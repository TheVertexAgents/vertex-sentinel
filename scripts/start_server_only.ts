import { startSocketServer } from '../src/orchestrator/socket-server.js';
import { logger } from '../src/utils/logger.js';

logger.info({ module: 'SERVER', message: 'Starting socket server only for verification' });
startSocketServer();
