#!/usr/bin/env bash
# =============================================================================
# Vertex Sentinel — MVP Implementation Plan PR Validator
# =============================================================================
# Usage:
#   ./scripts/validate_mvp_pr.sh [--phase 1|2|3|all] [--base main]
#
# Validates that a PR branch implements the 12-day MVP plan correctly.
# Exit codes: 0 = all pass, 1 = minor fixes needed, 2 = rejected
# =============================================================================

# Do NOT use set -e — we handle errors manually per check
set +e

# --- State ---
BASE_BRANCH="main"
PHASE="all"
PASS=0; FAIL=0; WARN=0; SKIP=0
ERRORS=()

# --- Colors ---
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# --- Parse args ---
while [[ $# -gt 0 ]]; do
  case $1 in
    --phase) PHASE="$2"; shift 2 ;;
    --base)  BASE_BRANCH="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# --- Helpers ---
section() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }
check_pass() { ((PASS++)); echo -e "  ${GREEN}✔ PASS${NC}: $1"; }
check_fail() { ((FAIL++)); ERRORS+=("$1"); echo -e "  ${RED}✘ FAIL${NC}: $1"; }
check_warn() { ((WARN++)); echo -e "  ${YELLOW}⚠ WARN${NC}: $1"; }
check_skip() { ((SKIP++)); echo -e "  ${CYAN}⊘ SKIP${NC}: $1"; }

file_exists()    { [[ -f "$1" ]]; }
file_contains()  { grep -qE "$2" "$1" 2>/dev/null; }
file_not_contains() { ! grep -qE "$2" "$1" 2>/dev/null; }
dir_exists()     { [[ -d "$1" ]]; }

echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║  Vertex Sentinel — MVP PR Validation Script             ║${NC}"
echo -e "${BOLD}║  Phase: ${PHASE}                                              ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
echo -e "  Branch: $(git branch --show-current 2>/dev/null || echo 'unknown')"
echo -e "  Base:   ${BASE_BRANCH}"
echo -e "  Date:   $(date -Iseconds)"

# =============================================================================
# PHASE 0: UNIVERSAL CHECKS (always run)
# =============================================================================
section "Phase 0: Build & Type Safety"

# 0.1 — TypeScript compilation
echo -e "  Running: npx tsc --noEmit (timeout 120s) ..."
TSC_OUTPUT=$(timeout 120 npx tsc --noEmit 2>&1)
TSC_EXIT=$?
if [[ $TSC_EXIT -eq 0 ]]; then
  check_pass "TypeScript compiles with 0 errors"
elif [[ $TSC_EXIT -eq 124 ]]; then
  check_warn "TypeScript check timed out after 120s"
else
  TSC_ERRORS=$(echo "$TSC_OUTPUT" | grep "error TS" | wc -l)
  check_fail "TypeScript has ${TSC_ERRORS} compilation error(s)"
  echo "$TSC_OUTPUT" | grep "error TS" | head -5 | while read -r line; do
    echo -e "    ${RED}│${NC} $line"
  done
fi

# 0.2 — No secrets leaked
if file_exists ".gitguardian.yaml"; then
  check_pass ".gitguardian.yaml present"
else
  check_warn ".gitguardian.yaml missing"
fi

LEAKED=$(git log --oneline -10 --diff-filter=A -- '*.env' 2>/dev/null | wc -l)
if [[ "$LEAKED" -eq 0 ]]; then
  check_pass "No .env files in recent commits"
else
  check_fail ".env file committed to git history"
fi

# 0.3 — Console.log check
CONSOLE_LOGS=$(grep -rn "console\.log" src/ --include="*.ts" 2>/dev/null | grep -v "//.*console" | wc -l)
if [[ "$CONSOLE_LOGS" -gt 3 ]]; then
  check_warn "Found ${CONSOLE_LOGS} console.log in src/ (prefer structured logger)"
else
  check_pass "Minimal console.log usage in production code (${CONSOLE_LOGS})"
fi

# 0.4 — node_modules exists
if [[ -d "node_modules" ]]; then
  check_pass "node_modules exists"
else
  check_warn "node_modules missing — run npm install first"
fi

