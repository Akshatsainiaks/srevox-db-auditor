#!/bin/bash
set -e

BOLD="\033[1m"
GREEN="\033[32m"
CYAN="\033[36m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

BASE="https://raw.githubusercontent.com/Akshatsainiaks/srevox-db-auditor/main"

echo ""
echo -e "${CYAN}${BOLD}⚡ Srevox DB Auditor — Self-Hosted Setup${RESET}"
echo -e "${CYAN}   Database Audit, DDL Tracking & CDC Change Intelligence${RESET}"
echo ""

# ── Download helper with retry and timeout logic ─────────────
download() {
  local url="$1"
  local dest="$2"
  local attempts=3
  local count=0

  while [ $count -lt $attempts ]; do
    count=$((count + 1))
    if curl -fsSL -m 20 --retry 2 --retry-delay 3 "$url" -o "$dest"; then
      return 0
    fi
    echo -e "${YELLOW}⚠️  Download attempt $count failed for $url. Retrying...${RESET}"
    sleep 2
  done

  echo -e "${RED}✗ Failed to download $url after $attempts attempts.${RESET}"
  exit 1
}

# ── Check Docker ──────────────────────────────────────────────
if ! command -v docker &> /dev/null; then
  echo -e "${RED}✗ Docker not found. Install: https://docs.docker.com/get-docker/${RESET}"
  exit 1
fi
if ! docker compose version &> /dev/null; then
  echo -e "${RED}✗ Docker Compose not found.${RESET}"
  exit 1
fi
echo -e "${GREEN}✓ Docker found${RESET}"

# ── Create folder structure ───────────────────────────────────
mkdir -p srevox-db-auditor
cd srevox-db-auditor
echo -e "${GREEN}✓ Created srevox-db-auditor/ directory${RESET}"

# ── Download all required files ───────────────────────────────
echo -e "${CYAN}→ Downloading deployment files...${RESET}"

download "$BASE/docker-compose.yml" "docker-compose.yml"
echo -e "${GREEN}✓ docker-compose.yml downloaded${RESET}"

# Ensure ClickHouse init schema directory and file are downloaded
mkdir -p infra/db-audit
download "$BASE/infra/db-audit/02_clickhouse_schema.sql" "infra/db-audit/02_clickhouse_schema.sql"
echo -e "${GREEN}✓ infra/db-audit/02_clickhouse_schema.sql downloaded${RESET}"

# ── Create .env if not exists ─────────────────────────────────
if [ ! -f .env ]; then
  download "$BASE/.env.example" ".env"
  echo -e "${GREEN}✓ .env created from template${RESET}"
  echo ""
  echo -e "${YELLOW}${BOLD}⚠️  Review .env before starting (optional for custom ports):${RESET}"
  echo -e "${YELLOW}   SREVOX_VERSION=v0.0.1${RESET}"
  echo -e "${YELLOW}   POSTGRES_PASSWORD=srevoxdbauditor${RESET}"
  echo -e "${YELLOW}   BACKEND_SECRET_KEY=any_32_char_string_here_xxxx${RESET}"
  echo -e "${YELLOW}   ENCRYPTION_KEY=exactly_32_chars_here__________${RESET}"
  echo -e "${YELLOW}   API_URL=http://YOUR_SERVER_IP:7001${RESET}"
  echo -e "${YELLOW}   FRONTEND_URL=http://YOUR_SERVER_IP:7005${RESET}"
  echo ""
  echo -e "   Run: ${BOLD}nano .env${RESET}"
  echo ""
else
  echo -e "${GREEN}✓ .env already exists — skipping${RESET}"
fi

# ── Pull all images ───────────────────────────────────────────
echo -e "${CYAN}→ Pulling Srevox DB Auditor images from Docker Hub...${RESET}"
docker compose pull
echo -e "${GREEN}✓ All images pulled successfully${RESET}"

echo ""
echo -e "${GREEN}${BOLD}✅ Srevox DB Auditor is ready!${RESET}"
echo ""
echo -e "   1. Start DB Auditor:  ${BOLD}docker compose up -d${RESET}"
echo -e "   2. Console UI:        ${CYAN}http://localhost:7005/login${RESET}"
echo -e "   3. API Endpoint:      ${CYAN}http://localhost:7001${RESET}"
echo -e "   4. Default Admin:     ${CYAN}admin@srevox.local / admin123${RESET}"
echo ""
echo -e "   ${YELLOW}⚠️  Change default credentials after your first login in Settings → Security!${RESET}"
echo ""
