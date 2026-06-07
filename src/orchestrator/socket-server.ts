import { Server } from 'socket.io';
import { createServer } from 'http';
import express, { Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import { QuotaTracker } from '../utils/quota-tracker.js';
import { PnLTracker } from '../logic/pnl/tracker.js';
import { ApiKeyManager, apiKeyManager } from '../utils/api-key-manager.js';
import { FaucetService } from '../services/faucet.js';
import { LeaderboardService } from '../services/leaderboard.js';
import { authenticateRequest } from '../utils/auth-middleware.js';
import { sessionManager } from '../utils/session-manager.js';
import { betaAccessService } from '../services/beta-access.js';
import { feedbackService } from '../services/feedback.js';
import { marketDataService } from '../services/market-data.js';
import { orderManager } from '../execution/order-manager.js';
import { routerV2 } from './router-v2.js';
import { agentEvents } from '../utils/event-bus.js';

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

  // Rate Limiting
  const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
  });

  const auditLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many audit requests, please try again later.' }
  });

  const toggleLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many automation toggle requests, please try again later.' }
  });

  const faucetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: 1,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Faucet limit exceeded. One request per hour.' }
  });

  // Apply limiters
  app.use('/api/', generalLimiter);
  app.use('/api/audit', auditLimiter);
  app.use('/api/automation/toggle', toggleLimiter);
  app.use('/api/faucet/request', faucetLimiter);

  // Global X-API-Version header
  app.use((_req, res, next) => {
    res.setHeader('X-API-Version', '1.3.0');
    next();
  });

  // Static Dashboard Files
  const dashboardPath = path.join(process.cwd(), 'dashboard');
  if (fs.existsSync(dashboardPath)) {
    logger.info({ module: 'SERVER', step: 'SERVING_STATIC', path: dashboardPath });
    app.use(express.static(dashboardPath));
    app.use('/dashboard', express.static(dashboardPath));

    app.get('/dashboard', (_req: Request, res: Response) => {
      res.sendFile(path.join(dashboardPath, 'index.html'));
    });

    app.get('/onboarding', (_req: Request, res: Response) => {
      res.sendFile(path.join(dashboardPath, 'onboarding.html'));
    });
  }

  // Pitch Deck
  app.get('/pitch-deck.html', (_req: Request, res: Response) => {
    res.sendFile(path.join(process.cwd(), 'pitch-deck.html'));
  });

  // Socket.io Setup
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Socket.io connection throttling
  const connectionCounts = new Map<string, number>();
  const MAX_CONNECTIONS_PER_IP = 5;

  io.use((socket, next) => {
    const ip = socket.handshake.address;
    const count = connectionCounts.get(ip) || 0;

    if (count >= MAX_CONNECTIONS_PER_IP) {
      logger.warn({ module: 'SOCKET_SERVER', step: 'CONNECTION_THROTTLED', ip, count });
      return next(new Error('Too many connections from this IP'));
    }

    connectionCounts.set(ip, count + 1);
    next();
  });

  // API Versioning
  const v1Router = express.Router();
  app.use('/v1', v1Router);
  app.use('/v2', routerV2);

  // Apply Auth Middleware
  const authHandler = (req: Request, res: Response, next: any) => {
    const exempt = ['/health', '/quota', '/beta/register', '/sessions/create'];
    const checkPath = req.path.replace(/^\/v1/, '');
    if (exempt.includes(checkPath)) return next();
    authenticateRequest(req, res, next);
  };

  app.use('/api', authHandler);
  v1Router.use('/api', authHandler);

  // REST Endpoints Registration
  const registerRoutes = (router: express.Router) => {
    router.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'OK', timestamp: new Date().toISOString(), version: '1.3.0' });
    });

    router.get('/quota', (_req: Request, res: Response) => {
      const usage = QuotaTracker.getInstance().getUsage();
      res.json(usage);
    });

    router.get('/agent', (_req: Request, res: Response) => {
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

    router.get('/pnl', (_req: Request, res: Response) => {
      try {
        const metrics = getPnLTracker().getMetrics();
        res.json(metrics);
      } catch (e) {
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

    router.get('/audit', (req: Request, res: Response) => {
      const auditPath = path.join(process.cwd(), 'logs/audit.json');
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      if (fs.existsSync(auditPath)) {
        try {
          const content = fs.readFileSync(auditPath, 'utf8');
          const lines = content.trim().split('\n').filter(l => l.length > 0).reverse();
          const startIndex = (page - 1) * limit;
          const endIndex = page * limit;
          const logs = lines.slice(startIndex, endIndex).map(l => JSON.parse(l));

          res.json({
            logs,
            pagination: { page, limit, total: lines.length, pages: Math.ceil(lines.length / limit) }
          });
        } catch (e) {
          res.status(500).json({ error: 'Failed to parse audit logs' });
        }
      } else {
        res.json({ logs: [], pagination: { page, limit, total: 0, pages: 0 } });
      }
    });

    router.get('/automation', (_req: Request, res: Response) => {
      const statePath = path.join(process.cwd(), 'logs/automation_state.json');
      if (fs.existsSync(statePath)) {
        try {
          res.json(JSON.parse(fs.readFileSync(statePath, 'utf8')));
        } catch (e) {
          res.status(500).json({ error: 'Failed to parse automation state' });
        }
      } else {
        res.json({ enabled: false, timestamp: new Date().toISOString() });
      }
    });

    router.post('/automation/toggle', (req: Request, res: Response) => {
      const { enabled } = req.body;
      if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'Invalid enabled state' });

      const statePath = path.join(process.cwd(), 'logs/automation_state.json');
      const data = { enabled, timestamp: new Date().toISOString() };
      try {
        if (!fs.existsSync(path.dirname(statePath))) fs.mkdirSync(path.dirname(statePath), { recursive: true });
        fs.writeFileSync(statePath, JSON.stringify(data, null, 2));
        agentEvents.emit('automation.toggle', { enabled });
        io.emit('automation.sync', { enabled });
        res.json({ success: true, enabled });
      } catch (e) {
        res.status(500).json({ error: 'Failed to save automation state' });
      }
    });

    router.post('/keys/rotate', (_req: Request, res: Response) => {
      try {
        res.json(ApiKeyManager.getInstance().rotateKey());
      } catch (e) {
        res.status(500).json({ error: 'Failed to rotate API keys' });
      }
    });

    router.post('/faucet/request', async (req: Request, res: Response) => {
      const { address } = req.body;
      if (!address || !address.startsWith('0x')) return res.status(400).json({ error: 'Invalid address' });
      try {
        const txHash = await FaucetService.getInstance().requestTestnetFunds(address);
        res.json({ success: true, txHash });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    router.post('/sessions/create', async (req: Request, res: Response) => {
      const { apiKey } = req.body;
      if (!apiKey) return res.status(400).json({ error: 'API Key required' });
      const isValid = await apiKeyManager.validateKey(apiKey);
      if (!isValid) return res.status(401).json({ error: 'Invalid API Key' });
      try {
        const session = await sessionManager.createSession(apiKey);
        if (!session) return res.status(401).json({ error: 'Failed to create session' });
        res.json(session);
      } catch (e) {
        res.status(500).json({ error: 'Session creation failed' });
      }
    });

    router.post('/sessions/revoke', async (req: Request, res: Response) => {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        await sessionManager.revokeSession(token);
      }
      res.json({ success: true });
    });

    router.get('/sessions/me', (req: Request, res: Response) => {
      res.json((req as any).user);
    });

    router.post('/beta/register', async (req: Request, res: Response) => {
      const { address, role } = req.body;
      if (!address) return res.status(400).json({ error: 'Address required' });
      try {
        res.json(await betaAccessService.registerBetaUser(address, role));
      } catch (e: any) {
        if (e.message && e.message.includes('UNIQUE constraint failed')) return res.status(409).json({ error: 'Address already registered' });
        res.status(500).json({ error: 'Beta registration failed' });
      }
    });

    router.get('/beta/users', (_req: Request, res: Response) => {
      res.json(betaAccessService.getBetaUsers());
    });

    router.post('/feedback', async (req: Request, res: Response) => {
      const { agentId, rating, comment, tradeId } = req.body;
      if (!agentId || !rating) return res.status(400).json({ error: 'AgentId and rating required' });
      try {
        res.json(await feedbackService.submitFeedback({ agentId, rating, comment, tradeId }));
      } catch (e) {
        res.status(500).json({ error: 'Feedback submission failed' });
      }
    });

    router.get('/leaderboard', (req: Request, res: Response) => {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const data = LeaderboardService.getInstance().getCachedLeaderboard();
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      res.json({
          data: data.slice(startIndex, endIndex),
          pagination: { page, limit, total: data.length, pages: Math.ceil(data.length / limit) }
      });
    });

    router.get('/markets/pairs', async (req: Request, res: Response) => {
      const exchangeId = (req.query.exchange as string) || 'binance';
      try {
        const pairs = await marketDataService.getSupportedPairs(exchangeId);
        res.json({ exchange: exchangeId, pairs });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    router.post('/orders/oco', async (req: Request, res: Response) => {
      try {
        res.json(await orderManager.placeOCO(req.body));
      } catch (e: any) {
        res.status(400).json({ error: e.message });
      }
    });

    router.post('/orders/stop-limit', async (req: Request, res: Response) => {
      try {
        res.json(await orderManager.placeStopLimit(req.body));
      } catch (e: any) {
        res.status(400).json({ error: e.message });
      }
    });
  };

  const v1ApiRouter = express.Router();
  v1Router.use('/api', v1ApiRouter);
  registerRoutes(v1ApiRouter);

  const legacyRouter = express.Router();
  registerRoutes(legacyRouter);
  app.use('/api', legacyRouter);

  // Socket.io Connection Logic
  io.on('connection', (socket) => {
    const ip = socket.handshake.address;
    logger.info({ module: 'SOCKET_SERVER', step: 'CLIENT_CONNECTED', socketId: socket.id, ip });

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
      const ip = socket.handshake.address;
      const count = connectionCounts.get(ip) || 1;
      connectionCounts.set(ip, count - 1);
      logger.info({ module: 'SOCKET_SERVER', step: 'CLIENT_DISCONNECTED', socketId: socket.id, ip });
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

  agentEvents.on('reputation.update', async () => {
    const leaderboard = await LeaderboardService.getInstance().updateLeaderboard();
    io.emit('leaderboard.update', leaderboard);
  });

  // Background polling for leaderboard
  setInterval(async () => {
      const leaderboard = await LeaderboardService.getInstance().updateLeaderboard();
      io.emit('leaderboard.update', leaderboard);
  }, 30000);

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
