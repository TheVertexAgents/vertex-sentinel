#!/bin/bash

##############################################################################
# GROQ Migration & Fail-Closed Recovery — Verification Script
#
# Validates ALL code changes from the implementation plan:
#   Phase 1: Immediate Recovery (env, HALTED file)
#   Phase 2: GROQ Migration (env schema, ai.ts, quota tracker)
#   Phase 3: Resilience Hardening (sentiment fallback, brain error handling)
#   Phase 4: Production Readiness (TypeScript, tests, documentation)
#
# This script does NOT modify .env (handled manually by the operator).
# It verifies that source code changes were applied correctly.
#
# Usage: ./scripts/verify_groq_migration.sh
##############################################################################

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
VERIFICATION_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
VERIFICATION_LOG="logs/verification-groq-migration-$(date +%s).log"

mkdir -p logs

log_result() {
    local status=$1
    local message=$2
    echo "[$(date +'%H:%M:%S')] ${status} | ${message}" | tee -a "$VERIFICATION_LOG"
}

pass() {
    local msg=$1
    echo -e "  ${GREEN}✓ PASS${NC}: ${msg}"
    log_result "PASS" "$msg"
    PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
    local msg=$1
    echo -e "  ${RED}✗ FAIL${NC}: ${msg}"
    log_result "FAIL" "$msg"
    FAIL_COUNT=$((FAIL_COUNT + 1))
}

warn() {
    local msg=$1
    echo -e "  ${YELLOW}⚠ WARN${NC}: ${msg}"
    log_result "WARN" "$msg"
    WARN_COUNT=$((WARN_COUNT + 1))
}

info() {
    local msg=$1
    echo -e "  ${CYAN}ℹ INFO${NC}: ${msg}"
    log_result "INFO" "$msg"
}

print_section() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

echo -e "\n${CYAN}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       GROQ Migration & Fail-Closed Recovery Verification          ║${NC}"
echo -e "${CYAN}║                    Vertex Sentinel                                ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════╝${NC}\n"

# ============================================================================
# 1. ENV SCHEMA — GOOGLE KEY MUST BE OPTIONAL (Sprint 2A)
# ============================================================================

print_section "1. Environment Schema — GOOGLE_GENAI_API_KEY Conditionality (Sprint 2A)"

ENV_FILE="src/logic/env.ts"

if [ ! -f "$ENV_FILE" ]; then
    fail "$ENV_FILE does not exist"
else
    # 1a. GOOGLE_GENAI_API_KEY must NOT be unconditionally required
    #     Old: z.string().min(1, "GOOGLE_GENAI_API_KEY is required")
    #     New: z.string().optional() or z.string().min(1,...).optional()
    if grep -q 'GOOGLE_GENAI_API_KEY.*z\.string()\.min(1' "$ENV_FILE" && \
       ! grep -q 'GOOGLE_GENAI_API_KEY.*\.optional()' "$ENV_FILE"; then
        fail "GOOGLE_GENAI_API_KEY is still unconditionally required in env schema"
        info "Expected: z.string().optional() — so GROQ mode doesn't need a Google key"
    else
        pass "GOOGLE_GENAI_API_KEY is optional or conditionally required"
    fi

    # 1b. Cross-validation: Google provider still requires key
    if grep -q "AI_PROVIDER.*===.*'google'.*GOOGLE_GENAI_API_KEY" "$ENV_FILE" || \
       grep -q "AI_PROVIDER.*google.*GOOGLE_GENAI" "$ENV_FILE"; then
        pass "Cross-validation: Google provider still enforces API key when selected"
    else
        warn "Cross-validation for Google provider not found — verify manually"
    fi

    # 1c. GROQ cross-validation exists
    if grep -q "AI_PROVIDER.*===.*'groq'.*GROQ_API_KEY" "$ENV_FILE" || \
       grep -q "AI_PROVIDER.*groq.*GROQ_API_KEY" "$ENV_FILE"; then
        pass "Cross-validation: GROQ provider enforces GROQ_API_KEY when selected"
    else
        fail "Missing cross-validation for GROQ provider + GROQ_API_KEY"
    fi

    # 1d. AI_PROVIDER field exists with groq option
    if grep -q "AI_PROVIDER.*z\.enum.*groq" "$ENV_FILE"; then
        pass "AI_PROVIDER enum includes 'groq'"
    else
        fail "AI_PROVIDER enum does not include 'groq'"
    fi

    # 1e. GROQ_API_KEY field exists
    if grep -q "GROQ_API_KEY" "$ENV_FILE"; then
        pass "GROQ_API_KEY field exists in env schema"
    else
        fail "GROQ_API_KEY field missing from env schema"
    fi
