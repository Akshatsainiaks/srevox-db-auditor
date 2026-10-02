#!/bin/bash
# Srevox DB Auditor — Quick Start Script
# Run: chmod +x start.sh && ./start.sh

echo "⚡ Starting Srevox DB Auditor..."

# Check .env exists
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️ Created .env from .env.example"
fi

# Load env
export $(cat .env | grep -v ^# | xargs)

echo ""
echo "Starting services... Open 2 terminal tabs and run:"
echo ""
echo "Tab 1 — API Backend (Fastify):"
echo "  cd apps/api && npm run dev"
echo "  Runs on: http://localhost:7001"
echo ""
echo "Tab 2 — Frontend Console (Next.js):"
echo "  cd apps/frontend && npm run dev"
echo "  Runs on: http://localhost:7005"
echo ""
echo "Login: admin@srevox.local / admin123"
