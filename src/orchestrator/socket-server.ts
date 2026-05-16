import { Server } from 'socket.io';
import { createServer } from 'http';
import { logger } from '../utils/logger.js';
import { EventEmitter } from 'events';
import { QuotaTracker } from '../utils/quota-tracker.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Shared Event Emitter for standalone Socket.io server
export const agentEvents = new EventEmitter();

const PORT = process.env.SOCKET_PORT || 3006;

/**
 * @title Vertex Sentinel Socket Server
 * @dev Standalone Socket.io server for real-time dashboard updates.
 * Bridges Agent Brain events to the frontend via EventEmitter.
 */
export function startSocketServer() {
  const httpServer = createServer((req, res) => {
    // REST Endpoint for Quota Monitoring
    if (req.url === '/api/quota' && req.method === 'GET') {
      const usage = QuotaTracker.getInstance().getUsage();
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(usage));
      return;
    }

    res.writeHead(404);
    res.end();
  });

  const io = new Server(httpServer, {
    cors: {
      origin: "*", // Adjust for production security
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    logger.info({ module: 'SOCKET_SERVER', step: 'CLIENT_CONNECTED', socketId: socket.id });

    // Sync automation state on connect
    const statePath = path.join(process.cwd(), 'logs/automation_state.json');
    if (fs.existsSync(statePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        socket.emit('automation.sync', data);
      } catch (e) {}
    }

    socket.on('disconnect', () => {
      logger.info({ module: 'SOCKET_SERVER', step: 'CLIENT_DISCONNECTED', socketId: socket.id });
    });
  });

  // Bridge Agent Events to Socket.io
  agentEvents.on('trade.authorized', (data) => {
    logger.info({ module: 'SOCKET_SERVER', step: 'BROADCAST_AUTH', data });
    io.emit('trade.authorized', data);
  });

  agentEvents.on('risk.alert', (data) => {
    logger.warn({ module: 'SOCKET_SERVER', step: 'BROADCAST_RISK', data });
    io.emit('risk.alert', data);
  });

  agentEvents.on('balance.update', (data) => {
    logger.info({ module: 'SOCKET_SERVER', step: 'BROADCAST_BALANCE', data });
    io.emit('balance.update', data);
  });

  agentEvents.on('hitl.pending', (data) => {
    logger.info({ module: 'SOCKET_SERVER', step: 'BROADCAST_HITL_PENDING', data });
    io.emit('hitl.pending', data);
  });

  agentEvents.on('risk.update', (data) => {
    logger.info({ module: 'SOCKET_SERVER', step: 'BROADCAST_RISK_UPDATE', data });
    io.emit('risk.update', data);
  });

  io.on('connection', (socket) => {
    socket.on('hitl.approve', (data) => {
      logger.info({ module: 'SOCKET_SERVER', step: 'HITL_APPROVED', data });
      agentEvents.emit(`hitl.approve.${data.traceId}`, data);
    });

    socket.on('hitl.reject', (data) => {
      logger.info({ module: 'SOCKET_SERVER', step: 'HITL_REJECTED', data });
      agentEvents.emit(`hitl.reject.${data.traceId}`, data);
    });

    socket.on('automation.toggle', (data) => {
      logger.info({ module: 'SOCKET_SERVER', step: 'AUTOMATION_TOGGLED', enabled: data.enabled });
      agentEvents.emit('automation.toggle', data);
    });
  });

  httpServer.listen(PORT, () => {
    logger.info({ module: 'SOCKET_SERVER', step: 'SERVER_START', port: PORT });
  });

  return io;
}

// Start server if this is the main module
const isMain = process.argv[1] && (
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
);

if (isMain && process.env.NODE_ENV !== 'test') {
  startSocketServer();
}
