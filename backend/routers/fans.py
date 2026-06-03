"""
FanDock – /api/fans routes.
Fan curve editor + test endpoint.
"""

from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException

from ..routers.auth import get_current_user
from ..services.config_service import load_config, save_config
from ..services.fan_service import test_fan, read_fan_statuses
from ..models.schemas import FanCurve

router = APIRouter(prefix="/api/fans", tags=["fans"])


@router.get("/")
async def get_fans(_user: str = Depends(get_current_user)):
    cfg = load_config()
    return read_fan_statuses(cfg.fans)


@router.get("/{fan_id}/curve")
async def get_curve(fan_id: str, _user: str = Depends(get_current_user)):
    cfg = load_config()
    for fc in cfg.fans:
        if fc.fan_id == fan_id:
            return {"fan_id": fan_id, "points": [p.model_dump() for p in fc.curve]}
    raise HTTPException(404, f"Fan {fan_id} not found")


@router.put("/{fan_id}/curve")
async def update_curve(fan_id: str, curve: FanCurve, _user: str = Depends(get_current_user)):
    if len(curve.points) < 2:
        raise HTTPException(400, "Curve needs at least 2 points")
    cfg = load_config()
    for fc in cfg.fans:
        if fc.fan_id == fan_id:
            # Sort by temperature, enforce monotonic PWM values, force last point to 100%
            sorted_points = sorted(curve.points, key=lambda p: p.temp_c)
            # Ensure PWM values are monotonically increasing
            for i in range(1, len(sorted_points)):
                if sorted_points[i].pwm_pct < sorted_points[i-1].pwm_pct:
                    sorted_points[i].pwm_pct = sorted_points[i-1].pwm_pct
            # Last point always 100%
            sorted_points[-1].pwm_pct = 100.0
            fc.curve = sorted_points
            save_config(cfg)
            return {"ok": True}
    raise HTTPException(404, f"Fan {fan_id} not found")


@router.post("/{fan_id}/test")
async def test_fan_endpoint(fan_id: str, _user: str = Depends(get_current_user)):
    """Spin the fan at 100% for 6 seconds."""
    cfg = load_config()
    for fc in cfg.fans:
        if fc.fan_id == fan_id:
            await test_fan(fc.pwm_path, test_pwm=255, duration_seconds=6)
            return {"ok": True}
    raise HTTPException(404, f"Fan {fan_id} not found")
