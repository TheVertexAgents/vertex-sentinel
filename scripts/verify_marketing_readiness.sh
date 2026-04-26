#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         MARKETING & MAINNET PITCH VERIFICATION                     ║${NC}"
echo -e "${BLUE}║                  Vertex Sentinel                                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}\n"

TESTS_PASSED=0
TESTS_FAILED=0
VERIFICATION_LOG="logs/marketing-verification-$(date +%s).log"
mkdir -p logs

log_result() {
    echo "[$(date +'%H:%M:%S')] $1 | $2" | tee -a "$VERIFICATION_LOG"
}

print_section() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}${1}${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_section "1. Mainnet Technical Readiness Verification"
if NODE_OPTIONS='--import tsx --no-warnings' npx ts-node scripts/verify_mainnet_readiness.ts | tee -a "$VERIFICATION_LOG"; then
    echo -e "${GREEN}✓ Mainnet Technical Readiness: PASS${NC}"
    log_result "PASS" "verify_mainnet_readiness.ts passed 100%"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ Mainnet Technical Readiness: FAIL${NC}"
    log_result "FAIL" "Mainnet readiness check failed"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

print_section "2. Marketing Assets Check"
REQUIRED_DOCS=(
    "MISSION_VERIFICATION_SUMMARY.md"
    "VISIONNAIRE_PITCH.md"
)

ALL_DOCS_EXIST=1
for doc in "${REQUIRED_DOCS[@]}"; do
    if [ -f "$doc" ]; then
        echo -e "${GREEN}✓ $doc exists${NC}"
        log_result "PASS" "$doc found"
    else
        echo -e "${RED}✗ $doc NOT FOUND${NC}"
        log_result "FAIL" "Missing $doc"
        ALL_DOCS_EXIST=0
    fi
done

if [ $ALL_DOCS_EXIST -eq 1 ]; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

print_section "3. Deprecated Token Marketing Archival"
DEPRECATED_FILES=(
    "PERK_DECISION.md"
    "SURGE_PAGE_DESCRIPTIONS.md"
)

ARCHIVED_CORRECTLY=1
for doc in "${DEPRECATED_FILES[@]}"; do
    if [ -f "$doc" ]; then
        echo -e "${RED}✗ $doc still exists in root. MUST BE ARCHIVED.${NC}"
        log_result "FAIL" "$doc not archived"
        ARCHIVED_CORRECTLY=0
    else
        echo -e "${GREEN}✓ $doc is correctly archived/removed from root${NC}"
        log_result "PASS" "$doc is archived"
    fi
done

if [ $ARCHIVED_CORRECTLY -eq 1 ]; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

print_section "VERIFICATION SUMMARY"
TOTAL_CHECKS=$((TESTS_PASSED + TESTS_FAILED))

echo -e "Passed:         ${GREEN}${TESTS_PASSED}${NC}"
echo -e "Failed:         ${RED}${TESTS_FAILED}${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✅ MARKETING READINESS VERIFIED${NC}"
    
    echo -e "\n${BLUE}Committing verification results...${NC}"
    git add MISSION_VERIFICATION_SUMMARY.md VISIONNAIRE_PITCH.md scripts/verify_marketing_readiness.sh || true
    
    # Run the pre-commit checks before we actually commit. (we skip full hooks here as we just want to create the commit in this script)
    # The actual hooks run on the 'git commit' step.
    
    if git commit -m "docs: Marketing and Visionnaire Pitch prep verified"; then
        git push origin main || echo -e "${YELLOW}Push failed or already up to date${NC}"
    else
        echo -e "${YELLOW}Nothing to commit${NC}"
    fi
    exit 0
else
    echo -e "\n${RED}✗ VERIFICATION FAILED. Fix issues above.${NC}"
    exit 1
fi
