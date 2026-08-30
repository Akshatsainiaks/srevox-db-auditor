#!/bin/bash
# Srevox Quick Start Script
# Run: chmod +x start.sh && ./start.sh

echo "🔭 Starting Srevox..."

# Check .env exists
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️  Created .env from .env.example — please update with your credentials"
fi

# Load env
export $(cat .env | grep -v ^# | xargs)

echo ""
echo "Starting services... Open 4 terminal tabs and run:"
echo ""
echo "Tab 1 — API (Node.js):"
echo "  cd apps/api && npm install && npm run dev"
echo ""
echo "Tab 2 — AI Service (Python):"
echo "  cd apps/backend && pip install -r requirements.txt && uvicorn ai_service:app --port 8000 --reload"
echo ""
echo "Tab 3 — Alert Worker (Node.js):"
echo "  cd apps/alert-worker && npm install && npm run dev"
echo ""
echo "Tab 4 — Frontend (Next.js):"
echo "  cd apps/frontend && npm install && npm run dev"
echo ""
echo "Tab 5 — Activity Audit Service (Rust):"
echo "  cd apps/activity-service && cargo run"
echo ""
echo "Then open: http://localhost:3000"
echo "Login: admin@srevox.local / admin123"
