#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Vertex Sentinel — PR Alignment Verification Script
# ═══════════════════════════════════════════════════════════════════
# Verifies the feat/unified-server-api-alignment PR against the
# agreed-upon implementation plan:
#   Phase 1: Backend API Layer (Express HTTP Server)
#   Phase 4: Frontend-Backend Integration
#
# Usage:
#   chmod +x scripts/verify_pr_alignment.sh
#   ./scripts/verify_pr_alignment.sh
#
# Optional: Pass --live to also start the server and test HTTP routes
#   ./scripts/verify_pr_alignment.sh --live
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Colors ──────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

PASS=0
FAIL=0
WARN=0
LIVE_MODE=false

for arg in "$@"; do
  if [ "$arg" = "--live" ]; then
    LIVE_MODE=true
  fi
done

pass() { PASS=$((PASS + 1)); echo -e "  ${GREEN}✅ PASS${NC}: $1"; }
fail() { FAIL=$((FAIL + 1)); echo -e "  ${RED}❌ FAIL${NC}: $1"; }
warn() { WARN=$((WARN + 1)); echo -e "  ${YELLOW}⚠️  WARN${NC}: $1"; }
section() { echo -e "\n${CYAN}${BOLD}━━━ $1 ━━━${NC}"; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo -e "${BOLD}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║     Vertex Sentinel — PR Alignment Verification              ║"
echo "║     Branch: feat/unified-server-api-alignment                ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ══════════════════════════════════════════════════════════════════
# SECTION 1: FILE STRUCTURE VERIFICATION
# ══════════════════════════════════════════════════════════════════
section "1. File Structure Verification"

# New files that MUST exist
echo -e "  ${BOLD}Checking new files...${NC}"
if [ -f "dashboard/js/api-client.js" ]; then
  pass "dashboard/js/api-client.js exists (centralized API client)"
else
  fail "dashboard/js/api-client.js MISSING — frontend cannot call API routes"
fi

if [ -f "dashboard/js/app.js" ]; then
  pass "dashboard/js/app.js exists (extracted dashboard JS)"
else
  fail "dashboard/js/app.js MISSING — dashboard JS not extracted from index.html"
fi

# ══════════════════════════════════════════════════════════════════
# SECTION 2: UNIFIED EXPRESS SERVER
# ══════════════════════════════════════════════════════════════════
section "2. Unified Express Server (socket-server.ts)"

SERVER_FILE="src/orchestrator/socket-server.ts"

if [ ! -f "$SERVER_FILE" ]; then
  fail "socket-server.ts not found!"
else
  # Check Express import
  if grep -q "import express" "$SERVER_FILE"; then
    pass "Express imported in socket-server.ts"
  else
    fail "Express NOT imported — server is not unified"
  fi

  # Check CORS import
  if grep -q "import cors" "$SERVER_FILE"; then
    pass "CORS middleware imported"
  else
    fail "CORS middleware NOT imported"
  fi

  # Check express.json() middleware
  if grep -q "express.json()" "$SERVER_FILE"; then
    pass "JSON body parser middleware configured"
  else
    fail "express.json() middleware missing — POST routes won't work"
  fi

  # Check static file serving for dashboard
  if grep -q "express.static" "$SERVER_FILE" && grep -q "dashboard" "$SERVER_FILE"; then
    pass "Dashboard served via Express static middleware"
  else
    fail "Dashboard NOT served via Express.static — still needs separate 'serve' process"
  fi

  # Check API routes exist
  echo -e "\n  ${BOLD}Checking API routes...${NC}"

  declare -A ROUTES=(
    ["/api/health"]="Health check endpoint"
    ["/api/agent"]="Agent metadata endpoint"
    ["/api/pnl"]="Live PnL metrics endpoint"
    ["/api/audit"]="Paginated audit trail endpoint"
    ["/api/automation"]="Automation state endpoint"
    ["/api/quota"]="AI quota usage endpoint"
  )

  for route in "${!ROUTES[@]}"; do
    # Use a more flexible grep — the route string might appear in various forms
    route_pattern=$(echo "$route" | sed 's/\//\\\//g')
    if grep -qE "(get|post|put|delete)\(['\"]${route_pattern}" "$SERVER_FILE" 2>/dev/null || \
       grep -qF "'${route}'" "$SERVER_FILE" 2>/dev/null || \
       grep -qF "\"${route}\"" "$SERVER_FILE" 2>/dev/null; then
      pass "Route ${route} — ${ROUTES[$route]}"
    else
      fail "Route ${route} MISSING — ${ROUTES[$route]}"
    fi
  done

  # Check POST automation toggle
  if grep -q "/api/automation/toggle" "$SERVER_FILE"; then
    pass "Route POST /api/automation/toggle — toggle automation via REST"
  else
    fail "Route POST /api/automation/toggle MISSING"
  fi

  # Check PnL tracker import for live data
  if grep -q "PnLTracker\|getPnLTracker\|pnl.*tracker" "$SERVER_FILE"; then
    pass "PnLTracker integrated — live PnL data from memory"
  else
    fail "PnLTracker NOT integrated — /api/pnl would use stale file data"
  fi

  # Check audit pagination support
  if grep -q "page.*limit\|pagination\|page_size\|pageSize" "$SERVER_FILE"; then
    pass "Audit trail supports pagination"
  else
    warn "Audit trail may not support pagination"
  fi

  # Check route for dashboard HTML serving
  if grep -qE "sendFile.*index\.html|sendFile.*onboarding" "$SERVER_FILE"; then
    pass "Dashboard HTML routes configured (index.html, onboarding.html)"
  else
    warn "Dashboard HTML routes may not be explicitly configured"
  fi
fi

# ══════════════════════════════════════════════════════════════════
# SECTION 3: HARDCODED LOCALHOST REMOVAL
# ══════════════════════════════════════════════════════════════════
section "3. Hardcoded localhost Removal"

# Check dashboard HTML for localhost references
DASHBOARD="dashboard/index.html"
if [ -f "$DASHBOARD" ]; then
  LOCALHOST_COUNT=$(grep -c "localhost" "$DASHBOARD" 2>/dev/null || true)
  if [ "$LOCALHOST_COUNT" -eq 0 ]; then
    pass "No hardcoded 'localhost' in dashboard/index.html"
  else
    fail "Found $LOCALHOST_COUNT 'localhost' reference(s) in dashboard/index.html"
    grep -n "localhost" "$DASHBOARD" 2>/dev/null | head -5 | while read -r line; do
      echo -e "        ${RED}→ $line${NC}"
    done
  fi
fi

# Check api-client.js uses window.location.origin
if [ -f "dashboard/js/api-client.js" ]; then
  if grep -q "window.location.origin" "dashboard/js/api-client.js"; then
    pass "API client uses window.location.origin (dynamic URL)"
  else
    fail "API client does NOT use window.location.origin — hardcoded URL?"
  fi

  if grep -q "localhost" "dashboard/js/api-client.js" 2>/dev/null; then
    fail "API client still references 'localhost'"
  else
    pass "API client has no hardcoded localhost references"
  fi
fi

# Check app.js for localhost
if [ -f "dashboard/js/app.js" ]; then
  if grep -q "localhost" "dashboard/js/app.js" 2>/dev/null; then
    fail "app.js still references 'localhost'"
    grep -n "localhost" "dashboard/js/app.js" 2>/dev/null | head -5 | while read -r line; do
      echo -e "        ${RED}→ $line${NC}"
    done
  else
    pass "app.js has no hardcoded localhost references"
  fi
fi

# ══════════════════════════════════════════════════════════════════
# SECTION 4: FRONTEND JS EXTRACTION
# ══════════════════════════════════════════════════════════════════
section "4. Frontend JS Extraction"

if [ -f "$DASHBOARD" ]; then
  # Count inline script blocks (should be minimal or zero)
  INLINE_SCRIPT_COUNT=$(grep -c "<script>" "$DASHBOARD" 2>/dev/null || true)
  TOTAL_LINES=$(wc -l < "$DASHBOARD" 2>/dev/null || echo "0")

  if [ "$TOTAL_LINES" -lt 900 ]; then
    pass "Dashboard HTML reduced to $TOTAL_LINES lines (from ~1617 original)"
  else
    warn "Dashboard HTML is $TOTAL_LINES lines — expected significant reduction from JS extraction"
  fi

  # Check that app.js is referenced
  if grep -q "app.js" "$DASHBOARD"; then
    pass "Dashboard references app.js"
  else
    fail "Dashboard does NOT reference app.js"
  fi

  # Check that api-client.js is imported (directly or via app.js)
  if grep -q "api-client" "$DASHBOARD" || ([ -f "dashboard/js/app.js" ] && grep -q "api-client" "dashboard/js/app.js"); then
    pass "API client is imported (directly or via app.js)"
  else
    fail "API client is NOT imported anywhere"
  fi

  # Check the script tag uses type="module" for ESM imports
  if grep -q 'type="module".*app.js\|app.js.*type="module"' "$DASHBOARD"; then
    pass "app.js loaded as ES module (type=\"module\")"
  else
    warn "app.js may not be loaded as ES module — import/export won't work"
  fi
fi

# ══════════════════════════════════════════════════════════════════
# SECTION 5: AUTOMATION DEFAULT STATE
# ══════════════════════════════════════════════════════════════════
section "5. Agent Brain Automation Default"

BRAIN_FILE="src/logic/agent_brain.ts"
if [ -f "$BRAIN_FILE" ]; then
  # Check automation defaults to OFF
  if grep -qE "isAutomationEnabled\s*=\s*false" "$BRAIN_FILE"; then
    pass "Automation defaults to OFF (isAutomationEnabled = false)"
  elif grep -qE "isAutomationEnabled\s*=\s*true" "$BRAIN_FILE"; then
    fail "Automation still defaults to ON — should be OFF per spec"
  else
    warn "Could not determine automation default state"
  fi

  # Check strict boolean parsing
  if grep -q 'data.enabled === true' "$BRAIN_FILE"; then
    pass "Strict boolean check: data.enabled === true (not loose truthy)"
  elif grep -q 'data.enabled !== false' "$BRAIN_FILE"; then
    fail "Loose boolean check: data.enabled !== false (should be === true)"
  else
    warn "Could not determine boolean parsing strictness"
  fi
fi

# Check socket-server sends default state on connect
if [ -f "$SERVER_FILE" ]; then
  if grep -q 'enabled: false' "$SERVER_FILE"; then
    pass "Socket server sends { enabled: false } when no state file exists"
  else
    warn "Socket server may not default to disabled state for new connections"
  fi
fi

# ══════════════════════════════════════════════════════════════════
# SECTION 6: PACKAGE.JSON UPDATES
# ══════════════════════════════════════════════════════════════════
section "6. Package.json Dependencies & Scripts"

PKG="package.json"
if [ -f "$PKG" ]; then
  # Check express dependency
  if grep -q '"express"' "$PKG"; then
    pass "express dependency added"
  else
    fail "express dependency MISSING in package.json"
  fi

  # Check cors dependency
  if grep -q '"cors"' "$PKG"; then
    pass "cors dependency added"
  else
    fail "cors dependency MISSING in package.json"
  fi

  # Check @types/express
  if grep -q '"@types/express"' "$PKG"; then
    pass "@types/express dev dependency added"
  else
    warn "@types/express missing — may cause TS compilation warnings"
  fi

  # Check that dashboard script no longer uses 'serve'
  DASHBOARD_SCRIPT=$(node -e "const p = require('./package.json'); console.log(p.scripts.dashboard || '')" 2>/dev/null)
  if echo "$DASHBOARD_SCRIPT" | grep -q "serve"; then
    fail "Dashboard script still uses 'serve' package — not unified"
  else
    pass "Dashboard script no longer uses 'serve' package"
  fi
fi

# ══════════════════════════════════════════════════════════════════
# SECTION 7: START-APP.SH UNIFIED
# ══════════════════════════════════════════════════════════════════
section "7. Start Script (start-app.sh)"

if [ -f "start-app.sh" ]; then
  # Check it only starts one service (not two)
  SERVICE_COUNT=$(grep -c '^start_service ' "start-app.sh" 2>/dev/null || true)
  if [ "$SERVICE_COUNT" -eq 1 ]; then
    pass "start-app.sh starts a single unified service"
  elif [ "$SERVICE_COUNT" -eq 2 ]; then
    fail "start-app.sh still starts two separate services (agent + dashboard)"
  else
    warn "start-app.sh has $SERVICE_COUNT start_service calls"
  fi

  # Check the service is named 'sentinel' or similar unified name
  if grep -q '"sentinel"\|"server"\|"unified"' "start-app.sh"; then
    pass "Unified service has descriptive name"
  else
    warn "Service naming may not reflect unified architecture"
  fi

  # Check port 3006 is referenced or documented
  if grep -q "3006" "start-app.sh"; then
    pass "References port 3006 in documentation"
  else
    warn "Port 3006 not mentioned in start-app.sh"
  fi
fi

# ══════════════════════════════════════════════════════════════════
# SECTION 8: SOCKET.IO EVENT WIRING
# ══════════════════════════════════════════════════════════════════
section "8. Socket.io Event Wiring"

if [ -f "$SERVER_FILE" ]; then
  SOCKET_EVENTS=("hitl.approve" "hitl.reject" "automation.toggle" "trade.authorized" "risk.alert" "balance.update" "hitl.pending" "risk.update")

  for event in "${SOCKET_EVENTS[@]}"; do
    if grep -q "$event" "$SERVER_FILE"; then
      pass "Socket event '$event' wired"
    else
      fail "Socket event '$event' NOT wired in server"
    fi
  done
fi

# Check frontend app.js also handles these events
if [ -f "dashboard/js/app.js" ]; then
  echo -e "\n  ${BOLD}Checking frontend event handling...${NC}"
  FE_EVENTS=("trade.authorized" "risk.alert" "balance.update" "hitl.pending" "risk.update" "automation.sync")

  for event in "${FE_EVENTS[@]}"; do
    if grep -q "$event" "dashboard/js/app.js"; then
      pass "Frontend handles '$event'"
    else
      warn "Frontend may not handle '$event' in app.js"
    fi
  done
fi

# ══════════════════════════════════════════════════════════════════
# SECTION 9: API CLIENT COMPLETENESS
# ══════════════════════════════════════════════════════════════════
section "9. API Client Completeness"

if [ -f "dashboard/js/api-client.js" ]; then
  API_METHODS=("fetchAgent" "fetchPnL" "fetchAudit" "fetchAutomation" "toggleAutomation" "initSocket")

  for method in "${API_METHODS[@]}"; do
    if grep -q "$method" "dashboard/js/api-client.js"; then
      pass "API client method: $method()"
    else
      fail "API client MISSING method: $method()"
    fi
  done

  # Check it exports the client instance
  if grep -q "export" "dashboard/js/api-client.js"; then
    pass "API client exports instance for ES module import"
  else
    warn "API client may not export — check if app.js can import it"
  fi
fi

# ══════════════════════════════════════════════════════════════════
# SECTION 10: FRONTEND USES API (not static files)
# ══════════════════════════════════════════════════════════════════
section "10. Frontend Uses API Routes (not static files)"

if [ -f "dashboard/js/app.js" ]; then
  # Check it uses API calls instead of direct file fetches
  if grep -q "api\.fetchAudit\|api\.fetchPnL\|/api/audit\|/api/pnl" "dashboard/js/app.js"; then
    pass "Frontend uses API routes for data fetching"
  else
    warn "Frontend may still use static file fetches"
  fi

  # Check for old /logs/ static file patterns
  OLD_PATTERNS=$(grep -c "/logs/audit.json\|/logs/pnl_report.json" "dashboard/js/app.js" 2>/dev/null || true)
  if [ "$OLD_PATTERNS" -eq 0 ]; then
    pass "No legacy /logs/*.json static file fetches in app.js"
  else
    warn "Found $OLD_PATTERNS legacy /logs/*.json fetches — should use API routes"
  fi
fi

# Also check index.html for any remaining direct file fetches
if [ -f "$DASHBOARD" ]; then
  OLD_HTML_PATTERNS=$(grep -c "/logs/audit.json\|/logs/pnl_report.json" "$DASHBOARD" 2>/dev/null || true)
  if [ "$OLD_HTML_PATTERNS" -eq 0 ]; then
    pass "No legacy /logs/*.json static file fetches in index.html"
  else
    warn "Found $OLD_HTML_PATTERNS legacy /logs/*.json fetches in index.html"
  fi
fi

# ══════════════════════════════════════════════════════════════════
# SECTION 11: TYPESCRIPT COMPILATION CHECK
# ══════════════════════════════════════════════════════════════════
section "11. TypeScript Compilation Check"

if command -v npx &> /dev/null && [ -f "tsconfig.json" ]; then
  echo -e "  Compiling TypeScript (this may take a moment)..."
  if npx tsc --noEmit --pretty 2>&1 | head -30; then
    TSC_EXIT=${PIPESTATUS[0]}
    if [ "$TSC_EXIT" -eq 0 ]; then
      pass "TypeScript compilation successful — no type errors"
    else
      fail "TypeScript compilation failed — check type errors above"
    fi
  fi
else
  warn "Cannot run tsc — npx or tsconfig.json not found"
fi

# ══════════════════════════════════════════════════════════════════
# SECTION 12: LIVE SERVER TESTS (optional, --live flag)
# ══════════════════════════════════════════════════════════════════
if [ "$LIVE_MODE" = true ]; then
  section "12. Live Server HTTP Tests (--live mode)"

  PORT=${PORT:-3006}
  SERVER_PID=""
  CLEANUP() {
    if [ -n "$SERVER_PID" ]; then
      echo -e "\n  Cleaning up server (PID: $SERVER_PID)..."
      kill "$SERVER_PID" 2>/dev/null || true
      wait "$SERVER_PID" 2>/dev/null || true
    fi
  }
  trap CLEANUP EXIT

  echo -e "  Starting unified server on port $PORT..."

  # Start the server in background
  NODE_OPTIONS='--import tsx --no-warnings' node src/orchestrator/socket-server.ts > /tmp/sentinel_verify.log 2>&1 &
  SERVER_PID=$!

  # Wait for startup
  echo -e "  Waiting for server to initialize..."
  sleep 4

  # Check if server is running
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    fail "Server failed to start! Check /tmp/sentinel_verify.log"
    echo -e "  ${RED}Last 10 lines of log:${NC}"
    tail -10 /tmp/sentinel_verify.log 2>/dev/null | while read -r line; do
      echo -e "    $line"
    done
  else
    pass "Server started successfully (PID: $SERVER_PID)"

    # Test health endpoint
    echo -e "\n  ${BOLD}Testing API endpoints...${NC}"

    test_endpoint() {
      local url="$1"
      local desc="$2"
      local expected_status="${3:-200}"

      HTTP_CODE=$(curl -s -o /tmp/sentinel_response.json -w '%{http_code}' "http://localhost:${PORT}${url}" 2>/dev/null || echo "000")

      if [[ "$HTTP_CODE" =~ ^($expected_status)$ ]]; then
        pass "$desc → HTTP $HTTP_CODE"
        # Show a snippet of the response
        RESPONSE_PREVIEW=$(cat /tmp/sentinel_response.json 2>/dev/null | head -c 120)
        if [ -n "$RESPONSE_PREVIEW" ]; then
          echo -e "        ${CYAN}Response: ${RESPONSE_PREVIEW}...${NC}"
        fi
      elif [ "$HTTP_CODE" = "000" ]; then
        fail "$desc → Connection refused (server not responding)"
      else
        fail "$desc → HTTP $HTTP_CODE (expected $expected_status)"
        RESPONSE_PREVIEW=$(cat /tmp/sentinel_response.json 2>/dev/null | head -c 200)
        if [ -n "$RESPONSE_PREVIEW" ]; then
          echo -e "        ${RED}Response: ${RESPONSE_PREVIEW}${NC}"
        fi
      fi
    }

    # Test each API route
    test_endpoint "/api/health" "GET /api/health"
    test_endpoint "/api/agent" "GET /api/agent" "200|404"
    test_endpoint "/api/pnl" "GET /api/pnl" "200|404"
    test_endpoint "/api/audit?page=1&limit=10" "GET /api/audit (paginated)"
    test_endpoint "/api/automation" "GET /api/automation"
    test_endpoint "/api/quota" "GET /api/quota"

    # Test static file serving
    test_endpoint "/" "GET / (dashboard index.html)"
    test_endpoint "/dashboard" "GET /dashboard (explicit route)"
    test_endpoint "/onboarding" "GET /onboarding"

    # Test POST automation toggle
    echo -e "\n  ${BOLD}Testing POST endpoints...${NC}"
    POST_CODE=$(curl -s -o /tmp/sentinel_post_response.json -w '%{http_code}' \
      -X POST "http://localhost:${PORT}/api/automation/toggle" \
      -H "Content-Type: application/json" \
      -d '{"enabled": false}' 2>/dev/null || echo "000")

    if [ "$POST_CODE" = "200" ]; then
      pass "POST /api/automation/toggle → HTTP $POST_CODE"
    else
      fail "POST /api/automation/toggle → HTTP $POST_CODE"
    fi

    # Test that static JS files are served correctly
    JS_CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${PORT}/js/app.js" 2>/dev/null || echo "000")
    if [ "$JS_CODE" = "200" ]; then
      pass "GET /js/app.js → served via Express static"
    else
      fail "GET /js/app.js → HTTP $JS_CODE (static files not served correctly)"
    fi

    JS_CLIENT_CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${PORT}/js/api-client.js" 2>/dev/null || echo "000")
    if [ "$JS_CLIENT_CODE" = "200" ]; then
      pass "GET /js/api-client.js → served via Express static"
    else
      fail "GET /js/api-client.js → HTTP $JS_CLIENT_CODE"
    fi
  fi
else
  section "12. Live Server Tests (SKIPPED)"
  echo -e "  ${YELLOW}Run with --live flag to test HTTP endpoints:${NC}"
  echo -e "  ${BOLD}  ./scripts/verify_pr_alignment.sh --live${NC}"
fi

# ══════════════════════════════════════════════════════════════════
# SECTION 13: SECURITY SANITY CHECKS
# ══════════════════════════════════════════════════════════════════
section "13. Security Sanity Checks"

# Ensure no secrets leaked
if [ -f "dashboard/js/api-client.js" ]; then
  if grep -qi "private_key\|api_key\|secret\|password\|0x[a-fA-F0-9]\{64\}" "dashboard/js/api-client.js" 2>/dev/null; then
    fail "SECURITY: Potential secret/key found in api-client.js!"
  else
    pass "No secrets in api-client.js"
  fi
fi

if [ -f "dashboard/js/app.js" ]; then
  if grep -qi "private_key\|KRAKEN_SECRET\|AGENT_PRIVATE_KEY" "dashboard/js/app.js" 2>/dev/null; then
    fail "SECURITY: Potential secret/key found in app.js!"
  else
    pass "No secrets in app.js"
  fi
fi

# Ensure CORS is not fully open in production
if [ -f "$SERVER_FILE" ]; then
  if grep -q "origin:\s*['\"]\\*['\"]" "$SERVER_FILE" 2>/dev/null; then
    warn "CORS allows all origins (*) — acceptable for dev, restrict for production"
  else
    pass "CORS is not blanket wildcard"
  fi
fi

# ══════════════════════════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                    VERIFICATION SUMMARY                      ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "  ${GREEN}✅ Passed:  $PASS${NC}"
echo -e "  ${RED}❌ Failed:  $FAIL${NC}"
echo -e "  ${YELLOW}⚠️  Warnings: $WARN${NC}"
echo ""

TOTAL=$((PASS + FAIL))
if [ "$TOTAL" -gt 0 ]; then
  SCORE=$(( (PASS * 100) / TOTAL ))
  echo -e "  Score: ${BOLD}$SCORE%${NC} ($PASS/$TOTAL)"
else
  SCORE=0
  echo -e "  ${RED}No checks executed${NC}"
fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}🎉 ALL CHECKS PASSED — PR is aligned with implementation plan${NC}"
  exit 0
elif [ "$FAIL" -le 3 ]; then
  echo -e "  ${YELLOW}${BOLD}⚠️  MINOR ISSUES — PR mostly aligned, review failures above${NC}"
  exit 0
else
  echo -e "  ${RED}${BOLD}🚨 SIGNIFICANT GAPS — PR needs revisions before merge${NC}"
  exit 1
fi
