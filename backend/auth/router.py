from fastapi import (
    APIRouter,
    HTTPException,
    Depends,
    Request,
)
from fastapi.responses import RedirectResponse, JSONResponse
from google.oauth2 import id_token
from google.auth.transport import requests
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, timedelta
import httpx
import hmac
import hashlib
import uuid

from config.database import get_db
from config.settings import app_settings, google_settings
from config.models import User
from config.schemas import UserStatus

from .security import get_current_user, verify_session


auth_router = APIRouter()


@auth_router.post("/session")
async def create_session():
    session_id = str(uuid.uuid4())
    sig = hmac.new(
        app_settings.JWT_SECRET.encode(), session_id.encode(), hashlib.sha256
    ).hexdigest()
    response = JSONResponse({"ok": True})
    response.set_cookie(
        "session_id",
        session_id,
        httponly=True,
        # secure=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 365,
    )
    response.set_cookie(
        "session_sig",
        sig,
        httponly=True,
        # secure=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 365,
    )

    return response


@auth_router.get("/session")
async def check_session(request: Request):
    # Берём cookie
    session_id = request.cookies.get("session_id")
    session_sig = request.cookies.get("session_sig")

    if not session_id or not session_sig:
        return JSONResponse({"exists": False})

    if not verify_session(session_id, session_sig):
        return JSONResponse({"exists": False})

    return JSONResponse({"exists": True})


@auth_router.get("/google/login")
def google_login():
    google_auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={google_settings.CLIENT_ID}"
        f"&redirect_uri={app_settings.API_URL}/auth/google/callback"
        "&response_type=code"
        "&scope=openid%20email%20profile"
    )
    return RedirectResponse(google_auth_url)


@auth_router.get("/google/callback")
async def google_callback(
    request: Request, code: str, db: AsyncSession = Depends(get_db)
):
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
        result = await db.execute(select(User).filter_by(google_id=google_id))
        user = result.scalar_one_or_none()

        if not user:
            user = User(google_id=google_id, email=email)
            db.add(user)
            await db.commit()
            await db.refresh(user)

        # Генерируем собственный JWT
        payload = {
            "sub": str(user.id),
            "email": email,
            "exp": int(
                (
                    datetime.utcnow() + timedelta(days=app_settings.JWT_EXPIRE_DAYS)
                ).timestamp()
            ),
            "status": user.status.value,
        }
        my_token = jwt.encode(
            payload, app_settings.JWT_SECRET, algorithm=app_settings.JWT_ALG
        )

        # Редирект на фронт с токеном
        redirect_url = f"{app_settings.URL}/mod?token={my_token}"
        return RedirectResponse(redirect_url)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google token")


@auth_router.post("/google/check")
async def google_recaptcha(
    request: Request,
    code: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.status == UserStatus.BANNED:
        raise HTTPException(status_code=400, detail="User is banned")

    data = {
        "code": code,
    }

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            f"https://www.google.com/recaptcha/api/siteverify?secret={google_settings.CAPTCHA_KEY}&response={code}",
            data=data,
        )
        token_json = token_resp.json()

    is_success = token_json.get("success")
    score = token_json.get("score")

    if not is_success:
        raise HTTPException(status_code=400, detail="Google reCAPTCHA failed")

    if score is not None and score < 0.5:
        user.status = UserStatus.BANNED
        db.add(user)
        await db.commit()
        await db.refresh(user)

        raise HTTPException(
            status_code=403, detail="User blocked due to low reCAPTCHA score"
        )