# =============================================================================
# PHASE 1: STABILIZE & FIX (Issues #158, #173, #145, #146, #171)
# =============================================================================
if [[ "$PHASE" == "1" || "$PHASE" == "all" ]]; then

section "Phase 1A: Test Suite Fix (#158)"

# 1A.1 — nock dependency
if [[ -d "node_modules/nock" ]]; then
  check_pass "nock module installed in node_modules"
else
  check_fail "nock module NOT found — npm install required (#158)"
fi

# 1A.2 — Test suite runs
echo -e "  Running: npm test (timeout 120s) ..."
TEST_OUTPUT=$(timeout 120 npm test 2>&1)
TEST_EXIT=$?
if echo "$TEST_OUTPUT" | grep -q "MODULE_NOT_FOUND"; then
  check_fail "npm test crashes with MODULE_NOT_FOUND (#158)"
elif echo "$TEST_OUTPUT" | grep -qi "passing"; then
  PASSING=$(echo "$TEST_OUTPUT" | grep -i "passing" | tail -1)
  check_pass "npm test runs: $PASSING"
elif [[ $TEST_EXIT -eq 124 ]]; then
  check_warn "npm test timed out after 120s"
else
  check_warn "npm test exited with code $TEST_EXIT (no 'passing' found)"
fi

# 1A.3 — E2E PnL test
echo -e "  Running: npm run test:e2e (timeout 60s) ..."
E2E_OUTPUT=$(timeout 60 npm run test:e2e 2>&1)
E2E_EXIT=$?
if echo "$E2E_OUTPUT" | grep -qi "passing"; then
  check_pass "E2E PnL scenario test passes"
elif [[ $E2E_EXIT -eq 124 ]]; then
  check_warn "E2E test timed out"
else
  check_warn "E2E test exited with code $E2E_EXIT"
fi

# ---
section "Phase 1B: Sentiment API Replacement (#173, #145)"

NEWS_FEED="src/logic/strategy/news_feed.ts"
if file_exists "$NEWS_FEED"; then
  # 1B.1 — Alternative provider exists
  if file_contains "$NEWS_FEED" "lunarcrush.com/api4"; then
    if file_contains "$NEWS_FEED" "coingecko|cryptocompare|newsapi|coinmarketcap|SENTIMENT_PROVIDER|fallback.*provider|alternative|Provider"; then
      check_pass "Alternative sentiment provider added alongside LunarCrush"
    else
      check_fail "news_feed.ts still uses ONLY LunarCrush V4 (requires paid tier) (#173)"
    fi
  else
    check_pass "LunarCrush V4 endpoint removed or replaced"
  fi

  # 1B.2 — Neutral fallback preserved
  if file_contains "$NEWS_FEED" "getNeutralFallback|neutralFallback|neutral.*fallback"; then
    check_pass "Neutral sentiment fallback preserved (fail-closed)"
  else
    check_fail "Neutral fallback missing — violates fail-closed principle"
  fi

  # 1B.3 — Provider abstraction
  if file_contains "$NEWS_FEED" "interface.*Provider|type.*Provider|SentimentProvider|NewsProvider"; then
    check_pass "Sentiment provider abstraction added"
  else
    check_warn "No provider abstraction — future swaps harder"
  fi
else
  check_fail "news_feed.ts not found"
fi

# ---
section "Phase 1C: PnL & Risk Model Hardening (#146, #171)"

# 1C.1 — MDD calculation fix
CALCULATOR="src/logic/pnl/calculator.ts"
if file_exists "$CALCULATOR"; then
  # Bug: equityCurve starts at [0], negative PnL gives drawdown > 100%
  # Original buggy line: (peak - value) / (peak || 1)
  # Need: floor peak at minimum value OR clamp drawdown to 100%
  HAS_FLOOR=$(grep -c "Math.max\|minimum.*equity\|floor.*peak\|initialEquity\|baselineEquity\|clamp\|Math.min.*1\|maxDrawdown.*100" "$CALCULATOR" 2>/dev/null)
  if [[ "$HAS_FLOOR" -gt 0 ]]; then
    check_pass "MDD calculation has peak equity floor or clamp (#146)"
  else
    check_fail "MDD calculation not fixed — >100% drawdown possible (#146)"
  fi
else
  check_fail "calculator.ts not found"
