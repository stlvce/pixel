from locust import HttpUser, task, between, events
import asyncio
import websockets
import random
import json

TARGET_HTTP = "http://pixeluks.ru"
AUTH_PATH = "/api/auth/session"
BOARD_PATH = "/api/board"
WS_PATH = "/api/board/ws"
BOARD_WIDTH = 200
BOARD_HEIGHT = 200

# количество пикселей, которые ставит один пользователь за один раз
PIXELS_PER_RUN = 1


class PixelUser(HttpUser):
    wait_time = between(0.5, 2)  # пауза между задачами
    host = TARGET_HTTP

    def on_start(self):
        """Получаем session_id при старте каждого пользователя"""
        import requests

        self.session = requests.Session()
        resp = self.session.post(f"{TARGET_HTTP}{AUTH_PATH}")
        # Locust умеет измерять события вручную
        if resp.status_code != 200:
            print(f"[WARN] auth failed with {resp.status_code}")

    @task(1)
    def set_pixel_ws(self):
        """Асинхронно открываем WS и ставим пиксель"""
        cookies = self.session.cookies.get_dict()
        session_cookie = cookies.get("session_id", "")

        async def ws_task():
            ws_scheme = "ws" if TARGET_HTTP.startswith("http://") else "wss"
            ws_url = f"{ws_scheme}://{TARGET_HTTP.split('://')[1]}{WS_PATH}"
            try:
                async with websockets.connect(
                    ws_url, extra_headers={"Cookie": f"session_id={session_cookie}"}
                ) as ws:
                    for _ in range(PIXELS_PER_RUN):
                        x = random.randint(0, BOARD_WIDTH)
                        y = random.randint(0, BOARD_HEIGHT)
                        color = "#{:06x}".format(random.randint(0, 0xFFFFFF))
                        msg = {
                            "x": x,
                            "y": y,
                            "color": color,
                        }
                        await ws.send(json.dumps(msg))

                        events.request.fire(
                            request_type="WS",
                            name="set_pixel",
                            response_time=0,
                            response_length=0,
                        )
                        await asyncio.sleep(30)
            except Exception as e:
                # Можно логировать ошибки

                events.worker_report.fire(
                    request_type="WS", name="set_pixel", response_time=0
                )
            else:
                events.request.fire(
                    request_type="WS",
                    name="set_pixel",
                    response_time=0,
                    response_length=0,
                )

        asyncio.run(ws_task())

    @task(1)
    def get_board(self):
        """GET /api/board через HTTP"""
        with self.client.get(
            BOARD_PATH, name="/api/board", catch_response=True
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"status {resp.status_code}")
