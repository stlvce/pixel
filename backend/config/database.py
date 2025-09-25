from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

from .settings import db_settings


engine = create_async_engine(
    db_settings.db_url,
    echo=True,
    future=True,
    pool_size=10,
    max_overflow=20,
    pool_recycle=1800,  # каждые 30 мин переподключать
    pool_pre_ping=True,  # проверять соединение перед использованием
)

async_session = async_sessionmaker(
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
