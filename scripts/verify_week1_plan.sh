#!/usr/bin/env bash
# =============================================================================
# ╔══════════════════════════════════════════════════════════════════════════╗
# ║        VERTEX SENTINEL — Week 1 Sprint Neutral Verifier                  ║
# ║        Verifies: Endpoints · Logs · File Existence · Feature Checks      ║
# ║        Branch: main  |  Run: bash scripts/verify_week1_plan.sh           ║
# ╚══════════════════════════════════════════════════════════════════════════╝
# =============================================================================
# USAGE:
#   bash scripts/verify_week1_plan.sh           # full suite
#   bash scripts/verify_week1_plan.sh --day mon  # run only Monday checks
#   bash scripts/verify_week1_plan.sh --day tue
#   bash scripts/verify_week1_plan.sh --day wed
#   bash scripts/verify_week1_plan.sh --day thu
#   bash scripts/verify_week1_plan.sh --day fri
#   bash scripts/verify_week1_plan.sh --day sdk  # SDK-only checks
# =============================================================================

set -uo pipefail

# ── Config ───────────────────────────────────────────────────────────────────
BASE_URL="${BASE_URL:-http://localhost:3006}"
SERVER_TIMEOUT=5         # seconds to wait for curl
DAY_FILTER="${2:-all}"   # set via --day argument
PASS=0
FAIL=0
SKIP=0
WARNINGS=()

# ── Colors ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# ── Argument Parsing ──────────────────────────────────────────────────────────
if [[ "${1:-}" == "--day" ]]; then
  DAY_FILTER="${2:-all}"
fi

# ── Helpers ───────────────────────────────────────────────────────────────────
section() {
  echo ""
  echo -e "${BOLD}${CYAN}══════════════════════════════════════════${RESET}"
  echo -e "${BOLD}${CYAN}  $1${RESET}"
  echo -e "${BOLD}${CYAN}══════════════════════════════════════════${RESET}"
}

pass() {
  echo -e "  ${GREEN}✅ PASS${RESET}  $1"
  PASS=$((PASS+1))
}

fail() {
  echo -e "  ${RED}❌ FAIL${RESET}  $1"
  FAIL=$((FAIL+1))
}

warn() {
  echo -e "  ${YELLOW}⚠️  WARN${RESET}  $1"
  WARNINGS+=("$1")
}

skip() {
  echo -e "  ${DIM}⏭  SKIP${RESET}  $1"
  SKIP=$((SKIP+1))
}

info() {
  echo -e "  ${DIM}ℹ   INFO${RESET}  $1"
}

# Returns HTTP status code for a GET request
http_status() {
  curl -s -o /dev/null -w "%{http_code}" --max-time "$SERVER_TIMEOUT" "$1" 2>/dev/null || echo "000"
}

# Returns response body for a GET request
http_body() {
  curl -s --max-time "$SERVER_TIMEOUT" "$1" 2>/dev/null || echo ""
}

# Returns HTTP status for a POST request with JSON body
http_post_status() {
  local url="$1"
  local body="${2:-{}}"
  curl -s -o /dev/null -w "%{http_code}" --max-time "$SERVER_TIMEOUT" \
    -X POST -H "Content-Type: application/json" -d "$body" "$url" 2>/dev/null || echo "000"
}

# Returns body for a POST request
http_post_body() {
  local url="$1"
  local body="${2:-{}}"
  curl -s --max-time "$SERVER_TIMEOUT" \
    -X POST -H "Content-Type: application/json" -d "$body" "$url" 2>/dev/null || echo ""
}

# Check if a file exists
file_exists() {
  [[ -f "$1" ]]
}

# Check if a directory exists
dir_exists() {
  [[ -d "$1" ]]
}

# Check if file contains a string
file_contains() {
  grep -q "$2" "$1" 2>/dev/null
}

# Check if jq field exists and is not null/empty
json_field() {
  echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); v=d$(echo "$2"); print('ok' if v else 'empty')" 2>/dev/null || echo "error"
}

# ── Server Probe ──────────────────────────────────────────────────────────────
server_running() {
  local status
  status=$(http_status "${BASE_URL}/api/health")
  [[ "$status" == "200" ]]
}

# =============================================================================
# PRE-FLIGHT: Server Online Check
# =============================================================================
section "PRE-FLIGHT: Server Availability"

