from fastapi import WebSocket
from typing import Dict, List, Set, Any
import json
import time

class ConnectionManager:
    def __init__(self):
        # Maps room_id -> list of (user_id, WebSocket)
        self.active_connections: Dict[str, List[tuple[str, WebSocket]]] = {}

    async def connect(self, room_id: str, user_id: str, websocket: WebSocket):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append((user_id, websocket))

    def disconnect(self, room_id: str, user_id: str, websocket: WebSocket):
        if room_id in self.active_connections:
            self.active_connections[room_id] = [
                conn for conn in self.active_connections[room_id]
                if conn[1] != websocket
            ]
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

    async def broadcast_to_room(self, room_id: str, message: dict):
        if room_id in self.active_connections:
            payload = json.dumps(message)
            for _, websocket in self.active_connections[room_id]:
                try:
                    await websocket.send_text(payload)
                except Exception:
                    pass

    async def send_to_user(self, room_id: str, user_id: str, message: dict):
        if room_id in self.active_connections:
            payload = json.dumps(message)
            for uid, websocket in self.active_connections[room_id]:
                if uid == user_id:
                    try:
                        await websocket.send_text(payload)
                    except Exception:
                        pass

manager = ConnectionManager()
