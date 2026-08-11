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
    url = ytmusic_service.get_stream_url(video_id)
    if not url:
        raise HTTPException(status_code=404, detail="Stream URL not found")
    return {"url": url}

@router.get("/play/{video_id}")
async def play_stream(video_id: str, range: Optional[str] = Header(None)):
    url = ytmusic_service.get_stream_url(video_id)
    if not url:
        raise HTTPException(status_code=404, detail="Stream URL not found")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    if range:
        headers["Range"] = range
        
    client = httpx.AsyncClient()
    try:
        req = client.build_request("GET", url, headers=headers)
        resp = await client.send(req, stream=True, follow_redirects=True)
        
        if resp.status_code not in (200, 206):
            await resp.aclose()
            await client.aclose()
            raise HTTPException(status_code=resp.status_code, detail="Failed to fetch stream from YouTube")
            
        response_headers = {}
        if "Content-Range" in resp.headers:
            response_headers["Content-Range"] = resp.headers["Content-Range"]
        if "Accept-Ranges" in resp.headers:
            response_headers["Accept-Ranges"] = resp.headers["Accept-Ranges"]
        if "Content-Length" in resp.headers:
            response_headers["Content-Length"] = resp.headers["Content-Length"]
            
        async def stream_generator():
            try:
                async for chunk in resp.aiter_bytes(chunk_size=1024 * 64):
                    yield chunk
            finally:
                await resp.aclose()
                await client.aclose()

        return StreamingResponse(
            stream_generator(),
            status_code=resp.status_code,
            headers=response_headers,
            media_type=resp.headers.get("Content-Type", "audio/webm")
        )
    except Exception as e:
        await client.aclose()
        raise HTTPException(status_code=500, detail=str(e))

