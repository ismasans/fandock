"""
FanDock – config persistence.
Reads/writes config.json on the mounted volume (/app/config/config.json).
"""

from __future__ import annotations
import json
import os
from pathlib import Path
from passlib.context import CryptContext
from ..models.schemas import AppConfig, FanConfig, CurvePoint

CONFIG_PATH = Path(os.getenv("FANDOCK_CONFIG_PATH", "/app/config/config.json"))

_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _default_config() -> AppConfig:
    """Return a fresh config with the default admin password."""
    return AppConfig(
        password_hash=_pwd_ctx.hash("fandock"),
    )


def load_config() -> AppConfig:
    if not CONFIG_PATH.exists():
        cfg = _default_config()
        save_config(cfg)
        return cfg
    with open(CONFIG_PATH) as f:
        data = json.load(f)
    return AppConfig(**data)


def save_config(cfg: AppConfig) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_PATH, "w") as f:
        json.dump(cfg.model_dump(), f, indent=2)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_ctx.verify(plain, hashed)


def hash_password(plain: str) -> str:
    return _pwd_ctx.hash(plain)


def reset_password() -> None:
    """Reset admin password to 'fandock' and force first_run wizard."""
    cfg = load_config()
    cfg.password_hash = hash_password("fandock")
    cfg.first_run = True
    save_config(cfg)
    print("Password reset to 'fandock'. First-run wizard will appear on next login.")