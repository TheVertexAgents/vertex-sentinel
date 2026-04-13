import { spawn } from 'child_process';
import path from 'path';

async function verifyShutdown() {
  console.log("Verifying agent_brain.ts graceful shutdown...");
  
  const env = {
    ...process.env,
    NODE_ENV: 'development',
    NETWORK: 'local',
    TRADING_INTERVAL_MS: '60000', // 60 seconds
    AGENT_PRIVATE_KEY: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    GOOGLE_GENAI_API_KEY: 'test',
    KRAKEN_API_KEY: 'test',
    KRAKEN_SECRET: 'test',
    INFURA_KEY: 'test'
  };

  const agentProcess = spawn(process.execPath, ['--import', 'tsx', '--no-warnings', 'src/logic/agent_brain.ts'], { env });

  let output = '';
  agentProcess.stdout.on('data', (data) => {
    const str = data.toString();
    output += str;
    process.stdout.write(str);
  });

  agentProcess.stderr.on('data', (data) => {
    process.stderr.write(data.toString());
  });

  // Wait for agent to start and enter loop with a timeout
  console.log("Waiting for agent to enter trading loop...");
  await Promise.race([
    new Promise(resolve => {
      const interval = setInterval(() => {
        if (output.includes('Next trade in')) {
          clearInterval(interval);
          resolve(null);
        }
      }, 500);
    }),
    new Promise((_, reject) => setTimeout(() => {
      console.log("\n--- Debug: Full Output so far ---");
      console.log(output);
      reject(new Error("Agent failed to reach trading loop within 30 seconds"));
    }, 30000))
  ]);

  console.log("\n--- Sending SIGINT ---");
  agentProcess.kill('SIGINT');

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.error("❌ FAILED: Agent did not shut down within 10 seconds");
      agentProcess.kill('SIGKILL');
      reject(new Error("Timeout"));
    }, 10000);

    agentProcess.on('close', (code) => {
      clearTimeout(timeout);
      if (output.includes('Agent shutdown complete')) {
        console.log("✅ PASSED: Agent shut down gracefully");
        resolve(null);
      } else {
        console.error("❌ FAILED: Agent shutdown message not found in output");
        reject(new Error("Shutdown message missing"));
      }
    });
  });
}

verifyShutdown().catch(err => {
  console.error(err);
  process.exit(1);
});