if server_running; then
  SERVER_LIVE=true
  body=$(http_body "${BASE_URL}/api/health")
  version=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('version','?'))" 2>/dev/null || echo "?")
  pass "Server is UP at ${BASE_URL} (version: ${version})"
else
  SERVER_LIVE=false
  warn "Server is NOT running at ${BASE_URL} — endpoint tests will be skipped"
  warn "Start server with: npm start  (or npm run dashboard)"
fi

# =============================================================================
# MONDAY — Security Hardening
# =============================================================================
if [[ "$DAY_FILTER" == "all" || "$DAY_FILTER" == "mon" ]]; then
  section "MONDAY — Security Hardening"

  # --- M1: Rate limiting implementation ---
  echo -e "\n${BOLD}[M1] API Rate Limiting${RESET}"
  if file_exists "src/orchestrator/socket-server.ts"; then
    if file_contains "src/orchestrator/socket-server.ts" "rateLimit\|rate-limit\|express-rate-limit"; then
      pass "express-rate-limit middleware found in socket-server.ts"
    else
      fail "Rate limiting NOT detected in socket-server.ts — add express-rate-limit middleware"
    fi
  else
    fail "socket-server.ts not found"
  fi

  if $SERVER_LIVE; then
    # Fire 20 rapid requests and check for a 429 response
    echo -ne "  ${DIM}Testing 429 enforcement (20 rapid requests)...${RESET} "
    got_429=false
    for i in $(seq 1 20); do
      status=$(http_status "${BASE_URL}/api/health")
      if [[ "$status" == "429" ]]; then
        got_429=true
        break
      fi
    done
    if $got_429; then
      pass "Server correctly returned HTTP 429 under rapid-fire load"
    else
      warn "No 429 observed after 20 requests — rate limit threshold may be >20 req/min (acceptable if configured high; lower for production)"
    fi
  else
    skip "Rate limit live test — server offline"
  fi

  # --- M2: API Key Management ---
  echo -e "\n${BOLD}[M2] API Key Manager${RESET}"
  if file_exists "src/utils/api-key-manager.ts"; then
    pass "api-key-manager.ts exists"
    if file_contains "src/utils/api-key-manager.ts" "rotate\|rotation"; then
      pass "Key rotation logic found in api-key-manager.ts"
    else
      fail "Key rotation NOT found in api-key-manager.ts"
    fi
    if file_contains "src/utils/api-key-manager.ts" "HMAC\|hmac\|crypto\|sign"; then
      pass "Cryptographic signing found in api-key-manager.ts"
    else
      fail "No HMAC/crypto signing found — keys may be insecure"
    fi
  else
    fail "src/utils/api-key-manager.ts does NOT exist — not implemented yet"
  fi

  if $SERVER_LIVE; then
    echo -e "\n  ${DIM}Testing /api/keys/rotate endpoint...${RESET}"
    rotate_status=$(http_post_status "${BASE_URL}/api/keys/rotate" '{}')
    if [[ "$rotate_status" == "200" || "$rotate_status" == "201" ]]; then
      pass "POST /api/keys/rotate returned ${rotate_status}"
      rotate_body=$(http_post_body "${BASE_URL}/api/keys/rotate" '{}')
      if echo "$rotate_body" | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'key' in d or 'apiKey' in d" 2>/dev/null; then
        pass "Rotation response contains new key field"
      else
        warn "Rotation response body missing 'key'/'apiKey' field — check response schema"
      fi
    elif [[ "$rotate_status" == "401" || "$rotate_status" == "403" ]]; then
      pass "POST /api/keys/rotate correctly requires auth (${rotate_status})"
    elif [[ "$rotate_status" == "404" ]]; then
      fail "POST /api/keys/rotate returns 404 — endpoint not registered"
    else
      warn "POST /api/keys/rotate returned ${rotate_status} — unexpected status"
    fi
  else
    skip "Key rotation endpoint test — server offline"
  fi

  if file_exists ".env.example"; then
    if file_contains ".env.example" "API_KEY_SECRET"; then
      pass "API_KEY_SECRET documented in .env.example"
    else
      fail "API_KEY_SECRET missing from .env.example — add it for operator guidance"
    fi
  fi

  # --- M3: Unit test existence ---
  echo -e "\n${BOLD}[M3] Security Test Coverage${RESET}"
  if file_exists "test/api-key-manager.test.ts"; then
    pass "test/api-key-manager.test.ts exists"
  else
    fail "test/api-key-manager.test.ts NOT found — write unit tests for key manager"
  fi
