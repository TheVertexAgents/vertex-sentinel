import { Server } from 'socket.io';
import { createServer } from 'http';
import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { QuotaTracker } from '../utils/quota-tracker.js';
import { PnLTracker } from '../logic/pnl/tracker.js';

// Shared Event Emitter for standalone Socket.io server
export const agentEvents = new EventEmitter();

const PORT = process.env.PORT || process.env.SOCKET_PORT || 3006;

/**
 * @title Vertex Sentinel Unified Server
 * @dev Express + Socket.io server for REST API, WebSockets, and Dashboard Static Files.
 */
export function startSocketServer() {
  const app = express();
  const httpServer = createServer(app);

  // Lazy-loaded PnL Tracker
  let pnlTracker: PnLTracker | null = null;
  function getPnLTracker() {
    if (!pnlTracker) {
      pnlTracker = new PnLTracker({ persist: true });
    }
    return pnlTracker;
  }

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Static Dashboard Files
  const dashboardPath = path.join(process.cwd(), 'dashboard');
  if (fs.existsSync(dashboardPath)) {
    logger.info({ module: 'SERVER', step: 'SERVING_STATIC', path: dashboardPath });
    app.use(express.static(dashboardPath));

    app.get('/dashboard', (_req: Request, res: Response) => {
      res.sendFile(path.join(dashboardPath, 'index.html'));
    });

    app.get('/onboarding', (_req: Request, res: Response) => {
      res.sendFile(path.join(dashboardPath, 'onboarding.html'));
    });
  }

  // Socket.io Setup
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // REST Endpoints
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString(), version: '1.1.0' });
  });

  app.get('/api/quota', (_req: Request, res: Response) => {
    const usage = QuotaTracker.getInstance().getUsage();
    res.json(usage);
  });

  /**
   * GET /api/agent
   * Returns current agent metadata from agent-id.json
   */
  app.get('/api/agent', (_req: Request, res: Response) => {
    const agentIdPath = path.join(process.cwd(), 'agent-id.json');
    if (fs.existsSync(agentIdPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(agentIdPath, 'utf8'));
        res.json(data);
      } catch (e) {
        res.status(500).json({ error: 'Failed to parse agent metadata' });
      }
    } else {
      res.status(404).json({ error: 'Agent metadata not found' });
    }
  });

  /**
   * GET /api/pnl
   * Returns live PnL metrics from memory (with file-based fallback)
   */
  app.get('/api/pnl', (_req: Request, res: Response) => {
    try {
      const metrics = getPnLTracker().getMetrics();
      res.json(metrics);
    } catch (e) {
      // Fallback to pnl.json file if tracker fails
      const pnlPath = path.join(process.cwd(), 'logs/pnl.json');
      if (fs.existsSync(pnlPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(pnlPath, 'utf8'));
          res.json(data.summary || data);
        } catch (err) {
          res.status(500).json({ error: 'Failed to retrieve PnL data' });
        }
      } else {
        res.status(404).json({ error: 'PnL data not found' });
      }
    }
  });

  /**
   * GET /api/audit
   * Returns paginated audit trail from logs/audit.json
   */
  app.get('/api/audit', (req: Request, res: Response) => {
    const auditPath = path.join(process.cwd(), 'logs/audit.json');
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    if (fs.existsSync(auditPath)) {
      try {
        const content = fs.readFileSync(auditPath, 'utf8');
        const lines = content.trim().split('\n').filter(l => l.length > 0).reverse();

        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const paginatedLines = lines.slice(startIndex, endIndex);

        const logs = paginatedLines.map(l => JSON.parse(l));

        res.json({
          logs,
          pagination: {
            page,
            limit,
            total: lines.length,
            pages: Math.ceil(lines.length / limit)
          }
        });
      } catch (e) {
        res.status(500).json({ error: 'Failed to parse audit logs' });
      }
    } else {
      res.json({ logs: [], pagination: { page, limit, total: 0, pages: 0 } });
    }
  });

  /**
   * GET /api/automation
   * Returns current automation state
   */
  app.get('/api/automation', (_req: Request, res: Response) => {
    const statePath = path.join(process.cwd(), 'logs/automation_state.json');
    if (fs.existsSync(statePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        res.json(data);
      } catch (e) {
        res.status(500).json({ error: 'Failed to parse automation state' });
      }
    } else {
      res.json({ enabled: false, timestamp: new Date().toISOString() });
    }
  });

  /**
   * POST /api/automation/toggle
   * Toggles automation state
   */
  app.post('/api/automation/toggle', (req: Request, res: Response) => {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'Invalid enabled state' });
      return;
    }

    const statePath = path.join(process.cwd(), 'logs/automation_state.json');
    const data = { enabled, timestamp: new Date().toISOString() };

    try {
      if (!fs.existsSync(path.dirname(statePath))) {
        fs.mkdirSync(path.dirname(statePath), { recursive: true });
      }
      fs.writeFileSync(statePath, JSON.stringify(data, null, 2));

      // Notify Agent Brain
      agentEvents.emit('automation.toggle', { enabled });
      io.emit('automation.sync', { enabled });

      res.json({ success: true, enabled });
    } catch (e) {
      res.status(500).json({ error: 'Failed to save automation state' });
    }
  });

  // Socket.io Connection Logic
  io.on('connection', (socket) => {
    logger.info({ module: 'SOCKET_SERVER', step: 'CLIENT_CONNECTED', socketId: socket.id });

    // Sync automation state on connect
    const statePath = path.join(process.cwd(), 'logs/automation_state.json');
    if (fs.existsSync(statePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        socket.emit('automation.sync', data);
      } catch (e) {}
    } else {
        socket.emit('automation.sync', { enabled: false });
    }

    socket.on('disconnect', () => {
      logger.info({ module: 'SOCKET_SERVER', step: 'CLIENT_DISCONNECTED', socketId: socket.id });
    });

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

      // Persist state via internal API logic
      const statePath = path.join(process.cwd(), 'logs/automation_state.json');
      const stateData = { enabled: data.enabled, timestamp: new Date().toISOString() };
      try {
        if (!fs.existsSync(path.dirname(statePath))) fs.mkdirSync(path.dirname(statePath), { recursive: true });
        fs.writeFileSync(statePath, JSON.stringify(stateData, null, 2));
      } catch (e) {}

      agentEvents.emit('automation.toggle', data);
      socket.broadcast.emit('automation.sync', data);
    });
  });

  // Bridge Agent Events to Socket.io
  agentEvents.on('trade.authorized', (data) => {
    io.emit('trade.authorized', data);
  });

  agentEvents.on('risk.alert', (data) => {
    io.emit('risk.alert', data);
  });

  agentEvents.on('balance.update', (data) => {
    io.emit('balance.update', data);
  });

  agentEvents.on('hitl.pending', (data) => {
    io.emit('hitl.pending', data);
  });

  agentEvents.on('risk.update', (data) => {
    io.emit('risk.update', data);
  });

  httpServer.listen(PORT, () => {
    logger.info({ module: 'SERVER', step: 'SERVER_START', port: PORT });
  });

  return io;
}

// Start server if this is the main module
const isMain = process.argv[1] && (
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
);

if (isMain) {
  startSocketServer();
}
