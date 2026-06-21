# FanDock — Agent Instructions

**Open-source Docker web app to control NAS fan speeds based on disk SMART temperatures.**

## Project Overview

- **Tech Stack**: Python 3.13 (FastAPI) + Vanilla JavaScript + Docker
- **Domain**: Linux system administration (PWM fan control, SMART disk monitoring via sysfs and `smartctl`)
- **Deployment**: Docker/Docker Compose, TrueNAS SCALE community apps
- **User Audience**: NAS administrators (Synology, TrueNAS, DIY Linux boxes)

---

## Architecture at a Glance

```
frontend/
├── static/js/app.js          # Vanilla JS, i18n, API wrapper, 5s polling loop
├── static/js/i18n/*.json     # Translations (en, es, fr, de currently)
└── templates/index.html      # Single-page app (no build step)

backend/
├── main.py                   # FastAPI app, lifespan events, CORS setup
├── routers/auth.py           # JWT authentication, token lifecycle
├── routers/{dashboard,fans,settings}.py  # API endpoints
└── services/
    ├── control_loop.py       # Background AsyncIO task (5–30s polling)
    ├── fan_service.py        # sysfs PWM writes, fan discovery
    ├── smart_service.py      # smartctl JSON parsing, temp monitoring
    └── config_service.py     # JSON persistence + bcrypt password hashing

config/config.json            # Persisted config (fans, disks, curves, password hash)
Dockerfile                    # Base: python:3.13-slim + system tools
docker-compose.yml            # Dev setup with volume mounts for hot reload
```

---

## Key Architectural Patterns

### Backend
- **Routers** (`auth.py`, `dashboard.py`, `fans.py`, `settings.py`): RESTful endpoints prefixed `/api/`, all require JWT auth (except login).
- **Services**: Stateless functions + module-level state in `control_loop` (cached `_last_snapshot`, `_known_disks`, `_known_fans`).
- **Control Loop**: AsyncIO background task runs every 5–30 seconds, applies fan curves based on disk temps, detects hardware changes.
- **Schema Validation**: Pydantic models in `models/schemas.py` validate all API inputs/outputs.
- **Error Handling**: `HTTPException` with status codes (401, 404, 400).

**Example pattern** (adding a new endpoint):
1. Add route to router: `@router.get("/api/resource") async def resource(_user: str = Depends(get_current_user))`
2. Service logic in `services/`.
3. Return Pydantic schema for response validation.

### Frontend
- **No build step**: Static files served directly; JavaScript runs in browser.
- **i18n**: All strings in `T.keyName` (JS) or `id="keyName"` (HTML). JSON files in `frontend/static/js/i18n/`.
- **API Wrapper**: `async api(method, path, body)` handles JWT bearer token, 401 redirect, error logging.
- **State**: Global: `token`, `unit`, `allDisks`, `allFans`, `curves`, `settingsData`.
- **Polling**: Dashboard polls `/api/dashboard/snapshot` every 5 seconds (when tab is active).
- **Session**: 15-minute token validity, auto-refresh 1 minute before expiry, 5-minute inactivity logout.

---

## Configuration & Environment

- `FANDOCK_SECRET`: JWT secret (env override, required for production).
- `FANDOCK_CONFIG_PATH`: Defaults to `/app/config/config.json` (must be a volume mount in Docker).
- `FANDOCK_VERSION`: Read from `/app/VERSION` or env var; displayed in UI.

**Config file structure** (JSON, Pydantic-validated):
```json
{
  "password_hash": "bcrypt hash",
  "fans": [...],
  "disk_friendly_names": {"serial": "friendly name"},
  "known_disk_serials": ["serial1", "serial2"],
  "temp_unit": "C",
  "language": "en",
  "poll_interval_seconds": 10,
  "unmonitored_disks": [],
  "unmonitored_fans": [],
  "first_run": false
}
```

---

## Development Workflow

### Setup
```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend: no dependencies, served directly by FastAPI

# Run locally (requires Linux with sysfs PWM and smartctl)
cd backend
FANDOCK_SECRET=dev_secret uvicorn main:app --reload

# Open http://localhost:8080
# Default login: admin / fandock
```

### Build & Deploy
```bash
# Docker build (local)
docker build -t fandock:dev .

# Docker Compose (with volume mounts for development)
docker-compose up

# Publish to Docker Hub (uses ./publish.sh)
./publish.sh  # GitHub Actions CI/CD handles this on commits
```

### Code Style & Conventions

**Branching & Commits** (see [CONTRIBUTING.md](CONTRIBUTING.md)):
- Branch from `dev` (never `main`): `feat/issue-XX-description`
- Commits: `feat: description (#XX)`, `fix: description (#XX)`, `chore: description`, `docs: description`
- Always reference issue number in commits.

