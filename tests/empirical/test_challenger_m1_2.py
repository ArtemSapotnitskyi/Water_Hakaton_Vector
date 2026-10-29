import time
import pytest
import pandas as pd
import numpy as np
from pathlib import Path
from fastapi.testclient import TestClient

from main import app
from etl_service import etl_service
from config import RYBNIK_DIR


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


# ==============================================================================
# CHALLENGE 1: LEAP YEAR AND CALENDAR BOUNDARIES (2024, 2025, 2026, 2028)
# ==============================================================================

@pytest.mark.parametrize("year,is_leap,feb_days,expected_hours", [
    (2024, True, 29, 8784),
    (2025, False, 28, 8760),
    (2026, False, 28, 8760),
    (2028, True, 29, 8784),
])
def test_evaluation_calendar_years_and_leap_boundaries(year, is_leap, feb_days, expected_hours):
    """
    Challenge 1: Evaluates full annual dataset for 2024, 2025, 2026, and 2028.
    Verifies that:
    1. Leap day (02-29) is correctly recognized or excluded depending on leap year logic.
    2. No DateParseError occurs during ingestion, resampling, or seasonal slicing.
    3. The jan_feb period in seasonal breakdown accounts for exact number of days (31 + feb_days).
    """
    dates = pd.date_range(f"{year}-01-01 00:00:00", f"{year}-12-31 23:00:00", freq="1h")
    assert len(dates) == expected_hours

    # Synthesize SCADA counter records sampled every 4 hours
    lines = []
    cnt = 5000.0
    for dt in dates[::4]:
        cnt += 120.0
        lines.append(f"TAG_{year}\t{dt.strftime('%Y-%m-%d %H:%M:%S')}\t{cnt:.1f}\tWartość z pomiaru")

    file_bytes = "\n".join(lines).encode("utf-8")
    filename = f"scada_year_{year}.txt"

    # Ingestion & Evaluation
    result = etl_service.evaluate_uploaded_dataset(file_content=file_bytes, filename=filename)

    assert result.total_measured_m3 > 0
    assert result.total_dwf_m3 > 0
    assert len(result.seasonal_breakdown) == 6

    # Verify seasonal breakdown jan_feb slice directly on full 1h series
    full_df = pd.DataFrame({
        "flow_m3": np.full(len(dates), 40.0),
        "dwf_m3": np.full(len(dates), 30.0),
        "accidental_m3": np.full(len(dates), 10.0),
        "energy_kwh": np.full(len(dates), 8.0),
        "accidental_energy_kwh": np.full(len(dates), 2.0),
        "financial_loss_pln": np.full(len(dates), 2.0)
    }, index=dates)

    breakdown = etl_service._calculate_seasonal_breakdown(full_df, sensitivity=1.2)
    jan_feb_item = next(p for p in breakdown if p["period_id"] == "jan_feb")

    expected_jan_feb_hours = (31 + feb_days) * 24
    expected_jan_feb_flow = float(expected_jan_feb_hours * 40.0)

    assert jan_feb_item["total_flow_m3"] == expected_jan_feb_flow


def test_adversarial_invalid_leap_day_in_non_leap_year():
    """
    Tests handling of an invalid leap day '2025-02-29' injected into a non-leap year SCADA file.
    The parser should coerce invalid timestamps without raising DateParseError.
    """
    lines = [
        "TAG\t2025-02-28 22:00:00\t1000.0\tWartość z pomiaru",
        "TAG\t2025-02-28 23:00:00\t1025.0\tWartość z pomiaru",
        "TAG\t2025-02-29 00:00:00\t1050.0\tWartość z pomiaru",  # INVALID DATE in 2025!
        "TAG\t2025-02-29 12:00:00\t1075.0\tWartość z pomiaru",  # INVALID DATE in 2025!
        "TAG\t2025-03-01 00:00:00\t1100.0\tWartość z pomiaru",
        "TAG\t2025-03-01 01:00:00\t1125.0\tWartość z pomiaru",
    ]
    file_bytes = "\n".join(lines).encode("utf-8")
    result = etl_service.evaluate_uploaded_dataset(file_content=file_bytes, filename="invalid_leap.txt")
    assert result.total_measured_m3 >= 0
    assert result.metadata.total_records >= 4


