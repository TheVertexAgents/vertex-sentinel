import http from 'http';

/**
 * @dev Mock AgentStack Orchestrator Gateway.
 * Simulates Arc L1 settlement and data verification.
 */
const PORT = 3003;

const server = http.createServer((req, res) => {
  // Set CORS headers for local dashboard testing if needed
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/orchestrate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      console.log(`[MOCK_GATEWAY] Received Request: ${body}`);

      const response = {
        settlementHash: `0x${Math.random().toString(16).substring(2, 66).padEnd(64, '0')}`,
        timestamp: new Date().toISOString(),
        workers: [
          { id: 'worker-01', status: 'verified', contribution: 0.85 },
          { id: 'worker-02', status: 'verified', contribution: 0.15 }
        ],
        status: 'success'
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      console.log(`[MOCK_GATEWAY] Responded with Proof: ${response.settlementHash}`);
    });
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not Found' }));
  }
});

server.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║      🛡️  ARC L1 MOCK GATEWAY — VERIFICATION LAYER 🛡️        ║`);
  console.log(`╚══════════════════════════════════════════════════════════════╝`);
  console.log(`  Listening on: http://localhost:${PORT}`);
  console.log(`  Endpoint: /orchestrate`);
  console.log(`  Mode: Settlement Proof Emulation\n`);
});
