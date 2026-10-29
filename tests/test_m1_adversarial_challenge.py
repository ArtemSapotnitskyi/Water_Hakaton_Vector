"""
Milestone 1 Empirical Adversarial Challenge Test Suite
Empirical challenger verification for HydroPulse SCADA M1 data ingestion and resampling.

Covers:
1. Extreme data gaps (hours, days, months, irregular sampling, short series).
2. Counter resets, meter replacements, upward jumps, and negative volume prevention.
3. Strict empirical verification of PZ-1 March 2024 corrupted window (14,107 records, raw vs cleaned).
4. Pure SCADA weather resilience (zero rainfall dependency).
5. Robustness against corrupt tokens, formats, and non-leap year dates.
"""

import io
import math
import pytest
import numpy as np
import pandas as pd
from pathlib import Path
from fastapi.testclient import TestClient

from config import (
    RYBNIK_DIR, PZ1_SEU_KWH_M3, PNB1_SEU_KWH_M3, DEFAULT_SEU_KWH_M3,
    ELECTRICITY_TARIFF_PLN_KWH
)
from etl_service import etl_service
from main import app


@pytest.fixture
def api_client():
    return TestClient(app)


# ==============================================================================
# SECTION 1: EXTREME DATA GAPS & IRREGULAR SAMPLING
# ==============================================================================

def test_adv_gap_01_single_day_gap():
    """Adversarial 1.1: 24-hour complete gap in SCADA telemetry is resampled and filled."""
    lines = [
        "Q1\t2024-06-01 10:00:00\t1000.0\tOK",
        "Q1\t2024-06-01 11:00:00\t1025.0\tOK",
        # 24-hour gap
        "Q1\t2024-06-02 12:00:00\t1600.0\tOK",
        "Q1\t2024-06-02 13:00:00\t1625.0\tOK",
    ]
    content = "\n".join(lines).encode("utf-8")
    res = etl_service.evaluate_uploaded_dataset(file_content=content, filename="gap_24h.txt")
    assert res is not None
    assert res.total_measured_m3 >= 600.0
    assert res.total_accidental_m3 >= 0.0


def test_adv_gap_02_multi_week_gap():
    """Adversarial 1.2: 14-day telemetry dropout resamples to continuous hourly series without crash."""
    lines = [
        "Q1\t2024-01-01 00:00:00\t10000.0\tOK",
        "Q1\t2024-01-01 01:00:00\t10030.0\tOK",
        # 14 days blackout
        "Q1\t2024-01-15 01:00:00\t15000.0\tOK",
        "Q1\t2024-01-15 02:00:00\t15035.0\tOK",
    ]
    content = "\n".join(lines).encode("utf-8")
    res = etl_service.evaluate_uploaded_dataset(file_content=content, filename="gap_14d.txt")
    assert res is not None
    assert res.total_measured_m3 > 0.0
    assert res.total_accidental_m3 >= 0.0
    assert len(res.forecast_trends) == 48


def test_adv_gap_03_multi_month_extreme_gap():
    """Adversarial 1.3: 6-month telemetry dropout between February and August."""
    lines = [
        "Q1\t2024-02-01 12:00:00\t20000.0\tOK",
        "Q1\t2024-02-01 13:00:00\t20040.0\tOK",
        # 6 months blackout
        "Q1\t2024-08-01 12:00:00\t45000.0\tOK",
        "Q1\t2024-08-01 13:00:00\t45045.0\tOK",
    ]
    content = "\n".join(lines).encode("utf-8")
    res = etl_service.evaluate_uploaded_dataset(file_content=content, filename="gap_6m.txt")
    assert res is not None
    assert res.total_measured_m3 > 0.0
    assert res.total_accidental_m3 >= 0.0


def test_adv_gap_04_irregular_event_bursts():
    """Adversarial 1.4: Highly irregular event-based timestamps (10s, 3m, 47m, 4h)."""
    lines = [
        "Q1\t2024-04-10 08:00:10\t100.0\tOK",
        "Q1\t2024-04-10 08:00:20\t100.2\tOK",
        "Q1\t2024-04-10 08:03:55\t103.5\tOK",
        "Q1\t2024-04-10 08:50:00\t140.0\tOK",
        "Q1\t2024-04-10 12:30:00\t280.0\tOK",
        "Q1\t2024-04-10 12:30:10\t280.1\tOK",
        "Q1\t2024-04-10 16:45:00\t400.0\tOK",
    ]
    content = "\n".join(lines).encode("utf-8")
    res = etl_service.evaluate_uploaded_dataset(file_content=content, filename="irregular.txt")
    assert res is not None
    assert res.total_measured_m3 == 260.0
    assert res.total_accidental_m3 >= 0.0


