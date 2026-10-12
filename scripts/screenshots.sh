#!/usr/bin/env bash
# Builds the site into a temporary folder, serves it, and takes headless screenshots of the map
# and the dioramas (see scripts/screenshot.mjs for the options). Needs google-chrome on the PATH.
#
#   scripts/screenshots.sh <outDir> [map | all | landmark ids…] [options]
#   scripts/screenshots.sh shots all "--views=wide:-10,70,60,-5,0,0"
#   scripts/screenshots.sh shots hagia-sophia --width=390 --height=844
#
# A throwaway build must not go to Sentry, so the auth token is blanked for it. Set
# SCREENSHOT_PORT to run several copies at once.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PROJECT="$(dirname "$HERE")"
OUT="$(realpath -m "${1:?usage: screenshots.sh <outDir> [targets…] [options]}")"
shift
PORT="${SCREENSHOT_PORT:-4173}"
BUILD="$(mktemp -d)"
trap 'kill ${PREVIEW_PID:-} 2>/dev/null || true; rm -rf "$BUILD"' EXIT

cd "$PROJECT"
SENTRY_AUTH_TOKEN= npx vite build --outDir "$BUILD" --emptyOutDir --logLevel warn 2>&1 | grep -v sentry-vite-plugin || true
npx vite preview --outDir "$BUILD" --port "$PORT" --strictPort --logLevel silent >/dev/null 2>&1 &
PREVIEW_PID=$!
for i in $(seq 1 50); do curl -s -o /dev/null "http://localhost:$PORT/" && break; sleep 0.2; done
node "$HERE/screenshot.mjs" "$OUT" "$@" "--url=http://localhost:$PORT/" "--port=$((PORT + 5000))"
