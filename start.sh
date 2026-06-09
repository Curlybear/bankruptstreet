#!/usr/bin/env bash
# Build and run Bankrupt Street: game server (:3001) + client dev server (:5173).
# Ctrl+C stops both.
set -euo pipefail
cd "$(dirname "$0")"

# Install dependencies on first run
[ -d node_modules ] || npm install
[ -d client/node_modules ] || (cd client && npm install)

# Build / type-check both packages
echo "── Building server + engine…"
npm run build
echo "── Type-checking client…"
(cd client && npx tsc --noEmit)

# Run both; kill the server when the client (foreground) exits.
# Launch node directly (not via npm) so the trap kills the real process.
echo "── Starting game server on :3001 and client on :5173…"
node --import tsx/esm server/index.ts &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

(cd client && npm run dev)
