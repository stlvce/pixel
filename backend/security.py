from fastapi import HTTPException, Depends, Query
from sqlalchemy.orm import Session
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


def get_current_user(token: str = Query(...), db: Session = Depends(get_db)):
    try:
        payload = verify_jwt(token)
        user = db.query(User).filter(User.id == payload["sub"]).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