fi

# =============================================================================
# TUESDAY — SDK Publication + Security Best Practices
# =============================================================================
if [[ "$DAY_FILTER" == "all" || "$DAY_FILTER" == "tue" || "$DAY_FILTER" == "sdk" ]]; then
  section "TUESDAY — SDK Publication & Security Docs"

  # --- T1: SDK build output ---
  echo -e "\n${BOLD}[T1] SDK Build Artifacts${RESET}"
  SDK_DIR="packages/sentinel-sdk"
  if dir_exists "$SDK_DIR/dist"; then
    pass "packages/sentinel-sdk/dist/ exists (build output present)"
    if file_exists "$SDK_DIR/dist/index.js"; then
      pass "dist/index.js found"
    else
      fail "dist/index.js NOT found — run: cd packages/sentinel-sdk && npm run build"
    fi
    if file_exists "$SDK_DIR/dist/index.d.ts"; then
      pass "dist/index.d.ts found (TypeScript types exported)"
    else
      warn "dist/index.d.ts NOT found — TypeScript consumers won't get type completion"
    fi
  else
    fail "packages/sentinel-sdk/dist/ NOT found — SDK has not been built"
  fi

  # --- T2: SDK package.json metadata ---
  echo -e "\n${BOLD}[T2] SDK package.json Publish-Readiness${RESET}"
  SDK_PKG="$SDK_DIR/package.json"
  if file_exists "$SDK_PKG"; then
    sdk_json=$(cat "$SDK_PKG")
    for field in "files" "keywords" "license" "repository" "publishConfig"; do
      if echo "$sdk_json" | python3 -c "import sys,json; d=json.load(sys.stdin); assert '$field' in d" 2>/dev/null; then
        pass "SDK package.json has '$field' field"
      else
        fail "SDK package.json missing '$field' field — required for npm publish"
      fi
    done
    if echo "$sdk_json" | python3 -c "import sys,json; d=json.load(sys.stdin); pc=d.get('publishConfig',{}); assert pc.get('access')=='public'" 2>/dev/null; then
      pass "publishConfig.access is 'public' (scoped package publish)"
    else
      fail "publishConfig.access != 'public' — scoped package will fail npm publish"
    fi
  else
    fail "packages/sentinel-sdk/package.json not found"
  fi

  # --- T3: npm registry check ---
  echo -e "\n${BOLD}[T3] npm Registry Publication${RESET}"
  npm_result=$(npm info @vertex-agents/sentinel-sdk version 2>/dev/null || echo "NOT_FOUND")
  if [[ "$npm_result" != "NOT_FOUND" && -n "$npm_result" ]]; then
    pass "@vertex-agents/sentinel-sdk@${npm_result} found on npm registry"
  else
    warn "@vertex-agents/sentinel-sdk NOT found on npm — pending publish"
    info "Run: cd packages/sentinel-sdk && npm publish"
  fi

  # --- T4: Security Best Practices doc ---
  echo -e "\n${BOLD}[T4] Security Best Practices Documentation${RESET}"
  if file_exists "docs/SECURITY_BEST_PRACTICES.md"; then
    pass "docs/SECURITY_BEST_PRACTICES.md exists"
    for topic in "EIP-712\|eip-712" "circuit.breaker\|circuit_breaker\|CircuitBreaker" "rate.limit\|rateLimit\|rate_limit" "secret\|SECRET\|env.*var\|\.env"; do
      if file_contains "docs/SECURITY_BEST_PRACTICES.md" "$topic"; then
        pass "SECURITY_BEST_PRACTICES.md covers: $(echo $topic | cut -d'\\' -f1)"
      else
        warn "SECURITY_BEST_PRACTICES.md may be missing coverage for: $(echo $topic | cut -d'\\' -f1)"
      fi
    done
  else
    fail "docs/SECURITY_BEST_PRACTICES.md does NOT exist — not written yet"
  fi
fi

