# Issue: Migrate Dashboard from Polling to WebSockets

## Description
The current Sentinel Live Monitor () uses a 5-second polling interval to fetch updates from `logs/audit.json`. For high-frequency trading and real-time security monitoring, this latency is suboptimal.

## Requirements
- Replace the `setInterval(fetchLogs, 5000)` pattern with a WebSocket connection.
- Implement a small WebSocket server in `src/execution/proxy.ts` or a dedicated monitoring service.
- The server should watch `logs/audit.json` (using `fs.watch`) and broadcast new lines to connected clients.
- Ensure the frontend can gracefully reconnect if the socket drops.

## Benefit
- Zero-latency updates for operators.
- Reduced server load (no redundant HTTP requests).
- Real-time visualization of "Fail-Closed" triggers.
