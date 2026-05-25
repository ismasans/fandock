"""
FanDock – /api/settings routes.
Hardware scan, friendly names, fan config, global toggles.
"""

from __future__ import annotations
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, Literal

from ..routers.auth import get_current_user
from ..services.config_service import load_config, save_config
from ..services.smart_service import scan_disks
from ..services.fan_service import scan_fans
from ..models.schemas import HardwareScanResult, FanConfig, CurvePoint

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/")
async def get_settings(_user: str = Depends(get_current_user)):
    cfg = load_config()
    return {
        "fans": [fc.model_dump() for fc in cfg.fans],
        "disk_friendly_names": cfg.disk_friendly_names,
        "temp_unit": cfg.temp_unit,
        "monitor_enabled": cfg.monitor_enabled,
        "control_enabled": cfg.control_enabled,
        "poll_interval_seconds": cfg.poll_interval_seconds,
    }


@router.post("/scan")
async def hardware_scan(_user: str = Depends(get_current_user)) -> HardwareScanResult:
    """Auto-detect disks and fans; merge into config without overwriting existing settings."""
    cfg = load_config()

    disks = await scan_disks()
    fans = scan_fans()

    # Merge fans: add new ones, preserve existing config
    existing_ids = {fc.fan_id for fc in cfg.fans}
    for fs in fans:
        if fs.fan_id not in existing_ids:
            cfg.fans.append(FanConfig(
                fan_id=fs.fan_id,
                pwm_path=fs.pwm_path,
                rpm_path=fs.rpm_path,
                # Default curve: 30°C→20% … 55°C→100%
                curve=[
                    CurvePoint(temp_c=30, pwm_pct=20),
                    CurvePoint(temp_c=40, pwm_pct=40),
                    CurvePoint(temp_c=50, pwm_pct=70),
                    CurvePoint(temp_c=55, pwm_pct=100),
                ],
            ))

    save_config(cfg)
    from ..services.control_loop import _known_disks as _ckd
    _ckd.clear()
    _ckd.extend(disks)
    return HardwareScanResult(disks=disks, fans=fans)


class FriendlyNamesPayload(BaseModel):
    names: dict[str, str]  # {"/dev/sdb": "IronWolf 1", ...}

@router.put("/friendly-names")
async def update_friendly_names(
    payload: FriendlyNamesPayload,
    _user: str = Depends(get_current_user),
):
    cfg = load_config()
    cfg.disk_friendly_names.update(payload.names)
    save_config(cfg)
    return {"ok": True}


class FanConfigPayload(BaseModel):
    friendly_name: Optional[str] = None
    pwm_path: Optional[str] = None
    rpm_path: Optional[str] = None
    enabled: Optional[bool] = None
    controlled: Optional[bool] = None

@router.patch("/fans/{fan_id}")
async def update_fan_config(
    fan_id: str,
    payload: FanConfigPayload,
    _user: str = Depends(get_current_user),
):
    cfg = load_config()
    for fc in cfg.fans:
        if fc.fan_id == fan_id:
            for field, value in payload.model_dump(exclude_none=True).items():
                setattr(fc, field, value)
            save_config(cfg)
            return {"ok": True}
    from fastapi import HTTPException
    raise HTTPException(404, f"Fan {fan_id} not found")


class GlobalSettingsPayload(BaseModel):
    temp_unit: Optional[Literal["C", "F"]] = None
    monitor_enabled: Optional[bool] = None
    control_enabled: Optional[bool] = None
    poll_interval_seconds: Optional[int] = None
    unmonitored_disks: Optional[list[str]] = None

@router.patch("/global")
async def update_global_settings(
    payload: GlobalSettingsPayload,
    _user: str = Depends(get_current_user),
):
    cfg = load_config()
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(cfg, field, value)
    save_config(cfg)
    return {"ok": True}