def test_multi_year_dataset_spanning_2025_and_2026():
    """
    Tests evaluation across a 2-year non-leap span (2025 to 2026).
    """
    dates = pd.date_range("2025-06-01 00:00:00", "2026-05-31 23:00:00", freq="6h")
    lines = []
    cnt = 10000.0
    for dt in dates:
        cnt += 150.0
        lines.append(f"TAG\t{dt.strftime('%Y-%m-%d %H:%M:%S')}\t{cnt:.1f}\tWartość z pomiaru")

    file_bytes = "\n".join(lines).encode("utf-8")
    result = etl_service.evaluate_uploaded_dataset(file_content=file_bytes, filename="span_2025_2026.txt")
    assert result.total_measured_m3 > 0
    assert len(result.seasonal_breakdown) == 6


# ==============================================================================
# CHALLENGE 2: CORRUPTED SCADA FILES (STATUS, MISSING TOKENS, TRAILING SPACES, HEADERLESS)
# ==============================================================================

def test_corrupted_scada_dirty_status_strings():
    """
    Tests SCADA parsing resilience against dirty status strings:
    - Trailing spaces ('Wartość z pomiaru   ')
    - Error strings ('Wartość nieznana', 'Błąd obliczenia', 'Awaria pompy')
    - Mixed case and whitespace
    """
    lines = [
        "PZ1\t2024-05-01 00:00:00\t10000.0\tWartość z pomiaru   ",
        "PZ1\t2024-05-01 01:00:00\t10040.0\t   Wartość z pomiaru",
        "PZ1\t2024-05-01 02:00:00\t10070.0\tWartość nieznana",
        "PZ1\t2024-05-01 03:00:00\t10100.0\tBłąd obliczenia   ",
        "PZ1\t2024-05-01 04:00:00\t10130.0\tAwaria przetwornika",
        "PZ1\t2024-05-01 05:00:00\t10170.0\talarm poziomu max",
        "PZ1\t2024-05-01 06:00:00\t10220.0\tWartość z pomiaru",
        "PZ1\t2024-05-01 07:00:00\t10270.0\tWartość z pomiaru\t\r",
    ]
    file_bytes = "\n".join(lines).encode("utf-8")
    result = etl_service.evaluate_uploaded_dataset(file_content=file_bytes, filename="dirty_status.txt")

    assert result.total_measured_m3 > 0
    # Failures / raw incidents should capture the dirty status records
    assert len(result.failures_summary) > 0 or result.metadata.quality_score < 100.0


def test_corrupted_scada_missing_tokens_and_dashes():
    """
    Tests handling of '--', ' -- ', empty tokens, decimal commas, and missing counters.
    """
    lines = [
        "PZ1\t2024-05-01 00:00:00\t10000,50\tWartość z pomiaru",
        "PZ1\t2024-05-01 01:00:00\t--\tWartość nieznana",
        "PZ1\t2024-05-01 02:00:00\t  --  \tWartość nieznana",
        "PZ1\t2024-05-01 03:00:00\tNaN\tBłąd obliczenia",
        "PZ1\t2024-05-01 04:00:00\t10140,80\tWartość z pomiaru",
        "PZ1\t2024-05-01 05:00:00\t\tBłąd",  # missing counter token completely
        "PZ1\t2024-05-01 06:00:00\t10200.0\tWartość z pomiaru",
    ]
    file_bytes = "\n".join(lines).encode("utf-8")
    result = etl_service.evaluate_uploaded_dataset(file_content=file_bytes, filename="missing_tokens.txt")

    assert result.total_measured_m3 > 0
    assert not np.isnan(result.total_measured_m3)
    assert not np.isnan(result.total_dwf_m3)


