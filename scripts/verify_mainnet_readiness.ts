/**
 * @file verify_mainnet_readiness.ts
 * @description Verification script for the 30-Day Mainnet Launch Plan.
 *
 * Validates all 4 weeks of changes made by the implementation agent (Jules).
 * Run with:  NODE_OPTIONS='--import tsx --no-warnings' npx ts-node scripts/verify_mainnet_readiness.ts
 *
 * Each check is independent. A FAIL does not stop subsequent checks.
 * Exit code 0 = all checks passed. Exit code 1 = one or more checks failed.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createPublicClient, http, parseAbi } from 'viem';
import { sepolia } from 'viem/chains';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ─── Colour helpers ──────────────────────────────────────────────────────────
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

let passed  = 0;
let failed  = 0;
let warned  = 0;
const failures: string[] = [];

function ok(label: string, detail = '')    { passed++;  console.log(`  ${GREEN}✔${RESET} ${label}${detail ? ` ${YELLOW}(${detail})${RESET}` : ''}`); }
function fail(label: string, detail = '')  { failed++;  failures.push(label); console.log(`  ${RED}✘${RESET} ${BOLD}${label}${RESET}${detail ? `\n      ${RED}→ ${detail}${RESET}` : ''}`); }
function warn(label: string, detail = '')  { warned++;  console.log(`  ${YELLOW}⚠${RESET} ${label}${detail ? `\n      ${YELLOW}→ ${detail}${RESET}` : ''}`); }
function section(title: string)            { console.log(`\n${CYAN}${BOLD}══ ${title} ══${RESET}`); }

// ─── File helpers ─────────────────────────────────────────────────────────────
function readFile(rel: string): string | null {
  const full = path.join(ROOT, rel);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
}

function fileExists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

function fileContains(rel: string, pattern: string | RegExp): boolean {
  const content = readFile(rel);
  if (!content) return false;
  return typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content);
}

// ─── WEEK 1: SECURITY HARDENING ───────────────────────────────────────────────
section('WEEK 1 · Security Hardening');

// 1.1 – Hardcoded 'side: buy' in proxy.ts
{
  const proxy = readFile('src/execution/proxy.ts');
  if (!proxy) {
    fail('1.1 proxy.ts exists', 'File not found');
  } else if (/side:\s*['"]buy['"]/i.test(proxy) && !/side:\s*action/i.test(proxy)) {
    fail('1.1 Execution side is dynamic (not hardcoded)',
      "proxy.ts still contains hardcoded `side: 'buy'`. Fix: pass action from TradeAuthorized event.");
  } else if (/side:\s*(action|intent\.action|order\.action)/i.test(proxy)) {
    ok('1.1 Execution side is dynamic', 'side derived from action field');
  } else {
    warn('1.1 Execution side', 'Cannot determine if side is dynamic. Manual review required.');
  }
}

// 1.2 – Slippage enforced in proxy.ts before placing order
{
  const proxy = readFile('src/execution/proxy.ts');
  if (proxy && /maxSlippageBps/i.test(proxy) && /slippage/i.test(proxy)) {
    ok('1.2 Slippage enforcement present in proxy.ts');
  } else {
    fail('1.2 Slippage enforcement in proxy.ts',
      'No slippage validation found before place_order call. Add a pre-execution price check against maxSlippageBps.');
  }
}

// 1.3 – Circle WaaS key management (no raw private key in hot path)
{
  const brain = readFile('src/logic/agent_brain.ts');

  // Check for Circle signer file in any valid location
  const hasCircleSignerFile = fileExists('src/utils/circle-signer.ts') ||
                              fileExists('src/utils/kms-signer.ts') ||
                              fileExists('src/onchain/circle_signer.ts') ||
                              fileExists('src/onchain/circle-signer.ts');

  // Check for @circle-fin imports in key files
  const hasCircleImport = fileContains('src/logic/agent_brain.ts', '@circle-fin') ||
                          fileContains('src/onchain/risk_router.ts', '@circle-fin') ||
                          fileContains('src/onchain/circle_signer.ts', '@circle-fin');

  // Check for USE_CIRCLE_WAAS toggle pattern in agent_brain.ts
  const hasCircleToggle = brain
    ? /USE_CIRCLE_WAAS|useCircle|circle_signer|CircleSigner/i.test(brain)
    : false;

  const hasCircleIntegration = hasCircleSignerFile || hasCircleImport || hasCircleToggle;

  if (hasCircleIntegration) {
    // Verify the signer implementation actually uses @circle-fin SDK
    const signerUsesCircleSDK = fileContains('src/onchain/circle_signer.ts', '@circle-fin') ||
                                fileContains('src/utils/circle-signer.ts', '@circle-fin');
    if (signerUsesCircleSDK) {
      ok('1.3 Circle WaaS signer integrated', 'CircleSigner uses @circle-fin SDK with USE_CIRCLE_WAAS toggle');
    } else if (hasCircleToggle) {
      ok('1.3 Circle WaaS toggle present in agent_brain.ts', 'USE_CIRCLE_WAAS env flag controls signing path');
    } else {
      warn('1.3 Key management', 'Circle signer file found but cannot confirm @circle-fin SDK usage. Verify manually.');
    }
  } else {
    fail('1.3 Key management (Circle WaaS / KMS)',
      'No Circle WaaS integration found. Implement a CircleSigner in src/onchain/circle_signer.ts ' +
      'and add USE_CIRCLE_WAAS toggle in agent_brain.ts.');
  }
}

// 1.4 – Multi-sig: RiskRouter constructor should accept a safe/owner address
{
  const router = readFile('contracts/RiskRouter.sol');
  if (!router) {
    fail('1.4 RiskRouter.sol exists', 'File not found');
  } else {
    // Check that setRiskParams is no longer callable by a raw EOA without multi-sig
    const hasMultiSigGuard = /Ownable2Step|TimelockController|Safe|_checkOwner/i.test(router) ||
      /onlyOwner/.test(router) && /transferOwnership/i.test(router);
    const acceptsSafeAddress = /address.*owner|address.*_safe|address.*_multisig/i.test(router);

    if (hasMultiSigGuard || acceptsSafeAddress) {
      ok('1.4 RiskRouter ownership is upgradeable to multi-sig');
    } else {
      fail('1.4 Multi-sig ownership preparation',
        'RiskRouter.sol constructor still uses hardcoded single-EOA ownership. ' +
        'Use OpenZeppelin Ownable2Step or accept a Safe address in constructor.');
    }
  }
}

// 1.4b – Multi-sig deployment script
{
  const hasDeployScript = fileExists('scripts/deploy_safe_multisig.ts') ||
                          fileExists('scripts/transfer_ownership_to_safe.ts') ||
                          fileContains('scripts/deploy_sepolia.ts', 'Safe');
  if (hasDeployScript) {
    ok('1.4 Multi-sig deployment/transfer script exists');
  } else {
    warn('1.4 Multi-sig script', 'No Safe deployment/transfer script found. Create scripts/transfer_ownership_to_safe.ts');
  }
}

// 1.5 – AgentStack fallback mode (not a hard halt)
{
  const risk = readFile('src/logic/strategy/risk_assessment.ts');
  if (risk) {
    const hasHardHalt   = /verification\.verified.*HOLD.*Verification Gateway/i.test(risk);
    const hasFallback   = /AGENTSTACK_REQUIRED|agentStackRequired|agentstack_required/i.test(risk);
    if (!hasHardHalt && !hasFallback) {
      ok('1.5 AgentStack hard-halt already removed');
    } else if (hasFallback) {
      ok('1.5 AgentStack has configurable fallback (AGENTSTACK_REQUIRED flag)');
    } else {
      fail('1.5 AgentStack single-point-of-failure',
        'risk_assessment.ts still returns action:HOLD whenever AgentStack is unreachable. ' +
        "Add env flag: if (!verification.verified && !process.env.AGENTSTACK_REQUIRED) { /* continue with local */ }");
    }
  }
}

