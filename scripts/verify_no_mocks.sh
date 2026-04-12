#!/bin/bash

echo '🔍 Verifying no mocks in production paths...'

FAIL=0

if grep -q 'mock_kraken.sh' package.json; then
    echo '❌ FAIL: package.json still references mock_kraken.sh'
    FAIL=1
fi

if grep -q 'mock_kraken.sh' src/logic/strategy/risk_assessment.ts; then
    echo '❌ FAIL: risk_assessment.ts still defaults to mock'
    FAIL=1
fi

if grep -q 'const mockPrice = 67000' src/logic/agent_brain.ts; then
    echo '❌ FAIL: agent_brain.ts still has hardcoded mockPrice'
    FAIL=1
fi

if grep -q 'LIVE-' scripts/live_kraken_cli.js; then
    echo '❌ FAIL: live_kraken_cli.js still has fake order ID generation'
    FAIL=1
fi

if [ -f 'contracts/MockRegistry.sol' ]; then
    echo '❌ FAIL: MockRegistry.sol still in production contracts directory'
    FAIL=1
fi

if [ $FAIL -eq 0 ]; then
    echo '✅ All production mock checks passed!'
else
    echo '❌ Some checks failed.'
fi
