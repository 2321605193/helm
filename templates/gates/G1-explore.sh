#!/bin/bash
# G1: Explore Gate — Verify exploration artifacts exist and have content
set -euo pipefail

echo "=== G1: Explore Gate ==="

EXPLORE_FILE="$1"
if [ -z "$EXPLORE_FILE" ]; then
  # Search in .harness/tasks/
  EXPLORE_FILE=$(find .harness/tasks -name "explore.md" -print -quit 2>/dev/null || true)
fi

if [ -z "$EXPLORE_FILE" ] || [ ! -f "$EXPLORE_FILE" ]; then
  echo "✗ explore.md not found"
  exit 1
fi

if [ ! -s "$EXPLORE_FILE" ]; then
  echo "✗ explore.md is empty"
  exit 1
fi

if ! grep -q "## " "$EXPLORE_FILE" 2>/dev/null; then
  echo "✗ explore.md has no sections"
  exit 1
fi

echo "✓ Explore artifacts verified"
exit 0
