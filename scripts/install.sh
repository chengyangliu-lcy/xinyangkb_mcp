#!/usr/bin/env bash
# Wrapper that delegates to the cross-platform Node.js installer.
# Works on both Linux and macOS.
set -euo pipefail

cd "$(dirname "$0")/.."
node scripts/install.cjs "$@"
