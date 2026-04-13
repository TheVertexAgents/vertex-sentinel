#!/bin/bash
echo "# Discovery Scan Results"
echo ""

SEARCH_TERMS=(
    "mock"
    "placeholder"
    "todo"
    "hardcoded"
    "0x0000000000000000000000000000000000000000"
    "67000"
    "100"
    "DEMO_MODE"
    "test-only"
    "fake"
    "fallback"
)

for term in "${SEARCH_TERMS[@]}"; do
    echo "## Results for '$term'"
    grep -rnEiC 2 "$term" src scripts contracts | grep -v "node_modules" | grep -v ".git"
    echo ""
done