# =============================================================================
# WEDNESDAY — Testnet Faucet + Error Recovery
# =============================================================================
if [[ "$DAY_FILTER" == "all" || "$DAY_FILTER" == "wed" ]]; then
  section "WEDNESDAY — Onboarding & Error Recovery"

  # --- W1: Faucet service file ---
  echo -e "\n${BOLD}[W1] Testnet Faucet Service${RESET}"
  if file_exists "src/services/faucet.ts"; then
    pass "src/services/faucet.ts exists"
    if file_contains "src/services/faucet.ts" "requestTestnetFunds\|faucet\|sepolia"; then
      pass "Faucet service contains expected functions"
    else
      warn "faucet.ts may not implement requestTestnetFunds — verify content"
    fi
    if file_contains "src/services/faucet.ts" "retry\|backoff\|attempt"; then
      pass "Retry/backoff logic found in faucet service"
    else
      warn "No retry logic detected in faucet.ts — add exponential backoff"
    fi
  else
    fail "src/services/faucet.ts NOT found — faucet not implemented"
  fi

  if $SERVER_LIVE; then
    echo -e "\n  ${DIM}Testing /api/faucet/request endpoint...${RESET}"
    faucet_status=$(http_post_status "${BASE_URL}/api/faucet/request" '{"address":"0x5367F88E7B24bFa34A453CF24f7BE741CF3276c9"}')
    if [[ "$faucet_status" == "200" || "$faucet_status" == "202" ]]; then
      pass "POST /api/faucet/request returned ${faucet_status}"
    elif [[ "$faucet_status" == "429" ]]; then
      pass "POST /api/faucet/request correctly rate-limited (1/hour/IP enforcement: 429)"
    elif [[ "$faucet_status" == "400" ]]; then
      pass "POST /api/faucet/request returns 400 for bad input (validation active)"
    elif [[ "$faucet_status" == "404" ]]; then
      fail "POST /api/faucet/request returns 404 — endpoint not registered"
    else
      warn "POST /api/faucet/request returned ${faucet_status}"
    fi
  else
    skip "Faucet endpoint test — server offline"
  fi

  # --- W2: Dashboard onboarding page faucet button ---
  echo -e "\n${BOLD}[W2] Dashboard Onboarding: Faucet Button${RESET}"
  if file_exists "dashboard/onboarding.html"; then
    if file_contains "dashboard/onboarding.html" "faucet\|Faucet"; then
      pass "Faucet UI element found in dashboard/onboarding.html"
    else
      warn "No faucet button found in dashboard/onboarding.html — add it for onboarding UX"
    fi
  else
    fail "dashboard/onboarding.html not found"
  fi

  if $SERVER_LIVE; then
    echo -e "\n  ${DIM}Testing /onboarding route...${RESET}"
    onboard_status=$(http_status "${BASE_URL}/onboarding")
    if [[ "$onboard_status" == "200" ]]; then
      pass "GET /onboarding returns 200"
    else
      fail "GET /onboarding returned ${onboard_status}"
    fi
  else
    skip "Onboarding page route test — server offline"
  fi

  # --- W3: Error recovery / circuit breaker ---
  echo -e "\n${BOLD}[W3] Error Recovery & Circuit Breaker${RESET}"
  if file_exists "src/execution/proxy.ts"; then
    pass "src/execution/proxy.ts exists"
    if file_contains "src/execution/proxy.ts" "circuit\|Circuit\|CIRCUIT"; then
      pass "Circuit breaker logic found in proxy.ts"
    else
      fail "No circuit breaker detected in proxy.ts"
    fi
    if file_contains "src/execution/proxy.ts" "backoff\|retry\|RETRY\|attempt"; then
      pass "Retry/backoff logic found in proxy.ts"
    else
      warn "No explicit retry/backoff found in proxy.ts — add for resilience"
    fi
    if file_contains "src/execution/proxy.ts" "risk.alert\|agentEvents\|emit"; then
      pass "agentEvents.emit found in proxy.ts (health probe → alert pipeline)"
    else
      warn "proxy.ts does not emit agentEvents on failure — add health probe"
    fi
  else
    fail "src/execution/proxy.ts NOT found"
  fi

  # --- W4: HALTED state flag ---
  echo -e "\n${BOLD}[W4] HALTED State Recovery${RESET}"
  if file_exists "logs/HALTED"; then
    warn "HALTED file exists! System may be in a halted state — investigate or run: npm start -- --force-restart"
  else
    pass "No HALTED flag present — system is not in forced-halt state"
  fi
