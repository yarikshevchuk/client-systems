#!/bin/bash
set -e

DISK=/dev/disk/by-id/google-data
MOUNT=/data
APP=$MOUNT/app

# Mount the data disk (format only on first boot)
if ! blkid $DISK; then
  mkfs.ext4 -m 0 -F $DISK
fi
mkdir -p $MOUNT
if ! grep -q "$MOUNT" /etc/fstab; then
  echo "$DISK $MOUNT ext4 defaults,nofail 0 2" >> /etc/fstab
fi
mount -a

# Docker, compose plugin, git
if ! command -v docker; then
  apt-get update
  apt-get install -y ca-certificates curl git
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
  echo "deb [signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
fi

# Application code and data folders
if [ -d $APP ]; then
  git -C $APP pull
else
  git clone ${repo_url} $APP
fi
mkdir -p $MOUNT/postgres $MOUNT/uploads

# Build the frontend
docker run --rm -v $APP/frontend:/app -w /app node:22-alpine sh -c "npm ci && npm run build"

cat > $MOUNT/nginx.conf <<'CONF'
server {
    listen 80;
    client_max_body_size 100m;
    root /usr/share/nginx/html;

    location / {
        try_files $uri /index.html;
    }

    location /api {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
    }

    location /ws {
        proxy_pass http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
CONF

cat > $MOUNT/compose.yml <<'CONF'
services:
  db:
    image: postgres:16
    restart: always
    environment:
      POSTGRES_USER: vns
      POSTGRES_PASSWORD: ${db_password}
      POSTGRES_DB: vns
    volumes:
      - /data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vns -d vns"]
      interval: 3s
      retries: 20

  backend:
    image: python:3.12-slim
    restart: always
    working_dir: /app
    command: sh -c "pip install -r requirements.txt && uvicorn main:app --host 0.0.0.0 --port 8000"
    environment:
      DATABASE_URL: postgresql://vns:${db_password}@db:5432/vns
      APP_SECRET: ${app_secret}
      ANTHROPIC_API_KEY: "${anthropic_api_key}"
      GEMINI_API_KEY: "${gemini_api_key}"
    volumes:
      - /data/app/backend:/app
      - /data/uploads:/app/uploads
    depends_on:
      db:
        condition: service_healthy

  frontend:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
    volumes:
      - /data/app/frontend/dist:/usr/share/nginx/html:ro
      - /data/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - backend
CONF

docker compose -f $MOUNT/compose.yml up -d