def test_adv_gap_05_micro_series_short_horizon():
    """Adversarial 1.5: Short dataset (<24h, 4 hours) does not fail DWF or forecasting engine."""
    lines = [
        "Q1\t2024-07-01 10:00:00\t50.0\tOK",
        "Q1\t2024-07-01 11:00:00\t75.0\tOK",
        "Q1\t2024-07-01 12:00:00\t95.0\tOK",
        "Q1\t2024-07-01 13:00:00\t120.0\tOK",
    ]
    content = "\n".join(lines).encode("utf-8")
    res = etl_service.evaluate_uploaded_dataset(file_content=content, filename="short_4h.txt")
    assert res is not None
    # 4 hourly bins with leading diff backfilled: 25 + 25 + 20 + 25 = 95.0
    assert res.total_measured_m3 == 95.0
    assert res.total_accidental_m3 >= 0.0
    assert len(res.forecast_trends) == 48


def test_adv_gap_06_unsorted_timestamps():
    """Adversarial 1.6: Telemetry packets arriving out-of-order are sorted monotonically."""
    lines = [
        "Q1\t2024-05-01 12:00:00\t1200.0\tOK",
        "Q1\t2024-05-01 10:00:00\t1000.0\tOK",
        "Q1\t2024-05-01 13:00:00\t1300.0\tOK",
        "Q1\t2024-05-01 11:00:00\t1100.0\tOK",
    ]
    content = "\n".join(lines).encode("utf-8")
    res = etl_service.evaluate_uploaded_dataset(file_content=content, filename="unsorted.txt")
    assert res is not None
    # 4 sorted hourly intervals, each with 100 m3 delta = 400.0 m3
    assert res.total_measured_m3 == 400.0
    assert res.total_accidental_m3 >= 0.0



# ==============================================================================
# SECTION 2: COUNTER RESETS, ROLLOVERS & NEGATIVE VOLUME PREVENTION
# ==============================================================================

def test_adv_reset_01_meter_replacement_from_999999_to_10():
    """Adversarial 2.1: Physical meter replacement resetting 999,999 -> 10 produces no negative flow."""
    lines = [
        "Q1\t2024-05-10 08:00:00\t999800.0\tOK",
        "Q1\t2024-05-10 09:00:00\t999900.0\tOK",
        "Q1\t2024-05-10 10:00:00\t999999.0\tOK",
        "Q1\t2024-05-10 11:00:00\t10.0\tOK",      # RESET
        "Q1\t2024-05-10 12:00:00\t50.0\tOK",
        "Q1\t2024-05-10 13:00:00\t90.0\tOK",
    ]
    content = "\n".join(lines).encode("utf-8")
    res = etl_service.evaluate_uploaded_dataset(file_content=content, filename="reset_rollover.txt")
    assert res is not None
    assert res.total_measured_m3 >= 0.0
    assert res.total_accidental_m3 >= 0.0
    assert res.financial_cost_pln >= 0.0
    # Resampled flow items must all be strictly non-negative
    for item in res.hourly_trends:
        assert item["measured_m3"] >= 0.0
        assert item["accidental_m3"] >= 0.0


def test_adv_reset_02_massive_upward_discontinuity_jump():
    """Adversarial 2.2: Meter jump from 10 to 999,999 (>5000 m3/h) clamped as discontinuity."""
    lines = [
        "Q1\t2024-05-10 08:00:00\t10.0\tOK",
        "Q1\t2024-05-10 09:00:00\t20.0\tOK",
        "Q1\t2024-05-10 10:00:00\t999999.0\tOK",  # Discontinuity surge
        "Q1\t2024-05-10 11:00:00\t1000020.0\tOK",
    ]
    content = "\n".join(lines).encode("utf-8")
    res = etl_service.evaluate_uploaded_dataset(file_content=content, filename="jump_clamp.txt")
    assert res is not None
    # Must not ingest 999,979 m3 into measured volume
    assert res.total_measured_m3 < 50000.0
    assert res.total_accidental_m3 >= 0.0


def test_adv_reset_03_multiple_consecutive_meter_swaps():
    """Adversarial 2.3: Multiple chaotic resets in unstable hardware test."""
    lines = [
        "Q1\t2024-05-01 00:00:00\t500.0\tOK",
        "Q1\t2024-05-01 01:00:00\t10.0\tOK",    # Reset 1
        "Q1\t2024-05-01 02:00:00\t30.0\tOK",
        "Q1\t2024-05-01 03:00:00\t5.0\tOK",     # Reset 2
        "Q1\t2024-05-01 04:00:00\t40.0\tOK",
        "Q1\t2024-05-01 05:00:00\t2.0\tOK",     # Reset 3
        "Q1\t2024-05-01 06:00:00\t50.0\tOK",
    ]
    content = "\n".join(lines).encode("utf-8")
    res = etl_service.evaluate_uploaded_dataset(file_content=content, filename="multi_reset.txt")
    assert res is not None
    assert res.total_measured_m3 >= 0.0
    assert res.total_accidental_m3 >= 0.0
    for trend in res.hourly_trends:
        assert trend["measured_m3"] >= 0.0
        assert trend["accidental_m3"] >= 0.0


