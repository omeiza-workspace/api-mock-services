#!/usr/bin/env bash
#
# The gate for the mock services.
#
# It runs the same tests `make test` runs, so the laptop and the runner
# agree on what passes.
#
#   bash scripts/ci/gate.sh [fast]
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

MODE="${1:-full}"
[ "$MODE" = "fast" ] && FAST=1 || FAST=0

step() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m[ci] %s\033[0m\n' "$*" >&2; exit 1; }

if [ "$FAST" = "0" ] || [ ! -d node_modules ]; then
  step "installing dependencies"
  npm install || fail "npm install failed"
fi

step "tests (node --test)"
npm test || fail "the tests failed"

printf '\n\033[1;32m[ci] mock services gates green\033[0m\n'
