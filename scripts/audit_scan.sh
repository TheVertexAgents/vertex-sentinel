#!/bin/bash

# ERC-8004 Cleanliness Audit - Refined Discovery Script
# Scans src/, scripts/, and contracts/ for mock patterns and hardcoded data.
# Excludes test directories to focus on production partitioning.

OUTPUT_FILE="logs/audit_scan_raw.log"
mkdir -p logs
echo "ERC-8004 Cleanliness Audit - Raw Scan Logs" > $OUTPUT_FILE
echo "Generated on: $(date)" >> $OUTPUT_FILE
echo "----------------------------------------" >> $OUTPUT_FILE

TARGETS="src scripts contracts"
EXCLUDE_DIRS="--exclude-dir=test --exclude-dir=contracts/test"

KEYWORDS=("mock" "placeholder" "todo" "hardcoded" "fake" "fallback")
SPECIAL_PATTERNS=("0x0000000000000000000000000000000000000000" "100" "67000" "DEMO_MODE" "NETWORK !== 'sepolia'")

echo "Searching for keywords: ${KEYWORDS[*]}..."
for kw in "${KEYWORDS[@]}"; do
    echo -e "\n--- KEYWORD: $kw ---" >> $OUTPUT_FILE
    grep -rnEi $EXCLUDE_DIRS "$kw" $TARGETS >> $OUTPUT_FILE 2>/dev/null
done

echo "Searching for special patterns..."
for pattern in "${SPECIAL_PATTERNS[@]}"; do
    echo -e "\n--- PATTERN: $pattern ---" >> $OUTPUT_FILE
    grep -rnE $EXCLUDE_DIRS "$pattern" $TARGETS >> $OUTPUT_FILE 2>/dev/null
done

# Targeted scan for Risk Parameters in risk_assessment.ts
echo -e "\n--- TARGETED: Risk Parameters in risk_assessment.ts ---" >> $OUTPUT_FILE
grep -rnE "[-]?[0-9]+\.[0-9]+" src/logic/strategy/risk_assessment.ts >> $OUTPUT_FILE 2>/dev/null

echo "Scan complete. Results saved to $OUTPUT_FILE"