def test_headerless_scada_variations():
    """
    Tests headerless inputs in 4-column, 3-column, and 2-column layouts,
    with tab and semicolon delimiters.
    """
    # 1. 4-column tab-delimited headerless
    lines_4col = [
        "TagA\t2024-07-01 00:00:00\t2000.0\tWartość z pomiaru",
        "TagA\t2024-07-01 01:00:00\t2045.0\tWartość z pomiaru",
        "TagA\t2024-07-01 02:00:00\t2080.0\tWartość z pomiaru",
        "TagA\t2024-07-01 03:00:00\t2110.0\tWartość z pomiaru",
    ]
    res4 = etl_service.evaluate_uploaded_dataset(file_content="\n".join(lines_4col).encode("utf-8"), filename="head_4col.txt")
    assert res4.total_measured_m3 > 0

    # 2. 3-column tab-delimited headerless (no status column)
    lines_3col = [
        "TagB\t2024-07-01 00:00:00\t5000.0",
        "TagB\t2024-07-01 01:00:00\t5035.0",
        "TagB\t2024-07-01 02:00:00\t5065.0",
        "TagB\t2024-07-01 03:00:00\t5090.0",
    ]
    res3 = etl_service.evaluate_uploaded_dataset(file_content="\n".join(lines_3col).encode("utf-8"), filename="head_3col.txt")
    assert res3.total_measured_m3 > 0

    # 3. 2-column semicolon-delimited headerless (timestamp, flow)
    lines_2col = [
        "2024-07-01 00:00:00;35,2",
        "2024-07-01 01:00:00;38,7",
        "2024-07-01 02:00:00;31,4",
        "2024-07-01 03:00:00;29,8",
    ]
    res2 = etl_service.evaluate_uploaded_dataset(file_content="\n".join(lines_2col).encode("utf-8"), filename="head_2col.csv")
    assert res2.total_measured_m3 > 0


def test_corrupted_counter_huge_discontinuity_jump():
    """
    Tests handling of meter replacement / reset discontinuity (> 5000 m3/h jump).
    Ensures clamping prevents gigantic false accidental water explosion.
    """
    lines = [
        "PZ1\t2024-05-01 00:00:00\t1000.0\tWartość z pomiaru",
        "PZ1\t2024-05-01 01:00:00\t1050.0\tWartość z pomiaru",
        "PZ1\t2024-05-01 02:00:00\t80000.0\tWartość z pomiaru",  # 78,950 m3 discontinuity!
        "PZ1\t2024-05-01 03:00:00\t80045.0\tWartość z pomiaru",
        "PZ1\t2024-05-01 04:00:00\t80080.0\tWartość z pomiaru",
    ]
    file_bytes = "\n".join(lines).encode("utf-8")
    result = etl_service.evaluate_uploaded_dataset(file_content=file_bytes, filename="jump.txt")

    # Accidental water should be reasonable, NOT ~80,000 m3
    assert result.total_accidental_m3 < 5000.0


# ==============================================================================
# CHALLENGE 3: PROCESSING LATENCY (REAL RYBNIK DATASETS < 2.0s)
# ==============================================================================

def test_latency_real_pnb1_parse_and_aggregation():
    """
    Challenge 3.1: Verify PNB1_2024.txt (5.2 MB) full parse & evaluation strictly < 2.0s.
    """
    pnb1_file = RYBNIK_DIR / "PNB1_2024.txt"
    assert pnb1_file.exists(), f"PNB1_2024.txt not found at {pnb1_file}"

    with open(pnb1_file, "rb") as f:
        content = f.read()

    t0 = time.perf_counter()
    res = etl_service.evaluate_uploaded_dataset(file_content=content, filename="PNB1_2024.txt")
    elapsed = time.perf_counter() - t0

    print(f"\n[LATENCY BENCHMARK] PNB1_2024.txt (5.18 MB): {elapsed:.4f}s")
    assert elapsed < 2.0, f"PNB1 evaluation took {elapsed:.4f}s, exceeding 2.0s threshold!"
    assert res.total_measured_m3 > 0


