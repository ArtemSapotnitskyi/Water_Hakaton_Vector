#!/usr/bin/env python3
"""
HydroPulse SCADA Platform — Universal E2E Test Runner
Executes opaque-box E2E tests across Tiers 1-4.

Usage:
    python tests/run_e2e_tests.py [--tier {1,2,3,4,all}] [-v]
"""

import sys
import os
import argparse
from pathlib import Path
import pytest

# Ensure repository root and backend directory are in sys.path
TESTS_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = TESTS_DIR.parent
BACKEND_DIR = PROJECT_ROOT / "backend"

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def run_suite(tier: str, verbose: bool = False) -> int:
    """Run specified test suite and return pytest exit code."""
    tier_map = {
        "1": TESTS_DIR / "e2e" / "test_tier1_features.py",
        "2": TESTS_DIR / "e2e" / "test_tier2_boundaries.py",
        "3": TESTS_DIR / "e2e" / "test_tier3_combinations.py",
        "4": TESTS_DIR / "e2e" / "test_tier4_scenarios.py",
    }

    pytest_args = ["-q"]
    if verbose:
        pytest_args = ["-v"]

    print("=" * 72)
    print("HYDROPULSE SCADA E2E TEST RUNNER")
    print(f"Target: {'All Tiers' if tier == 'all' else f'Tier {tier}'}")
    print("=" * 72)

    if tier == "all":
        targets = [str(p) for p in tier_map.values()]
    elif tier in tier_map:
        targets = [str(tier_map[tier])]
    else:
        print(f"Unknown tier: {tier}")
        return 1

    pytest_args.extend(targets)
    ret = pytest.main(pytest_args)
    print("=" * 72)
    print(f"Test run completed with exit code: {int(ret)}")
    print("=" * 72)
    return int(ret)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="HydroPulse E2E Test Runner")
    parser.add_argument(
        "--tier",
        choices=["1", "2", "3", "4", "all"],
        default="all",
        help="Specify which tier to execute (default: all)"
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable verbose test output"
    )

    args = parser.parse_args()
    sys.exit(run_suite(args.tier, args.verbose))
