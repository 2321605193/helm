#!/bin/bash
# G4: Lint Gate — Run linter
set -euo pipefail

echo "=== G4: Lint Gate ==="

# Prefer the concrete command resolved by `helm init` (harness/project.env).
[ -f "harness/project.env" ] && source "harness/project.env"
if [ -n "${HELM_LINT_CMD:-}" ]; then
  echo "Running: $HELM_LINT_CMD"
  eval "$HELM_LINT_CMD" || { echo "✗ Lint found issues"; exit 1; }
  echo "✓ Lint passed"
  exit 0
fi

if [ -f "package.json" ] && command -v npx &>/dev/null; then
  if grep -q '"lint"' package.json 2>/dev/null; then
    npm run lint 2>&1 || { echo "✗ Lint failed"; exit 1; }
    echo "✓ Lint passed"
    exit 0
  elif [ -f "eslint.config.js" ] || [ -f ".eslintrc" ] || [ -f ".eslintrc.js" ]; then
    npx eslint . 2>&1 || { echo "✗ ESLint found issues"; exit 1; }
    echo "✓ Lint passed"
    exit 0
  fi
fi

if [ -f "pyproject.toml" ] && command -v ruff &>/dev/null; then
  ruff check . 2>&1 || { echo "✗ Ruff found issues"; exit 1; }
  echo "✓ Lint passed"
  exit 0
fi

echo "⊘ No linter detected, skipping"
exit 0
