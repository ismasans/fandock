"""
FanDock – shared Pydantic models.
All domain objects used by API routes and services live here.
"""

from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    username: str
    password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------------------------------------------------------------------------
# Disks / SMART
# ---------------------------------------------------------------------------

DiskType = Literal["HDD", "SSD", "NVMe"]

class DiskInfo(BaseModel):
    device: str                     # e.g. "/dev/sdb"
    model: str
    serial: str
    type: DiskType
    temperature_c: Optional[float]  # None if unreadable
    friendly_name: Optional[str] = None

class DiskTemperatureReading(BaseModel):
    device: str
    temperature_c: Optional[float]
    temperature_f: Optional[float]
    type: DiskType
    status: Literal["normal", "warm", "hot", "critical"]
    friendly_name: Optional[str] = None


# ---------------------------------------------------------------------------
# Fans
# ---------------------------------------------------------------------------

class FanStatus(BaseModel):
    fan_id: str                     # e.g. "fan0"
    friendly_name: Optional[str] = None
    pwm_path: str                   # e.g. "/sys/class/hwmon/hwmon1/pwm1"
    rpm_path: Optional[str] = None  # e.g. "/sys/class/hwmon/hwmon1/fan1_input"
    current_pwm: int                # 0-255
    current_rpm: Optional[int] = None
    enabled: bool = True
    controlled: bool = True


# ---------------------------------------------------------------------------
# Fan Curve
# ---------------------------------------------------------------------------

class CurvePoint(BaseModel):
    temp_c: float = Field(..., ge=0, le=100)
    pwm_pct: float = Field(..., ge=0, le=100)

class FanCurve(BaseModel):
    fan_id: str
    points: list[CurvePoint]        # must be sorted by temp_c, min 2 points


# ---------------------------------------------------------------------------
# Settings / Config
# ---------------------------------------------------------------------------

class FanConfig(BaseModel):
    fan_id: str
    friendly_name: Optional[str] = None
    pwm_path: str
    rpm_path: Optional[str] = None
    enabled: bool = True
    controlled: bool = True
    curve: list[CurvePoint] = Field(default_factory=list)

class AppConfig(BaseModel):
    password_hash: str
    fans: list[FanConfig] = Field(default_factory=list)
    disk_friendly_names: dict[str, str] = Field(default_factory=dict)
    temp_unit: Literal["C", "F"] = "C"
    monitor_enabled: bool = True
    control_enabled: bool = True
    poll_interval_seconds: int = Field(default=10, ge=5, le=300)
    unmonitored_disks: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Hardware scan result (Settings page)
# ---------------------------------------------------------------------------

class HardwareScanResult(BaseModel):
    disks: list[DiskInfo]
    fans: list[FanStatus]


# ---------------------------------------------------------------------------
# Dashboard snapshot (single polling response)
# ---------------------------------------------------------------------------

class DashboardSnapshot(BaseModel):
    disks: list[DiskTemperatureReading]
    fans: list[FanStatus]
    any_critical: bool