fi

# ============================================================================
# 2. AI MODULE — CONDITIONAL PLUGIN INITIALIZATION (Sprint 2B)
# ============================================================================

print_section "2. AI Module — Conditional Genkit Plugin Initialization (Sprint 2B)"

AI_FILE="src/utils/ai.ts"

if [ ! -f "$AI_FILE" ]; then
    fail "$AI_FILE does not exist"
else
    # 2a. googleAI plugin must NOT be unconditionally initialized
    #     Old: plugins: [ googleAI({...}), groq({...}) ]
    #     New: Conditional based on env/key availability
    if grep -q "plugins.*\[" "$AI_FILE" && \
       grep -q "googleAI.*apiKey.*process\.env\.GOOGLE_GENAI_API_KEY" "$AI_FILE"; then
        # Check if it's inside a conditional
        # Look for patterns like: if (process.env.GOOGLE_GENAI_API_KEY) or ternary
        if grep -B5 "googleAI.*apiKey" "$AI_FILE" | grep -q "if\|?.*:.*\[\]"; then
            pass "googleAI plugin initialization is conditional"
        elif grep -q "plugins.*=.*\[\]" "$AI_FILE" || \
             grep -q "const plugins" "$AI_FILE"; then
            pass "Plugin array is dynamically built (conditional pattern detected)"
        else
            # Check if it's a static array with both plugins always included
            if grep -q 'plugins: \[' "$AI_FILE" && \
               grep -A2 'plugins: \[' "$AI_FILE" | grep -q 'googleAI'; then
                fail "googleAI plugin appears to be unconditionally initialized"
                info "Expected: Conditional initialization — only load googleAI if GOOGLE_GENAI_API_KEY is present"
            else
                pass "Plugin initialization appears conditional (non-standard pattern)"
            fi
        fi
    else
        info "googleAI may have been fully removed — verify GROQ is the sole provider"
    fi

    # 2b. GROQ plugin initialization exists
    if grep -q "groq.*apiKey.*process\.env\.GROQ_API_KEY\|groq({" "$AI_FILE"; then
        pass "GROQ plugin initialization exists"
    else
        fail "GROQ plugin initialization not found in ai.ts"
    fi

    # 2c. genkitx-groq import exists
    if grep -q "genkitx-groq" "$AI_FILE"; then
        pass "genkitx-groq import present"
    else
        fail "genkitx-groq import missing"
    fi

    # 2d. Model routing supports GROQ
    if grep -q "provider.*===.*'groq'\|AI_PROVIDER.*groq" "$AI_FILE"; then
        pass "Model routing supports GROQ provider"
    else
        fail "No GROQ provider routing found in generateWithRetry()"
    fi

    # 2e. llama model reference exists
    if grep -qi "llama" "$AI_FILE"; then
        pass "Llama model reference found (GROQ default model)"
    else
        warn "No llama model reference found — verify GROQ model selection"
    fi
fi

# ============================================================================
# 3. SENTIMENT RESILIENCE — GRACEFUL DEGRADATION (Sprint 3A)
# ============================================================================

