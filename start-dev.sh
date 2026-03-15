#!/usr/bin/env bash
# start-dev.sh — starts backend + ngrok + vite dev server for local sharing
# Usage: ./start-dev.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ENV_FILE=".env.local"
PYTHON="./.venv/bin/python"

# ── cleanup helper ────────────────────────────────────────────────────────────
cleanup() {
  echo ""
  echo "Shutting down..."
  [ -n "${BACKEND_PID:-}" ] && kill "$BACKEND_PID" 2>/dev/null || true
  [ -n "${NGROK_PID:-}" ]   && kill "$NGROK_PID"   2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ── kill stale processes ──────────────────────────────────────────────────────
pkill -f 'python.*server\.py' 2>/dev/null || true
pkill -f 'ngrok http'         2>/dev/null || true
sleep 1

# ── start Python backend ──────────────────────────────────────────────────────
echo "▶  Starting backend on :8765 ..."
"$PYTHON" server.py &
BACKEND_PID=$!
sleep 2

# ── start ngrok tunnel ────────────────────────────────────────────────────────
echo "▶  Starting ngrok tunnel on :8765 ..."
ngrok http 8765 --log=stdout > /tmp/ngrok-timesheet.log 2>&1 &
NGROK_PID=$!

# ── wait for ngrok API to be ready ───────────────────────────────────────────
echo "▶  Waiting for ngrok public URL..."
NGROK_URL=""
for i in $(seq 1 30); do
  sleep 1
  NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null \
    | python3 -c "
import sys, json
try:
    tunnels = json.load(sys.stdin).get('tunnels', [])
    url = next((t['public_url'] for t in tunnels if t.get('proto') == 'https'), '')
    print(url)
except Exception:
    print('')
" 2>/dev/null) || true
  [ -n "$NGROK_URL" ] && break
  echo "   waiting... ($i/30)"
done

if [ -z "$NGROK_URL" ]; then
  echo ""
  echo "ERROR: Could not get ngrok URL after 30 seconds."
  echo "  Make sure ngrok is authenticated: ngrok config add-authtoken <your-token>"
  echo "  Get a free token at https://dashboard.ngrok.com/get-started/your-authtoken"
  exit 1
fi

# ── update VITE_BACKEND_URL in .env.local ────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
  if grep -q "^VITE_BACKEND_URL=" "$ENV_FILE"; then
    # macOS-compatible in-place sed
    sed -i.bak "s|^VITE_BACKEND_URL=.*|VITE_BACKEND_URL=$NGROK_URL|" "$ENV_FILE"
    rm -f "$ENV_FILE.bak"
  else
    echo "VITE_BACKEND_URL=$NGROK_URL" >> "$ENV_FILE"
  fi
else
  printf "VITE_BACKEND_URL=%s\nVITE_GOOGLE_CLIENT_ID=\n" "$NGROK_URL" > "$ENV_FILE"
fi

echo ""
echo "══════════════════════════════════════════════════"
echo "  Backend (local):  http://localhost:8765"
echo "  Backend (public):  $NGROK_URL"
echo "  Frontend:          http://localhost:5173  (all network interfaces)"
echo ""
echo "  Share the frontend via your local IP, e.g.:"
echo "    http://$(ipconfig getifaddr en0 2>/dev/null || echo '<your-ip>'):5173"
echo ""
echo "  Add these to Google Cloud Console → Authorized JS origins:"
echo "    http://localhost:5173"
echo "    $NGROK_URL"
echo "══════════════════════════════════════════════════"
echo ""

# ── start Vite dev server (bound to all interfaces for LAN sharing) ───────────
npm run dev -- --host 0.0.0.0
