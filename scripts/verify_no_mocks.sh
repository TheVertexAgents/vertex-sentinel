#!/bin/bash

echo '🔍 Verifying no mocks or bypasses in production paths...'

FAIL=0

# 1. Check for mock scripts
if grep -q 'mock_kraken.sh' package.json; then
    echo '❌ FAIL: package.json still references mock_kraken.sh'
    FAIL=1
fi

if grep -q 'mock_kraken.sh' src/logic/strategy/risk_assessment.ts; then
    echo '❌ FAIL: risk_assessment.ts still defaults to mock'
    FAIL=1
fi

# 2. Check for hardcoded prices in brain
if grep -q 'realPrice = 67000' src/logic/agent_brain.ts; then
    echo '❌ FAIL: agent_brain.ts still has hardcoded realPrice fallback'
    FAIL=1
fi

# 3. Check for fake order IDs
if grep -q 'LIVE-' scripts/live_kraken_cli.js; then
    echo '❌ FAIL: live_kraken_cli.js still has fake order ID generation'
    FAIL=1
fi

# 4. Check for mock contracts
if [ -f 'contracts/MockRegistry.sol' ]; then
    echo '❌ FAIL: MockRegistry.sol still in production contracts directory'
    FAIL=1
fi

# 5. Check for DEMO_MODE bypasses in production source
if grep -r "process.env.DEMO_MODE === 'true'" src/onchain/ | grep -v "test"; then
    echo '❌ FAIL: DEMO_MODE bypass still exists in src/onchain/'
    FAIL=1
fi

# 6. Check for zero-address bypasses in production source
if grep -r "registryAddress === '0x0000000000000000000000000000000000000000'" src/onchain/ | grep -q "return true"; then
    echo '❌ FAIL: zero-address registration bypass still exists'
    FAIL=1
fi

if grep -r "routerAddress === '0x0000000000000000000000000000000000000000'" src/onchain/ | grep -q "return 0n"; then
    echo '❌ FAIL: zero-address RiskRouter nonce bypass still exists'
    FAIL=1
fi

if grep -r "routerAddress === '0x0000000000000000000000000000000000000000'" src/onchain/ | grep -q "return { success: true }"; then
    echo '❌ FAIL: zero-address RiskRouter authorization bypass still exists'
    FAIL=1
fi

# 7. Check for missing volume scaling fix
if grep -q "formatEther(volume)" src/execution/proxy.ts; then
    echo '❌ FAIL: proxy.ts still uses formatEther instead of usdScalingFactor'
    FAIL=1
fi

if [ $FAIL -eq 0 ]; then
    echo '✅ All production cleanliness checks passed!'
else
    echo '❌ Some checks failed. The agent is not production-ready.'
fi