**Python**:
- Type hints: `from __future__ import annotations`
- Docstrings: Module-level and function-level as needed.
- Error handling: `HTTPException(status_code=..., detail="...")`
- Pattern: Service functions accept data, return Pydantic models or raise `HTTPException`.

**JavaScript**:
- Vanilla JS, no frameworks.
- Function grouping by feature (login functions, dashboard rendering, API calls).
- Comments: `// ── Feature Name ──` dividers for sections.
- Inline event handlers: `onclick="functionName()"`

**i18n**:
- All user-visible strings in `T.keyName` (JS) or `id="keyName"` (HTML).
- JSON translation files in `frontend/static/js/i18n/`.
- To add a new language: Copy `en.json`, translate values (preserve keys), open PR.

---

## Common Development Tasks

### Adding a New API Endpoint
1. Create or edit router in `backend/routers/`.
2. Define Pydantic schema in `backend/models/schemas.py`.
3. Implement service function in `backend/services/` if needed.
4. Endpoint must use `Depends(get_current_user)` for auth.
5. Return Pydantic model for response validation.

### Adding Frontend UI
1. Add HTML to `frontend/templates/index.html`.
2. Add i18n keys to all `frontend/static/js/i18n/*.json` files (start with `en.json`).
3. Add JavaScript logic to `frontend/static/js/app.js` (group by feature).
4. Use `api(method, path, body)` for backend calls; it handles JWT tokens.
5. Update translations: copy `en.json` → `xx.json`, translate values only.

### Adding a New Language
1. Copy `frontend/static/js/i18n/en.json` to `frontend/static/js/i18n/{code}.json` (e.g., `pt.json`).
2. Add `"_name": "Your language name"` at the top.
3. Translate all values; **do not change keys**.
4. Open PR; language is auto-detected and added to selector.

### Debugging a Hardware Issue
- Check `control_loop.py` for polling logic and state cache.
- `fan_service.py`: PWM discovery via glob `/sys/class/hwmon/*/pwm*`.
- `smart_service.py`: Disk discovery via `smartctl --scan-open` (JSON).
- Look at `allDisks` and `allFans` in browser console for current state.

---

## Project-Specific Pitfalls

1. **State Consistency**: Control loop writes cached state; dashboard reads it. If adding new state, ensure control loop updates it; otherwise dashboard may show stale data.

2. **i18n Coverage**: Every new UI string must be added to **all** language files (`en.json`, `es.json`, `fr.json`, `de.json`). Missing keys will display as `T.keyName` in the UI.

3. **JWT Token Expiry**: Backend token validity is 15 minutes. Frontend auto-refreshes 1 minute before expiry. Don't assume a long-lived token.

4. **Privileged Mode**: Docker container must run as `privileged: true` to write to sysfs (`/sys/class/hwmon/`). Without it, PWM writes fail silently.

5. **Config Persistence**: Config file lives at `/app/config/config.json` (in Docker volume). If the volume isn't mounted, config changes are lost on restart.

6. **No Database**: All persistence is JSON in `/app/config/`. No migrations, no transactions. Keep config structure simple.

7. **Blocking Calls**: Control loop uses `subprocess.run()` for `smartctl` and sysfs writes. In the future, consider async wrappers to avoid blocking the event loop.

---

## Key Files & Patterns

| File | Purpose | Key Pattern |
|------|---------|-------------|
| [backend/main.py](backend/main.py) | FastAPI app setup | Lifespan events, background task registration, CORS + static file mounting |
| [backend/routers/auth.py](backend/routers/auth.py) | Authentication | JWT token generation, OAuth2PasswordBearer, password hashing |
| [backend/services/control_loop.py](backend/services/control_loop.py) | Hardware monitoring | AsyncIO background task, module-level state cache, polling loop |
| [backend/models/schemas.py](backend/models/schemas.py) | Data contracts | Pydantic BaseModel for all API requests/responses |
| [frontend/static/js/app.js](frontend/static/js/app.js) | Frontend app | i18n bootstrap, API wrapper, polling loop, global state |

---

## Testing & Quality

- No automated tests. Manual testing is done on real TrueNAS hardware.
- Validation happens at API boundary via Pydantic.
- Use browser DevTools console to inspect `T`, `token`, `allDisks`, `allFans`.

---

## Related Resources

- [CONTRIBUTING.md](CONTRIBUTING.md) — Branch model, commit style, language contribution process
- [CHANGELOG.md](CHANGELOG.md) — Version history, features per release
- [README.md](README.md) — Installation, screenshots, feature list
- [Dockerfile](Dockerfile) — Base image, system dependencies
- [docker-compose.yml](docker-compose.yml) — Development setup

---

## Getting Help

- **Issues**: Describe the problem, steps to reproduce, hardware, and FanDock version.
- **PRs**: Always target `dev` branch; reference issue number.
- **Questions**: Open a discussion or issue on GitHub.