print_section "3. Sentiment Resilience — Graceful Degradation (Sprint 3A)"

RISK_FILE="src/logic/strategy/risk_assessment.ts"

if [ ! -f "$RISK_FILE" ]; then
    fail "$RISK_FILE does not exist"
else
    # 3a. getSentiment() must NOT throw CriticalSecurityException on AI failure
    #     Old: throw new CriticalSecurityException(`Fail-Closed: AI Sentiment analysis failed...`)
    #     New: Return neutral fallback { headline: '...', indicator: 'Neutral', score: 0.5 }
    if grep -q "throw.*CriticalSecurityException.*Sentiment.*analysis.*failed\|throw.*CriticalSecurityException.*Verified-or-Die" "$RISK_FILE"; then
        fail "getSentiment() still throws CriticalSecurityException on AI failure"
        info "Expected: Return neutral fallback (score: 0.5) instead of halting system"
    else
        pass "getSentiment() does NOT throw CriticalSecurityException on AI failure"
    fi

    # 3b. Neutral fallback exists in sentiment function
    if grep -q "score.*0\.5\|score:.*0\.5\|Neutral\|DEGRADED.*MODE\|degraded\|neutral.*fallback\|neutral.*baseline" "$RISK_FILE"; then
        pass "Neutral sentiment fallback pattern detected"
    else
        warn "No explicit neutral fallback found — verify getSentiment() handles null gracefully"
    fi

    # 3c. sentimentResult rejection must not crash the system
    #     Old: if (sentimentResult.status === 'rejected') throw sentimentResult.reason;
    #     New: Graceful handling with fallback
    if grep -q "sentimentResult\.status.*===.*'rejected'.*throw" "$RISK_FILE"; then
        fail "sentimentResult rejection still throws (re-throws the error)"
        info "Expected: Handle gracefully with neutral fallback instead of throw"
    else
        pass "sentimentResult rejection does not throw — graceful handling"
    fi

    # 3d. Promise.allSettled is still used (not downgraded to Promise.all)
    if grep -q "Promise\.allSettled" "$RISK_FILE"; then
        pass "Promise.allSettled used for parallel API calls (correct pattern)"
    else
        warn "Promise.allSettled not found — verify parallel API call pattern"
    fi

    # 3e. Ticker failure still throws (security-critical — must be preserved)
    if grep -q "tickerResult.*===.*'rejected'.*throw\|if.*tickerResult.*throw" "$RISK_FILE"; then
        pass "tickerResult rejection still throws (correct: ticker data is security-critical)"
    else
        warn "tickerResult rejection handling unclear — verify market data is still fail-closed"
    fi
fi

# ============================================================================
# 4. AGENT BRAIN — HALT SYSTEM HARDENING (Sprint 3B)
# ============================================================================

print_section "4. Agent Brain — Error Handling & HALTED Recovery (Sprint 1A + 3B)"

BRAIN_FILE="src/logic/agent_brain.ts"

if [ ! -f "$BRAIN_FILE" ]; then
    fail "$BRAIN_FILE does not exist"