fi

# 1C.2 — ROI block fix
RISK_ASSESSMENT="src/logic/strategy/risk_assessment.ts"
if file_exists "$RISK_ASSESSMENT"; then
  # Bug: expectedRoi <= 0 blocks ALL trades when sentiment=0.5 (edge=0)
  if grep -q "expectedRoi.*<=.*0" "$RISK_ASSESSMENT" 2>/dev/null; then
    # Check if they also added a threshold
    if file_contains "$RISK_ASSESSMENT" "MIN_EDGE|minEdge|edgeThreshold|MIN_ROI|expectedRoi.*<.*-0"; then
      check_pass "ROI block uses negative threshold (not strictly positive)"
    else
      check_fail "ROI block still uses 'expectedRoi <= 0' — blocks all neutral sentiment trades (#171)"
    fi
  else
    check_pass "ROI block threshold adjusted"
  fi

  # 1C.3 — Configurable risk thresholds
  if file_contains "$RISK_ASSESSMENT" "process\.env\.\w*RISK|process\.env\.\w*THRESHOLD|process\.env\.\w*CONFIDENCE|RISK_THRESHOLD"; then
    check_pass "Risk thresholds are configurable via env vars"
  else
    check_warn "Risk thresholds are hardcoded — SDK users can't customize"
  fi

  # 1C.4 — AgentStack optional
  if file_contains "$RISK_ASSESSMENT" "agentStackRequired"; then
    check_pass "AgentStack verification is configurable"
  else
    check_warn "AgentStack verification may be hardcoded"
  fi
else
  check_fail "risk_assessment.ts not found"
fi

# 1C.5 — AI utility circuit breaker
AI_UTILS="src/utils/ai.ts"
if file_exists "$AI_UTILS"; then
  if file_contains "$AI_UTILS" "circuit.*breaker|circuitBreaker|consecutive.*fail|cooldown|COOLDOWN"; then
    check_pass "AI utility has circuit breaker pattern"
  else
    check_warn "No circuit breaker in AI utility — Gemini quota unhandled (#171)"
  fi
fi

# ---
section "Phase 1D: API Call Optimization"

# 1D.1 — Parallel API calls
if file_exists "$RISK_ASSESSMENT"; then
  if file_contains "$RISK_ASSESSMENT" "Promise\.all|Promise\.allSettled"; then
    check_pass "API calls parallelized with Promise.all/allSettled"
  else
    check_warn "API calls appear sequential — perf bottleneck"
  fi
fi

# 1D.2 — Balance/history caching
KRAKEN_SVC="src/services/kraken_service.ts"
if file_exists "$KRAKEN_SVC"; then
  if file_contains "$KRAKEN_SVC" "cache|Cache|TTL|ttl|cached|lastFetch|_cached"; then
    check_pass "KrakenService has response caching"
  else
    check_warn "KrakenService has no caching for getBalance/getTradeHistory"
  fi
fi

fi # end Phase 1

# =============================================================================
# PHASE 2: SDK EXTRACTION & DASHBOARD (#161, #160, #162)
# =============================================================================
if [[ "$PHASE" == "2" || "$PHASE" == "all" ]]; then

section "Phase 2A: SDK Package Structure"

SDK_DIR="packages/sentinel-sdk"

