# FanDock 🌀

**Open-source Docker web app to control NAS fan speeds based on disk SMART temperatures.**

[![Docker Hub](https://img.shields.io/docker/pulls/ismasans/fandock)](https://hub.docker.com/r/ismasans/fandock)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Features

- 🌡️ Disk temperature monitoring via SMART (HDD / SSD / NVMe auto-detected)
- 🌀 Fan speed control with customizable fan curves (drag-to-edit)
- 🔒 Simple login / password change
- ⚙️ Hardware auto-scan, friendly names, PWM mapping, Test button
- 🌍 i18n-ready UI
- 🔔 Visual critical alerts (v1.1: email via SMTP)

## Quick Start

```yaml
services:
  fandock:
    image: ismasans/fandock:latest
    container_name: fandock
    privileged: true
    ports:
      - "8080:8080"
    volumes:
      - fandock_config:/app/config
    environment:
      - FANDOCK_PORT=8080
      - FANDOCK_SECRET=change_me
    restart: unless-stopped

volumes:
  fandock_config:
```

Then open **http://\<NAS_IP\>:8080** in your browser.

> Default credentials: `admin` / `fandock` — you will be asked to change your password on first login.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `FANDOCK_PORT` | `8080` | Web UI port |
| `FANDOCK_SECRET` | `change_me` | JWT secret key — change this! |
| `FANDOCK_CONFIG_PATH` | `/app/config/config.json` | Path to the configuration file |

## Password Reset

If you forget your password, run this command on the server:

```bash
docker exec fandock python -c "from backend.services.config_service import reset_password; reset_password()"
```

This resets the password to `fandock` and triggers the first-run wizard on next login.

## Stack

| Layer | Technology |
|-------|------------|
| Backend | FastAPI (Python 3.11) |
| Frontend | HTML + JS + Chart.js |
| Container | Single Docker image |
| Config | JSON on mounted volume |

## Roadmap

| Version | Feature |
|---------|---------|
| v1.0 | Core fan control |
| v1.1 | Email alerts via SMTP |
| v1.2 | Extended NVMe support |

## License

MIT © ismasans