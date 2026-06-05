FROM python:3.11-slim

# smartmontools for SMART data, lsblk (util-linux) for disk discovery
RUN apt-get update && apt-get install -y --no-install-recommends \
    smartmontools \
    util-linux \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY VERSION ./VERSION

# Config volume
VOLUME ["/app/config"]

EXPOSE 8080

ENV FANDOCK_CONFIG_PATH=/app/config/config.json

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]