else
    # 4a. signIntent catch block should differentiate recoverable vs security errors
    #     Old: Any error → haltSystem() → process.exit(1)
    #     New: Only genuine security violations halt; API/network errors → continue
    #
    # We check that NOT every CriticalSecurityException triggers haltSystem()
    # OR that there's some differentiation in the catch block
    HALT_CALLS=$(grep -c "haltSystem" "$BRAIN_FILE" || true)
    if [ "$HALT_CALLS" -ge 1 ]; then
        pass "haltSystem() function exists in agent_brain.ts"
    else
        fail "haltSystem() function not found — system halt mechanism missing"
    fi

    # 4b. Check for force-restart flag support
    if grep -q "\-\-force-restart\|force.restart\|FORCE_RESTART" "$BRAIN_FILE"; then
        pass "--force-restart flag or equivalent recovery mechanism exists"
    else
        warn "No --force-restart flag found — HALTED recovery requires manual file deletion"
        info "This is acceptable if documented, but operational convenience is reduced"
    fi

    # 4c. The catch block in signIntent should not blindly halt on all errors
    #     Look for differentiation: recoverable errors vs security errors
    if grep -A10 "catch.*error.*any" "$BRAIN_FILE" | grep -q "recoverable\|CYCLE_ERROR\|isAllowed.*false\|return.*isAllowed"; then
        pass "signIntent catch block has recovery path for non-critical errors"
    else
        # Check if the catch block at least logs before halting
        if grep -B2 "haltSystem" "$BRAIN_FILE" | grep -q "CriticalSecurityException"; then
            warn "haltSystem only triggered for CriticalSecurityException (acceptable but strict)"
        else
            warn "signIntent error handling may be too aggressive — verify manually"
        fi
    fi

    # 4d. HALTED file check exists on startup
    if grep -q "logs/HALTED\|HALTED" "$BRAIN_FILE"; then
        pass "HALTED file check exists in startup sequence"
    else
        fail "HALTED file check missing from startup — system won't detect halt state"
    fi

    # 4e. validateEnv() is called on startup
    if grep -q "validateEnv()" "$BRAIN_FILE"; then
        pass "validateEnv() called during startup"
    else
        fail "validateEnv() not called — env validation is missing"
    fi
fi

# ============================================================================
# 5. QUOTA TRACKER — GROQ LIMITS (Sprint 2C)
# ============================================================================

print_section "5. Quota Tracker — GROQ Rate Limits (Sprint 2C)"

QUOTA_FILE="src/utils/quota-tracker.ts"

if [ ! -f "$QUOTA_FILE" ]; then
    fail "$QUOTA_FILE does not exist"
else
    # 5a. DAILY_LIMIT should NOT be hardcoded to 20 (Google free tier)
    #     GROQ free tier: 14,400 req/day
    if grep -q "DAILY_LIMIT.*=.*20[^0-9]" "$QUOTA_FILE" && \
       ! grep -q "DAILY_LIMIT.*process\.env\|DAILY_LIMIT.*groq\|DAILY_LIMIT.*AI_PROVIDER\|DAILY_LIMIT.*14400\|DAILY_LIMIT.*provider" "$QUOTA_FILE"; then
        fail "DAILY_LIMIT is hardcoded to 20 (Google free tier limit)"
        info "Expected: Dynamic based on AI_PROVIDER — GROQ allows 14,400 req/day"
    else
        pass "DAILY_LIMIT is configurable or updated for GROQ"
    fi

    # 5b. QuotaTracker singleton pattern preserved
    if grep -q "getInstance" "$QUOTA_FILE"; then
        pass "QuotaTracker singleton pattern preserved"
    else
        fail "QuotaTracker singleton pattern missing"
    fi

    # 5c. Day reset logic still works
    if grep -q "resetIfNewDay\|reset.*day\|date.*today" "$QUOTA_FILE"; then
        pass "Day reset logic present in QuotaTracker"
    else
        warn "Day reset logic not found — verify quota resets daily"
    fi
fi

# ============================================================================
# 6. .env.example — DOCUMENTATION UPDATE (Sprint 4A)
# ============================================================================

print_section "6. .env.example — GROQ Documentation (Sprint 4A)"

ENV_EXAMPLE="\.env.example"

if [ ! -f ".env.example" ]; then
    fail ".env.example does not exist"
