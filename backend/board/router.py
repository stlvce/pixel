from fastapi import (
    APIRouter,
    WebSocket,
    WebSocketDisconnect,
    Query,
    HTTPException,
    Depends,
)
import time
from sqlalchemy import delete, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import uuid
from typing import Union

from config.database import async_session, get_db
from config.models import User, Pixel
from board.ws_manager import ConnectionManager
from auth.security import verify_jwt, get_current_user
from config.schemas import UserRole, PixelOut, PixelsDeleteIn, UserStatus

board_router = APIRouter()

# кулдаун для юзеров
cooldowns = {}


manager = ConnectionManager()


@board_router.get("", response_model=list[PixelOut])
async def get_board(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Pixel, User).join(User, Pixel.user_id == User.id))
    pixels = result.all()
    return [
        {
            "id": p.Pixel.id,
            "x": p.Pixel.x,
            "y": p.Pixel.y,
            "color": p.Pixel.color,
        }
        for p in pixels
    ]


@board_router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket, token: str = Query(None), anon_id: str = Query(None)
):
    # если есть токен — верифицируем
    user_id: Union[str, None] = None
    is_authenticated = False

    if token:
        try:
            user_data = verify_jwt(token)
            user_id = user_data["sub"]
            is_authenticated = True
            user_status = user_data["status"]

            if user_status == UserStatus.BANNED.value:
                raise HTTPException(status_code=403, detail="Banned user")
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

    last_time = cooldowns.get(conn_key, 0)
    now = time.time()
    if now - last_time < 60:
        await manager.send_to_user(
            conn_key, {"type": "init", "coldown": 60 - round(now - last_time)}
        )
    else:
        await manager.send_to_user(conn_key, {"type": "init", "coldown": 0})

    db: AsyncSession = async_session()
    try:
        while True:
            data = await websocket.receive_json()

            # при записи пикселя — определяем идентификатор для кулдауна/логов
            actor = conn_key  # используем conn_key как идентификатор

            if data.get("type") == "clear":
                await manager.broadcast({"type": "clear", "list": data["list"]})
                continue

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
            if is_authenticated and user_id:
                pixel = Pixel(x=x, y=y, color=color, user_id=int(user_id))
            else:
                pixel = Pixel(
                    x=x, y=y, color=color, anon_id=anon_id
                )  # добавь поле anon_id в модели, если нужно
            db.add(pixel)
            await db.commit()

            cooldowns[actor] = now

            await manager.broadcast(
                {"type": "pixel", "x": x, "y": y, "color": color, "actor": conn_key}
            )
    except WebSocketDisconnect:
        manager.disconnect(conn_key, websocket)


@board_router.delete("/delete_pixels")
async def delete_pixels(
    payload: PixelsDeleteIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Проверяем права
    if user.is_admin != UserRole.ADMIN.value:
        raise HTTPException(status_code=403, detail="Not enough rights")

    # Проверяем наличие start и end
    if not payload.start or not payload.end:
        raise HTTPException(
            status_code=400, detail="Start and end coordinates required"
        )

    x_start, y_start = payload.start.x, payload.start.y
    x_end, y_end = payload.end.x, payload.end.y

    # Убедимся, что координаты корректны
    if x_start > x_end or y_start > y_end:
        raise HTTPException(status_code=400, detail="Invalid coordinate range")

    # Получаем пиксели, которые будут удалены
    result = await db.execute(
        select(Pixel).where(
            and_(
                Pixel.x >= x_start,
                Pixel.x <= x_end,
                Pixel.y >= y_start,
                Pixel.y <= y_end,
            )
        )
    )
    pixels_to_delete = result.scalars().all()

    if not pixels_to_delete:
        return []

    # Формируем список для возвращения
    deleted_pixels = [
        {"x": p.x, "y": p.y, "color": p.color, "id": p.id} for p in pixels_to_delete
    ]

    # Удаляем пиксели из БД
    stmt = delete(Pixel).where(
        and_(Pixel.x >= x_start, Pixel.x <= x_end, Pixel.y >= y_start, Pixel.y <= y_end)
    )
    await db.execute(stmt)
    await db.commit()

    return deleted_pixels
