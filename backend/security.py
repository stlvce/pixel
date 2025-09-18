from fastapi import HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from jose import jwt, JWTError, ExpiredSignatureError

from config.settings import app_settings
from models import User
from config.database import get_db


def verify_jwt(token: str):
    try:
        payload = jwt.decode(
            token, app_settings.JWT_SECRET, algorithms=[app_settings.JWT_ALG]
        )
        return payload
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid JWT")


async def get_current_user(token: str = Query(...), db: AsyncSession = Depends(get_db)):
    try:
        # Проверяем токена
        payload = verify_jwt(token)

        # Получение пользователя
        result = await db.execute(select(User).filter_by(id=int(payload["sub"])))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
