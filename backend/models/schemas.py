from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    first_run: bool = False
    is_default_password: bool = True


DiskType = Literal["HDD", "SSD", "NVMe"]

class DiskInfo(BaseModel):
    device: str
    model: str
    serial: str
    type: DiskType
    temperature_c: Optional[float]
    friendly_name: Optional[str] = None

class DiskTemperatureReading(BaseModel):
    device: str
    serial: Optional[str] = None
    temperature_c: Optional[float]
    temperature_f: Optional[float]
    type: DiskType
    status: Literal["normal", "warm", "hot", "critical"]
    friendly_name: Optional[str] = None


class FanStatus(BaseModel):
    fan_id: str
    friendly_name: Optional[str] = None
    pwm_path: str
    rpm_path: Optional[str] = None
    current_pwm: int
    current_rpm: Optional[int] = None
    enabled: bool = True
    controlled: bool = True


class CurvePoint(BaseModel):
    temp_c: float = Field(..., ge=0, le=100)
    pwm_pct: float = Field(..., ge=0, le=100)

class FanCurve(BaseModel):
    fan_id: str
    points: list[CurvePoint]


class FanConfig(BaseModel):
    fan_id: str
    friendly_name: Optional[str] = None
    pwm_path: str
    rpm_path: Optional[str] = None
    enabled: bool = True
    controlled: bool = True
    curve: list[CurvePoint] = Field(default_factory=list)
    linked_disks: list[str] = Field(default_factory=list)

class AppConfig(BaseModel):
    password_hash: str
    fans: list[FanConfig] = Field(default_factory=list)
    disk_friendly_names: dict[str, str] = Field(default_factory=dict)
    temp_unit: Literal["C", "F"] = "C"
    language: Optional[str] = None
    monitor_enabled: bool = True
    control_enabled: bool = True
    poll_interval_seconds: int = Field(default=5, ge=5, le=300)
    unmonitored_disks: list[str] = Field(default_factory=list)
    unmonitored_fans: list[str] = Field(default_factory=list)
    first_run: bool = True


class HardwareScanResult(BaseModel):
    disks: list[DiskInfo]
    fans: list[FanStatus]

class DashboardSnapshot(BaseModel):
    disks: list[DiskTemperatureReading]
    fans: list[FanStatus]
    any_critical: bool
