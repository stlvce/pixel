from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from config.database import Base, engine
from config.settings import app_settings
from auth.router import auth_router
from board.router import board_router
from user.router import user_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # создаём таблицы асинхронно
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield


app = FastAPI(
    docs_url="/api/docs",
    version="1.0.0",
    openapi_url="/api/openapi.json",
    swagger_ui_parameters={
        "operationsSorter": "method",
        "syntaxHighlight.theme": "obsidian",
    },
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[app_settings.CORS_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def check_origin(request: Request, call_next):
    if (app_settings.CORS_ORIGIN == "*"):
        return await call_next(request)

    origin = request.headers.get("origin")
    referer = request.headers.get("referer")

    if origin and origin != app_settings.CORS_ORIGIN:
        raise HTTPException(status_code=403, detail="Forbidden origin")
    if referer and not referer.startswith(app_settings.CORS_ORIGIN):
        raise HTTPException(status_code=403, detail="Forbidden referer")

    return await call_next(request)

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(user_router, prefix="/api/user", tags=["user"])
app.include_router(board_router, prefix="/api/board", tags=["board"])
