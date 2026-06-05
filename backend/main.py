"""
FanDock – FastAPI application entry point.
"""

from __future__ import annotations
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .routers import auth, dashboard, fans, settings as settings_router
from .services.control_loop import start_control_loop, stop_control_loop
# Allow overriding the JWT secret via environment variable
from .routers import auth as _auth_mod

if secret := os.getenv("FANDOCK_SECRET"):
    _auth_mod.SECRET_KEY = secret

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_control_loop()
    yield
    stop_control_loop()
    # Release all fans back to BIOS on shutdown
    from .services.config_service import load_config
    from .services.fan_service import release_pwm_control
    try:
        cfg = load_config()
        for fc in cfg.fans:
            release_pwm_control(fc.pwm_path)
    except Exception:
        pass


import pathlib
_version = pathlib.Path("/app/VERSION").read_text().strip() if pathlib.Path("/app/VERSION").exists() else "dev"

app = FastAPI(
    title="FanDock",
    version=_version,
    description="NAS fan control based on disk SMART temperatures",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten for production if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routers
app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(fans.router)
app.include_router(settings_router.router)

# Serve frontend static files
app.mount("/static", StaticFiles(directory=os.path.join(FRONTEND_DIR, "static")), name="static")

@app.get("/")
@app.get("/{full_path:path}")
async def serve_frontend(full_path: str = ""):
    """Catch-all: serve index.html for SPA routing."""
    index = os.path.join(FRONTEND_DIR, "templates", "index.html")
    return FileResponse(index)
