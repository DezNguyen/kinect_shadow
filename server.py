import asyncio
import base64
import numpy as np
import cv2
import websockets
import pykinect_azure as pykinect

pykinect.initialize_libraries()
device = pykinect.start_device()

background = None
THRESHOLD = 80


async def handler(websocket):
    global background

    async def receive_commands():
        global background

        async for message in websocket:
            if message == "save_background":
                capture = device.update()
                ret, depth = capture.get_depth_image()

                if ret:
                    background = depth.copy()
                    print("Background saved")

    command_task = asyncio.create_task(receive_commands())

    try:
        while True:
            capture = device.update()
            ret, depth = capture.get_depth_image()

            if not ret:
                continue

            if background is None:
                mask = np.ones_like(depth, dtype=np.uint8) * 255
            else:
                valid = (depth > 0) & (background > 0)

                person = valid & (depth < background - THRESHOLD)

                mask = np.where(person, 0, 255).astype(np.uint8)

            _, buffer = cv2.imencode(".jpg", mask)
            jpg_as_text = base64.b64encode(buffer).decode("utf-8")

            await websocket.send(jpg_as_text)
            await asyncio.sleep(1 / 30)

    finally:
        command_task.cancel()


async def main():
    async with websockets.serve(handler, "localhost", 8765):
        print("Server läuft auf ws://localhost:8765")
        await asyncio.Future()


asyncio.run(main())