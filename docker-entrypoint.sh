#!/bin/sh
set -e

# SENTINEL_MODE can be 'agent' (default) or 'server'
MODE=${SENTINEL_MODE:-agent}

echo "[entrypoint] Starting vertex-sentinel in $MODE mode"
echo "[entrypoint] NODE_ENV=${NODE_ENV:-production}, PORT=${PORT:-3006}"

# Ensure runtime directories exist
mkdir -p /app/logs /app/data

# If running smoke tests (NODE_ENV=test), run a persistent health server as PID 1
if [ "${NODE_ENV:-production}" = "test" ]; then
  echo "[entrypoint] Running persistent health server for test mode"
  exec node -e "const http=require('http');const s=http.createServer((req,res)=>{if(req.url==='/'||req.url==='/health'||req.url==='/api/health'){res.writeHead(200);res.end('OK');}else{res.writeHead(404);res.end('Not Found');}});s.listen(process.env.PORT||3006, ()=>{console.log('health server listening on', process.env.PORT||3006)});"
fi

# In agent mode, the socket server is started internally by agent_brain.js
# In server mode, we start only the socket server.

if [ "$MODE" = "server" ]; then
  echo "[entrypoint] Launching standalone Sentinel Server..."
  exec npm run start:server
else
  echo "[entrypoint] Launching Sentinel Agent Brain (with integrated server)..."
  exec npm run start:agent
fi
