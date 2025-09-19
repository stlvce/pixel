from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config.database import Base, engine
from auth.router import auth_router
from board.router import board_router
from user.router import user_router


app = FastAPI(
    docs_url="/api/docs",
    version="1.0.0",
    openapi_url="/api/openapi.json",
    swagger_ui_parameters={
        "operationsSorter": "method",
        "syntaxHighlight.theme": "obsidian",
    },
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(user_router, prefix="/api/user", tags=["user"])
app.include_router(board_router, prefix="/api/board", tags=["board"])


@app.on_event("startup")
async def on_startup():
    # создаём таблицы асинхронно
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