// ─── WEEK 2: INFRASTRUCTURE & RELIABILITY ────────────────────────────────────
section('WEEK 2 · Infrastructure & Reliability');

// 2.1 – Chainlink oracle in RiskRouter.sol
{
  const router = readFile('contracts/RiskRouter.sol');
  if (router) {
    const hasChainlink = /AggregatorV3Interface|latestRoundData|chainlink/i.test(router);
    const hasOracleConfig = fileExists('src/config/chainlink-feeds.ts') ||
                            fileExists('config/chainlink-feeds.json') ||
                            fileContains('contracts/RiskRouter.sol', 'priceFeed');
    if (hasChainlink && hasOracleConfig) {
      ok('2.1 Chainlink price oracle integrated in RiskRouter + config file present');
    } else if (hasChainlink) {
      ok('2.1 Chainlink integrated in RiskRouter.sol');
      warn('2.1 Chainlink config file', 'No chainlink-feeds.ts/json config found. Create config/chainlink-feeds.ts mapping BTC/ETH/SOL to aggregator addresses.');
    } else {
      fail('2.1 Chainlink oracle not found in RiskRouter.sol',
        'Add AggregatorV3Interface import and call latestRoundData() to verify amountUsdScaled against real price.');
    }
  }
}

// 2.2 – Event reconciliation loop
{
  const hasReconciler = fileExists('src/execution/reconciler.ts') ||
                        fileExists('src/execution/reconciler.js');
  const hasDb         = fileContains('src/execution/reconciler.ts', 'executed_intents') ||
                        fileContains('src/execution/proxy.ts', 'executed_intents');
  if (hasReconciler && hasDb) {
    ok('2.2 Reconciliation loop present with executed_intents persistence');
  } else if (hasReconciler) {
    ok('2.2 reconciler.ts exists');
    warn('2.2 executed_intents.db persistence', 'Reconciler found but no executed_intents DB reference. Ensure SQLite/JSON log tracks executed intents.');
  } else {
    fail('2.2 Event reconciliation loop',
      'No reconciler.ts found. Create src/execution/reconciler.ts that polls TradeAuthorized events and re-executes missed ones.');
  }
}

