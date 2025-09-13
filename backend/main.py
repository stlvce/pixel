from fastapi import (
    FastAPI,
    WebSocket,
    WebSocketDisconnect,
    Query,
    HTTPException,
    Depends,
)
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from google.oauth2 import id_token
from google.auth.transport import requests
from jose import jwt, JWTError, ExpiredSignatureError
import time
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Dict, List
import uuid

from database import SessionLocal, Base, get_db, engine
from models import User, Pixel
from schemas import TokenRequest


app = FastAPI(
    docs_url="/api/docs",
    version="1.0.0",
    openapi_url="/api/openapi.json",
    swagger_ui_parameters={
        "operationsSorter": "method",
        "syntaxHighlight.theme": "obsidian",
    },
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# размеры поля
WIDTH = 200
HEIGHT = 200


# список подключённых клиентов
clients = set()

# кулдаун для юзеров
cooldowns = {}


Base.metadata.create_all(bind=engine)

GOOGLE_CLIENT_ID = (
    "1093433149059-7109nsgh75hd2gu2rtac0s620hrsgeto.apps.googleusercontent.com"
)
JWT_SECRET = "4ee29ef54c58849ea0cddd45361a613977f89be0287fbb68293317a0499ebd42"
JWT_ALG = "HS256"


@app.post("/auth/google")
async def auth_google(data: TokenRequest, db: Session = Depends(get_db)):
    try:
        idinfo = id_token.verify_oauth2_token(
            data.token, requests.Request(), GOOGLE_CLIENT_ID
        )
        google_id = idinfo["sub"]
        email = idinfo["email"]

        # проверяем или создаем пользователя
        user = db.query(User).filter(User.google_id == google_id).first()
        if not user:
            user = User(google_id=google_id, email=email)
            db.add(user)
            db.commit()
            db.refresh(user)

        # генерируем JWT
        payload = {
            "sub": str(user.id),
            "email": email,
            "exp": int((datetime.utcnow() + timedelta(days=7)).timestamp()),
        }

        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

        return {"access_token": token}
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Google token")


def verify_jwt(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        return payload
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid JWT")


@app.get("/test-token")
async def test_token(token: str):
    try:
        payload = verify_jwt(token)
        return {"email": payload["email"]}
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket):
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_to_user(self, user_id: int, message: dict):
        """Отправка сообщения только конкретному пользователю"""
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                await connection.send_json(message)

    async def broadcast(self, message: dict):
        """Отправка всем пользователям"""
        for connections in self.active_connections.values():
            for connection in connections:
                await connection.send_json(message)


manager = ConnectionManager()


# @app.websocket("/ws")
# async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
#     try:
#         user_data = verify_jwt(token)
#         user_id = user_data["sub"]
#     except HTTPException:
#         await websocket.close(code=1008)
#         return

#     await websocket.accept()
#     print(f"✅ Connected: {user_data['email']}")

#     db: Session = SessionLocal()

#     try:
#         while True:
#             data = await websocket.receive_json()
#             x, y, color = data["x"], data["y"], data["color"]

#             # кулдаун 60 секунд
#             last_time = cooldowns.get(user_id, 0)
#             now = time.time()
#             if now - last_time < 60:
#                 await websocket.send_json(
#                     {
#                         "type": "error",
#                         "error": "Подожди 60 сек перед следующим пикселем",
#                     }
#                 )
#                 continue

#             # сохраняем пиксель
#             pixel = Pixel(x=x, y=y, color=color, user_id=user_id)
#             db.add(pixel)
#             db.commit()

#             cooldowns[user_id] = now

#             # рассылаем всем (можно добавить менеджер подключений)
#             await websocket.send_json(
#                 {
#                     "type": "pixel",
#                     "x": x,
#                     "y": y,
#                     "color": color,
#                     "user": user_data["email"],
#                 }
#             )

#     except WebSocketDisconnect:
#         print(f"❌ Disconnected: {user_data['email']}")
#     finally:
#         db.close()


@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket, token: str = Query(None), anon_id: str = Query(None)
):
    # если есть токен — верифицируем
    user_id = None
    user_email = None
    is_authenticated = False

    if token:
        try:
            user_data = verify_jwt(token)
            user_id = user_data["sub"]
            user_email = user_data.get("email")
            is_authenticated = True
        except HTTPException:
            await websocket.close(code=1008)
            return
    else:
        # если нет anon_id — сгенерируем (и клиенту его вернём)
        if not anon_id:
            anon_id = str(uuid.uuid4())
            # мы не можем установить cookie здесь, но можем отправить клиенту сообщение с anon_id после accept
        # anon_id используется как строковый идентификатор для анонимов

    await websocket.accept()

    # если мы сгенерировали anon_id server-side, сообщаем клиенту
    if not token and not (
        Query and anon_id
    ):  # упрощённый пример; лучше всегда отправлять back the anon_id
        await websocket.send_json({"type": "assign_anon", "anon_id": anon_id})

    # регистрируем соединение в менеджере под ключом (auth user_id или "anon:"+anon_id)
    conn_key = f"user:{user_id}" if is_authenticated else f"anon:{anon_id}"
    await manager.connect(conn_key, websocket)

    db: Session = SessionLocal()
    try:
        while True:
            data = await websocket.receive_json()
            # при записи пикселя — определяем идентификатор для кулдауна/логов
            actor = conn_key  # используем conn_key как идентификатор

            x, y, color = data["x"], data["y"], data["color"]

            # кулдаун — теперь учитываем actor (anon or user)
            last_time = cooldowns.get(actor, 0)
            now = time.time()
            if now - last_time < 60:
                await manager.send_to_user(
                    conn_key, {"type": "error", "error": "Подожди"}
                )
                continue

            # если аноним — можно не сохранять user_id, либо сохранять anon_id в Pixel. Например:
            if is_authenticated:
                pixel = Pixel(x=x, y=y, color=color, user_id=user_id)
            else:
                pixel = Pixel(
                    x=x, y=y, color=color, anon_id=anon_id
                )  # добавь поле anon_id в модели, если нужно
            db.add(pixel)
            db.commit()

            cooldowns[actor] = now

            await manager.broadcast(
                {"type": "pixel", "x": x, "y": y, "color": color, "actor": conn_key}
            )
    except WebSocketDisconnect:
        manager.disconnect(conn_key, websocket)


@app.get("/board")
def get_board(db: Session = Depends(get_db)):
    pixels = db.query(Pixel).join(User).all()
    print(pixels)
    return JSONResponse(
        content=[
            {"x": p.x, "y": p.y, "color": p.color, "user": p.user.email} for p in pixels
        ]
    )


def get_current_user(token: str = Query(...), db: Session = Depends(get_db)):
    try:
        payload = verify_jwt(token)
        user = db.query(User).filter(User.id == payload["sub"]).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


@app.delete("/moderation/delete_pixel")
def delete_pixel(
    x: int,
    y: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.is_admin != 1:
        raise HTTPException(status_code=403, detail="Not enough rights")

    pixel = db.query(Pixel).filter(Pixel.x == x, Pixel.y == y).first()
    if not pixel:
        raise HTTPException(status_code=404, detail="Pixel not found")

    db.delete(pixel)
    db.commit()

    return {"status": "deleted", "x": x, "y": y}
