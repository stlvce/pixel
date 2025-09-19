from fastapi import APIRouter, Depends

from config.schemas import UserOut
from config.models import User
from auth.security import get_current_user


user_router = APIRouter()


@user_router.get("", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user)):
    return user
