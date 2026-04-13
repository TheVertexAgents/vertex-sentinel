#!/bin/bash

# ERC-8004 Cleanliness Audit - Discovery Script
# Scans src/, scripts/, and contracts/ for mock patterns and hardcoded data.

OUTPUT_FILE="logs/audit_scan_raw.log"
mkdir -p logs
echo "ERC-8004 Cleanliness Audit - Raw Scan Logs" > $OUTPUT_FILE
echo "Generated on: $(date)" >> $OUTPUT_FILE
echo "----------------------------------------" >> $OUTPUT_FILE

TARGETS="src scripts contracts"

KEYWORDS=("mock" "placeholder" "todo" "hardcoded" "fake" "fallback")
SPECIAL_PATTERNS=("0x0000000000000000000000000000000000000000" "100" "67000" "DEMO_MODE" "NETWORK !== 'sepolia'")

echo "Searching for keywords: ${KEYWORDS[*]}..."
for kw in "${KEYWORDS[@]}"; do
    echo -e "\n--- KEYWORD: $kw ---" >> $OUTPUT_FILE
    grep -rni "$kw" $TARGETS >> $OUTPUT_FILE 2>/dev/null
done

echo "Searching for special patterns..."
for pattern in "${SPECIAL_PATTERNS[@]}"; do
    echo -e "\n--- PATTERN: $pattern ---" >> $OUTPUT_FILE
    grep -rn "$pattern" $TARGETS >> $OUTPUT_FILE 2>/dev/null
done

echo "Scan complete. Results saved to $OUTPUT_FILE"
