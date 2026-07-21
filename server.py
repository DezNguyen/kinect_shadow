import asyncio
import base64
import cv2
import numpy as np
import websockets
import pykinect_azure as pykinect

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
async def handler(websocket):
    while True:
        capture = device.update()

        #depth-bild
        ret, depth = capture.get_depth_image()

        mask = np.where(
            (depth > MIN_DEPTH) & (depth < MAX_DEPTH),
            0,
            255
        ).astype(np.uint8)

        mask = remove_fisheye(mask, strength=0.22)



        #jpg erzeugen (rohes bild ist gross)
        _, buffer = cv2.imencode('.jpg', mask)

        #bild zu text
        jpg_as_text = base64.b64encode(buffer).decode("utf-8")

        # an browser senden
        await websocket.send(jpg_as_text)

        #fps limitieren
        await asyncio.sleep(1 / 30)

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


#server starten
async def main():
    async with websockets.serve(handler, "localhost", 8765):
        print("WebSocket laeuft auf ws://localhost:8765")
        await asyncio.Future()

asyncio.run(main())
