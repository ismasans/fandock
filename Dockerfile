FROM python:3.13-slim

# Install system dependencies: smartmontools, lsblk, build tools for compiling packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    smartmontools \
    util-linux \
    lm-sensors \
    build-essential \
    python3-dev \
    libssl-dev \
    libffi-dev \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /app

# Upgrade pip and install build tools
RUN pip install --upgrade --default-timeout=1000 pip setuptools wheel

# Install Python dependencies
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --default-timeout=1000 -r requirements.txt

# Copy application
COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY VERSION ./VERSION

# Config volume
VOLUME ["/app/config"]

EXPOSE 8080

ENV FANDOCK_CONFIG_PATH=/app/config/config.json

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]
