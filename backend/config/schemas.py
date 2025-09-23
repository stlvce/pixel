from enum import Enum
from pydantic import BaseModel


class UserRole(Enum):
    USER = 0
    ADMIN = 1


class UserStatus(Enum):
    ACTIVE = "active"
    BANNED = "banned"


class WSAction(Enum):
    CLEAR = "clear"
    PIXEL = "pixel"
    ERROR = "error"


class UserOut(BaseModel):
    id: int
    email: str
    role: UserRole
    status: str


class PixelOut(BaseModel):
    id: int
    x: int
    y: int
    color: str


class PixelIn(BaseModel):
    x: int
    y: int


class PixelsDeleteIn(BaseModel):
    start: PixelIn
    end: PixelIn
