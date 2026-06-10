# Stage 1: Builder
FROM python:3.13.13-slim as builder

# Install build dependencies (only in builder, won't be in final image)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3-dev \
    libssl-dev \
    libffi-dev \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /build

# Create virtual environment for better dependency isolation
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Upgrade pip in venv
RUN pip install --upgrade --default-timeout=1000 pip setuptools wheel

# Install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir --default-timeout=1000 -r requirements.txt

# Stage 2: Runtime
FROM python:3.13.13-slim

# Install only runtime system dependencies (no build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    smartmontools \
    util-linux \
    lm-sensors \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Create non-root user (security critical)
RUN groupadd -r fandock && useradd -r -g fandock -u 1000 fandock

WORKDIR /app

# Copy virtual environment from builder
COPY --from=builder --chown=fandock:fandock /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy application (set correct ownership)
COPY --chown=fandock:fandock backend/ ./backend/
COPY --chown=fandock:fandock frontend/ ./frontend/
COPY --chown=fandock:fandock VERSION ./VERSION

# Create config directory with correct permissions
RUN mkdir -p /app/config && chown -R fandock:fandock /app/config

# Config volume
VOLUME ["/app/config"]

EXPOSE 8080

ENV FANDOCK_CONFIG_PATH=/app/config/config.json

# Switch to non-root user
USER fandock

# Healthcheck (requires uvicorn to have a health endpoint)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]
