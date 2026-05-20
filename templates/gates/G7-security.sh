#!/bin/bash
# G7: Security Gate — Scan for common security issues
set -euo pipefail

echo "=== G7: Security Gate ==="

ISSUES=0

# Check for hardcoded secrets/keys
if grep -rn "API_KEY\s*=\s*['\"][^'\"]\+['\"]" --include="*.js" --include="*.ts" --include="*.py" . 2>/dev/null | grep -v node_modules | grep -v ".env"; then
  echo "⚠ Possible hardcoded API key found"
  ISSUES=$((ISSUES + 1))
fi

# Check for eval/exec
if grep -rn "eval(" --include="*.js" --include="*.ts" . 2>/dev/null | grep -v node_modules | grep -v test; then
  echo "⚠ eval() usage detected"
  ISSUES=$((ISSUES + 1))
fi

# Check for empty catch blocks
if grep -rn "catch.*{.*}" --include="*.js" --include="*.ts" --include="*.py" . 2>/dev/null | grep -v node_modules | grep -v test; then
  echo "⚠ Possible empty/silent catch blocks"
  ISSUES=$((ISSUES + 1))
fi

# Check for .env in gitignore
if [ -f ".gitignore" ] && ! grep -q "\.env" .gitignore 2>/dev/null; then
  echo "⚠ .env not in .gitignore"
  ISSUES=$((ISSUES + 1))
fi

if [ "$ISSUES" -gt 0 ]; then
  echo "✗ Found $ISSUES security issue(s)"
  exit 1
fi

echo "✓ No obvious security issues found"
exit 0
