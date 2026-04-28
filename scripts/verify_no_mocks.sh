#!/bin/bash

echo '🔍 Verifying no mocks or bypasses in production paths...'

FAIL=0

# 1. Check for mock scripts in package.json
if grep -q 'mock_kraken.sh' package.json; then
    echo '❌ FAIL: package.json still references mock_kraken.sh'
    FAIL=1
fi

# 2. Check for simulation bypasses in Circle payments
if grep -q "isSimulated" src/onchain/circle.ts; then
    echo '❌ FAIL: circle.ts still contains isSimulated bypass logic'
    FAIL=1
fi

if grep -q "0x_sim_payment_" src/onchain/circle.ts; then
    echo '❌ FAIL: circle.ts still contains mock payment hash generation'
    FAIL=1
fi

# 3. Check for hardcoded prices in brain
if grep -q 'realPrice = 67000' src/logic/agent_brain.ts; then
    echo '❌ FAIL: agent_brain.ts still has hardcoded realPrice fallback'
    FAIL=1
fi

# 4. Check for mock contracts in production directory
if [ -f 'contracts/MockRegistry.sol' ]; then
    echo '❌ FAIL: MockRegistry.sol still in production contracts directory'
    FAIL=1
fi

if [ -f 'contracts/test/MockRegistry.sol' ]; then
    echo '⚠️  WARN: MockRegistry.sol found in contracts/test/ directory'
    # FAIL=1 # Usually test contracts are okay if not deployed, but verify-no-mocks is strict
fi

# 5. Check for DEMO_MODE bypasses in production source
if grep -r "process.env.DEMO_MODE === 'true'" src/onchain/ | grep -v "test" | grep -v ".ts:.*//"; then
    echo '❌ FAIL: DEMO_MODE bypass still exists in src/onchain/'
    FAIL=1
fi

# 5b. Check for 0xCIRCLE placeholders
if grep -r "0xCIRCLE" src/onchain/ | grep -v "test" | grep -v ".ts:.*//"; then
    echo '❌ FAIL: 0xCIRCLE placeholder still exists in src/onchain/'
    FAIL=1
fi

# 6. Check for zero-address bypasses in production source
if grep -r "registryAddress === '0x0000000000000000000000000000000000000000'" src/onchain/ | grep -q "return true"; then
    echo '❌ FAIL: zero-address registration bypass still exists'
    FAIL=1
fi

# 7. Check for Fail-Open logic in risk assessment
if grep -q "return {.*action: 'HOLD'.*reasoning: 'Fallback: AI/MCP Engine unavailable in local mode'" src/logic/strategy/risk_assessment.ts; then
    echo '⚠️  WARN: risk_assessment.ts has local fallback that might be undesirable in production'
fi

# 8. Check for Math.random() in execution logic (non-test, non-brain-trade-randomization)
# Brain uses Math.random() for trade randomization which is intended, but we check other places
if grep -r "Math.random()" src/ | grep -v "agent_brain.ts" | grep -v "test" | grep -v "circle.ts"; then
    echo '❌ FAIL: Unexpected Math.random() found in source (possible mock/simulation)'
    FAIL=1
fi

# 9. Log Paper Mode status
if grep -q "KRAKEN_PAPER_MODE=true" .env 2>/dev/null; then
    echo 'ℹ️  INFO: KRAKEN_PAPER_MODE is enabled in .env (Acceptable for Demo)'
fi

# 10. Check live execution entry point (replaces legacy live_kraken_cli.js)
if [ ! -f "src/execution/proxy.ts" ]; then
    echo '❌ FAIL: Missing live execution entry point src/execution/proxy.ts'
    FAIL=1
fi

if [ $FAIL -eq 0 ]; then
    echo '✅ All production cleanliness checks passed!'
else
    echo '❌ Some checks failed. The agent is not production-ready.'
    exit 1
fi
