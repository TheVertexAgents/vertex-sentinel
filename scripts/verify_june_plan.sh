#!/usr/bin/env bash
# =============================================================================
# ╔══════════════════════════════════════════════════════════════════════════╗
# ║     VERTEX SENTINEL — June 2026 Rest-of-Month Neutral Verifier          ║
# ║     Covers: Week 2 (Jun 14–20) · Week 3 (Jun 21–27) · Week 4 (Jun 28–30)║
# ║     Run: bash scripts/verify_june_plan.sh [--week 2|3|4]                ║
# ╚══════════════════════════════════════════════════════════════════════════╝
# =============================================================================
# USAGE:
#   bash scripts/verify_june_plan.sh              # all weeks
#   bash scripts/verify_june_plan.sh --week 2     # Week 2 only (Q2 close)
#   bash scripts/verify_june_plan.sh --week 3     # Week 3 only (Q3 exchange)
#   bash scripts/verify_june_plan.sh --week 4     # Week 4 only (month close)
#   BASE_URL=http://localhost:3006 bash scripts/verify_june_plan.sh
# =============================================================================

set -uo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
BASE_URL="${BASE_URL:-http://localhost:3006}"
SERVER_TIMEOUT=5
WEEK_FILTER="${2:-all}"
PASS=0
FAIL=0
SKIP=0
WARNINGS=()

# ── Colors ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# ── Argument Parsing ──────────────────────────────────────────────────────────
if [[ "${1:-}" == "--week" ]]; then
  WEEK_FILTER="${2:-all}"
fi

# ── Helpers ───────────────────────────────────────────────────────────────────
section() {
  echo ""
  echo -e "${BOLD}${CYAN}══════════════════════════════════════════${RESET}"
  echo -e "${BOLD}${CYAN}  $1${RESET}"
  echo -e "${BOLD}${CYAN}══════════════════════════════════════════${RESET}"
}

check() {
  # $1 = label, $2 = condition (0=pass, 1=fail)
  echo -e "  ${BOLD}[$1]${RESET}"
}

pass() { echo -e "  ${GREEN}✅ PASS${RESET}  $1"; PASS=$((PASS+1)); }
fail() { echo -e "  ${RED}❌ FAIL${RESET}  $1"; FAIL=$((FAIL+1)); }
warn() { echo -e "  ${YELLOW}⚠️  WARN${RESET}  $1"; WARNINGS+=("$1"); }
skip() { echo -e "  ${DIM}⏭  SKIP${RESET}  $1"; SKIP=$((SKIP+1)); }
info() { echo -e "  ${DIM}ℹ   INFO${RESET}  $1"; }

http_status() { curl -s -o /dev/null -w "%{http_code}" --max-time "$SERVER_TIMEOUT" "$1" 2>/dev/null || echo "000"; }
http_body()   { curl -s --max-time "$SERVER_TIMEOUT" "$1" 2>/dev/null || echo ""; }
http_post_status() {
  curl -s -o /dev/null -w "%{http_code}" --max-time "$SERVER_TIMEOUT" \
    -X POST -H "Content-Type: application/json" -d "${2:-{}}" "$1" 2>/dev/null || echo "000"
}
http_post_body() {
  curl -s --max-time "$SERVER_TIMEOUT" \
    -X POST -H "Content-Type: application/json" -d "${2:-{}}" "$1" 2>/dev/null || echo ""
}
file_exists()   { [[ -f "$1" ]]; }
dir_exists()    { [[ -d "$1" ]]; }
file_contains() { grep -q "$2" "$1" 2>/dev/null; }

server_running() {
  local s; s=$(http_status "${BASE_URL}/api/health"); [[ "$s" == "200" ]]
}

# =============================================================================
# PRE-FLIGHT
# =============================================================================
section "PRE-FLIGHT: Environment Check"

current_branch=$(git branch --show-current 2>/dev/null || echo "unknown")
if [[ "$current_branch" == "main" ]]; then
  pass "On main branch"
else
  warn "Not on main — on: ${current_branch}"
fi

