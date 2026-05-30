import asyncio
import json
import logging
from typing import Callable, Awaitable
from collections import defaultdict

logger = logging.getLogger('vertha-ws')

WS_CONNECTIONS: dict[str, list] = defaultdict(list)


class WebSocketManager:
    def __init__(self):
        self._connections: dict[str, list] = defaultdict(list)
        self._lock = asyncio.Lock()
        self._handlers: dict[str, Callable[[dict], Awaitable[None]]] = {}

    async def connect(self, websocket, client_id: str = "default"):
        async with self._lock:
            self._connections[client_id].append(websocket)
            logger.info(f"Client connected: {client_id}, total: {len(self._connections[client_id])}")

    async def disconnect(self, websocket, client_id: str = "default"):
        async with self._lock:
            if websocket in self._connections[client_id]:
                self._connections[client_id].remove(websocket)
                logger.info(f"Client disconnected: {client_id}, remaining: {len(self._connections[client_id])}")

    async def send(self, message: dict, client_id: str = "default"):
        if not message:
            return

        data = json.dumps(message)
        dead = []

        async with self._lock:
            for ws in self._connections[client_id]:
                try:
                    await ws.send_text(data)
                except Exception as e:
                    logger.warning(f"Failed to send to client: {e}")
                    dead.append(ws)

            for ws in dead:
                if ws in self._connections[client_id]:
                    self._connections[client_id].remove(ws)

    async def broadcast(self, message: dict):
        if not message:
            return

        data = json.dumps(message)
        dead = []

        async with self._lock:
            for client_id, connections in self._connections.items():
                for ws in connections:
                    try:
                        await ws.send_text(data)
                    except Exception as e:
                        logger.warning(f"Failed to broadcast to {client_id}: {e}")
                        dead.append((client_id, ws))

            for client_id, ws in dead:
                if ws in self._connections[client_id]:
                    self._connections[client_id].remove(ws)

    def on(self, event_type: str, handler: Callable[[dict], Awaitable[None]]):
        self._handlers[event_type] = handler

    async def handle_message(self, message: dict):
        event_type = message.get("type")
        if event_type and event_type in self._handlers:
            await self._handlers[event_type](message)

    async def handle_incoming(self, data: str, client_id: str = "default"):
        try:
            message = json.loads(data)
            await self.handle_message(message)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON from {client_id}: {e}")

    @property
    def connection_count(self) -> int:
        return sum(len(conns) for conns in self._connections.values())


_ws_manager: WebSocketManager | None = None


def get_ws_manager() -> WebSocketManager:
    global _ws_manager
    if _ws_manager is None:
        _ws_manager = WebSocketManager()
    return _ws_manager