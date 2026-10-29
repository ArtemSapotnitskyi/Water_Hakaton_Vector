#!/usr/bin/env bash
# ==============================================================================
# HydroPulse SCADA E2E Universal Test Runner Script
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Resolve Python executable
if [ -f "${ROOT_DIR}/backend/venv/bin/python" ]; then
    PYTHON_BIN="${ROOT_DIR}/backend/venv/bin/python"
elif [ -f "${ROOT_DIR}/backend/venv 2/bin/python" ]; then
    PYTHON_BIN="${ROOT_DIR}/backend/venv 2/bin/python"
elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3)"
else
    echo "ERROR: Python interpreter not found." >&2
    exit 1
fi

echo "Using Python: ${PYTHON_BIN}"
cd "${ROOT_DIR}"
exec "${PYTHON_BIN}" "${SCRIPT_DIR}/run_e2e_tests.py" "$@"