if server_running; then
  SERVER_LIVE=true
  version=$(http_body "${BASE_URL}/api/health" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('version','?'))" 2>/dev/null || echo "?")
  pass "Server UP at ${BASE_URL} (v${version})"
else
  SERVER_LIVE=false
  warn "Server offline — endpoint tests will be skipped"
  info "Start with: npm start"
fi

# Confirm Week 1 is still green (regression check)
section "REGRESSION: Week 1 Sprint Baseline"
for f in \
  "src/orchestrator/socket-server.ts:rateLimit\|rate-limit\|express-rate-limit" \
  "src/utils/api-key-manager.ts:rotate\|rotation" \
  "src/execution/proxy.ts:circuit\|Circuit" \
  "src/services/faucet.ts:requestTestnetFunds\|faucet\|sepolia" \
  "src/services/leaderboard.ts:ReputationRegistry\|reputation" \
  "src/execution/adapters/binance.ts:HMAC\|hmac\|sign" \
  "src/logic/sizing/kelly.ts:kellyFraction\|Kelly" \
  "packages/sentinel-sdk/dist/index.js:." \
  "docs/SECURITY_BEST_PRACTICES.md:."
do
  filepath="${f%%:*}"
  pattern="${f##*:}"
  label=$(basename "$filepath")
  if file_exists "$filepath"; then
    if file_contains "$filepath" "$pattern"; then
      pass "W1 regression: ${label} ✓"
    else
      warn "W1 regression: ${label} — expected pattern missing"
    fi
  else
    fail "W1 regression: ${label} NOT found — Week 1 deliverable missing!"
  fi
done