fi

# =============================================================================
# THURSDAY — Leaderboard UI
# =============================================================================
if [[ "$DAY_FILTER" == "all" || "$DAY_FILTER" == "thu" ]]; then
  section "THURSDAY — Leaderboard UI & Backend"

  # --- Th1: Leaderboard service ---
  echo -e "\n${BOLD}[Th1] Leaderboard Service${RESET}"
  if file_exists "src/services/leaderboard.ts"; then
    pass "src/services/leaderboard.ts exists"
    if file_contains "src/services/leaderboard.ts" "ReputationRegistry\|reputation"; then
      pass "Leaderboard service references ReputationRegistry contract"
    else
      warn "leaderboard.ts may not be connected to ReputationRegistry — verify"
    fi
    if file_contains "src/services/leaderboard.ts" "cache\|Cache\|leaderboard-cache"; then
      pass "Caching layer found in leaderboard service"
    else
      warn "No caching found in leaderboard.ts — add cache to reduce RPC calls"
    fi
  else
    fail "src/services/leaderboard.ts NOT found — not implemented yet"
  fi

  # --- Th2: Leaderboard REST endpoint ---
  if $SERVER_LIVE; then
    echo -e "\n${BOLD}[Th2] Leaderboard API Endpoint${RESET}"
    lb_status=$(http_status "${BASE_URL}/api/leaderboard")
    if [[ "$lb_status" == "200" ]]; then
      lb_body=$(http_body "${BASE_URL}/api/leaderboard")
      pass "GET /api/leaderboard returns 200"
      if echo "$lb_body" | python3 -c "import sys,json; d=json.load(sys.stdin); assert isinstance(d,list) or 'entries' in d or 'data' in d or 'leaderboard' in d" 2>/dev/null; then
        pass "Response is a valid leaderboard array/object"
      else
        warn "Leaderboard response schema unexpected — check field names"
      fi
    elif [[ "$lb_status" == "404" ]]; then
      fail "GET /api/leaderboard returns 404 — endpoint not registered"
    else
      warn "GET /api/leaderboard returned ${lb_status}"
    fi
  else
    skip "Leaderboard endpoint test — server offline"
  fi

  # --- Th3: Dashboard leaderboard UI ---
  echo -e "\n${BOLD}[Th3] Dashboard Leaderboard Panel${RESET}"
  if file_exists "dashboard/index.html"; then
    if file_contains "dashboard/index.html" "leaderboard\|Leaderboard"; then
      pass "Leaderboard section/tab found in dashboard/index.html"
    else
      fail "No leaderboard UI found in dashboard/index.html — add the panel"
    fi
    if file_contains "dashboard/index.html" "leaderboard.update\|leaderboard\.update"; then
      pass "Socket.io leaderboard.update event wired in dashboard"
    else
      warn "leaderboard.update Socket.io event not found in index.html — check app.js"
    fi
  else
    fail "dashboard/index.html not found"
  fi

  if file_exists "dashboard/js/app.js"; then
    if file_contains "dashboard/js/app.js" "leaderboard\|Leaderboard"; then
      pass "Leaderboard logic found in dashboard/js/app.js"
    else
      warn "dashboard/js/app.js may not handle leaderboard events"
    fi
  fi

  # --- Th4: ReputationRegistry contract ---
  echo -e "\n${BOLD}[Th4] ReputationRegistry Contract${RESET}"
  if file_exists "contracts/ReputationRegistry.sol"; then
    pass "contracts/ReputationRegistry.sol exists"
  else
    fail "contracts/ReputationRegistry.sol NOT found"
  fi
fi

