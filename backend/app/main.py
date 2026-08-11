from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from app.api import search, stream, rooms
from app.api.ws_manager import manager
from app.services.room_service import room_service
import json
import time
import asyncio

app = FastAPI(title="Local YouTube Music Player API")

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In a real app, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search.router)
app.include_router(stream.router)
app.include_router(rooms.router)

@app.on_event("startup")
async def startup_event():
    async def cleanup_loop():
        while True:
            try:
                room_service.clean_expired_rooms()
            except Exception as e:
                print(f"Error in room cleanup: {e}")
            await asyncio.sleep(10) # check every 10 seconds
    asyncio.create_task(cleanup_loop())

@app.get("/")
def read_root():
    return {"message": "Local YouTube Music Player API is running"}

@app.websocket("/api/ws/{room_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    room_id: str,
    userId: str = Query(...),
    userName: str = Query(...)
):
    await manager.connect(room_id, userId, websocket)
    
    # Add user to room state
    room = room_service.join_room(room_id, userId, userName)
    if not room:
        await websocket.close(code=4004)
        manager.disconnect(room_id, userId, websocket)
        return

    # Broadcast that user joined
    await manager.broadcast_to_room(room_id, {
        "type": "ROOM_USER_JOINED",
        "userId": userId,
        "userName": userName,
        "room": room.model_dump()
    })
    
    # Send initial room state to the joining user
    await websocket.send_text(json.dumps({
        "type": "ROOM_STATE",
        "room": room.model_dump(),
        "serverTime": int(time.time() * 1000)
    }))

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            msg_type = message.get("type")
            
            # Keep user active
            room_service.update_user_activity(room_id, userId)
            
            updated_room = None
            
            if msg_type == "ROOM_PLAY":
                updated_room = room_service.update_play(room_id)
            elif msg_type == "ROOM_PAUSE":
                updated_room = room_service.update_pause(room_id)
            elif msg_type == "ROOM_SEEK":
                position = message.get("position", 0.0)
                updated_room = room_service.update_seek(room_id, position)
            elif msg_type == "ROOM_NEXT":
                updated_room = room_service.next_track(room_id)
            elif msg_type == "ROOM_PREVIOUS":
                updated_room = room_service.prev_track(room_id)
            elif msg_type == "ROOM_TRACK_CHANGED":
                song = message.get("song")
                if song:
                    updated_room = room_service.update_track(room_id, song)
            elif msg_type == "ROOM_SYNC_REQUEST":
                current_room = room_service.get_room(room_id)
                if current_room:
                    # Send response back to that user
                    await websocket.send_text(json.dumps({
                        "type": "ROOM_SYNC_RESPONSE",
                        "roomId": room_id,
                        "trackId": current_room.currentTrackId,
                        "isPlaying": current_room.playback.isPlaying,
                        "position": room_service.calculate_current_position(current_room),
                        "serverTime": int(time.time() * 1000),
                        "version": current_room.version,
                        "room": current_room.model_dump()
                    }))
                continue
                
            if updated_room:
                # Broadcast the updated state to all members
                await manager.broadcast_to_room(room_id, {
                    "type": "ROOM_STATE",
                    "room": updated_room.model_dump(),
                    "serverTime": int(time.time() * 1000)
                })

    except WebSocketDisconnect:
        # User disconnected
        manager.disconnect(room_id, userId, websocket)
        updated_room = room_service.leave_room(room_id, userId)
        
        # Broadcast that user left
        await manager.broadcast_to_room(room_id, {
            "type": "ROOM_USER_LEFT",
            "userId": userId,
            "userName": userName,
            "room": updated_room.model_dump() if updated_room else None
        })