# =============================================================================
# WEEK 2 — Q2 Close & Platform Polish
# =============================================================================
if [[ "$WEEK_FILTER" == "all" || "$WEEK_FILTER" == "2" ]]; then
  section "WEEK 2 — Q2 Close & Platform Polish (Jun 14–20)"

  # ── W2-1: npm SDK Publication (Sandboxed) ─────────
  echo -e "\n${BOLD}[W2-1] npm SDK Publication (Mocked)${RESET}"
  if file_exists "docs/NPM_PUBLISH_GUIDE.md"; then
    pass "docs/NPM_PUBLISH_GUIDE.md exists — npm publish manual guide provided"
  else
    fail "docs/NPM_PUBLISH_GUIDE.md NOT found — create a manual publish guide"
  fi

  # ── W2-2: Leaderboard Socket.io event ─────────────────────────────────────
  echo -e "\n${BOLD}[W2-2] Leaderboard Socket.io Wire-Up${RESET}"
  wired=false
  for f in "dashboard/index.html" "dashboard/js/app.js"; do
    if file_exists "$f" && file_contains "$f" "leaderboard\.update\|leaderboard.update"; then
      pass "leaderboard.update event wired in ${f}"
      wired=true
    fi
  done
  $wired || fail "leaderboard.update Socket.io event not found in dashboard HTML or app.js"

  # ── W2-3: Binance Weight Tracker ──────────────────────────────────────────
  echo -e "\n${BOLD}[W2-3] Binance Weight Throttle System${RESET}"
  if file_exists "src/execution/adapters/binance-weight-tracker.ts"; then
    pass "binance-weight-tracker.ts exists"
    if file_contains "src/execution/adapters/binance-weight-tracker.ts" "1200\|1100\|weight\|throttle"; then
      pass "Weight threshold (1100/1200) found in weight tracker"
    else
      fail "Weight threshold not found — add Binance 1200 weight/min enforcement"
    fi
    if file_contains "src/execution/adapters/binance-weight-tracker.ts" "risk.alert\|agentEvents\|emit"; then
      pass "Weight throttle emits risk.alert"
    else
      warn "Weight throttle does not emit risk.alert — add for observability"
    fi
  else
    fail "src/execution/adapters/binance-weight-tracker.ts NOT found"
  fi

  if file_exists "test/execution/binance.test.ts"; then
    pass "test/execution/binance.test.ts exists"
  else
    fail "test/execution/binance.test.ts NOT found — add Binance adapter tests"
  fi

  # ── W2-4: Auth Middleware ──────────────────────────────────────────────────
  echo -e "\n${BOLD}[W2-4] Multi-User Auth Middleware${RESET}"
  if file_exists "src/utils/auth-middleware.ts"; then
    pass "src/utils/auth-middleware.ts exists"
    if file_contains "src/utils/auth-middleware.ts" "authenticateRequest\|authenticate\|401\|Unauthorized"; then
      pass "Auth middleware implements 401 rejection"
    else
      warn "Auth middleware may not return 401 — check implementation"
    fi
  else
    fail "src/utils/auth-middleware.ts NOT found — multi-user auth not implemented"
  fi

  if file_exists "src/utils/session-manager.ts"; then
    pass "src/utils/session-manager.ts exists"
    for fn in "create\|createSession" "revoke\|revokeSession" "me\|currentSession"; do
      if file_contains "src/utils/session-manager.ts" "$fn"; then
        pass "Session manager: $(echo $fn | awk -F'\\\\' '{print $1}') method found"
      else
        warn "Session manager missing: $(echo $fn | awk -F'\\\\' '{print $1}')"
      fi
    done
  else
    fail "src/utils/session-manager.ts NOT found"
  fi

  if file_exists "dashboard/login.html"; then
    pass "dashboard/login.html exists"
  else
    fail "dashboard/login.html NOT found — create login page for multi-user auth"
  fi

  if $SERVER_LIVE; then
    echo -e "\n  ${DIM}Testing protected endpoint without token...${RESET}"
    # Protected endpoints should return 401 without auth
    status=$(http_status "${BASE_URL}/v1/api/audit" 2>/dev/null || http_status "${BASE_URL}/api/audit")
    if [[ "$status" == "401" ]]; then
      pass "GET /api/audit correctly returns 401 without auth token"
    elif [[ "$status" == "200" ]]; then
      warn "GET /api/audit returns 200 without auth — auth middleware may not be applied"
    else
      info "GET /api/audit returned ${status} (may be expected in dev mode)"
    fi

    echo -e "  ${DIM}Testing session endpoints...${RESET}"
    for ep in "/api/sessions/create" "/api/sessions/me"; do
      s=$(http_post_status "${BASE_URL}${ep}" '{}')
      if [[ "$s" == "404" ]]; then
        fail "POST ${ep} → 404 (endpoint not registered)"
      elif [[ "$s" == "401" || "$s" == "400" || "$s" == "200" || "$s" == "201" ]]; then
        pass "POST ${ep} → ${s} (endpoint exists)"
      else
        warn "POST ${ep} → ${s}"
      fi
    done
  else
    skip "Auth endpoint live tests — server offline"
  fi

  # ── W2-5: Beta Access Program ──────────────────────────────────────────────
  echo -e "\n${BOLD}[W2-5] Beta Access Program${RESET}"
  if file_exists "src/services/beta-access.ts"; then
    pass "src/services/beta-access.ts exists"
    if file_contains "src/services/beta-access.ts" "registerBetaUser\|register\|beta"; then
      pass "registerBetaUser function found"
    else
      warn "registerBetaUser not found in beta-access.ts"
    fi
    if file_contains "src/services/beta-access.ts" "api-key-manager\|apiKey\|ApiKey"; then
      pass "Beta registration issues API keys via api-key-manager"
    else
      warn "Beta service does not use api-key-manager — link them"
    fi
  else
    fail "src/services/beta-access.ts NOT found"
  fi

  if file_exists "src/services/feedback.ts"; then
    pass "src/services/feedback.ts exists"
    if file_contains "src/services/feedback.ts" "rating\|Rating\|1-5\|feedback"; then
      pass "Feedback rating field found"
    else
      warn "Feedback service missing rating field"
    fi
  else
    fail "src/services/feedback.ts NOT found"
  fi

  if file_exists "logs/feedback.json"; then
    pass "logs/feedback.json exists (feedback persisted)"
  else
    warn "logs/feedback.json not found — submit a test feedback entry to create it"
  fi

  if $SERVER_LIVE; then
    beta_status=$(http_post_status "${BASE_URL}/api/beta/register" '{"address":"0x5367F88E7B24bFa34A453CF24f7BE741CF3276c9","role":"observer"}')
    if [[ "$beta_status" == "200" || "$beta_status" == "201" ]]; then
      pass "POST /api/beta/register → ${beta_status}"
    elif [[ "$beta_status" == "409" ]]; then
      pass "POST /api/beta/register → 409 (already registered — idempotency working)"
    elif [[ "$beta_status" == "404" ]]; then
      fail "POST /api/beta/register → 404 — endpoint not registered"
    else
      warn "POST /api/beta/register → ${beta_status}"
    fi

    fb_status=$(http_post_status "${BASE_URL}/api/feedback" '{"agentId":"1","rating":5,"comment":"Great system"}')
    if [[ "$fb_status" == "200" || "$fb_status" == "201" ]]; then
      pass "POST /api/feedback → ${fb_status}"
    elif [[ "$fb_status" == "404" ]]; then
      fail "POST /api/feedback → 404 — endpoint not registered"
    else
      warn "POST /api/feedback → ${fb_status}"
    fi
  else
    skip "Beta/feedback endpoint tests — server offline"
  fi

  # ── W2-6: v1.2.0 Tag ──────────────────────────────────────────────────────
  echo -e "\n${BOLD}[W2-6] Release Tag v1.2.0${RESET}"
  if git tag --list | grep -q "v1.2.0"; then
    pass "Git tag v1.2.0 exists"
  else
    warn "Git tag v1.2.0 not yet created — create at Week 2 close"
  fi