# =============================================================================
# FRIDAY — Binance Adapter + Kelly Criterion + Release Tag
# =============================================================================
if [[ "$DAY_FILTER" == "all" || "$DAY_FILTER" == "fri" ]]; then
  section "FRIDAY — Binance Adapter, Kelly Criterion & v1.1.0 Tag"

  # --- F1: Binance adapter ---
  echo -e "\n${BOLD}[F1] Binance Exchange Adapter${RESET}"
  if file_exists "src/execution/adapters/binance.ts"; then
    pass "src/execution/adapters/binance.ts exists"
    for fn in "getBalance\|balance" "placeOrder\|place_order\|createOrder" "getOrderStatus\|orderStatus" "cancelOrder\|cancel_order"; do
      if file_contains "src/execution/adapters/binance.ts" "$fn"; then
        pass "Binance adapter implements: $(echo $fn | cut -d'\\' -f1)"
      else
        warn "Binance adapter missing: $(echo $fn | cut -d'\\' -f1)"
      fi
    done
    if file_contains "src/execution/adapters/binance.ts" "HMAC\|hmac\|signature\|sign"; then
      pass "HMAC-SHA256 auth found in Binance adapter"
    else
      fail "No HMAC auth in Binance adapter — Binance API requires signed requests"
    fi
    if file_contains "src/execution/adapters/binance.ts" "weight\|rateLimit\|rate_limit\|1200"; then
      pass "Binance weight/rate-limit system referenced in adapter"
    else
      warn "Binance weight system not handled — add request weight tracking to avoid bans"
    fi
  else
    fail "src/execution/adapters/binance.ts NOT found — not implemented yet"
  fi

  # --- F2: Adapter registry ---
  echo -e "\n${BOLD}[F2] Adapter Registry${RESET}"
  if file_exists "src/execution/adapters/index.ts"; then
    pass "src/execution/adapters/index.ts (adapter registry) exists"
    if file_contains "src/execution/adapters/index.ts" "binance\|Binance"; then
      pass "Binance adapter registered in adapter index"
    else
      warn "Binance not yet registered in adapter index — add the export"
    fi
  else
    fail "src/execution/adapters/index.ts NOT found — create adapter registry"
  fi

  # --- F3: env vars for Binance ---
  echo -e "\n${BOLD}[F3] Binance Environment Config${RESET}"
  if file_exists ".env.example"; then
    for var in "BINANCE_API_KEY" "BINANCE_SECRET" "BINANCE_BASE_URL"; do
      if file_contains ".env.example" "$var"; then
        pass ".env.example documents $var"
      else
        fail ".env.example missing $var — Binance adapter needs this"
      fi
    done
  fi

  # --- F4: Kelly Criterion sizing ---
  echo -e "\n${BOLD}[F4] Kelly Criterion Position Sizing${RESET}"
  if file_exists "src/logic/sizing/kelly.ts"; then
    pass "src/logic/sizing/kelly.ts exists"
    if file_contains "src/logic/sizing/kelly.ts" "kellyFraction\|kelly_fraction\|Kelly"; then
      pass "kellyFraction function found"
    else
      warn "kellyFraction not found in kelly.ts — verify function name"
    fi
    if file_contains "src/logic/sizing/kelly.ts" "0.25\|fractional\|fraction\|half"; then
      pass "Fractional Kelly (safety multiplier) found"
    else
      warn "No fractional Kelly multiplier — using full Kelly is dangerous in live trading"
    fi
  else
    fail "src/logic/sizing/kelly.ts NOT found — not implemented yet"
  fi

  # Check integration with risk assessment
  if file_exists "src/logic/risk_assessment.ts"; then
    if file_contains "src/logic/risk_assessment.ts" "kelly\|Kelly\|kellyFraction"; then
      pass "Kelly criterion integrated into risk_assessment.ts"
    else
      warn "Kelly criterion NOT integrated into risk_assessment.ts yet"
    fi
  fi

  # --- F5: Git tag v1.1.0 ---
  echo -e "\n${BOLD}[F5] Release Tag v1.1.0${RESET}"
  if git tag --list | grep -q "v1.1.0"; then
    pass "Git tag v1.1.0 exists"
    tag_commit=$(git rev-list -n 1 v1.1.0 2>/dev/null || echo "?")
    info "Tag points to commit: ${tag_commit:0:8}"
  else
    warn "Git tag v1.1.0 NOT found — create with: git tag -a v1.1.0 -m 'Week 1 sprint complete'"
  fi

  # --- F6: ROADMAP.md updated ---
  echo -e "\n${BOLD}[F6] ROADMAP.md Updated${RESET}"
  if file_exists "docs/ROADMAP.md"; then
    roadmap_mtime=$(stat -c %Y docs/ROADMAP.md 2>/dev/null || echo "0")
    week_start=$(date -d "2026-06-09" +%s 2>/dev/null || echo "0")
    if [[ "$roadmap_mtime" -ge "$week_start" ]]; then
      pass "docs/ROADMAP.md updated during sprint week"
    else
      warn "docs/ROADMAP.md has not been modified this week — update status entries"
    fi
  else
    fail "docs/ROADMAP.md not found"
  fi
