"""
FanDock – fan PWM control service.
Reads/writes sysfs PWM paths directly.
Fan curve interpolation also lives here.
"""

from __future__ import annotations
import asyncio
import glob
import os
import subprocess
from pathlib import Path
from typing import Optional
from . import control_loop

from ..models.schemas import FanStatus, FanConfig, CurvePoint


# ---------------------------------------------------------------------------
# sysfs helpers
# ---------------------------------------------------------------------------

def _write_sysfs(path: str, value: int) -> bool:
    try:
        Path(path).write_text(str(value))
        return True
    except OSError:
        return False


def _read_sysfs_int(path: str) -> Optional[int]:
    try:
        return int(Path(path).read_text().strip())
    except (OSError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Hardware discovery
# ---------------------------------------------------------------------------

def _discover_hwmon_fans() -> list[FanStatus]:
    """
    Walk /sys/class/hwmon/hwmon*/pwm* to find controllable fans.
    Returns a list with preliminary FanStatus objects.
    """
    fans: list[FanStatus] = []
    idx = 0
    for hwmon_dir in sorted(glob.glob("/sys/class/hwmon/hwmon*")):
        for pwm_path in sorted(glob.glob(f"{hwmon_dir}/pwm[0-9]")):
            # Only include if enable file exists (means it's controllable)
            enable_path = pwm_path + "_enable"
            if not os.path.exists(enable_path):
                continue

            num = pwm_path[-1]  # last char is the fan number
            rpm_path = f"{hwmon_dir}/fan{num}_input"

            fans.append(FanStatus(
                fan_id=f"fan{num}",
                pwm_path=pwm_path,
                rpm_path=rpm_path if os.path.exists(rpm_path) else None,
                current_pwm=_read_sysfs_int(pwm_path) or 0,
                current_rpm=_read_sysfs_int(rpm_path) if os.path.exists(rpm_path) else None,
            ))
            idx += 1
    return fans


def scan_fans() -> list[FanStatus]:
    return _discover_hwmon_fans()


# ---------------------------------------------------------------------------
# Fan curve interpolation
# ---------------------------------------------------------------------------

def interpolate_pwm(temp_c: float, curve: list[CurvePoint]) -> int:
    """
    Linear interpolation of PWM% from the curve, then scale to 0-255.
    Curve must be sorted by temp_c.
    """
    if not curve:
        return 128  # safe default ~50%

    sorted_curve = sorted(curve, key=lambda p: p.temp_c)

    if temp_c <= sorted_curve[0].temp_c:
        pct = sorted_curve[0].pwm_pct
    elif temp_c >= sorted_curve[-1].temp_c:
        pct = sorted_curve[-1].pwm_pct
    else:
        for i in range(len(sorted_curve) - 1):
            lo, hi = sorted_curve[i], sorted_curve[i + 1]
            if lo.temp_c <= temp_c <= hi.temp_c:
                ratio = (temp_c - lo.temp_c) / (hi.temp_c - lo.temp_c)
                pct = lo.pwm_pct + ratio * (hi.pwm_pct - lo.pwm_pct)
                break
        else:
            pct = sorted_curve[-1].pwm_pct

    return max(0, min(255, round(pct / 100 * 255)))


# ---------------------------------------------------------------------------
# PWM control
# ---------------------------------------------------------------------------

def enable_pwm_control(pwm_path: str) -> bool:
    """Set pwmN_enable = 1 (manual control)."""
    return _write_sysfs(pwm_path + "_enable", 1)

def release_pwm_control(pwm_path: str) -> bool:
    """Return fan to Smart Fan / BIOS control (pwmN_enable = 5)."""
    return _write_sysfs(pwm_path + "_enable", 5)

def set_pwm(pwm_path: str, value: int) -> bool:
    """Write PWM value (0-255)."""
    value = max(0, min(255, value))
    return _write_sysfs(pwm_path, value)


async def test_fan(pwm_path: str, stop_first: bool = True) -> bool:
    """
    Test fan: stop completely → wait → spin at 100% → restore.
    Adjust the durations below to change test behavior.
    """
    STOP_DURATION_SECONDS = 15  # ← Time to keep fan stopped (seconds)
    SPIN_DURATION_SECONDS = 8   # ← Time to spin at 100% (seconds)

    control_loop._test_in_progress = True
    try:
        original = _read_sysfs_int(pwm_path) or 128
        enable_pwm_control(pwm_path)
        if stop_first:
            set_pwm(pwm_path, 0)
            await asyncio.sleep(STOP_DURATION_SECONDS)
        set_pwm(pwm_path, 255)
        await asyncio.sleep(SPIN_DURATION_SECONDS)
        set_pwm(pwm_path, original)
        release_pwm_control(pwm_path)
    finally:
        control_loop._test_in_progress = False
    return True


# ---------------------------------------------------------------------------
# Fan status snapshot
# ---------------------------------------------------------------------------

def read_fan_statuses(fan_configs: list[FanConfig], unmonitored: list[str] = []) -> list[FanStatus]:
    statuses: list[FanStatus] = []
    for fc in fan_configs:
        if fc.fan_id in unmonitored:
            continue
        statuses.append(FanStatus(
            fan_id=fc.fan_id,
            friendly_name=fc.friendly_name,
            pwm_path=fc.pwm_path,
            rpm_path=fc.rpm_path,
            current_pwm=_read_sysfs_int(fc.pwm_path) or 0,
            current_rpm=_read_sysfs_int(fc.rpm_path) if fc.rpm_path else None,
            enabled=fc.enabled,
            controlled=fc.controlled,
        ))
    return statuses
