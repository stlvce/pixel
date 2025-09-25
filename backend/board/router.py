from fastapi import (
    APIRouter,
    WebSocket,
    WebSocketDisconnect,
    HTTPException,
    Depends,
)
import time
from sqlalchemy import delete, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Union

from config.database import async_session, get_db
from config.models import User, Pixel
from board.ws_manager import ConnectionManager
from auth.security import verify_jwt, get_current_user
from config.schemas import UserRole, PixelOut, PixelsDeleteIn, UserStatus, WSAction

board_router = APIRouter()

cooldowns = {}  # кулдаун для юзеров
manager = ConnectionManager()


COOLDOWN = 30


@board_router.get("", response_model=list[PixelOut])
async def get_board(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Pixel))
    pixels = result.scalars().all()

    return [
        {
            "id": p.id,
            "x": p.x,
            "y": p.y,
            "color": p.color,
        }
        for p in pixels
    ]


@board_router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    session_id = websocket.cookies.get("session_id")

    if not session_id:
        await websocket.close(code=1008)
        return

    token = websocket.cookies.get("token")

    # если есть токен — верифицируем
    user_id: Union[str, None] = None
    is_authenticated = False

    if token:
        try:
            user_data = verify_jwt(token)
            user_id = user_data["sub"]
            user_status = user_data["status"]
            is_authenticated = True

            if user_status == UserStatus.BANNED.value:
                raise HTTPException(status_code=403, detail="Banned user")

        except HTTPException:
            await websocket.close(code=1008)
            return

    # Подключаем к сокету
    await websocket.accept()
    await manager.connect(session_id, websocket)

    # Проверияем кулдаун
    last_time = cooldowns.get(session_id, 0)
    now = time.time()
    if now - last_time < COOLDOWN:
        await manager.send_to_user(
            session_id, {"type": "init", "coldown": COOLDOWN - round(now - last_time)}
        )
    else:
        await manager.send_to_user(session_id, {"type": "init", "coldown": 0})

    # Начинаем слушать события
    try:
        while True:
            data = await websocket.receive_json()

            # при записи пикселя — определяем идентификатор для кулдауна/логов, используем conn_key как идентификатор
            actor = session_id

            if data.get("type") == WSAction.CLEAR.value:
                await manager.broadcast(
                    {"type": WSAction.CLEAR.value, "payload": data["list"]}
                )
                continue

            x, y, color = data["x"], data["y"], data["color"]

            # Проверияем кулдаун
            last_time = cooldowns.get(actor, 0)
            now = time.time()
            if now - last_time < COOLDOWN:
                await manager.send_to_user(
                    session_id,
                    {"type": WSAction.ERROR.value, "payload": "Необходимо подождать"},
                )
                continue

            async with async_session() as db:
                pixel = Pixel(x=x, y=y, color=color, session_id=session_id)
                db.add(pixel)
                await db.commit()

            cooldowns[actor] = now

            await manager.broadcast({"type": "pixel", "x": x, "y": y, "color": color})

    except WebSocketDisconnect:
        manager.disconnect(session_id, websocket)


@board_router.delete("/delete_pixels")
async def delete_pixels(
    payload: PixelsDeleteIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Проверяем права
    if user.role != UserRole.ADMIN:
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