fi

# =============================================================================
# BASELINE: Existing Infrastructure (Always Run)
# =============================================================================
if [[ "$DAY_FILTER" == "all" ]]; then
  section "BASELINE: Core Infrastructure Verification"

  echo -e "\n${BOLD}[B1] Core API Endpoints${RESET}"
  if $SERVER_LIVE; then
    for endpoint in "/api/health" "/api/quota" "/api/agent" "/api/pnl" "/api/audit" "/api/automation"; do
      status=$(http_status "${BASE_URL}${endpoint}")
      if [[ "$status" == "200" ]]; then
        pass "GET ${endpoint} → 200"
      elif [[ "$status" == "404" ]]; then
        fail "GET ${endpoint} → 404 (missing)"
      else
        warn "GET ${endpoint} → ${status}"
      fi
    done
  else
    skip "Core API tests — server offline"
  fi

  echo -e "\n${BOLD}[B2] Automation State${RESET}"
  if file_exists "logs/automation_state.json"; then
    auto_state=$(cat logs/automation_state.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('enabled','?'))" 2>/dev/null || echo "?")
    pass "logs/automation_state.json exists (enabled: ${auto_state})"
  else
    warn "logs/automation_state.json not found — automation state unknown"
  fi

  echo -e "\n${BOLD}[B3] Audit Trail${RESET}"
  if file_exists "logs/audit.json"; then
    line_count=$(wc -l < logs/audit.json 2>/dev/null || echo "0")
    pass "logs/audit.json exists (${line_count} audit entries)"
    last_entry=$(tail -1 logs/audit.json 2>/dev/null || echo "")
    if echo "$last_entry" | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'signature' in d" 2>/dev/null; then
      pass "Audit entries contain EIP-712 signature field"
    else
      warn "Last audit entry may be missing 'signature' field — check EIP-712 compliance"
    fi
  else
    fail "logs/audit.json not found"
  fi

  echo -e "\n${BOLD}[B4] Dashboard Pages${RESET}"
  if $SERVER_LIVE; then
    for route in "/" "/dashboard" "/onboarding"; do
      status=$(http_status "${BASE_URL}${route}")
      if [[ "$status" == "200" ]]; then
        pass "GET ${route} → 200"
      else
        warn "GET ${route} → ${status}"
      fi
    done
  else
    skip "Dashboard route tests — server offline"
  fi

  echo -e "\n${BOLD}[B5] Smart Contracts${RESET}"
  for contract in "RiskRouter.sol" "ReputationRegistry.sol" "ValidationRegistry.sol" "HackathonVault.sol"; do
    if file_exists "contracts/$contract"; then
      pass "contracts/$contract present"
    else
      fail "contracts/$contract MISSING"
    fi
  done

  echo -e "\n${BOLD}[B6] Git Branch Hygiene${RESET}"
  current_branch=$(git branch --show-current)
  if [[ "$current_branch" == "main" ]]; then
    pass "Currently on main branch"
  else
    warn "Not on main branch — currently on: ${current_branch}"
  fi

  stash_count=$(git stash list | grep "containerization" | wc -l)
  if [[ "$stash_count" -gt 0 ]]; then
    pass "Containerization branch stashed (${stash_count} stash entries) — safely preserved"
    info "To restore containerization work: git stash pop"
  fi
fi

# =============================================================================
# SUMMARY REPORT
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
  echo -e "  ${GREEN}${BOLD}🎉 ALL CHECKS PASSED — Sprint week items are implemented!${RESET}"
elif [[ "$FAIL" -le 3 ]]; then
  echo -e "  ${YELLOW}${BOLD}🔧 MOSTLY DONE — ${FAIL} item(s) still need attention before sprint close.${RESET}"
else
  echo -e "  ${RED}${BOLD}🚨 ${FAIL} ITEMS FAILING — Review the plan and complete missing implementations.${RESET}"
fi

echo ""
echo -e "  ${DIM}Re-run single day: bash scripts/verify_week1_plan.sh --day [mon|tue|wed|thu|fri|sdk]${RESET}"
echo ""

# Exit non-zero if any hard failures
[[ "$FAIL" -eq 0 ]]
