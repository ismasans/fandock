FROM python:3.13-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    smartmontools \
    util-linux \
    lm-sensors \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /app

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY VERSION ./VERSION

VOLUME ["/app/config"]

EXPOSE 8080

ENV FANDOCK_CONFIG_PATH=/app/config/config.json

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]