import { io } from 'socket.io-client';
import { startSocketServer, agentEvents } from '../src/orchestrator/socket-server.js';

/**
 * @dev Measures end-to-end latency from event trigger to dashboard update.
 */
async function main() {
  console.log("Starting WebSocket Latency Test...");

  // 1. Start Server
  startSocketServer();

  // 2. Connect Client
  const socket = io('http://localhost:3006');

  socket.on('connect', () => {
    console.log("Client connected. Measuring latency...");

    const startTime = Date.now();

    socket.on('trade.authorized', (data) => {
      const endTime = Date.now();
      console.log(`Latency: ${endTime - startTime}ms`);
      process.exit(0);
    });

    // 3. Trigger Event
    agentEvents.emit('trade.authorized', { traceId: 'test-latency', pair: 'BTC/USD', amount: 100 });
  });

  setTimeout(() => {
    console.error("Test timed out.");
    process.exit(1);
  }, 5000);
}

main();