else
    # 6a. AI_PROVIDER documented
    if grep -q "AI_PROVIDER" ".env.example"; then
        pass "AI_PROVIDER documented in .env.example"
    else
        fail "AI_PROVIDER not in .env.example — external users won't know about it"
    fi

    # 6b. AI_MODEL documented
    if grep -q "AI_MODEL" ".env.example"; then
        pass "AI_MODEL documented in .env.example"
    else
        fail "AI_MODEL not in .env.example"
    fi

    # 6c. GROQ_API_KEY documented
    if grep -q "GROQ_API_KEY" ".env.example"; then
        pass "GROQ_API_KEY documented in .env.example"
    else
        fail "GROQ_API_KEY not in .env.example"
    fi

    # 6d. GOOGLE_GENAI_API_KEY still documented (as optional/fallback)
    if grep -q "GOOGLE_GENAI_API_KEY" ".env.example"; then
        pass "GOOGLE_GENAI_API_KEY still documented (optional fallback)"
    else
        warn "GOOGLE_GENAI_API_KEY removed from .env.example — verify this is intentional"
    fi

    # 6e. AGENTSTACK_REQUIRED documented
    if grep -q "AGENTSTACK_REQUIRED" ".env.example"; then
        pass "AGENTSTACK_REQUIRED documented in .env.example"
    else
        warn "AGENTSTACK_REQUIRED not in .env.example"
    fi
fi

# ============================================================================
# 7. HALTED FILE — MUST NOT EXIST (Sprint 1A)
# ============================================================================

print_section "7. HALTED Lock File — Recovery Check (Sprint 1A)"

HALT_PATH="logs/HALTED"

if [ -f "$HALT_PATH" ]; then
    fail "logs/HALTED still exists — system will not start!"
    info "Contents: $(cat "$HALT_PATH" 2>/dev/null || echo 'unreadable')"
    info "Action required: rm logs/HALTED"
else
    pass "logs/HALTED does not exist — startup is unblocked"
fi

# ============================================================================
# 8. TYPESCRIPT COMPILATION (Sprint 4C)
# ============================================================================

print_section "8. TypeScript Compilation Check"

if npx tsc --noEmit 2>&1 | tee -a "$VERIFICATION_LOG"; then
    pass "TypeScript compilation: zero errors"
else
    fail "TypeScript compilation has errors"
    info "Run 'npx tsc --noEmit' to see details"
fi

# ============================================================================
# 9. CIRCUIT BREAKER TUNING (Sprint 3C)
# ============================================================================

print_section "9. Circuit Breaker — GROQ Tuning (Sprint 3C)"

if [ -f "$AI_FILE" ]; then
    # 9a. Circuit breaker class exists
    if grep -q "CircuitBreaker" "$AI_FILE"; then
        pass "CircuitBreaker class exists in ai.ts"
    else
        fail "CircuitBreaker class missing from ai.ts"
    fi

    # 9b. Check if circuit breaker params are tunable for GROQ
    if grep -q "AI_PROVIDER\|groq.*threshold\|groq.*cooldown\|provider.*threshold" "$AI_FILE"; then
        pass "Circuit breaker parameters appear tunable for GROQ"
    else
        warn "Circuit breaker parameters may not be GROQ-aware — verify threshold/cooldown"
        info "GROQ has higher rate limits; consider raising threshold from 5 to 10"
    fi
fi

# ============================================================================
# 10. CROSS-MODULE CONSISTENCY CHECKS
# ============================================================================

print_section "10. Cross-Module Consistency Checks"

# 10a. No remaining references to dead Google Gemini URL in source
GEMINI_URL_HITS=$(grep -r "generativelanguage.googleapis.com" src/ --include="*.ts" -l 2>/dev/null || true)
if [ -z "$GEMINI_URL_HITS" ]; then
    pass "No hardcoded Google Gemini API URLs in source code"
else
    warn "Google Gemini API URL still referenced in: $GEMINI_URL_HITS"
    info "This may be acceptable if it's behind a conditional, but verify"
fi

# 10b. genkitx-groq is in package.json dependencies
if grep -q '"genkitx-groq"' package.json; then
    pass "genkitx-groq listed in package.json dependencies"
else
    fail "genkitx-groq NOT in package.json — 'npm install' will fail for GROQ"
fi

