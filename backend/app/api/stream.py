from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import StreamingResponse
from app.services.ytmusic_service import ytmusic_service
from pydantic import BaseModel
import httpx
from typing import Optional

router = APIRouter(prefix="/api/stream", tags=["stream"])

class StreamResponse(BaseModel):
    url: str

@router.get("/{video_id}", response_model=StreamResponse)
def get_stream(video_id: str):
    print(f"Resolving stream URL for: {video_id}")
    url = ytmusic_service.get_stream_url(video_id)
    if not url:
        raise HTTPException(status_code=404, detail="Stream URL not found")
    return {"url": url}


