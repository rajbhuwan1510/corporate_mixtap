from fastapi import APIRouter, Query, HTTPException
from app.services.ytmusic_service import ytmusic_service
from typing import List, Dict, Any

router = APIRouter(prefix="/api/search", tags=["search"])

@router.get("")
def search_all(q: str = Query(..., description="Search query")):
    try:
        results = ytmusic_service.search(q)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/songs")
def search_songs(q: str = Query(..., description="Search query")):
    try:
        results = ytmusic_service.search(q, filter="songs")
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
