#!/bin/bash
# G2: Plan Gate — Verify plan exists and has wave decomposition
set -euo pipefail

echo "=== G2: Plan Gate ==="

PLAN_FILE="$1"
if [ -z "$PLAN_FILE" ]; then
  PLAN_FILE=$(find .harness/tasks -name "plan.md" -print -quit 2>/dev/null || true)
fi

if [ -z "$PLAN_FILE" ] || [ ! -f "$PLAN_FILE" ]; then
  echo "✗ plan.md not found"
  exit 1
fi

if ! grep -qi "wave" "$PLAN_FILE" 2>/dev/null; then
  echo "✗ plan.md has no wave decomposition"
  exit 1
fi

if ! grep -q "\[ \]" "$PLAN_FILE" 2>/dev/null; then
  echo "✗ plan.md has no actionable tasks"
  exit 1
fi

echo "✓ Plan artifacts verified"
exit 0
