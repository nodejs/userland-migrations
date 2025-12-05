#!/bin/bash

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

INPUT_DIR="tests/input"
EXPECTED_DIR="tests/expected"
TEMP_DIR="tests/temp_workzone"

declare -a passed_files
declare -a failed_files

echo -e "${BLUE}${BOLD}=== Starting Codemod Test Suite ===${NC}"

rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"
cp -r "$INPUT_DIR"/* "$TEMP_DIR"

echo -e "➜ Running codemod on temporary files..."
npx codemod workflow run -w workflow.yaml -t "$TEMP_DIR" > /dev/null 2>&1

echo -e "➜ Verifying results...\n"

for expected_file in "$EXPECTED_DIR"/*; do
    filename=$(basename "$expected_file")
    generated_file="$TEMP_DIR/$filename"

    if [ ! -f "$generated_file" ]; then
        echo -e "${RED}  [MISSING] $filename${NC}"
        failed_files+=("$filename (Missing)")
        continue
    fi

    diff_output=$(diff -u --color=always "$expected_file" "$generated_file")
    exit_code=$?

    if [ $exit_code -eq 0 ]; then
        echo -e "  ${GREEN}✔ $filename${NC}"
        passed_files+=("$filename")
    else
        echo -e "  ${RED}✘ $filename${NC}"
        echo -e "${YELLOW}--- Differences for $filename ---${NC}"
        echo "$diff_output"
        echo -e "${YELLOW}----------------------------------${NC}\n"
        failed_files+=("$filename")
    fi
done

rm -rf "$TEMP_DIR"

echo -e "\n${BLUE}${BOLD}=== FINAL REPORT ===${NC}"

if [ ${#passed_files[@]} -gt 0 ]; then
    echo -e "\n${GREEN}${BOLD}Passed Tests (${#passed_files[@]}) :${NC}"
    for f in "${passed_files[@]}"; do
        echo -e "  ${GREEN}✔ $f${NC}"
    done
fi

if [ ${#failed_files[@]} -gt 0 ]; then
    echo -e "\n${RED}${BOLD}Failed Tests (${#failed_files[@]}) :${NC}"
    for f in "${failed_files[@]}"; do
        echo -e "  ${RED}✘ $f${NC}"
    done
    echo -e "\n${RED}➔ Result: FAILURE${NC}"
    exit 1
else
    echo -e "\n${GREEN}➔ Result: SUCCESS${NC}"
    exit 0
fi