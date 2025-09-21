from datetime import datetime
from sqlalchemy import Integer, String, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship, Mapped, mapped_column

from config.database import Base
from config.schemas import UserStatus


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    google_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    is_admin: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus, name="user_status_enum"),
        default=UserStatus.ACTIVE,
        nullable=False,
    )

    pixels: Mapped[list["Pixel"]] = relationship(back_populates="user")


class Pixel(Base):
    __tablename__ = "pixels"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    x: Mapped[int] = mapped_column(index=True)
    y: Mapped[int] = mapped_column(index=True)
    color: Mapped[str] = mapped_column(String)
    placed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    user: Mapped["User"] = relationship(back_populates="pixels")