def test_latency_real_pz1_parse_and_aggregation():
    """
    Challenge 3.2: Verify PZ1_2024.txt (41.9 MB, 705,698 lines) full parse & evaluation strictly < 2.0s.
    """
    pz1_file = RYBNIK_DIR / "PZ1_2024.txt"
    assert pz1_file.exists(), f"PZ1_2024.txt not found at {pz1_file}"

    with open(pz1_file, "rb") as f:
        content = f.read()

    t0 = time.perf_counter()
    res = etl_service.evaluate_uploaded_dataset(file_content=content, filename="PZ1_2024.txt")
    elapsed = time.perf_counter() - t0

    print(f"\n[LATENCY BENCHMARK] PZ1_2024.txt (41.92 MB): {elapsed:.4f}s")
    assert elapsed < 2.0, f"PZ1 evaluation took {elapsed:.4f}s, exceeding 2.0s threshold!"
    assert res.total_measured_m3 > 0


def test_latency_presets_evaluation():
    """
    Challenge 3.3: Verify preset evaluation for all benchmark horizons is strictly < 2.0s.
    """
    presets = ["rybnik_2025_2026_test", "pz1_historical", "pnb1_historical"]
    for pr in presets:
        t0 = time.perf_counter()
        res = etl_service.evaluate_uploaded_dataset(preset=pr)
        elapsed = time.perf_counter() - t0
        print(f"\n[LATENCY BENCHMARK] Preset {pr}: {elapsed:.4f}s")
        assert elapsed < 2.0, f"Preset {pr} took {elapsed:.4f}s, exceeding 2.0s threshold!"
        assert res.total_measured_m3 > 0


def test_latency_tauron_energy_csv_evaluation():
    """
    Challenge 3.4: Verify Tauron hourly energy CSV files parse strictly < 2.0s.
    """
    csv_files = list(RYBNIK_DIR.glob("Rap_godzinowy_*.csv"))
    assert len(csv_files) > 0, "No Tauron CSV files found in Rybnik dir"

    for csv_file in csv_files:
        with open(csv_file, "rb") as f:
            content = f.read()
        t0 = time.perf_counter()
        res = etl_service.evaluate_uploaded_dataset(file_content=content, filename=csv_file.name)
        elapsed = time.perf_counter() - t0
        print(f"\n[LATENCY BENCHMARK] {csv_file.name}: {elapsed:.4f}s")
        assert elapsed < 2.0, f"CSV {csv_file.name} took {elapsed:.4f}s, exceeding 2.0s threshold!"
        assert res.total_measured_m3 > 0


def test_latency_fastapi_upload_endpoint(client: TestClient):
    """
    Challenge 3.5: Verify end-to-end HTTP file upload via /api/benchmark/upload strictly < 2.0s.
    """
    pnb1_file = RYBNIK_DIR / "PNB1_2024.txt"
    with open(pnb1_file, "rb") as f:
        t0 = time.perf_counter()
        res = client.post("/api/benchmark/upload", files={"file": ("PNB1_2024.txt", f, "text/plain")})
        elapsed = time.perf_counter() - t0

    assert res.status_code == 200
    print(f"\n[LATENCY BENCHMARK] HTTP POST /api/benchmark/upload (PNB1 5.2MB): {elapsed:.4f}s")
    assert elapsed < 2.0, f"Upload API took {elapsed:.4f}s, exceeding 2.0s!"

    pz1_file = RYBNIK_DIR / "PZ1_2024.txt"
    with open(pz1_file, "rb") as f:
        t0 = time.perf_counter()
        res = client.post("/api/benchmark/upload", files={"file": ("PZ1_2024.txt", f, "text/plain")})
        elapsed = time.perf_counter() - t0

    assert res.status_code == 200
    print(f"\n[LATENCY BENCHMARK] HTTP POST /api/benchmark/upload (PZ1 41.9MB): {elapsed:.4f}s")
    assert elapsed < 2.0, f"Upload API took {elapsed:.4f}s, exceeding 2.0s!"