// 2.3 – Mainnet chain support in getChain()
{
  const routerClient = readFile('src/onchain/risk_router.ts');
  if (routerClient) {
    const supportsMainnet = /mainnet|base|arbitrum/i.test(routerClient);
    if (supportsMainnet) {
      ok('2.3 Mainnet/L2 chain routing present in risk_router.ts');
    } else {
      fail('2.3 Mainnet chain support',
        "risk_router.ts getChain() only supports 'sepolia | hardhat'. Add 'mainnet', 'base', 'arbitrum' routing.");
    }
  }
}

// 2.4 – PRISM API (no longer a TODO placeholder)
{
  const brain = readFile('src/logic/agent_brain.ts');
  if (brain) {
    const isStillPlaceholder = /TODO.*PRISM|placeholder.*PRISM|Using placeholder resolution/i.test(brain);
    const hasRealCall        = /prismapi\.ai|STRYKR_PRISM_API.*fetch|fetch.*prismapi/i.test(brain);
    if (hasRealCall) {
      ok('2.4 PRISM API integration implemented');
    } else if (isStillPlaceholder) {
      fail('2.4 PRISM API still a placeholder',
        'getAssetResolution() in agent_brain.ts is still a placeholder. ' +
        'Implement a real REST call to https://api.prismapi.ai/resolve using STRYKR_PRISM_API key.');
    } else {
      warn('2.4 PRISM API', 'Cannot confirm status. Verify getAssetResolution() is no longer a TODO.');
    }
  }
}

// ─── WEEK 3: USER-FACING PRODUCT ─────────────────────────────────────────────
section('WEEK 3 · User-Facing Product');

// 3.1 – Onboarding flow
{
  const hasLanding   = fileExists('dashboard/landing.html') || fileExists('dashboard/onboarding.html');
  const hasWizard    = fileExists('dashboard/onboarding.html') || fileExists('dashboard/wizard.html') ||
                       fileContains('dashboard/index.html', 'onboarding') ||
                       fileContains('dashboard/index.html', 'wizard');
  if (hasLanding && hasWizard) {
    ok('3.1 Landing page + onboarding wizard files exist');
  } else if (hasLanding || hasWizard) {
    warn('3.1 Onboarding', 'Landing page OR wizard found but not both. Ensure both landing.html and onboarding.html exist in dashboard/.');
  } else {
    fail('3.1 Onboarding flow',
      'No landing.html or onboarding wizard found. Create dashboard/landing.html and dashboard/onboarding.html.');
  }
}

