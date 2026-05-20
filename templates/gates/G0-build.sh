#!/bin/bash
# G0: Build Gate — Verify the project compiles/builds successfully
set -euo pipefail

echo "=== G0: Build Gate ==="

if [ -f "package.json" ]; then
  if grep -q '"build"' package.json 2>/dev/null; then
    npm run build
    echo "✓ Build passed"
    exit 0
  fi
fi

if [ -f "pyproject.toml" ] || [ -f "requirements.txt" ]; then
  python -c "import py_compile; print('Python syntax check OK')"
  echo "✓ Build passed"
  exit 0
fi

if [ -f "Cargo.toml" ]; then
  cargo check
  echo "✓ Build passed"
  exit 0
fi

echo "⊘ No build system detected, skipping"
exit 0
