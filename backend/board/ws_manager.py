from fastapi import WebSocket
from typing import Dict, List
from starlette.websockets import WebSocketDisconnect


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, session_id: str, websocket: WebSocket):
        """ Подключение к сокету """
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        self.active_connections[session_id].append(websocket)

    def disconnect(self, session_id: str, websocket: WebSocket):
        """ Отключение от сокета """
        if session_id in self.active_connections:
            self.active_connections[session_id].remove(websocket)

            # Если у пользователя нет соединений, удаляем его
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]

    async def _safe_send(self, session_id: str, websocket: WebSocket, message: dict):
        """ Отправка с обработкой ошибок и чисткой закрытых сокетов """
        try:
            await websocket.send_json(message)
        except (WebSocketDisconnect, RuntimeError):
            # Соединение уже закрыто — убираем его из списка
            self.disconnect(session_id, websocket)

    async def send_to_user(self, session_id: str, message: dict):
        """ Отправка сообщения только конкретному пользователю """
        if session_id in self.active_connections:
            for connection in list(self.active_connections[session_id]):
                await self._safe_send(session_id, connection, message)

    async def broadcast(self, message: dict):
        """ Отправка всем пользователям """
        for session_id, connections in list(self.active_connections.items()):
            for connection in list(connections):
                await self._safe_send(session_id, connection, message)