def test_adv_reset_04_monotonically_decreasing_counter():
    """Adversarial 2.4: Broken counter running strictly in reverse produces zero flow, no negatives."""
    lines = [f"Q1\t2024-05-01 {h:02d}:00:00\t{1000 - h*10}.0\tOK" for h in range(24)]
    content = "\n".join(lines).encode("utf-8")
    res = etl_service.evaluate_uploaded_dataset(file_content=content, filename="reverse.txt")
    assert res is not None
    assert res.total_measured_m3 == 0.0
    assert res.total_accidental_m3 == 0.0
    assert res.accidental_energy_kwh == 0.0
    assert res.financial_cost_pln == 0.0


# ==============================================================================
# SECTION 3: MARCH 2024 PZ-1 CALIBRATION CORRUPTION & TOGGLE VERIFICATION
# ==============================================================================

def test_adv_march_01_verify_exact_14107_corrupted_records():
    """Adversarial 3.1: Empirically confirm exactly 14,107 records in the March 2024 window."""
    pz1_path = RYBNIK_DIR / "PZ1_2024.txt"
    assert pz1_path.exists(), f"Missing telemetry file at {pz1_path}"
    
    df = pd.read_csv(
        pz1_path, sep="\t", header=None,
        names=["tag", "timestamp", "counter", "status"],
        encoding="utf-8-sig", low_memory=False
    )
    df["dt"] = pd.to_datetime(df["timestamp"], errors="coerce")
    march_mask = (df["dt"] >= "2024-03-01 00:00:00") & (df["dt"] <= "2024-03-21 23:59:59")
    tainted_count = int(march_mask.sum())
    
    # Assert exact empirical count
    assert tainted_count == 14107, f"Expected 14,107 corrupted records, found {tainted_count}"


def test_adv_march_02_cleaned_mode_masks_and_prevents_negatives():
    """Adversarial 3.2: clean_data=True masks March freeze/surge and produces no negative accidental volumes."""
    res_clean = etl_service.get_inflow_analysis(station="PZ1", clean_data=True)
    
    assert res_clean.raw_vs_cleaned_stats is not None
    assert res_clean.raw_vs_cleaned_stats.is_cleaned is True
    assert res_clean.raw_vs_cleaned_stats.corrupted_records_count == 14107
    assert res_clean.raw_vs_cleaned_stats.masked_window_start == "2024-03-01 00:00:00"
    assert res_clean.raw_vs_cleaned_stats.masked_window_end == "2024-03-21 23:59:59"
    
    # Official evaluated volumes
    assert res_clean.total_measured_m3 == 1223080.0
    assert res_clean.total_accidental_m3 == pytest.approx(140011.0, abs=500.0)
    assert res_clean.total_accidental_m3 >= 0.0
    assert res_clean.financial_cost_pln >= 0.0


def test_adv_march_03_raw_mode_faithfully_preserves_distorted_surge():
    """Adversarial 3.3: clean_data=False preserves the 2,763 m3/h surge and inflated volume."""
    res_raw = etl_service.get_inflow_analysis(station="PZ1", clean_data=False)
    
    assert res_raw.raw_vs_cleaned_stats is not None
    assert res_raw.raw_vs_cleaned_stats.is_cleaned is False
    assert res_raw.raw_vs_cleaned_stats.corrupted_records_count == 14107
    
    # Official evaluated volumes for raw corrupted mode
    assert res_raw.total_measured_m3 == 1474250.0
    assert res_raw.total_accidental_m3 == pytest.approx(414786.0, abs=500.0)
    assert res_raw.total_measured_m3 > 1223080.0
    assert res_raw.total_accidental_m3 > 140011.0


def test_adv_march_04_direct_df_march_window_flow_bounds():
    """Adversarial 3.4: Inspect underlying hourly flow series during 2024-03-01..2024-03-21."""
    df_clean, _, _, _ = etl_service._load_pz1_historical(clean_data=True)
    df_raw, _, _, _ = etl_service._load_pz1_historical(clean_data=False)
    
    m_clean = df_clean.loc["2024-03-01 00:00:00":"2024-03-21 23:59:59"]
    m_raw = df_raw.loc["2024-03-01 00:00:00":"2024-03-21 23:59:59"]
    
    # 21 full days = 504 hours
    assert len(m_clean) == 504
    assert len(m_raw) == 504
    
    # Clean mode: flow matches diurnal DWF harmonics (bounded between 35 and 180 m3/h)
    assert m_clean["flow_m3"].min() >= 35.0
    assert m_clean["flow_m3"].max() <= 200.0
    
    # Raw mode: shows 0.0 m3/h during freeze and spikes up to 2,763 m3/h during runaway
    assert m_raw["flow_m3"].min() == 0.0
    assert m_raw["flow_m3"].max() == 2763.0


