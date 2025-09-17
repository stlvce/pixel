from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncSession,
)
from sqlalchemy.orm import sessionmaker, declarative_base

from .settings import db_settings


engine = create_async_engine(db_settings.db_url, echo=True, future=True)

async_session = sessionmaker(
    bind=engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


Base = declarative_base()


# Dependency для FastAPI
async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
