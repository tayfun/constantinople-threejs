#!/usr/bin/env bash
# Builds the site into a temporary folder, serves it to an Android phone on USB, and runs the
# device test (scripts/device.mjs) a few times, each in a freshly started Chrome. Needs adb and a
# phone with USB debugging on.
#
#   scripts/device.sh <outDir> [trials=3] [options for device.mjs]
#   scripts/device.sh device 3 --tour=hagia-sophia,hippodrome --map-wait=10000
#
# A throwaway build must not go to Sentry, so the auth token is blanked for it. DEVICE_PORT sets the
# port (default 4500).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PROJECT="$(dirname "$HERE")"
OUT="$(realpath -m "${1:?usage: device.sh <outDir> [trials] [options]}")"
TRIALS="${2:-3}"
shift $(( $# >= 2 ? 2 : 1 ))
PORT="${DEVICE_PORT:-4500}"
BUILD="$(mktemp -d)"
trap 'kill ${PREVIEW_PID:-} 2>/dev/null || true; adb reverse --remove tcp:$PORT 2>/dev/null || true; adb forward --remove tcp:9222 2>/dev/null || true; rm -rf "$BUILD"' EXIT

adb get-state >/dev/null || { echo "no phone on adb" >&2; exit 1; }
cd "$PROJECT"
SENTRY_AUTH_TOKEN= npx vite build --outDir "$BUILD" --emptyOutDir --logLevel warn 2>&1 | grep -v sentry-vite-plugin || true
# vite itself, not through npx, so that the trap above stops the server and not just its wrapper.
"$PROJECT/node_modules/.bin/vite" preview --outDir "$BUILD" --port "$PORT" --strictPort --logLevel silent >/dev/null 2>&1 &
PREVIEW_PID=$!
for i in $(seq 1 50); do curl -s -o /dev/null "http://localhost:$PORT/" && break; sleep 0.2; done
for trial in $(seq 1 "$TRIALS"); do
  node "$HERE/device.mjs" "$OUT" "--trial=$trial" "--port=$PORT" "$@"
done
