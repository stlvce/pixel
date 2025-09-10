from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
import time


app = FastAPI()

# Разрешаем фронтенду подключаться
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение к базе
conn = sqlite3.connect("pixels.db", check_same_thread=False)
cursor = conn.cursor()
cursor.execute("""
CREATE TABLE IF NOT EXISTS pixels (
    x INTEGER,
    y INTEGER,
    color TEXT,
    user TEXT,
    timestamp REAL
)
""")
conn.commit()

clients = []


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    clients.append(websocket)

    try:
        while True:
            data = await websocket.receive_json()
            x, y, color, user = data["x"], data["y"], data["color"], data["user"]

            # Проверяем кулдаун (1 минута)
            cursor.execute(
                "SELECT timestamp FROM pixels WHERE user=? ORDER BY timestamp DESC LIMIT 1",
                (user,),
            )
            row = cursor.fetchone()
            now = time.time()
            if row and now - row[0] < 60:
                await websocket.send_json(
                    {"error": "Wait before placing another pixel!"}
                )
                continue

            # Сохраняем пиксель
            cursor.execute(
                "INSERT INTO pixels VALUES (?, ?, ?, ?, ?)", (x, y, color, user, now)
            )
            conn.commit()

            # Рассылаем всем клиентам обновление
            for client in clients:
                await client.send_json({"x": x, "y": y, "color": color})

    except WebSocketDisconnect:
        clients.remove(websocket)