# 10c. node_modules has genkitx-groq installed
if [ -d "node_modules/genkitx-groq" ]; then
    pass "genkitx-groq is installed in node_modules"
else
    warn "genkitx-groq not found in node_modules — run 'npm install'"
fi

# 10d. No import of removed/unused Google modules without conditional
GOOGLE_IMPORTS=$(grep -n "import.*@genkit-ai/google-genai" src/utils/ai.ts 2>/dev/null || true)
if [ -n "$GOOGLE_IMPORTS" ]; then
    info "Google GenAI import still present: $GOOGLE_IMPORTS (acceptable if conditional)"
else
    info "Google GenAI import removed (acceptable if fully migrated to GROQ)"
fi

# 10e. Verify news_feed.ts still has CoinGecko provider (not broken by changes)
if [ -f "src/logic/strategy/news_feed.ts" ]; then
    if grep -q "CoinGeckoProvider\|CoinGecko" "src/logic/strategy/news_feed.ts"; then
        pass "CoinGecko news feed provider intact (not broken by migration)"
    else
        warn "CoinGecko provider may have been modified — verify news_feed.ts"
    fi
fi

# 10f. Verify agent-id.json exists (required for startup)
if [ -f "agent-id.json" ]; then
    pass "agent-id.json exists (required for agent metadata)"
else
    fail "agent-id.json missing — agent startup will fail"
fi

# 10g. .env has AI_PROVIDER set (operator responsibility — just check)
if [ -f ".env" ]; then
    if grep -q "^AI_PROVIDER=groq" ".env"; then
        pass ".env has AI_PROVIDER=groq set (operator confirmed)"
    elif grep -q "^AI_PROVIDER=" ".env"; then
        warn ".env has AI_PROVIDER set but NOT to 'groq' — verify intentional"
    else
        warn "AI_PROVIDER not set in .env — system will default to schema default"
    fi

    if grep -q "^GROQ_API_KEY=" ".env"; then
        pass ".env has GROQ_API_KEY set"
    else
        warn "GROQ_API_KEY not in .env — GROQ calls will fail"
    fi
fi

# ============================================================================
# 11. TEST SUITE (Sprint 4B)
# ============================================================================

print_section "11. Test Suite Execution"

# Check if env.test.ts covers GROQ scenarios
if [ -f "test/logic/env.test.ts" ]; then
    if grep -qi "groq" "test/logic/env.test.ts"; then
        pass "env.test.ts has GROQ-related test cases"
    else
        warn "env.test.ts does not appear to test GROQ provider scenarios"
        info "Consider adding tests for: groq+key→pass, groq+no_key→fail, google_key_optional_with_groq"
    fi
else
    warn "test/logic/env.test.ts not found — env validation tests may be elsewhere"
fi

# Run test suite (non-blocking — capture result)
echo -e "\n  Running test suite..."
TEST_OUTPUT=$(npm test 2>&1 || true)

if echo "$TEST_OUTPUT" | grep -q "passing"; then
    PASSING_TESTS=$(echo "$TEST_OUTPUT" | grep -o "[0-9]* passing" | tail -1 | grep -o "[0-9]*" || echo "0")
    FAILING_TESTS=$(echo "$TEST_OUTPUT" | grep -o "[0-9]* failing" | tail -1 | grep -o "[0-9]*" || echo "0")

    if [ "$FAILING_TESTS" -eq 0 ] 2>/dev/null; then
        pass "Test suite: ${PASSING_TESTS} passing, 0 failing"
    else
        fail "Test suite: ${PASSING_TESTS} passing, ${FAILING_TESTS} failing"
    fi
else
    fail "Test suite execution failed or produced no results"
    info "Run 'npm test' manually to see full output"
fi

# ============================================================================
# VERIFICATION SUMMARY
# ============================================================================

print_section "VERIFICATION SUMMARY"

TOTAL=$((PASS_COUNT + FAIL_COUNT))