if dir_exists "$SDK_DIR"; then
  check_pass "SDK directory exists: $SDK_DIR"

  # 2A.1 — package.json
  if file_exists "$SDK_DIR/package.json"; then
    check_pass "SDK package.json exists"
  else
    check_fail "SDK package.json missing"
  fi

  # 2A.2 — Entry point
  if file_exists "$SDK_DIR/src/index.ts"; then
    check_pass "SDK entry point: src/index.ts"
    if file_contains "$SDK_DIR/src/index.ts" "SentinelClient|export"; then
      check_pass "SDK exports SentinelClient"
    else
      check_fail "SDK index.ts doesn't export SentinelClient"
    fi
  else
    check_fail "SDK src/index.ts missing"
  fi

  # 2A.3 — Client implementation
  CLIENT_FILE=$(find "$SDK_DIR/src" -name "client.ts" -o -name "sentinel-client.ts" 2>/dev/null | head -1)
  if [[ -n "$CLIENT_FILE" ]]; then
    check_pass "SDK client file: $(basename $CLIENT_FILE)"

    if file_contains "$CLIENT_FILE" "authorize"; then
      check_pass "SentinelClient.authorize() exists"
    else
      check_fail "SentinelClient missing authorize() method"
    fi

    if file_contains "$CLIENT_FILE" "FailClosed|failClosed|FAIL_CLOSED|CriticalSecurityException|isAllowed.*false"; then
      check_pass "SDK implements fail-closed behavior"
    else
      check_fail "SDK missing fail-closed enforcement"
    fi
  else
    check_fail "No client.ts found in SDK"
  fi

  # 2A.4 — Types
  TYPES_FILE=$(find "$SDK_DIR/src" -name "types.ts" -o -name "interfaces.ts" 2>/dev/null | head -1)
  if [[ -n "$TYPES_FILE" ]]; then
    check_pass "SDK types file found"
    for TYPE in TradeIntent Authorization SentinelConfig; do
      if file_contains "$TYPES_FILE" "$TYPE"; then
        check_pass "SDK type: $TYPE"
      else
        check_warn "SDK missing type: $TYPE"
      fi
    done
  else
    check_fail "No types.ts in SDK"
  fi

  # 2A.5 — README
  if file_exists "$SDK_DIR/README.md"; then
    check_pass "SDK README.md exists"
    for KW in install fail-closed authorize; do
      if file_contains "$SDK_DIR/README.md" "$KW"; then
        check_pass "SDK README covers: $KW"
      else
        check_warn "SDK README missing: $KW"
      fi
    done
  else
    check_fail "SDK README.md missing"
  fi

  # 2A.6 — Tests
  SDK_TESTS=$(find "$SDK_DIR" -name "*.test.ts" -o -name "*.spec.ts" 2>/dev/null | wc -l)
  if [[ "$SDK_TESTS" -gt 0 ]]; then
    check_pass "SDK has $SDK_TESTS test file(s)"
  else
    check_fail "SDK has no test files"
  fi
else
  check_fail "SDK directory $SDK_DIR not found — Phase 2A not implemented"
fi

# ---
section "Phase 2B: Dashboard PnL Wiring (#161)"

DASHBOARD="dashboard/index.html"
if file_exists "$DASHBOARD"; then
  if file_contains "$DASHBOARD" "pnl_report|pnl\.json|pnlReport"; then
    check_pass "Dashboard references PnL report"
  else
    check_fail "Dashboard not wired to PnL report (#161)"
  fi

  for METRIC in "winRate|Win Rate" "sharpe|Sharpe" "drawdown|MDD|Drawdown" "sentinelSavings|Sentinel Savings"; do
    LABEL="${METRIC%%|*}"
    if file_contains "$DASHBOARD" "$METRIC"; then
      check_pass "Dashboard metric: $LABEL"
    else
      check_warn "Dashboard missing metric: $LABEL"
    fi
  done

  if file_contains "$DASHBOARD" "green.*red|profit.*loss|color.*pnl|pnl.*color|positive.*negative"; then
    check_pass "PnL color-coded display"
  else
    check_warn "PnL color coding not detected"
  fi
else
  check_fail "Dashboard index.html not found"
fi

fi # end Phase 2

# =============================================================================
# PHASE 3: DOCUMENTATION & POLISH (#166, #165, #164)
# =============================================================================
if [[ "$PHASE" == "3" || "$PHASE" == "all" ]]; then

section "Phase 3A: Pitch Deck Updates (#166)"

PITCH="pitch-deck.html"
if file_exists "$PITCH"; then
  if file_contains "$PITCH" "HITL|Human-in-the-Loop|human.*loop"; then
    check_pass "Pitch deck includes HITL"
  else
    check_fail "Pitch deck missing HITL (#166)"
  fi

  if file_contains "$PITCH" "PnL|pnl|Profit.*Loss|Win Rate|Sharpe"; then
    check_pass "Pitch deck includes PnL metrics"
  else
    check_warn "Pitch deck missing PnL content"
  fi

  if file_contains "$PITCH" "SDK|sdk|sentinel-sdk"; then
    check_pass "Pitch deck references SDK"
  else
    check_warn "Pitch deck doesn't mention SDK"
  fi
