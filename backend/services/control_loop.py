"""
FanDock – background control loop.
Polls SMART temperatures at the configured interval and adjusts fan PWM.
Runs as an asyncio task inside the FastAPI lifespan.
"""

from __future__ import annotations
import asyncio
import logging

from .config_service import load_config
from .smart_service import scan_disks, read_temperatures
from .fan_service import enable_pwm_control, set_pwm, interpolate_pwm, read_fan_statuses
from ..models.schemas import DiskInfo

logger = logging.getLogger("fandock.controller")

# Module-level cache so the dashboard can read latest data without re-querying
_last_snapshot: dict = {"disks": [], "fans": [], "any_critical": False}
_known_disks: list[DiskInfo] = []


async def get_last_snapshot() -> dict:
    return _last_snapshot


async def _control_loop() -> None:
    global _known_disks, _last_snapshot

    logger.info("FanDock control loop starting…")

    # Initial disk scan
    _known_disks = await scan_disks()
    logger.info(f"Discovered {len(_known_disks)} disk(s): {[d.device for d in _known_disks]}")

    while True:
        try:
            cfg = load_config()

            if not cfg.monitor_enabled:
                await asyncio.sleep(cfg.poll_interval_seconds)
                continue

            # Read temperatures
            monitored = [d for d in _known_disks if d.device not in cfg.unmonitored_disks]
            readings = await read_temperatures(monitored, cfg.disk_friendly_names)

            # Determine max temperature across all disks (used for fan curve)
            temps_c = [r.temperature_c for r in readings if r.temperature_c is not None]
            max_temp = max(temps_c) if temps_c else 0.0

            # Read fan statuses
            fan_statuses = read_fan_statuses(cfg.fans)

            # Apply curves if control is enabled
            if cfg.control_enabled:
                for fc in cfg.fans:
                    if not fc.enabled or not fc.controlled:
                        continue
                    if not fc.curve:
                        continue
                    pwm_value = interpolate_pwm(max_temp, fc.curve)
                    enable_pwm_control(fc.pwm_path)
                    ok = set_pwm(fc.pwm_path, pwm_value)
                    if not ok:
                        logger.warning(f"Could not write PWM to {fc.pwm_path}")

            any_critical = any(r.status == "critical" for r in readings)

            _last_snapshot = {
                "disks": [r.model_dump() for r in readings],
                "fans": [s.model_dump() for s in fan_statuses],
                "any_critical": any_critical,
            }

        except Exception as exc:
            logger.exception(f"Control loop error: {exc}")

        await asyncio.sleep(cfg.poll_interval_seconds if 'cfg' in dir() else 10)


# Entry point called from app lifespan
_loop_task: asyncio.Task | None = None


def start_control_loop() -> None:
    global _loop_task
    _loop_task = asyncio.create_task(_control_loop())


def stop_control_loop() -> None:
    if _loop_task:
        _loop_task.cancel()
