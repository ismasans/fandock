"""
FanDock – SMART temperature service.
Shells out to `smartctl` (provided by smartmontools inside the container).
All disk-type detection and threshold logic lives here.
"""

from __future__ import annotations
import asyncio
import re
import subprocess
from typing import Optional

from ..models.schemas import DiskInfo, DiskTemperatureReading, DiskType

# ---------------------------------------------------------------------------
# Per-type thresholds (°C)
# ---------------------------------------------------------------------------

THRESHOLDS: dict[DiskType, dict] = {
    "HDD":  {"warm": 40, "hot": 45, "critical": 55},
    "SSD":  {"warm": 50, "hot": 60, "critical": 70},
    "NVMe": {"warm": 55, "hot": 65, "critical": 75},
}


def _classify_status(temp: float, disk_type: DiskType) -> str:
    t = THRESHOLDS[disk_type]
    if temp >= t["critical"]:
        return "critical"
    if temp >= t["hot"]:
        return "hot"
    if temp >= t["warm"]:
        return "warm"
    return "normal"


# ---------------------------------------------------------------------------
# Disk discovery
# ---------------------------------------------------------------------------

def _list_block_devices() -> list[str]:
    """Return a list like ['/dev/sda', '/dev/sdb', '/dev/nvme0']."""
    try:
        result = subprocess.run(
            ["lsblk", "-d", "-n", "-o", "NAME,TYPE"],
            capture_output=True, text=True, timeout=5
        )
        devices = []
        for line in result.stdout.strip().splitlines():
            parts = line.split()
            if len(parts) >= 2 and parts[1] in ("disk",) and not parts[0].startswith("zd"):
                name = parts[0]
                prefix = "/dev/nvme" if name.startswith("nvme") else "/dev/"
                devices.append(f"{prefix}{name}" if not name.startswith("nvme") else f"/dev/{name}")
        return devices
    except Exception:
        return []


def _detect_disk_type(info_output: str, device: str) -> DiskType:
    """Heuristic type detection from smartctl -i output."""
    lower = info_output.lower()
    if "nvme" in device.lower() or "nvme" in lower:
        return "NVMe"
    if "solid state" in lower or "ssd" in lower or "flash" in lower:
        return "SSD"
    return "HDD"


def _parse_temperature(json_output: str) -> Optional[float]:
    """Extract temperature from smartctl --json output (attribute 194 or nvme_smart)."""
    import json
    try:
        data = json.loads(json_output)
        # NVMe
        nvme = data.get("nvme_smart_health_information_log", {})
        if "temperature" in nvme:
            return float(nvme["temperature"])
        # ATA – attribute 194 (Temperature_Celsius) or 190 (Airflow_Temperature_Cel)
        for attr in data.get("ata_smart_attributes", {}).get("table", []):
            if attr.get("id") in (194, 190):
                val = attr.get("raw", {}).get("value")
                if val is not None:
                    # raw value can encode extra info in upper bytes; mask to lower 16
                    return float(val & 0xFFFF)
        # Fallback: temperature_celsius block (some drives)
        tc = data.get("temperature", {})
        if "current" in tc:
            return float(tc["current"])
    except Exception:
        pass
    return None


async def _smartctl_info(device: str) -> Optional[DiskInfo]:
    """Run smartctl -i and --json -A for a single device."""
    try:
        loop = asyncio.get_event_loop()

        # Basic info
        info_proc = await loop.run_in_executor(
            None,
            lambda: subprocess.run(
                ["smartctl", "-i", device],
                capture_output=True, text=True, timeout=10
            )
        )
        info_out = info_proc.stdout

        model = "Unknown"
        serial = "Unknown"
        for line in info_out.splitlines():
            if line.startswith("Device Model:") or line.startswith("Model Number:"):
                model = line.split(":", 1)[1].strip()
            elif line.startswith("Serial Number:"):
                serial = line.split(":", 1)[1].strip()

        disk_type = _detect_disk_type(info_out, device)

        # Temperature via JSON
        json_proc = await loop.run_in_executor(
            None,
            lambda: subprocess.run(
                ["smartctl", "--json", "-A", device],
                capture_output=True, text=True, timeout=10
            )
        )
        temp = _parse_temperature(json_proc.stdout)

        return DiskInfo(
            device=device,
            model=model,
            serial=serial,
            type=disk_type,
            temperature_c=temp,
        )
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def scan_disks() -> list[DiskInfo]:
    """Discover all block devices and query their SMART data."""
    devices = _list_block_devices()
    tasks = [_smartctl_info(dev) for dev in devices]
    results = await asyncio.gather(*tasks)
    return [r for r in results if r is not None]