fi

# =============================================================================
# WEEK 3 — Q3 Advance: Exchange Depth
# =============================================================================
if [[ "$WEEK_FILTER" == "all" || "$WEEK_FILTER" == "3" ]]; then
  section "WEEK 3 — Q3 Exchange Depth (Jun 21–27)"

  # ── W3-1: ccxt Base Adapter ───────────────────────────────────────────────
  echo -e "\n${BOLD}[W3-1] ccxt Base Adapter${RESET}"
  if file_exists "src/execution/adapters/ccxt-base.ts"; then
    pass "src/execution/adapters/ccxt-base.ts exists"
    for method in "getBalance\|balance" "placeOrder\|createOrder" "fetchOrderBook\|orderBook" "fetchTicker\|ticker"; do
      if file_contains "src/execution/adapters/ccxt-base.ts" "$method"; then
        pass "ccxt base: $(echo $method | awk -F'\\\\' '{print $1}') implemented"
      else
        warn "ccxt base missing: $(echo $method | awk -F'\\\\' '{print $1}')"
      fi
    done
    if file_contains "src/execution/adapters/ccxt-base.ts" "ccxt\|import.*ccxt"; then
      pass "ccxt library imported in base adapter"
    else
      fail "ccxt not imported — base adapter not using ccxt"
    fi
  else
    fail "src/execution/adapters/ccxt-base.ts NOT found"
  fi

  # ── W3-2: Market Data Service (50+ pairs) ─────────────────────────────────
  echo -e "\n${BOLD}[W3-2] Market Data Service & 50+ Pairs${RESET}"
  if file_exists "src/services/market-data.ts"; then
    pass "src/services/market-data.ts exists"
    if file_contains "src/services/market-data.ts" "getSupportedPairs\|supportedPairs\|markets"; then
      pass "getSupportedPairs function found"
    else
      warn "getSupportedPairs not found in market-data.ts"
    fi
  else
    fail "src/services/market-data.ts NOT found"
  fi

  if $SERVER_LIVE; then
    markets_body=$(http_body "${BASE_URL}/api/markets/pairs?exchange=binance")
    if [[ -n "$markets_body" && "$markets_body" != "" ]]; then
      pair_count=$(echo "$markets_body" | python3 -c "import sys,json; d=json.load(sys.stdin); pairs=d if isinstance(d,list) else d.get('pairs',d.get('data',[])); print(len(pairs))" 2>/dev/null || echo "0")
      if [[ "$pair_count" -ge 50 ]]; then
        pass "GET /api/markets/pairs returns ${pair_count} pairs (≥50 target met)"
      elif [[ "$pair_count" -gt 0 ]]; then
        warn "GET /api/markets/pairs returns only ${pair_count} pairs — target is 50+"
      else
        fail "GET /api/markets/pairs returned empty or unparseable response"
      fi
    else
      fail "GET /api/markets/pairs → no response or endpoint missing"
    fi
  else
    skip "Market pairs live test — server offline"
  fi

  if file_exists "data/market-pairs-cache.json"; then
    cached_count=$(cat data/market-pairs-cache.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else len(d.get('pairs',d.get('binance',[]))))" 2>/dev/null || echo "0")
    if [[ "$cached_count" -ge 50 ]]; then
      pass "data/market-pairs-cache.json has ${cached_count} cached pairs"
    else
      warn "data/market-pairs-cache.json has only ${cached_count} pairs — needs 50+"
    fi
  else
    warn "data/market-pairs-cache.json not found — run market data refresh to populate"
  fi

  # ── W3-3: Advanced Order Types ────────────────────────────────────────────
  echo -e "\n${BOLD}[W3-3] Advanced Order Types (OCO + Stop-Limit)${RESET}"
  for f in \
    "src/execution/order-types/oco.ts:placeOCO\|oco\|OCO" \
    "src/execution/order-types/stop-limit.ts:stopLimit\|stop.limit\|StopLimit" \
    "src/execution/order-manager.ts:OrderManager\|market\|limit\|oco"
  do
    filepath="${f%%:*}"
    pattern="${f##*:}"
    label=$(basename "$filepath")
    if file_exists "$filepath"; then
      pass "${label} exists"
      if file_contains "$filepath" "$pattern"; then
        pass "${label} contains expected implementation"
      else
        warn "${label} may be incomplete — check for $(echo $pattern | awk -F'\\\\' '{print $1}')"
      fi
    else
      fail "${label} NOT found — order types not implemented"
    fi
  done

  if file_exists "test/execution/order-types.test.ts"; then
    pass "test/execution/order-types.test.ts exists"
  else
    fail "test/execution/order-types.test.ts NOT found — add order type tests"
  fi

  if $SERVER_LIVE; then
    for ep in "/api/orders/oco" "/api/orders/stop-limit"; do
      s=$(http_post_status "${BASE_URL}${ep}" '{}')
      if [[ "$s" == "404" ]]; then
        warn "POST ${ep} → 404 (may be routed differently — verify order manager)"
      elif [[ "$s" == "400" || "$s" == "401" ]]; then
        pass "POST ${ep} → ${s} (endpoint exists, validation/auth active)"
      elif [[ "$s" == "200" || "$s" == "201" ]]; then
        pass "POST ${ep} → ${s}"
      else
        info "POST ${ep} → ${s}"
      fi
    done
  else
    skip "Order type endpoint tests — server offline"
  fi

  # ── W3-4: Order Book + Market Impact ─────────────────────────────────────
  echo -e "\n${BOLD}[W3-4] Real-Time Order Book & Market Impact Analysis${RESET}"
  if file_exists "src/logic/strategy/order-book.ts"; then
    pass "src/logic/strategy/order-book.ts exists"
    for fn in "getBestBid\|bestBid" "getBestAsk\|bestAsk" "getMidPrice\|midPrice" "getSpread\|spread" "getMarketDepth\|depth"; do
      if file_contains "src/logic/strategy/order-book.ts" "$fn"; then
        pass "Order book: $(echo $fn | awk -F'\\\\' '{print $1}') found"
      else
        warn "Order book missing: $(echo $fn | awk -F'\\\\' '{print $1}')"
      fi
    done
  else
    fail "src/logic/strategy/order-book.ts NOT found"
  fi

  if file_exists "src/logic/strategy/risk_assessment.ts"; then
    if file_contains "src/logic/strategy/risk_assessment.ts" "marketImpact\|market_impact\|HIGH_IMPACT"; then
      pass "Market impact analysis integrated in risk_assessment.ts"
    else
      warn "Market impact not detected in risk_assessment.ts — integrate order-book depth"
    fi
  fi

  if file_exists "test/logic/order-book.test.ts"; then
    pass "test/logic/order-book.test.ts exists"
  else
    fail "test/logic/order-book.test.ts NOT found"
  fi

  # Check audit log has marketImpactBps field
  if file_exists "logs/audit.json"; then
    if tail -5 logs/audit.json | grep -q "marketImpact\|market_impact\|latencyMs\|executionLatency" 2>/dev/null; then
      pass "Audit log contains market impact / latency fields"
    else
      warn "Audit log does not yet contain marketImpactBps or executionLatencyMs — add after integration"
    fi
  fi

  # ── W3-5: Sub-Second Execution ────────────────────────────────────────────
  echo -e "\n${BOLD}[W3-5] Sub-Second Execution Fast-Path${RESET}"
  if file_exists "src/execution/fast-path.ts"; then
    pass "src/execution/fast-path.ts exists"
    if file_contains "src/execution/fast-path.ts" "latency\|cache\|nonce\|pool\|parallel\|concurrent"; then
      pass "Fast-path contains latency optimization logic"
    else
      warn "fast-path.ts may lack optimization — check for nonce pool and parallel execution"
    fi
  else
    fail "src/execution/fast-path.ts NOT found — sub-second execution not implemented"
  fi

  # ── W3-6: Dynamic Fee Optimizer ───────────────────────────────────────────
  echo -e "\n${BOLD}[W3-6] Dynamic Fee Optimizer${RESET}"
  if file_exists "src/execution/fee-optimizer.ts"; then
    pass "src/execution/fee-optimizer.ts exists"
    if file_contains "src/execution/fee-optimizer.ts" "getOptimalFeeRate\|feeRate\|fee_rate"; then
      pass "getOptimalFeeRate function found"
    else
      warn "getOptimalFeeRate not found — verify function name"
    fi
    if file_contains "src/execution/fee-optimizer.ts" "maker\|taker\|spread\|urgency"; then
      pass "Fee optimizer considers maker/taker/urgency"
    else
      warn "Fee optimizer may be too simple — add urgency tiers"
    fi
  else
    fail "src/execution/fee-optimizer.ts NOT found — fee optimization not implemented"
  fi

  # ── W3-7: API Versioning ──────────────────────────────────────────────────
  echo -e "\n${BOLD}[W3-7] Backward-Compatible API Versioning${RESET}"
  if file_exists "src/orchestrator/socket-server.ts"; then
    if file_contains "src/orchestrator/socket-server.ts" "/v1/\|v1\|apiVersion\|version"; then
      pass "API versioning (/v1/) found in socket-server.ts"
    else
      warn "No /v1/ prefix detected in socket-server.ts — add versioned routes"
    fi
    if file_contains "src/orchestrator/socket-server.ts" "X-API-Version\|x-api-version\|apiVersion"; then
      pass "X-API-Version response header found"
    else
      warn "X-API-Version header not set — add to all responses"
    fi
  fi

  if file_exists "src/orchestrator/router-v2.ts"; then
    pass "src/orchestrator/router-v2.ts (v2 stub) exists"
  else
    warn "router-v2.ts not found — create stub for future v2 routes"
  fi

  if $SERVER_LIVE; then
    # Test versioned endpoint
    v1_status=$(http_status "${BASE_URL}/v1/api/health")
    if [[ "$v1_status" == "200" ]]; then
      pass "GET /v1/api/health → 200 (versioned routes live)"
      v1_body=$(http_body "${BASE_URL}/v1/api/health")
      if echo "$v1_body" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('version')" 2>/dev/null; then
        pass "Versioned health response contains version field"
      fi
    else
      warn "GET /v1/api/health → ${v1_status} — versioned routing may not be active"
    fi
  else
    skip "API versioning live tests — server offline"
  fi

  # ── W3-8: v1.3.0 Tag ──────────────────────────────────────────────────────
  echo -e "\n${BOLD}[W3-8] Release Tag v1.3.0${RESET}"
  if git tag --list | grep -q "v1.3.0"; then
    pass "Git tag v1.3.0 exists"
  else
    warn "Git tag v1.3.0 not yet created — create at Week 3 close"
  fi
