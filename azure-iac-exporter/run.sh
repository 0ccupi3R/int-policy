#!/usr/bin/env bash
#
# Azure IaC Multi-Format Exporter Launcher
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="$(which python3 || echo "python")"

exec "$PYTHON_BIN" "$SCRIPT_DIR/exporter.py" "$@"
