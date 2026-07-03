#!/bin/sh

set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
URL="http://localhost:3000"

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

echo "Opening Safari..."
(
  sleep 3
  osascript <<'APPLESCRIPT'
set targetUrl to "http://localhost:3000"
set foundTab to false

tell application "Safari"
  activate

  repeat with w in windows
    repeat with t in tabs of w
      if URL of t starts with targetUrl then
        set current tab of w to t
        set index of w to 1
        set foundTab to true
        exit repeat
      end if
    end repeat

    if foundTab then exit repeat
  end repeat

  if not foundTab then
    open location targetUrl
  end if
end tell
APPLESCRIPT
) &

echo "Starting local dev server..."
cd "$ROOT_DIR"
npm run dev -- "$@"
