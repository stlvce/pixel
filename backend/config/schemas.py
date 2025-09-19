from enum import Enum
from pydantic import BaseModel


class UserRole(Enum):
    USER = 0
    ADMIN = 1


class UserOut(BaseModel):
    id: int
    email: str
    is_admin: int


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
