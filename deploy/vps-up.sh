#!/usr/bin/env bash
# Deploy IncidentBridge API + Postgres on a VPS with Docker Compose.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Create a root .env from .env.example first:"
  echo "  cp .env.example .env"
  echo "Then set POSTGRES_PASSWORD, AT_USERNAME, AT_API_KEY, AT_ALERT_PHONE"
  exit 1
fi

docker compose pull postgres || true
docker compose build api
docker compose up -d
docker compose ps
echo
echo "Health: curl -s http://127.0.0.1:${API_PORT:-4000}/api/health"
echo "AT status: curl -s http://127.0.0.1:${API_PORT:-4000}/api/africastalking/status"