def test_adv_march_05_api_toggle_consistency(api_client: TestClient):
    """Adversarial 3.5: API /api/inflow-analysis responds consistently to clean_data query param."""
    r1 = api_client.get("/api/inflow-analysis?station=PZ1&clean_data=true")
    assert r1.status_code == 200
    d1 = r1.json()
    assert d1["total_measured_m3"] == 1223080.0
    assert d1["raw_vs_cleaned_stats"]["is_cleaned"] is True

    r2 = api_client.get("/api/inflow-analysis?station=PZ1&clean_data=false")
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["total_measured_m3"] == 1474250.0
    assert d2["raw_vs_cleaned_stats"]["is_cleaned"] is False


# ==============================================================================
# SECTION 4: STATION-SPECIFIC SEU & WEATHER RESILIENCE
# ==============================================================================

def test_adv_seu_01_station_specific_energy_coefficients():
    """Adversarial 4.1: PZ-1 uses 0.08 kWh/m3, PNB-1 uses 0.31 kWh/m3."""
    pz1_res = etl_service.get_inflow_analysis(station="PZ1", clean_data=True)
    pnb1_res = etl_service.get_inflow_analysis(station="PNB1")
    
    # PZ1 ratio: accidental_energy / accidental_volume ~ 0.08
    pz1_acc_m3 = pz1_res.total_accidental_m3
    pz1_acc_kwh = pz1_res.accidental_energy_kwh
    assert math.isclose(pz1_acc_kwh / pz1_acc_m3, PZ1_SEU_KWH_M3, rel_tol=1e-2)
    
    # PNB1 ratio: accidental_energy / accidental_volume ~ 0.31
    pnb1_acc_m3 = pnb1_res.total_accidental_m3
    pnb1_acc_kwh = pnb1_res.accidental_energy_kwh
    assert math.isclose(pnb1_acc_kwh / pnb1_acc_m3, PNB1_SEU_KWH_M3, rel_tol=1e-2)


def test_adv_weather_02_pure_scada_autonomous_execution():
    """Adversarial 4.2: End-to-end processing succeeds without any rainfall data present."""
    # Build synthetic pure flow telemetry with 0 rainfall fields
    dates = pd.date_range("2024-08-01 00:00:00", "2024-08-10 23:00:00", freq="1h")
    lines = [f"TAG_FLOW\t{dt.strftime('%Y-%m-%d %H:%M:%S')}\t{1000 + i*15}.0\tOK" for i, dt in enumerate(dates)]
    content = "\n".join(lines).encode("utf-8")
    
    res = etl_service.evaluate_uploaded_dataset(file_content=content, filename="pure_flow_no_rain.txt")
    assert res is not None
    assert res.total_measured_m3 > 0.0
    assert len(res.forecast_trends) == 48
    assert res.financial_cost_pln >= 0.0


# ==============================================================================
# SECTION 5: CORRUPT TOKENS, ENCODINGS, AND DATEPARSERESOLUTION
# ==============================================================================

def test_adv_parsing_01_diverse_corrupted_tokens():
    """Adversarial 5.1: Handles non-standard status strings, dashes, commas, scientific notation."""
    lines = [
        "Q1\t2024-09-01 00:00:00\t1.000000e+03\tWartość z pomiaru",
        "Q1\t2024-09-01 01:00:00\t--\tBłąd komunikacji",
        "Q1\t2024-09-01 02:00:00\t1050,75\tWartość nieznana",
        "Q1\t2024-09-01 03:00:00\t#VALUE!\tBłąd obliczenia",
        "Q1\t2024-09-01 04:00:00\t1120.50\tOK",
    ]
    content = "\n".join(lines).encode("utf-8")
    res = etl_service.evaluate_uploaded_dataset(file_content=content, filename="tokens.txt")
    assert res is not None
    assert res.total_measured_m3 > 0.0
    assert res.total_accidental_m3 >= 0.0


def test_adv_parsing_02_non_leap_year_february_safety():
    """Adversarial 5.2: Non-leap year 2025 and 2026 dates never raise DateParseError."""
    # Test 2025 dataset horizon
    res_2025 = etl_service.evaluate_uploaded_dataset(preset="rybnik_2025_2026_test")
    assert res_2025 is not None
    assert len(res_2025.seasonal_breakdown) == 6
    jan_feb = [p for p in res_2025.seasonal_breakdown if p["period_id"] == "jan_feb"][0]
    assert jan_feb["total_flow_m3"] > 0.0
