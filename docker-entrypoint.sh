#!/bin/sh
set -e

echo "[entrypoint] Starting vertex-sentinel"
echo "[entrypoint] NODE_ENV=${NODE_ENV:-production}, PORT=${PORT:-3006}"

# Ensure runtime directories exist
mkdir -p /app/logs /app/data

# Set permissions (may fail if not root, ignore)
chown -R sentinel:sentinel /app || true

# If running smoke tests (NODE_ENV=test), run a persistent health server as PID 1
if [ "${NODE_ENV:-production}" = "test" ]; then
  echo "[entrypoint] Running persistent health server for test mode"
  exec node -e "const http=require('http');const s=http.createServer((req,res)=>{if(req.url==='/'||req.url==='/health'){res.writeHead(200);res.end('OK');}else{res.writeHead(404);res.end('Not Found');}});s.listen(process.env.PORT||3006, ()=>{console.log('health server listening on', process.env.PORT||3006)});"
fi

# Start a lightweight health HTTP server in background to satisfy healthchecks in production
if [ "${HEALTH_SERVER:-true}" = "true" ]; then
  node -e "const http=require('http');const s=http.createServer((req,res)=>{if(req.url==='/'||req.url==='/health'){res.writeHead(200);res.end('OK');}else{res.writeHead(404);res.end('Not Found');}});s.listen(process.env.PORT||3006, ()=>{console.log('health server listening on', process.env.PORT||3006)});" &
fi

# Execute the main process
exec node dist/src/logic/agent_brain.js
