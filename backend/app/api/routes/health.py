"""Health check router."""
from fastapi import APIRouter
from datetime import datetime

router = APIRouter()

@router.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "NBA Analytics Platform",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
    }