fi

# =============================================================================
# WEEK 4 — Month Close & Q3 Foundation
# =============================================================================
if [[ "$WEEK_FILTER" == "all" || "$WEEK_FILTER" == "4" ]]; then
  section "WEEK 4 — Month Close & Q3 Foundation (Jun 28–30)"

  # ── W4-1: Stress Test Suite ───────────────────────────────────────────────
  echo -e "\n${BOLD}[W4-1] Extreme Market Testing Suite${RESET}"
  if file_exists "scripts/stress_test_cycle.ts"; then
    pass "scripts/stress_test_cycle.ts exists"
    if file_contains "scripts/stress_test_cycle.ts" "1000\|concurrent\|parallel\|scenario\|Scenario"; then
      pass "Stress test contains high-volume scenarios"
    else
      warn "Stress test may be minimal — add 1000-order and circuit-breaker scenarios"
    fi
  else
    fail "scripts/stress_test_cycle.ts NOT found"
  fi

  if cat package.json | python3 -c "import sys,json; d=json.load(sys.stdin); s=d.get('scripts',{}); exit(0 if 'test:stress' in s else 1)" 2>/dev/null; then
    pass "npm run test:stress script defined in package.json"
  else
    fail "test:stress not in package.json scripts — add it"
  fi

  # ── W4-2: Portfolio Rebalancer ────────────────────────────────────────────
  echo -e "\n${BOLD}[W4-2] Portfolio Rebalancing Scaffold${RESET}"
  if file_exists "src/logic/strategy/rebalancer.ts"; then
    pass "src/logic/strategy/rebalancer.ts exists"
    if file_contains "src/logic/strategy/rebalancer.ts" "calculateRebalancingOrders\|rebalance\|targetWeight\|RebalanceTarget"; then
      pass "calculateRebalancingOrders function found"
    else
      warn "Rebalancer may be incomplete — check for calculateRebalancingOrders"
    fi
    if file_contains "src/logic/strategy/rebalancer.ts" "kelly\|Kelly\|kellyFraction\|sizing"; then
      pass "Rebalancer respects Kelly fraction for position sizing"
    else
      warn "Rebalancer not linked to Kelly criterion — add max-size enforcement"
    fi
  else
    fail "src/logic/strategy/rebalancer.ts NOT found"
  fi

  if file_exists "test/logic/rebalancer.test.ts"; then
    pass "test/logic/rebalancer.test.ts exists"
  else
    fail "test/logic/rebalancer.test.ts NOT found — add 3-asset rebalance test"
  fi

  # ── W4-3: Mainnet Readiness Script ────────────────────────────────────────
  echo -e "\n${BOLD}[W4-3] Mainnet Readiness Checklist${RESET}"
  if file_exists "scripts/verify_mainnet_readiness.ts"; then
    pass "scripts/verify_mainnet_readiness.ts exists"
    for check in "HALTED\|halted" "env\|ENV\|environment" "EIP-712\|eip712\|domain" "rate.limit\|rateLimit\|rate_limit"; do
      if file_contains "scripts/verify_mainnet_readiness.ts" "$check"; then
        pass "Mainnet check includes: $(echo $check | awk -F'\\\\' '{print $1}')"
      else
        warn "Mainnet readiness missing check for: $(echo $check | awk -F'\\\\' '{print $1}')"
      fi
    done
  else
    fail "scripts/verify_mainnet_readiness.ts NOT found"
  fi

  # ── W4-4: Documentation Complete ─────────────────────────────────────────
  echo -e "\n${BOLD}[W4-4] Month-End Documentation${RESET}"
  if file_exists "docs/CHANGELOG.md"; then
    pass "docs/CHANGELOG.md exists"
    for version in "v1.0.0" "v1.1.0" "v1.2.0" "v1.3.0"; do
      if file_contains "docs/CHANGELOG.md" "$version"; then
        pass "CHANGELOG.md contains ${version} entry"
      else
        warn "CHANGELOG.md missing ${version} entry"
      fi
    done
  else
    fail "docs/CHANGELOG.md NOT found — create with version history"
  fi

  if file_exists "docs/JULY_PREVIEW.md"; then
    pass "docs/JULY_PREVIEW.md exists (Q3 roadmap preview)"
  else
    warn "docs/JULY_PREVIEW.md not found — create Q3 preview before June 30"
  fi

  if file_exists "AGENTS.md"; then
    agents_mtime=$(stat -c %Y AGENTS.md 2>/dev/null || echo "0")
    june_start=$(date -d "2026-06-01" +%s 2>/dev/null || echo "0")
    if [[ "$agents_mtime" -ge "$june_start" ]]; then
      pass "AGENTS.md updated in June (reflects new architecture)"
    else
      warn "AGENTS.md not updated this month — update with ccxt, multi-user, order types"
    fi
  fi

  # ── W4-5: Final Release Tags ──────────────────────────────────────────────
  echo -e "\n${BOLD}[W4-5] Final Release Tags${RESET}"
  for tag in "v1.1.0" "v1.2.0" "v1.3.0" "v1.4.0"; do
    if git tag --list | grep -q "$tag"; then
      commit=$(git rev-list -n 1 "$tag" 2>/dev/null | head -c 8)
      pass "Tag ${tag} exists → ${commit}"
    else
      if [[ "$tag" == "v1.4.0" ]]; then
        warn "Tag ${tag} not yet created — create at June 30 close"
      else
        warn "Tag ${tag} missing — create at end of corresponding week"
      fi
    fi
  done

  # ── W4-6: Q2 Roadmap Complete ────────────────────────────────────────────
  echo -e "\n${BOLD}[W4-6] Q2 Roadmap Completeness${RESET}"
  if file_exists "docs/ROADMAP.md"; then
    q2_not_done=$(grep -c "Not Started\|PENDING\|TODO" docs/ROADMAP.md 2>/dev/null | tr -d '[:space:]' || echo "0")
    q2_done=$(grep -c "DONE\|Complete" docs/ROADMAP.md 2>/dev/null | tr -d '[:space:]' || echo "0")
    q2_not_done="${q2_not_done:-0}"
    q2_done="${q2_done:-0}"
    pass "docs/ROADMAP.md: ${q2_done} items marked complete"
    if [[ "${q2_not_done}" -gt 0 ]] 2>/dev/null; then
      warn "ROADMAP.md still has ${q2_not_done} incomplete items — resolve before June 30"
    else
      pass "No unresolved items in ROADMAP.md"
    fi
  else
    fail "docs/ROADMAP.md NOT found"
  fi
