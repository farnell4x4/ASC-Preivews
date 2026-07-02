#!/bin/sh

set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"

PIDS="$(pgrep -f "next dev" || true)"

if [ -n "$PIDS" ]; then
  echo "Stopping existing local dev server..."
  for PID in $PIDS; do
    kill "$PID" 2>/dev/null || true
  done
  sleep 1
fi

echo "Clearing Next.js build cache..."
rm -rf "$ROOT_DIR/.next"

echo "Starting local dev server..."
cd "$ROOT_DIR"
npm run dev -- "$@"
