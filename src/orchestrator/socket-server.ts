import { Server } from 'socket.io';
import { createServer } from 'http';
import { logger } from '../utils/logger.js';
import { EventEmitter } from 'events';

// Shared Event Emitter for standalone Socket.io server
export const agentEvents = new EventEmitter();

const PORT = process.env.SOCKET_PORT || 3006;

/**
 * @title Vertex Sentinel Socket Server
 * @dev Standalone Socket.io server for real-time dashboard updates.
 * Bridges Agent Brain events to the frontend via EventEmitter.
 */
export function startSocketServer() {
  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: {
      origin: "*", // Adjust for production security
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    logger.info({ module: 'SOCKET_SERVER', step: 'CLIENT_CONNECTED', socketId: socket.id });

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

  httpServer.listen(PORT, () => {
    logger.info({ module: 'SOCKET_SERVER', step: 'SERVER_START', port: PORT });
  });

  return io;
}

// Start server if this is the main module
import { fileURLToPath } from 'url';
import path from 'path';

const isMain = import.meta.url === `file://${fileURLToPath(import.meta.url)}`;
if (isMain) {
  startSocketServer();
}
