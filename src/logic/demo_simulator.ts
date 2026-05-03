import { agentEvents } from '../orchestrator/socket-server.js';
import { logger } from '../utils/logger.js';
import { OHLCVCollector } from './strategy/ohlcv_collector.js';

/**
 * @dev Simulation engine for Institutional Demos.
 */
export class DemoSimulator {
  private collector = OHLCVCollector.getInstance();

  /**
   * @dev Injects a fake price drop into the collector to trigger risk responses.
   */
  public async simulateFlashCrash(pair: string, dropPercent: number = 0.15) {
    logger.warn({ module: 'DEMO_SIMULATOR', step: 'FLASH_CRASH_START', pair, dropPercent });

    // Get current price if possible
    const history = this.collector.getHistory(pair);
    let basePrice = 60000; // Default BTC
    if (history.length > 0) {
      basePrice = history[history.length - 1].close;
    }

    const crashPrice = basePrice * (1 - dropPercent);

    // Inject extreme volatility
    for (let i = 0; i < 5; i++) {
        const stepPrice = basePrice - ((basePrice - crashPrice) * (i + 1) / 5);
        this.collector.recordTick(pair, stepPrice);
        logger.info({ module: 'DEMO_SIMULATOR', step: 'INJECT_TICK', pair, price: stepPrice });
    }

    agentEvents.emit('risk.alert', {
        traceId: 'demo-flash-crash',
        riskScore: 0.95,
        reasoning: `FLASH CRASH DETECTED: Price dropped ${(dropPercent * 100).toFixed(0)}% in seconds. HITL mandatory.`
    });
  }
}
