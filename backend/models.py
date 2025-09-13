from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    google_id = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    is_admin = Column(Integer, default=0)  # 0 - обычный, 1 - админ

    pixels = relationship("Pixel", back_populates="user")


class Pixel(Base):
    __tablename__ = "pixels"

    id = Column(Integer, primary_key=True, index=True)
    x = Column(Integer, index=True)
    y = Column(Integer, index=True)
    color = Column(String)
    placed_at = Column(DateTime, default=datetime.utcnow)

    user_id = Column(Integer, ForeignKey("users.id"))
    user = relationship("User", back_populates="pixels")