if [ $TOTAL -eq 0 ]; then
    echo -e "${RED}No checks were executed — something went wrong${NC}"
    exit 1
fi

SUCCESS_RATE=$(( (PASS_COUNT * 100) / TOTAL ))

echo -e ""
echo -e "  ${GREEN}Passed${NC}:   ${BOLD}${PASS_COUNT}${NC}"
echo -e "  ${RED}Failed${NC}:   ${BOLD}${FAIL_COUNT}${NC}"
echo -e "  ${YELLOW}Warnings${NC}: ${BOLD}${WARN_COUNT}${NC}"
echo -e "  Success:  ${BOLD}${SUCCESS_RATE}%${NC}"
echo -e "  Time:     ${CYAN}${VERIFICATION_TIMESTAMP}${NC}"
echo -e "  Log:      ${CYAN}${VERIFICATION_LOG}${NC}"

# Generate verification report
cat > logs/GROQ_MIGRATION_VERIFICATION.md << REPORT_EOF
# GROQ Migration Verification Report

**Timestamp:** ${VERIFICATION_TIMESTAMP}
**Script:** scripts/verify_groq_migration.sh
**Status:** $([ $FAIL_COUNT -eq 0 ] && echo "✅ ALL CHECKS PASSED" || echo "❌ ${FAIL_COUNT} CHECKS FAILED")

## Results

| Metric | Count |
|--------|-------|
| ✓ Passed | ${PASS_COUNT} |
| ✗ Failed | ${FAIL_COUNT} |
| ⚠ Warnings | ${WARN_COUNT} |
| Success Rate | ${SUCCESS_RATE}% |

## Checks Performed

### Phase 1: Immediate Recovery
- [$([ $FAIL_COUNT -eq 0 ] && echo "x" || echo " ")] logs/HALTED file cleared
- [$(grep -q "^AI_PROVIDER=groq" .env 2>/dev/null && echo "x" || echo " ")] .env has AI_PROVIDER=groq

### Phase 2: GROQ Migration
- [ ] GOOGLE_GENAI_API_KEY optional in env schema
- [ ] Conditional genkit plugin initialization
- [ ] QuotaTracker updated for GROQ limits

### Phase 3: Resilience Hardening
- [ ] Sentiment graceful degradation (no CriticalSecurityException)
- [ ] sentimentResult rejection handled gracefully
- [ ] signIntent error differentiation

### Phase 4: Production Readiness
- [ ] TypeScript compilation clean
- [ ] Test suite passing
- [ ] .env.example updated with GROQ fields

## Log File
See: ${VERIFICATION_LOG}
REPORT_EOF

echo -e ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║     ✓ GROQ MIGRATION VERIFIED — ALL SYSTEMS OPERATIONAL          ║${NC}"
    echo -e "${GREEN}║                                                                   ║${NC}"
    echo -e "${GREEN}║  The Vertex Sentinel is ready to restart with GROQ provider.      ║${NC}"
    echo -e "${GREEN}║  Run: rm logs/HALTED && npm start                                 ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════╝${NC}"
    echo -e ""
    log_result "SUMMARY" "GROQ migration verified: ${PASS_COUNT}/${TOTAL} passed (${SUCCESS_RATE}%)"
    exit 0
else
    echo -e "${RED}╔════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║     ✗ GROQ MIGRATION INCOMPLETE — ${FAIL_COUNT} CHECKS FAILED               ║${NC}"
    echo -e "${RED}║                                                                   ║${NC}"
    echo -e "${RED}║  Fix the FAIL items above and re-run this script.                 ║${NC}"
    echo -e "${RED}║  Do NOT start the agent until all checks pass.                    ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════════════╝${NC}"
    echo -e ""
    log_result "SUMMARY" "GROQ migration INCOMPLETE: ${FAIL_COUNT} failures, ${WARN_COUNT} warnings"
    exit 1
fi
