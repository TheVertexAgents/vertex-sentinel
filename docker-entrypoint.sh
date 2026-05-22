#!/bin/sh
set -e

echo "[entrypoint] Starting vertex-sentinel"
echo "[entrypoint] NODE_ENV=${NODE_ENV:-production}, PORT=${PORT:-3006}"

# Ensure runtime directories exist
mkdir -p /app/logs /app/data

# Set permissions (may fail if not root, ignore)
chown -R sentinel:sentinel /app || true

# Execute the main process
exec node dist/src/logic/agent_brain.js
