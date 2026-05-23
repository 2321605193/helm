#!/bin/bash
# G5: Test Gate — Run tests
set -euo pipefail

echo "=== G5: Test Gate ==="

# Prefer the concrete command resolved by `helm init` (harness/project.env).
[ -f "harness/project.env" ] && source "harness/project.env"
if [ -n "${HELM_TEST_CMD:-}" ]; then
  echo "Running: $HELM_TEST_CMD"
  eval "$HELM_TEST_CMD" || { echo "✗ Tests failed"; exit 1; }
  echo "✓ Tests passed"
  exit 0
fi

if [ -f "package.json" ]; then
  if grep -q '"test"' package.json 2>/dev/null; then
    npm test 2>&1 || { echo "✗ Tests failed"; exit 1; }
    echo "✓ Tests passed"
    exit 0
  fi
fi

if [ -f "pyproject.toml" ] || [ -f "pytest.ini" ] || [ -f "setup.py" ]; then
  pytest 2>&1 || { echo "✗ Tests failed"; exit 1; }
  echo "✓ Tests passed"
  exit 0
fi

if [ -f "Cargo.toml" ]; then
  cargo test 2>&1 || { echo "✗ Tests failed"; exit 1; }
  echo "✓ Tests passed"
  exit 0
fi

echo "⊘ No test runner detected, skipping"
exit 0
