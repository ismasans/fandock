"""
FanDock – /api/dashboard routes.
Returns the latest snapshot from the control loop cache.
"""

from __future__ import annotations
from fastapi import APIRouter, Depends

from ..routers.auth import get_current_user
from ..services.control_loop import get_last_snapshot

from ..services.control_loop import get_last_snapshot, force_tick

from ..services import control_loop as _cl

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/snapshot")
async def snapshot(_user: str = Depends(get_current_user)):
    """Return the most recent disk temperatures + fan statuses."""
    return await get_last_snapshot()


@router.post("/refresh")
async def refresh(_user: str = Depends(get_current_user)):
    await force_tick()
    return await get_last_snapshot()


@router.get("/test-status")
async def test_status(_user: str = Depends(get_current_user)):
    return {"test_in_progress": _cl._test_in_progress}