// 3.2 – Dashboard: no hardcoded mock data
{
  const dashboard = readFile('dashboard/index.html');
  if (dashboard) {
    const mockValues = [
      { pattern: /420\.69 ARC/,                label: 'hardcoded ARC balance (420.69 ARC)' },
      { pattern: /in 12 hours/,                label: 'hardcoded "Next Payment: in 12 hours"' },
      { pattern: /Agent #42.*hardcoded/i,      label: 'hardcoded Agent #42' },
    ];
    let hasMocks = false;
    for (const { pattern, label } of mockValues) {
      if (pattern.test(dashboard)) {
        fail(`3.2 Dashboard mock data: ${label}`);
        hasMocks = true;
      }
    }
    if (!hasMocks) ok('3.2 Dashboard has no obvious hardcoded mock values');
  }
}

// 3.2b – Dashboard connected to live WebSocket
{
  const dashboard = readFile('dashboard/index.html');
  if (dashboard) {
    const hasSocket = /socket\.io|io\(|initWebSocket/i.test(dashboard);
    if (hasSocket) {
      ok('3.2 Dashboard connected to WebSocket');
    } else {
      fail('3.2 Dashboard WebSocket', 'No Socket.IO connection found in dashboard/index.html.');
    }
  }
}

// 3.3 – Notifications/alerts service
{
  const hasSendGrid  = fileExists('src/utils/notifications.ts') &&
                       fileContains('src/utils/notifications.ts', 'sendgrid');
  const hasTelegram  = fileExists('src/utils/notifications.ts') &&
                       fileContains('src/utils/notifications.ts', 'telegram');
  const hasAnyAlert  = fileExists('src/utils/notifications.ts') ||
                       fileExists('src/utils/alerts.ts');
  if (hasSendGrid && hasTelegram) {
    ok('3.3 Alerts: SendGrid (email) + Telegram bot both present');
  } else if (hasAnyAlert) {
    warn('3.3 Alerts', 'Notification file found but missing SendGrid and/or Telegram. Implement both in src/utils/notifications.ts');
  } else {
    fail('3.3 Alerts & notifications',
      'No notifications.ts found. Create src/utils/notifications.ts with SendGrid (email) + Telegram Bot API support.');
  }
}

// 3.4 – Paper trading mode wired end-to-end
{
  const envExample = readFile('.env.example');
  const proxy      = readFile('src/execution/proxy.ts');
  const hasEnvVar  = envExample ? /KRAKEN_PAPER_MODE/i.test(envExample) : false;
  const proxySees  = proxy      ? /KRAKEN_PAPER_MODE|paper_mode|paperMode/i.test(proxy) : false;
  if (hasEnvVar && proxySees) {
    ok('3.4 Paper trading mode is wired through execution proxy');
  } else if (hasEnvVar) {
    fail('3.4 Paper trading end-to-end',
      'KRAKEN_PAPER_MODE exists in .env.example but proxy.ts does not read it. Wire it through the full execution stack.');
  } else {
    fail('3.4 Paper trading mode', 'KRAKEN_PAPER_MODE not found. Add to .env.example and wire through proxy.ts.');
  }
}

// ─── WEEK 4: AUDIT, COMPLIANCE & LAUNCH ──────────────────────────────────────
section('WEEK 4 · Audit, Compliance & Launch');

// 4.1 – Mainnet deployment file
{
  const hasMainnetDeployment = fileExists('deployments_mainnet.json') || fileExists('deployments_base.json');
  if (hasMainnetDeployment) {
    ok('4.1 Mainnet deployment file exists');
  } else {
    warn('4.1 Mainnet deployment file',
      'No deployments_mainnet.json found. This is expected if mainnet deploy has not run yet.');
  }
}

// 4.1b – Hardhat config supports mainnet
{
  const hardhatConfig = readFile('hardhat.config.cjs') || readFile('hardhat.config.ts');
  if (hardhatConfig && /mainnet|base|arbitrum/i.test(hardhatConfig)) {
    ok('4.1 hardhat.config supports mainnet network');
  } else {
    fail('4.1 Hardhat mainnet config',
      'hardhat.config does not define a mainnet/base network. Add it for deployment.');
  }
}

// 4.2 – Legal / Terms of Service placeholder
{
  const hasTos = fileExists('dashboard/terms.html') || fileExists('docs/TERMS.md');
  if (hasTos) {
    ok('4.2 Terms of Service document exists');
  } else {
    warn('4.2 Legal/ToS', 'No terms.html or TERMS.md found. Create a ToS page before public launch.');
  }
}

// 4.2b – Geographic restriction hook
{
  const hasGeoBlock = fileContains('dashboard/index.html', 'geo') ||
                      fileContains('dashboard/landing.html', 'geo') ||
                      fileExists('src/utils/geo-restrict.ts');
  if (hasGeoBlock) {
    ok('4.2 Geographic restriction logic present');
  } else {
    warn('4.2 Geographic restriction', 'No geo-block found. Consider restricting US/UK before public launch.');
  }
}

// 4.3 – Staged rollout config
{
  const hasRollout = fileExists('config/rollout.json') || fileExists('config/rollout.ts') ||
                     fileContains('.env.example', 'MAX_USERS') ||
                     fileContains('.env.example', 'ROLLOUT_PHASE');
  if (hasRollout) {
    ok('4.3 Staged rollout configuration present');
  } else {
    warn('4.3 Staged rollout', 'No rollout config found. Add ROLLOUT_PHASE and MAX_USERS to .env.example for alpha/beta/public control.');
  }
}

// 4.4 – env.ts updated for Circle + mainnet vars
{
  const envSchema = readFile('src/logic/env.ts');
  if (envSchema) {
    const hasCircleKey    = /CIRCLE_API_KEY|CIRCLE_ENTITY_SECRET/i.test(envSchema);
    const hasMainnetVars  = /MAINNET_RPC|BASE_RPC|ARBITRUM_RPC/i.test(envSchema);
    if (hasCircleKey) ok('4.4 CIRCLE_API_KEY added to env validator');
    else warn('4.4 env.ts', 'CIRCLE_API_KEY not in env schema. Add to src/logic/env.ts if Circle WaaS is used.');
    if (hasMainnetVars) ok('4.4 Mainnet RPC vars added to env validator');
    else warn('4.4 env.ts', 'No MAINNET_RPC in env schema. Add for production network support.');
  }
}

// ─── LIVE CONNECTIVITY CHECK (optional, requires INFURA_KEY) ─────────────────
section('LIVE · Contract Connectivity (Sepolia)');

async function checkLiveContract() {
  const infuraKey = process.env.INFURA_KEY;
  const routerAddress = '0xd6A6952545FF6E6E6681c2d15C59f9EB8F40FdBC';

  if (!infuraKey) {
    warn('LIVE check skipped', 'INFURA_KEY not set in environment.');
    return;
  }

  try {
    const client = createPublicClient({
      chain: sepolia,
      transport: http(`https://sepolia.infura.io/v3/${infuraKey}`)
    });

    const code = await client.getBytecode({ address: routerAddress as `0x${string}` });
    if (code && code !== '0x') {
      ok('RiskRouter bytecode present on Sepolia', routerAddress);
    } else {
      fail('RiskRouter bytecode', `No bytecode at ${routerAddress}`);
    }

    // Try reading owner / nonce for agent 1
    const abi = parseAbi(['function getIntentNonce(uint256 agentId) view returns (uint256)']);
    const nonce = await client.readContract({ address: routerAddress as `0x${string}`, abi, functionName: 'getIntentNonce', args: [1n] });
    ok(`RiskRouter.getIntentNonce(1) = ${nonce.toString()}`, 'Contract callable');

  } catch (err: any) {
    fail('Live contract connectivity', err.message);
  }
}

await checkLiveContract();

// ─── CONTRACT EVENT SIGNATURE CHECK ──────────────────────────────────────────
section('CONTRACT · TradeAuthorized Event Signature');

{
  const router = readFile('contracts/RiskRouter.sol');
  if (router) {
    // Week 1.1: Event must include 'action' for the proxy to know the trade side
    const hasActionInEvent    = /TradeAuthorized.*action|event TradeAuthorized[^;]*action/i.test(router);
    // Week 1.2: Event should include slippage or proxy must have it from intent
    const hasSlippageInEvent  = /TradeAuthorized.*slippage|event TradeAuthorized[^;]*slippage/i.test(router);

    if (hasActionInEvent) {
      ok('TradeAuthorized event includes `action` field (enables proxy to use correct side)');
    } else {
      fail('TradeAuthorized event missing `action` field',
        "Current event: (bytes32 intentHash, address agent, string pair, uint256 amountUsdScaled). " +
        "Add `string action` to allow proxy to distinguish BUY vs SELL.");
    }

    if (hasSlippageInEvent) {
      ok('TradeAuthorized event includes slippage data');
    } else {
      warn('TradeAuthorized slippage',
        'maxSlippageBps not in event. Ensure proxy reads it from signed intent or add to event.');
    }
  }
}

// ─── SUMMARY ──────────────────────────────────────────────────────────────────
console.log(`\n${CYAN}${BOLD}══ VERIFICATION SUMMARY ══${RESET}`);
console.log(`  ${GREEN}Passed${RESET}:   ${passed}`);
console.log(`  ${YELLOW}Warnings${RESET}: ${warned}`);
console.log(`  ${RED}Failed${RESET}:   ${failed}`);

if (failures.length > 0) {
  console.log(`\n${RED}${BOLD}Critical failures:${RESET}`);
  failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
}

const score = Math.round((passed / (passed + failed)) * 100);
console.log(`\n${BOLD}Mainnet Readiness Score: ${score >= 80 ? GREEN : score >= 60 ? YELLOW : RED}${score}%${RESET}\n`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