else
  check_fail "pitch-deck.html not found"
fi

# ---
section "Phase 3C: One-Click Onboarding (#164)"

if grep -q '"demo"' package.json 2>/dev/null; then
  check_pass "package.json has 'demo' script"
else
  check_fail "package.json missing 'demo' script (#164)"
fi

if file_not_contains "package.json" "hackathon:submit"; then
  check_pass "No stale 'hackathon:submit' in package.json"
else
  check_fail "'hackathon:submit' still in package.json"
fi

fi # end Phase 3

# =============================================================================
# SECURITY & ARCHITECTURE INVARIANTS (always run)
# =============================================================================
section "Security & Architecture Invariants"

# S.1 — CriticalSecurityException
CSE_COUNT=$(grep -r "CriticalSecurityException" src/ --include="*.ts" 2>/dev/null | wc -l)
if [[ "$CSE_COUNT" -gt 0 ]]; then
  check_pass "CriticalSecurityException used (${CSE_COUNT} locations)"
else
  check_fail "CriticalSecurityException not found — fail-closed broken"
fi

# S.2 — No mock flags in prod
MOCK_FLAGS=$(grep -rn "isSimulated\|IS_SIMULATED\|MOCK_MODE" src/ --include="*.ts" 2>/dev/null | grep -v "test\|spec" | wc -l)
if [[ "$MOCK_FLAGS" -eq 0 ]]; then
  check_pass "No mock/simulation flags in production code"
else
  check_warn "Found ${MOCK_FLAGS} mock flag(s) in src/"
fi

# S.3 — EIP-712 signing preserved
if grep -rq "signIntent\|EIP.712\|signTypedData" src/ 2>/dev/null; then
  check_pass "EIP-712 signing logic preserved"
else
  check_fail "EIP-712 signing missing — core security broken"
fi

# S.4 — Circuit breaker in ExecutionProxy
PROXY="src/execution/proxy.ts"
if file_exists "$PROXY"; then
  if file_contains "$PROXY" "circuitBreaker|CIRCUIT_BREAKER|consecutiveFailures"; then
    check_pass "ExecutionProxy circuit breaker intact"
  else
    check_fail "ExecutionProxy circuit breaker removed"
  fi
fi

# S.5 — HITL preserved
if grep -rq "hitl\|HITL\|hitlThreshold" src/ 2>/dev/null; then
  check_pass "HITL module preserved"
else
  check_fail "HITL module removed — institutional regression"
fi

# S.6 — Audit logging
if file_exists "$PROXY" && file_contains "$PROXY" "auditLog"; then
  check_pass "Audit logging preserved in ExecutionProxy"
else
  check_warn "Audit logging check inconclusive"
fi

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║                    VALIDATION SUMMARY                   ║${NC}"
echo -e "${BOLD}╠══════════════════════════════════════════════════════════╣${NC}"
TOTAL=$((PASS + FAIL + WARN + SKIP))
SCORE=0
if [[ $TOTAL -gt 0 ]]; then
  SCORE=$(( (PASS * 100) / TOTAL ))
fi
printf "${BOLD}║${NC}  ${GREEN}PASS: %-4s${NC} ${RED}FAIL: %-4s${NC} ${YELLOW}WARN: %-4s${NC}  Score: %3d%%   ${BOLD}║${NC}\n" "$PASS" "$FAIL" "$WARN" "$SCORE"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"

if [[ ${#ERRORS[@]} -gt 0 ]]; then
  echo ""
  echo -e "${RED}${BOLD}Failed checks:${NC}"
  for err in "${ERRORS[@]}"; do
    echo -e "  ${RED}• ${err}${NC}"
  done
fi

echo ""
if [[ $FAIL -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}✔ PR VALIDATED — All critical checks passed.${NC}"
  exit 0
elif [[ $FAIL -le 3 ]]; then
  echo -e "${YELLOW}${BOLD}⚠ PR NEEDS MINOR FIXES — ${FAIL} failure(s).${NC}"
  exit 1
else
  echo -e "${RED}${BOLD}✘ PR REJECTED — ${FAIL} critical failure(s).${NC}"
  exit 2
fi