async def read_temperatures(
    known_disks: list[DiskInfo],
    friendly_names: dict[str, str],
) -> list[DiskTemperatureReading]:
    """Re-read temperatures for a pre-discovered disk list."""
    readings: list[DiskTemperatureReading] = []
    for disk in known_disks:
        # Re-query temperature only (faster than full scan)
        try:
            loop = asyncio.get_event_loop()
            json_proc = await loop.run_in_executor(
                None,
                lambda d=disk.device: subprocess.run(
                    ["smartctl", "--json", "-A", d],
                    capture_output=True, text=True, timeout=10
                )
            )
            temp = _parse_temperature(json_proc.stdout)
        except Exception:
            temp = None

        temp_f = round(temp * 9 / 5 + 32, 1) if temp is not None else None
        status = _classify_status(temp, disk.type) if temp is not None else "normal"

        readings.append(DiskTemperatureReading(
            device=disk.device,
            serial=disk.serial,
            temperature_c=temp,
            temperature_f=temp_f,
            type=disk.type,
            status=status,
            friendly_name=friendly_names.get(disk.serial) or friendly_names.get(disk.device),
        ))
    return readings


# Chip → module mapping for fan control
CHIP_MODULE_MAP = {
    'nct6775': 'nct6775', 'nct6776': 'nct6775', 'nct6779': 'nct6775',
    'nct6791': 'nct6775', 'nct6792': 'nct6775', 'nct6793': 'nct6775',
    'nct6795': 'nct6775', 'nct6796': 'nct6775', 'nct6797': 'nct6775',
    'nct6798': 'nct6775', 'nct6799': 'nct6775',
    'it8620': 'it87', 'it8628': 'it87', 'it8686': 'it87', 'it8790': 'it87',
    'w83627dhg': 'w83627ehf', 'w83627ehf': 'w83627ehf',
    'f71882fg': 'f71882fg', 'f71869': 'f71882fg',
}

def diagnose_fan_hardware() -> dict:
    """
    Detect Super I/O chip and suggest the kernel module to load.
    Returns diagnostic info even if no PWM is currently available.
    """
    result = {
        "pwm_available": False,
        "chip_detected": None,
        "module_suggested": None,
        "module_loaded": False,
        "hwmon_names": [],
        "instructions": None,
    }

    # Check if any PWM paths exist (module already loaded and working)
    pwm_paths = glob.glob("/sys/class/hwmon/hwmon*/pwm[0-9]")
    if pwm_paths:
        result["pwm_available"] = True

    # Read all hwmon chip names
    hwmon_names = []
    for name_path in glob.glob("/sys/class/hwmon/hwmon*/name"):
        try:
            hwmon_names.append(Path(name_path).read_text().strip())
        except OSError:
            pass
    result["hwmon_names"] = hwmon_names

    # Check if a known fan-control chip is already loaded
    for name in hwmon_names:
        if name in CHIP_MODULE_MAP:
            result["chip_detected"] = name
            result["module_suggested"] = CHIP_MODULE_MAP[name]
            result["module_loaded"] = True
            break

    # If not loaded, try to detect from platform devices
    if not result["chip_detected"]:
        try:
            platform_devices = os.listdir("/sys/bus/platform/devices/")
            for dev in platform_devices:
                dev_lower = dev.lower()
                for chip in CHIP_MODULE_MAP:
                    if chip in dev_lower:
                        result["chip_detected"] = chip
                        result["module_suggested"] = CHIP_MODULE_MAP[chip]
                        break
                if result["chip_detected"]:
                    break
        except OSError:
            pass

    # Generate instructions
    if result["module_suggested"] and not result["module_loaded"]:
        mod = result["module_suggested"]
        result["instructions"] = {
            "load_now": f"modprobe {mod}",
            "persist_truenas": f"Add a Pre Init script in TrueNAS → System → Advanced → Init/Shutdown Scripts with command: modprobe {mod}",
            "persist_linux": f"echo '{mod}' | sudo tee /etc/modules-load.d/fandock.conf",
        }

    return result