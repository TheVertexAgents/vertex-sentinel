import { DemoSimulator } from '../src/logic/demo_simulator.js';
import { logger } from '../src/utils/logger.js';

async function main() {
    const simulator = new DemoSimulator();
    const pair = 'BTC/USDC';

    logger.info({ module: 'FLASH_CRASH_DEMO', step: 'START', pair });

    // 1. Initial healthy ticks
    logger.info({ module: 'FLASH_CRASH_DEMO', step: 'PRE_CRASH_TICKS' });
    // Simulate some stable prices
    const { OHLCVCollector } = await import('../src/logic/strategy/ohlcv_collector.js');
    const collector = OHLCVCollector.getInstance();
    for (let i = 0; i < 10; i++) {
        collector.recordTick(pair, 60000 + Math.random() * 100);
    }

    // 2. Trigger Flash Crash
    await simulator.simulateFlashCrash(pair, 0.20); // 20% drop

    logger.info({ module: 'FLASH_CRASH_DEMO', step: 'CRASH_INJECTED', pair });

    // Check volatility
    const vol = collector.calculateVolatility(pair);
    logger.info({ module: 'FLASH_CRASH_DEMO', step: 'VOLATILITY_CHECK', volatility: vol });

    if (vol > 0.05) {
        logger.warn({ module: 'FLASH_CRASH_DEMO', step: 'RESULT', message: 'VOLATILITY THRESHOLD BREACHED. HITL OVERRIDE ACTIVE.' });
    } else {
        logger.error({ module: 'FLASH_CRASH_DEMO', step: 'RESULT', message: 'FAIL: Volatility did not trigger override.' });
    }
}

main().catch(console.error);
