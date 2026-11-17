#!/bin/sh
set -eu
cd "$(dirname "$0")"
if command -v node >/dev/null 2>&1; then
  exec node launch.mjs
fi
printf '%s\n' 'Open http://127.0.0.1:41731/ in your browser. Press Ctrl+C to stop Holocron.'
exec python3 -m http.server 41731 --bind 127.0.0.1 --directory dist
