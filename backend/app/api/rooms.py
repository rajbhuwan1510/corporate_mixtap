from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.services.room_service import room_service

router = APIRouter(prefix="/api/rooms", tags=["rooms"])

class CreateRoomRequest(BaseModel):
    creatorId: str
    creatorName: str
    currentSong: Optional[Dict[str, Any]] = None
    position: float = 0.0
    isPlaying: bool = False

@router.post("/create")
def create_room(req: CreateRoomRequest):
    try:
        room = room_service.create_room(
            creator_id=req.creatorId,
            creator_name=req.creatorName,
            initial_song=req.currentSong,
            initial_position=req.position,
            is_playing=req.isPlaying
        )
        return room
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{room_id}")
def get_room_details(room_id: str):
    room = room_service.get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room