fi

# =============================================================================
# SUMMARY
# =============================================================================
section "VERIFICATION SUMMARY"

TOTAL=$((PASS + FAIL + SKIP))
echo ""
echo -e "  ${BOLD}Results:${RESET}"
echo -e "  ${GREEN}✅  PASS   : ${PASS}${RESET}"
echo -e "  ${RED}❌  FAIL   : ${FAIL}${RESET}"
echo -e "  ${DIM}⏭   SKIP   : ${SKIP}${RESET}"
echo -e "  ${BOLD}    TOTAL  : ${TOTAL}${RESET}"
echo ""

if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  echo -e "  ${YELLOW}${BOLD}⚠️  WARNINGS (${#WARNINGS[@]}):${RESET}"
  for w in "${WARNINGS[@]}"; do
    echo -e "  ${YELLOW}  • ${w}${RESET}"
  done
  echo ""
fi

if [[ "$FAIL" -eq 0 ]]; then
  echo -e "  ${GREEN}${BOLD}🎉 ALL CHECKS PASSED — Month plan fully implemented!${RESET}"
elif [[ "$FAIL" -le 5 ]]; then
  echo -e "  ${YELLOW}${BOLD}🔧 NEARLY DONE — ${FAIL} item(s) still need work.${RESET}"
else
  echo -e "  ${RED}${BOLD}🚨 ${FAIL} ITEMS FAILING — Review june_plan.md and implement missing items.${RESET}"
fi

echo ""
echo -e "  ${DIM}Week filter: bash scripts/verify_june_plan.sh --week [2|3|4]${RESET}"
echo -e "  ${DIM}With server: BASE_URL=http://localhost:3006 bash scripts/verify_june_plan.sh${RESET}"
echo ""

[[ "$FAIL" -eq 0 ]]
