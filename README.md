# FanDock 🌀

**Open-source Docker web app to control NAS fan speeds based on disk SMART temperatures.**

[![Docker Hub](https://img.shields.io/docker/pulls/ismasans/fandock)](https://hub.docker.com/r/ismasans/fandock)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Features

- 🌡️ Disk temperature monitoring via SMART (HDD / SSD / NVMe auto-detected)
- 🌀 Fan speed control with customizable fan curves (drag-to-edit)
- 🔒 Simple login / logout / password change
- ⚙️ Hardware auto-scan, friendly names, PWM mapping, Test button
- 🌍 i18n-ready UI
- 🔔 Visual critical alerts (v1.1: email via SMTP)

## Quick Start

```bash
docker run -d \
  --name fandock \
  --privileged \
  -p 8080:8080 \
  -v fandock_config:/app/config \
  ismasans/fandock
```

Then open **http://\<NAS_IP\>:8080** in your browser.

> Default credentials: `admin` / `fandock`

## Stack

| Layer     | Technology            |
|-----------|-----------------------|
| Backend   | FastAPI (Python 3.11) |
| Frontend  | HTML + JS + Chart.js  |
| Container | Single Docker image   |
| Config    | JSON on mounted volume|

## Roadmap

| Version | Feature                |
|---------|------------------------|
| v1.0    | Core fan control       |
| v1.1    | Email alerts via SMTP  |
| v1.2    | Extended NVMe support  |

## License

MIT © ismasans
