"""
FanDock – /api/auth routes.
"""

from __future__ import annotations
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt

from ..models.schemas import LoginRequest, ChangePasswordRequest, TokenResponse, AppConfig
from ..services.config_service import load_config, save_config, verify_password, hash_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

SECRET_KEY = "CHANGE_ME_IN_PRODUCTION"  # override via env var FANDOCK_SECRET in main.py
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8 hours

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


def _create_token(username: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": username, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme)) -> str:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            raise ValueError
        return username
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


# OAuth2 form endpoint (used by frontend fetch)
@router.post("/token", response_model=TokenResponse)
async def token(form: OAuth2PasswordRequestForm = Depends()):
    cfg = load_config()
    if form.username != "admin" or not verify_password(form.password, cfg.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return TokenResponse(access_token=_create_token("admin"))


# JSON login (also accepted by frontend)
@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    cfg = load_config()
    if req.username != "admin" or not verify_password(req.password, cfg.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return TokenResponse(
        access_token=_create_token("admin"), 
        first_run=cfg.first_run,
        is_default_password=verify_password("fandock", cfg.password_hash)
    )


@router.post("/change-password")
async def change_password(
    req: ChangePasswordRequest,
    _user: str = Depends(get_current_user),
):
    cfg = load_config()
    if not verify_password(req.current_password, cfg.password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    cfg.password_hash = hash_password(req.new_password)
    save_config(cfg)
    return {"ok": True, "first_run": cfg.first_run}


@router.post("/complete-setup")
async def complete_setup(_user: str = Depends(get_current_user)):
    cfg = load_config()
    cfg.first_run = False
    save_config(cfg)
    return {"ok": True}

@router.get("/first-run")
async def first_run_status():
    cfg = load_config()
    return {"first_run": cfg.first_run}

@router.get("/version")
async def get_version():
    import os
    import pathlib
    # Primero intenta leer de la variable de entorno (establecida en docker-compose.yml)
    v = os.getenv("FANDOCK_VERSION")
    # Si no está, intenta leer del archivo
    if not v:
        v = pathlib.Path("/app/VERSION").read_text().strip() if pathlib.Path("/app/VERSION").exists() else "dev"
    return {"version": v}


@router.post("/reset-config")
async def reset_config(_user: str = Depends(get_current_user)):
    cfg = load_config()
    # Keep password, reset everything else
    new_cfg = AppConfig(
        password_hash=cfg.password_hash,
        first_run=True,
    )
    save_config(new_cfg)
    return {"ok": True}