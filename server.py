import asyncio
import base64
import cv2
import numpy as np
import websockets
import pykinect_azure as pykinect
import json
import re
from pathlib import Path


BASE_DIRECTORY = Path(__file__).resolve().parent
GHOST_DIRECTORY = BASE_DIRECTORY / "ghosts"
GHOST_DIRECTORY.mkdir(parents=True, exist_ok=True)

pykinect.initialize_libraries()

device_config = pykinect.default_configuration
device_config.color_resolution = pykinect.K4A_COLOR_RESOLUTION_OFF
device_config.depth_resolution = pykinect.K4A_DEPTH_MODE_WFOV_UNBINNED


#print([x for x in dir(pykinect) if "DEPTH_MODE" in x])
#print([x for x in dir(pykinect) if "COLOR_RESOLUTION" in x])

device = pykinect.start_device(config=device_config)


calibration = device.get_calibration(
    depth_mode=device_config.depth_resolution,
    color_resolution=device_config.color_resolution)
params = calibration.depth_params


MIN_DEPTH = 1
MAX_DEPTH = 2100



#Websocket handler
async def send_kinect_frames(websocket):
    while True:
        capture = device.update()

        ret, depth = capture.get_depth_image()

        if not ret or depth is None:
            await asyncio.sleep(0.01)
            continue

        mask = np.where(
            (depth > MIN_DEPTH) & (depth < MAX_DEPTH),
            0,
            255
        ).astype(np.uint8)

        mask = remove_fisheye(mask, strength=0.22)

        success, buffer = cv2.imencode(".jpg", mask)

        if not success:
            print("Kinect-Bild konnte nicht kodiert werden")
            continue

        jpg_as_text = base64.b64encode(
            buffer
        ).decode("utf-8")

        await websocket.send(jpg_as_text)

        await asyncio.sleep(1 / 30)

async def receive_browser_messages(websocket):
    async for message in websocket:
        if not isinstance(message, str):
            continue

        try:
            handle_ghost_message(message)
        except Exception as error:
            print(
                "Fehler beim Speichern eines Geistes:",
                error
            )


async def handler(websocket):
    send_task = asyncio.create_task(
        send_kinect_frames(websocket)
    )

    receive_task = asyncio.create_task(
        receive_browser_messages(websocket)
    )

    try:
        await asyncio.gather(
            send_task,
            receive_task
        )

    except websockets.ConnectionClosed:
        print("Browser-Verbindung geschlossen")

    except Exception as error:
        print("WebSocket-Fehler:", error)

    finally:
        send_task.cancel()
        receive_task.cancel()

        await asyncio.gather(
            send_task,
            receive_task,
            return_exceptions=True
        )
def remove_fisheye(img, strength=0.25):
    h, w = img.shape[:2]
    y, x = np.indices((h, w), dtype=np.float32)

    cx = w / 2
    cy = h / 2

    x_norm = (x - cx) / cx
    y_norm = (y - cy) / cy

    r2 = x_norm * x_norm + y_norm * y_norm

    factor = 1 + strength * r2

    map_x = cx + (x - cx) / factor
    map_y = cy + (y - cy) / factor

    return cv2.remap(img, map_x, map_y, cv2.INTER_NEAREST)

def safe_ghost_id(ghost_id: str) -> str:
    """
    Entfernt unerlaubte Zeichen aus der Ghost-ID.
    Dadurch kann JavaScript keine beliebigen Dateipfade erzeugen.
    """
    cleaned = re.sub(r"[^a-zA-Z0-9_-]", "", ghost_id)

    if not cleaned:
        raise ValueError("Ungültige Ghost-ID")

    return cleaned

def handle_ghost_message(message: str) -> None:
    try:
        data = json.loads(message)
    except json.JSONDecodeError:
        print("Unbekannte Nachricht vom Browser")
        return

    message_type = data.get("type")

    if message_type == "ghost_start":
        ghost_id = safe_ghost_id(data["ghostId"])
        ghost_folder = GHOST_DIRECTORY / ghost_id

        ghost_folder.mkdir(parents=True, exist_ok=True)

        metadata = {
            "id": ghost_id,
            "createdAt": data.get("createdAt"),
            "frameCount": data.get("frameCount", 0),
            "recordInterval": data.get("recordInterval", 1),
            "complete": False
        }

        metadata_path = ghost_folder / "metadata.json"

        metadata_path.write_text(
            json.dumps(metadata, indent=2),
            encoding="utf-8"
        )

        print(f"Speicherung gestartet: {ghost_id}")

    elif message_type == "ghost_frame":
        ghost_id = safe_ghost_id(data["ghostId"])
        frame_index = int(data["frameIndex"])
        base64_data = data["data"]

        ghost_folder = GHOST_DIRECTORY / ghost_id
        ghost_folder.mkdir(parents=True, exist_ok=True)

        image_bytes = base64.b64decode(
            base64_data,
            validate=True
        )

        frame_path = (
            ghost_folder /
            f"frame_{frame_index:03d}.png"
        )

        frame_path.write_bytes(image_bytes)

    elif message_type == "ghost_end":
        ghost_id = safe_ghost_id(data["ghostId"])
        ghost_folder = GHOST_DIRECTORY / ghost_id
        metadata_path = ghost_folder / "metadata.json"

        if metadata_path.exists():
            metadata = json.loads(
                metadata_path.read_text(
                    encoding="utf-8"
                )
            )

            metadata["complete"] = True

            metadata_path.write_text(
                json.dumps(metadata, indent=2),
                encoding="utf-8"
            )

        print(f"Geist vollständig gespeichert: {ghost_id}")

#server starten
async def main():
    async with websockets.serve(
            handler,
            "localhost",
            8765,
            max_size=10 * 1024 * 1024
    ):
        print("WebSocket laeuft auf ws://localhost:8765")
        await asyncio.Future()

asyncio.run(main())
