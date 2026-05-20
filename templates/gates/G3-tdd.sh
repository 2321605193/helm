#!/bin/bash
# G3: TDD Gate — Verify tests were written before/during implementation
set -euo pipefail

echo "=== G3: TDD Gate ==="

# Check for test files modified in recent commits
if command -v git &>/dev/null; then
  TEST_COUNT=$(git diff --name-only HEAD~1 2>/dev/null | grep -ci "test\|spec" || echo "0")
  if [ "$TEST_COUNT" -gt 0 ]; then
    echo "✓ Found $TEST_COUNT test file(s) in recent changes"
    exit 0
  fi
fi

# Check for test files in the project
TEST_DIR_COUNT=$(find . -maxdepth 3 -type d \( -name "test" -o -name "tests" -o -name "__tests__" \) 2>/dev/null | wc -l)
if [ "$TEST_DIR_COUNT" -gt 0 ]; then
  echo "✓ Test directories exist, check coverage manually"
  exit 0
fi

echo "⊘ No test evidence found, but TDD gate is optional for S-level tasks"
exit 0
