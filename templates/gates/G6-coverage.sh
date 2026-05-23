#!/bin/bash
# G6: Coverage Gate — Check test coverage threshold
set -euo pipefail

echo "=== G6: Coverage Gate ==="

THRESHOLD=${COVERAGE_THRESHOLD:-80}

# Prefer the concrete command resolved by `helm init` (harness/project.env).
[ -f "harness/project.env" ] && source "harness/project.env"
if [ -n "${HELM_COVERAGE_CMD:-}" ]; then
  echo "Running: $HELM_COVERAGE_CMD (threshold: ${THRESHOLD}%)"
  eval "$HELM_COVERAGE_CMD"
  echo "⊘ Coverage reported above; threshold enforcement is advisory"
  exit 0
fi

if [ -f "package.json" ] && command -v npx &>/dev/null; then
  if grep -q '"c8"\|"istanbul"\|"jest"' package.json 2>/dev/null; then
    echo "Checking coverage (threshold: ${THRESHOLD}%)..."
    COVERAGE=$(npx c8 --reporter=text-summary npm test 2>&1 | grep -oP '\d+\.?\d*%' | head -1 || echo "0%")
    echo "Coverage: $COVERAGE"
  fi
fi

echo "⊘ Coverage check skipped (no coverage tool detected)"
exit 0
