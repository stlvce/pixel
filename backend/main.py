from fastapi import (
    FastAPI,
    WebSocket,
    WebSocketDisconnect,
    Query,
    HTTPException,
    Depends,
    Request,
)
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from google.oauth2 import id_token
from google.auth.transport import requests
from jose import jwt
import time
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import uuid
import httpx

from config.database import SessionLocal, Base, get_db, engine
from config.settings import app_settings, google_settings
from models import User, Pixel
from ws_manager import ConnectionManager
from security import get_current_user, verify_jwt


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

manager = ConnectionManager()


@app.get("/auth/google/login")
def google_login():
    google_auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={google_settings.CLIENT_ID}"
        f"&redirect_uri={app_settings.API_URL}/auth/google/callback"
        "&response_type=code"
        "&scope=openid%20email%20profile"
    )
    return RedirectResponse(google_auth_url)


@app.get("/auth/google/callback")
async def google_callback(request: Request, code: str, db: Session = Depends(get_db)):
    print(code)
    token_url = "https://oauth2.googleapis.com/token"
    data = {
        "code": code,
        "client_id": google_settings.CLIENT_ID,
        "client_secret": google_settings.JWT_SECRET,
        "redirect_uri": f"{app_settings.API_URL}/auth/google/callback",
        "grant_type": "authorization_code",
    }

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(token_url, data=data)
        token_json = token_resp.json()

    id_token_str = token_json.get("id_token")
    if not id_token_str:
        raise HTTPException(status_code=400, detail="No ID token returned from Google")

    try:
        # Проверка Google ID токена
        idinfo = id_token.verify_oauth2_token(
            id_token_str, requests.Request(), google_settings.CLIENT_ID
        )
        google_id = idinfo["sub"]
        email = idinfo["email"]

        # Проверяем или создаем пользователя
        user = db.query(User).filter(User.google_id == google_id).first()
        if not user:
            user = User(google_id=google_id, email=email)
            db.add(user)
            db.commit()
            db.refresh(user)

        # Генерируем собственный JWT
        payload = {
            "sub": str(user.id),
            "email": email,
            "exp": int(
                (
                    datetime.utcnow() + timedelta(days=app_settings.JWT_EXPIRE_DAYS)
                ).timestamp()
            ),
        }
        my_token = jwt.encode(
            payload, app_settings.JWT_SECRET, algorithm=app_settings.JWT_ALG
        )

        # Редирект на фронт с токеном
        redirect_url = f"{app_settings.URL}?token={my_token}"
        return RedirectResponse(redirect_url)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google token")


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
    finally:
        db.close()


@app.get("/board")
def get_board(db: Session = Depends(get_db)):
    pixels = db.query(Pixel).join(User).all()
    print(pixels)
    return JSONResponse(
        content=[
            {"x": p.x, "y": p.y, "color": p.color, "user": p.user.email} for p in pixels
        ]
    )


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


@app.get("/me")
def get_me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return user
