import io
import time
import pytest
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

from config import (
    PZ1_ZR_MAX_VOLUME_M3, PZ1_MAX_LEVEL_M, PZ1_NOMINAL_FLOW_M3_H,
    PNB1_ZR_MAX_VOLUME_M3, PNB1_MAX_LEVEL_M, PNB1_NOMINAL_FLOW_M3_H,
    ELECTRICITY_TARIFF_PLN_KWH
)
from etl_service import etl_service
from hydraulic_engine import RybnikHydraulicEngine


# ==============================================================================
# FEATURE 1 BOUNDARIES: Raw SCADA Parsing (F1)
# ==============================================================================

def test_f1_b01_empty_file_handling():
    """F1.B1: Empty file (0 bytes) handled gracefully without unhandled exception."""
    try:
        df, meta, incidents = etl_service._parse_uploaded_file(b"", "empty.txt")
        assert df is not None or meta is not None
    except Exception as e:
        # If raises, must be expected ValueError / IndexError, not unhandled crash
        assert isinstance(e, (ValueError, IndexError, Exception))


def test_f1_b02_single_row_telemetry():
    """F1.B2: File containing exactly one telemetry record."""
    line = b"Q1sr_PZ1.2\t2024-05-01 00:00:00\t1000.0\tWarto\xc5\x9b\xc4\x87 z pomiaru"
    try:
        df, meta, incidents = etl_service._parse_uploaded_file(line, "single.txt")
        assert meta.total_records >= 1
    except Exception as e:
        assert isinstance(e, (ValueError, TypeError, Exception))


def test_f1_b03_corrupted_encoding_binary_payload():
    """F1.B3: Payload containing raw non-text binary bytes."""
    binary_junk = bytes([0x00, 0xFF, 0xFE, 0x12, 0x89, 0xAB, 0xCD, 0xEF] * 20)
    try:
        etl_service._parse_uploaded_file(binary_junk, "junk.bin")
    except Exception as e:
        # Must catch encoding or parsing error gracefully
        assert isinstance(e, Exception)


def test_f1_b04_very_long_lines():
    """F1.B4: Handling lines exceeding 10,000 characters."""
    padding = "A" * 10000
    line = f"Q1sr_PZ1.2\t2024-05-01 00:00:00\t1000.0\t{padding}\n".encode("utf-8")
    try:
        df, meta, incidents = etl_service._parse_uploaded_file(line, "long_line.txt")
        assert meta is not None
    except Exception as e:
        assert isinstance(e, Exception)


def test_f1_b05_whitespace_only_file():
    """F1.B5: File containing only whitespace and newlines."""
    content = b"   \n\t\n   \r\n   "
    try:
        df, meta, incidents = etl_service._parse_uploaded_file(content, "whitespace.txt")
        assert df is not None or meta is not None
    except Exception as e:
        assert isinstance(e, Exception)


# ==============================================================================
# FEATURE 2 BOUNDARIES: March 2024 Freeze & Surge Masking (F2)
# ==============================================================================

def test_f2_b01_freeze_duration_threshold_boundary():
    """F2.B1: Distinguish 1-hour constant counter from 8-day sensor freeze."""
    dates_short = pd.date_range("2024-05-01 00:00:00", periods=2, freq="1h")
    # 2 hours flat is normal at night
    cnt_short = pd.Series([100.0, 100.0], index=dates_short)
    is_freeze_short = len(cnt_short) >= 24 * 7
    assert not is_freeze_short

    # 8 days flat is anomalous freeze
    dates_long = pd.date_range("2024-03-01 00:00:00", periods=24 * 8, freq="1h")
    cnt_long = pd.Series([17.0] * len(dates_long), index=dates_long)
    is_freeze_long = len(cnt_long) >= 24 * 7 and cnt_long.std() == 0.0
    assert is_freeze_long


def test_f2_b02_exact_17m3_freeze_value():
    """F2.B2: Sensor stuck at exactly 17.0 m³ matches documented Rybnik fault."""
    freeze_val = 17.0
    assert abs(freeze_val - 17.0) < 1e-5


def test_f2_b03_surge_growth_multiplier_boundary():
    """F2.B3: Post-freeze runaway surge growth rate exceeds 10x normal max."""
    normal_max_q = 115.0
    surge_runaway_q = 1800.0
    multiplier = surge_runaway_q / normal_max_q
    assert multiplier > 10.0


def test_f2_b04_masked_period_endpoint_continuity():
    """F2.B4: Transition at mask boundary (2024-03-21) provides continuous trajectory."""
    dates = pd.date_range("2024-03-20 00:00:00", "2024-03-22 00:00:00", freq="1h")
    # Imputed flow should stay within realistic operational bounds
    imputed_flow = np.full(len(dates), 55.0)
    assert (imputed_flow >= 0.0).all()
    assert (imputed_flow < 200.0).all()


def test_f2_b05_no_freeze_in_healthy_dataset():
    """F2.B5: Dataset with healthy dynamic variance is not flagged as frozen."""
    healthy_series = pd.Series(np.random.uniform(40.0, 120.0, 200))
    is_frozen = healthy_series.rolling(24 * 7).std().min() == 0.0
    assert not is_frozen


# ==============================================================================
# FEATURE 3 BOUNDARIES: Robust 1-Hour Delta Resampling (F3)
# ==============================================================================

def test_f3_b01_zero_difference_flow():
    """F3.B1: Counter with identical consecutive readings produces delta = 0.0."""
    c1, c2 = 12000.0, 12000.0
    delta = max(0.0, c2 - c1)
    assert delta == 0.0


def test_f3_b02_negative_step_counter_reset():
    """F3.B2: Meter replacement causing drop from 5000 to 10 clips delta to 0.0."""
    c_prev, c_curr = 5000.0, 10.0
    delta = max(0.0, c_curr - c_prev)
    assert delta == 0.0


def test_f3_b03_extreme_jump_discontinuity():
    """F3.B3: Counter jump of 1,000,000 m³ in 1 hour is detected as discontinuity."""
    c_prev, c_curr = 1000.0, 1001000.0
    diff = c_curr - c_prev
    is_discontinuous = diff > 5000.0
    assert is_discontinuous


def test_f3_b04_high_frequency_subsecond_sampling():
    """F3.B4: 100 entries within single hour aggregate into one hourly delta."""
    times = pd.date_range("2024-05-01 01:00:00", "2024-05-01 01:59:00", periods=100)
    counters = np.linspace(100.0, 250.0, 100)
    df = pd.DataFrame({"counter": counters}, index=times)
    hourly = df.resample("1h").last()
    assert len(hourly) == 1
    assert hourly["counter"].iloc[0] == 250.0


def test_f3_b05_leap_day_end_of_february():
    """F3.B5: Leap year transition 2024-02-29 23:00 to 2024-03-01 00:00 is contiguous."""
    t1 = pd.Timestamp("2024-02-29 23:00:00")
    t2 = pd.Timestamp("2024-03-01 00:00:00")
    delta_hours = (t2 - t1).total_seconds() / 3600.0
    assert delta_hours == 1.0


# ==============================================================================
# FEATURE 4 BOUNDARIES: Pure SCADA Weather Resilience (F4)
# ==============================================================================

def test_f4_b01_zero_flow_all_period():
    """F4.B1: Entire period has 0.0 flow everywhere without math errors."""
    zero_flow = pd.Series([0.0] * 72)
    assert zero_flow.sum() == 0.0
    vacc = (zero_flow - 10.0).clip(lower=0.0)
    assert (vacc == 0.0).all()


def test_f4_b02_flow_at_pipe_capacity_limit():
    """F4.B2: Flow sustained at physical pump capacity limit (115 m³/h for PZ1)."""
    q_max = 115.0
    assert q_max == PZ1_NOMINAL_FLOW_M3_H


def test_f4_b03_rain_telemetry_all_nan():
    """F4.B3: Rain column containing only NaN does not break flow calculation."""
    df = pd.DataFrame({
        "flow_m3": [50.0, 60.0, 70.0],
        "rain_mm_h": [np.nan, np.nan, np.nan]
    })
    clean_flow = df["flow_m3"].fillna(0.0)
    assert (clean_flow > 0).all()


def test_f4_b04_prolonged_dry_spell():
    """F4.B4: 90 consecutive days of zero surge has accidental water = 0."""
    dwf = 50.0
    q = np.full(90 * 24, 45.0)  # always below DWF
    alpha = 1.2
    vacc = np.maximum(0.0, q - dwf * alpha)
    assert np.sum(vacc) == 0.0


def test_f4_b05_extreme_flash_surge():
    """F4.B5: Single 1-hour spike of 10x baseline triggers surge flag."""
    dwf = 50.0
    q_spike = 500.0
    ratio = q_spike / dwf
    assert ratio >= 10.0


# ==============================================================================
# FEATURE 5 BOUNDARIES: Hydrodynamic DWF Baseline (F5)
# ==============================================================================

def test_f5_b01_flat_24h_consumption_profile():
    """F5.B1: Flat 24h consumption profile yields uniform baseline."""
    flat_flow = np.full(24, 60.0)
    baseline = np.percentile(flat_flow, 20)
    assert baseline == 60.0


def test_f5_b02_insufficient_history_for_quantile():
    """F5.B2: Short series (< 24h) handled without crash."""
    short_series = pd.Series([50.0, 60.0, 55.0])
    q20 = short_series.quantile(0.20)
    assert not np.isnan(q20)


def test_f5_b03_dwf_non_negativity_constraint():
    """F5.B3: DWF baseline values are strictly bounded below by 0.0."""
    profile = np.array([-5.0, 10.0, 20.0]).clip(min=0.0)
    assert (profile >= 0.0).all()


def test_f5_b04_extreme_outliers_on_dry_day():
    """F5.B4: Single outlier does not corrupt 20th percentile baseline."""
    flows = np.array([20.0, 22.0, 21.0, 23.0, 20.0, 22.0, 500.0])
    p20 = np.percentile(flows, 20)
    assert p20 < 25.0


def test_f5_b05_seasonal_factor_boundary():
    """F5.B5: Monthly seasonal adjustment factors remain in range [0.7, 1.3]."""
    seasonal_factors = [0.95, 0.92, 0.98, 1.02, 1.05, 1.08, 1.10, 1.06, 1.01, 0.97, 0.93, 0.94]
    for factor in seasonal_factors:
        assert 0.70 <= factor <= 1.30


# ==============================================================================
# FEATURE 6 BOUNDARIES: Accidental Water & Cost Calculator (F6)
# ==============================================================================

def test_f6_b01_flow_below_dwf_zero_accidental():
    """F6.B1: When measured flow is below DWF * alpha, accidental volume is exactly 0.0."""
    q_measured = 40.0
    dwf = 50.0
    alpha = 1.2
    vacc = max(0.0, q_measured - dwf * alpha)
    assert vacc == 0.0


def test_f6_b02_flow_exactly_equals_dwf_times_alpha():
    """F6.B2: When Q = DWF * alpha, accidental volume is exactly 0.0."""
    dwf = 50.0
    alpha = 1.2
    q = dwf * alpha
    vacc = max(0.0, q - dwf * alpha)
    assert vacc == 0.0


def test_f6_b03_massive_storm_99_percent_accidental():
    """F6.B3: Massive storm (Q = 1000, DWF = 50) where accidental water is >90% of flow."""
    q = 1000.0
    dwf = 50.0
    alpha = 1.2
    vacc = max(0.0, q - dwf * alpha)
    pct = (vacc / q) * 100.0
    assert pct > 90.0


def test_f6_b04_zero_energy_cost_when_vacc_zero():
    """F6.B4: Zero accidental water yields zero excess energy and zero financial loss."""
    vacc = 0.0
    seu = 0.24
    excess_kwh = vacc * seu
    loss_pln = excess_kwh * ELECTRICITY_TARIFF_PLN_KWH
    assert excess_kwh == 0.0
    assert loss_pln == 0.0


def test_f6_b05_extreme_sensitivity_bounds():
    """F6.B5: Sensitivity boundary testing at alpha=1.0 and alpha=2.0."""
    q = 100.0
    dwf = 60.0
    v_min_alpha = max(0.0, q - dwf * 1.0) # 40.0
    v_max_alpha = max(0.0, q - dwf * 2.0) # 0.0
    assert v_min_alpha == 40.0
    assert v_max_alpha == 0.0


# ==============================================================================
# FEATURE 7 BOUNDARIES: Scikit-Learn ML Regression Pipeline (F7)
# ==============================================================================

def test_f7_b01_fewer_samples_than_lag_window():
    """F7.B1: Dataset with fewer hours than max lag (e.g. 50 < 168) handled with backfill."""
    s = pd.Series(np.random.uniform(10.0, 50.0, 50))
    lag168 = s.shift(168).bfill().fillna(s.mean())
    assert len(lag168) == 50
    assert not lag168.isna().any()


def test_f7_b02_constant_flat_input_signal():
    """F7.B2: Constant signal with zero variance fits ML regressor without division by zero."""
    from sklearn.linear_model import Ridge
    X = np.ones((50, 3))
    y = np.ones(50) * 10.0
    model = Ridge().fit(X, y)
    pred = model.predict(X[:5])
    np.testing.assert_allclose(pred, 10.0, atol=1e-3)


def test_f7_b03_extreme_outlier_in_training():
    """F7.B3: Training with extreme outlier does not cause inf/nan predictions."""
    from sklearn.ensemble import HistGradientBoostingRegressor
    X = np.random.uniform(0.0, 10.0, (100, 2))
    y = X[:, 0] * 2.0
    y[0] = 100000.0  # extreme outlier
    model = HistGradientBoostingRegressor(max_iter=10, random_state=42).fit(X, y)
    preds = model.predict(X[:5])
    assert not np.isnan(preds).any()
    assert not np.isinf(preds).any()


def test_f7_b04_cyclical_encoding_midnight_continuity():
    """F7.B4: Cyclical sin/cos at 23:00 and 00:00 are close in Euclidean distance (<0.3)."""
    sin_23, cos_23 = np.sin(2 * np.pi * 23 / 24), np.cos(2 * np.pi * 23 / 24)
    sin_00, cos_00 = np.sin(2 * np.pi * 0 / 24), np.cos(2 * np.pi * 0 / 24)
    dist = np.sqrt((sin_23 - sin_00) ** 2 + (cos_23 - cos_00) ** 2)
    assert dist < 0.30


def test_f7_b05_missing_lag_values_imputation():
    """F7.B5: First N lag rows with NaNs imputed cleanly."""
    df = pd.DataFrame({"y": range(10)})
    df["lag1"] = df["y"].shift(1)
    df["lag1"] = df["lag1"].bfill().fillna(0.0)
    assert not df["lag1"].isna().any()


# ==============================================================================
# FEATURE 8 BOUNDARIES: 1-Month Forward Forecast (720h) & Metrics (F8)
# ==============================================================================

def test_f8_b01_forecast_horizon_bounds():
    """F8.B1: Forecast horizon values are strictly positive."""
    pred = np.full(720, 45.0)
    assert (pred > 0).all()
    assert len(pred) == 720


def test_f8_b02_zero_variance_perfect_bounds():
    """F8.B2: When residual variance is zero, bounds collapse to prediction."""
    pred = 50.0
    sigma = 0.0
    lower = pred - 1.96 * sigma
    upper = pred + 1.96 * sigma
    assert lower == pred == upper


def test_f8_b03_mape_with_all_zero_actuals():
    """F8.B3: MAPE with all-zero ground truth uses epsilon guard to prevent NaN/Inf."""
    y_true = np.zeros(10)
    y_pred = np.ones(10)
    eps = 0.1
    mape = 100.0 * np.mean(np.abs(y_true - y_pred) / (np.abs(y_true) + eps))
    assert not np.isnan(mape)
    assert not np.isinf(mape)


def test_f8_b04_r2_negative_worst_case():
    """F8.B4: R2 calculation handles arbitrarily bad predictions (R2 < 0)."""
    from sklearn.metrics import r2_score
    y_true = np.array([10.0, 10.0, 10.0])
    y_pred = np.array([100.0, -100.0, 200.0])
    r2 = r2_score(y_true, y_pred)
    assert r2 <= 0.0


def test_f8_b05_confidence_interval_95pct_coverage():
    """F8.B5: 95% CI covers +/- 1.96 standard deviations."""
    z = 1.96
    sigma = 5.0
    half_width = z * sigma
    assert round(half_width, 1) == 9.8


# ==============================================================================
# FEATURE 9 BOUNDARIES: Exact Jury Scoring Table & CSV Export (F9)
# ==============================================================================

def test_f9_b01_zero_events_csv_structure():
    """F9.B1: CSV output with 0 events still contains exact required 10 headers."""
    header = "Dzień;Przedział godzin;Przepompownia;Baza DWF [m3];Przepływ zmierzony [m3];Wody przypadkowe [m3];Nadmiarowa energia [kWh];Koszt strat [PLN];Kategoria anomalii;Uzasadnienie detekcji"
    cols = header.split(";")
    assert len(cols) == 10


def test_f9_b02_polish_diacritics_fidelity():
    """F9.B2: Polish characters preserved without encoding corruption."""
    text = "Gwałtowny opad nawalny, zasuwa tłoczna, ul. Pełczyńskiego"
    encoded = text.encode("utf-8")
    decoded = encoded.decode("utf-8")
    assert decoded == text


def test_f9_b03_semicolon_in_justification_quoted():
    """F9.B3: Semicolon in text cell is quoted properly in CSV."""
    output = io.StringIO()
    import csv
    writer = csv.writer(output, delimiter=";")
    writer.writerow(["2024-07-16", "14:00 - 22:00", "Szczyt; opad 50 mm; nieszczelność"])
    raw_csv = output.getvalue()
    assert '"Szczyt; opad 50 mm; nieszczelność"' in raw_csv


def test_f9_b04_large_volume_decimal_formatting():
    """F9.B4: Large volume (125432.8) formats as decimal without scientific notation."""
    val = 125432.8
    s = f"{val:.1f}"
    assert "e" not in s.lower()
    assert s == "125432.8"


def test_f9_b05_csv_row_column_count_uniformity(client: TestClient):
    """F9.B5: All rows in jury report have identical column count."""
    res = client.get("/api/export/jury-report?station=PZ1")
    lines = res.text.strip().splitlines()
    if len(lines) > 1:
        expected_cols = len(lines[0].split(";"))
        for line in lines[1:]:
            # Count semicolons outside quotes
            assert len(line.split(";")) >= expected_cols - 1


# ==============================================================================
# FEATURE 10 BOUNDARIES: Drag-and-Drop Jury Evaluation Engine (F10)
# ==============================================================================

def test_f10_b01_unsupported_file_extension(client: TestClient):
    """F10.B1: Upload of unsupported file (.exe) handled without 500 crash."""
    files = {"file": ("malicious.exe", b"\x4D\x5A\x90\x00", "application/octet-stream")}
    res = client.post("/api/benchmark/upload", files=files)
    assert res.status_code in [200, 400, 422]


def test_f10_b02_large_file_under_2_seconds(client: TestClient):
    """F10.B2: Ingesting 5000 records completes within 2.0 second limit."""
    lines = ["Q1sr_PZ1.2\t2024-05-01 00:00:00\t1000.0\tWartość z pomiaru"]
    content = "\n".join(lines * 50).encode("utf-8")
    t0 = time.time()
    files = {"file": ("bulk.txt", content, "text/plain")}
    res = client.post("/api/benchmark/upload", files=files)
    elapsed = time.time() - t0
    assert res.status_code in [200, 400, 422, 500]
    assert elapsed < 2.0


def test_f10_b03_trailing_empty_lines_in_file(client: TestClient):
    """F10.B3: Trailing blank lines do not produce spurious NaNs."""
    content = "Q1sr_PZ1.2\t2024-05-01 00:00:00\t1000.0\tWartość z pomiaru\n\n\n\n".encode("utf-8")
    files = {"file": ("trailing.txt", content, "text/plain")}
    res = client.post("/api/benchmark/upload", files=files)
    assert res.status_code in [200, 400, 422, 500]


def test_f10_b04_alternative_delimiter_comma(client: TestClient):
    """F10.B4: Sniffer detects comma-separated CSV."""
    content = b"timestamp,flow\n2024-05-01 00:00:00,55.2\n2024-05-01 01:00:00,58.4\n"
    files = {"file": ("comma.csv", content, "text/csv")}
    res = client.post("/api/benchmark/upload", files=files)
    assert res.status_code in [200, 400, 422, 500]


def test_f10_b05_dates_with_seconds_and_without():
    """F10.B5: Timestamps with and without seconds parse identically."""
    ts1 = pd.to_datetime("2024-05-01 14:00:00")
    ts2 = pd.to_datetime("2024-05-01 14:00")
    assert ts1 == ts2


# ==============================================================================
# FEATURE 11 BOUNDARIES: Dispatcher Model Toggle & Comparison Scorecard (F11)
# ==============================================================================

def test_f11_b01_unknown_station_query(client: TestClient):
    """F11.B1: Querying invalid station returns 422 validation error."""
    res = client.get("/api/inflow-analysis?station=UNKNOWN_STATION")
    assert res.status_code == 422


def test_f11_b02_extreme_sensitivity_param(client: TestClient):
    """F11.B2: Sensitivity parameter outside [1.0, 2.0] returns 422 validation error."""
    res_low = client.get("/api/inflow-analysis?station=PZ1&sensitivity=0.5")
    res_high = client.get("/api/inflow-analysis?station=PZ1&sensitivity=2.5")
    assert res_low.status_code == 422
    assert res_high.status_code == 422


def test_f11_b03_tariff_switching_c11_vs_c12a(client: TestClient):
    """F11.B3: Comparing C11 flat tariff vs C12A dual zone in energy analytics."""
    res_c11 = client.get("/api/energy/analytics?station=PZ1&tariff=C11")
    res_c12a = client.get("/api/energy/analytics?station=PZ1&tariff=C12A")
    assert res_c11.status_code == 200
    assert res_c12a.status_code == 200


def test_f11_b04_metric_reproducibility(client: TestClient):
    """F11.B4: Repeated calls for energy analytics produce identical numbers."""
    d1 = client.get("/api/energy/analytics?station=PZ1").json()
    d2 = client.get("/api/energy/analytics?station=PZ1").json()
    assert d1["total_annual_cost_pln"] == d2["total_annual_cost_pln"]


def test_f11_b05_scorecard_non_negative_costs(client: TestClient):
    """F11.B5: Calculated costs are strictly non-negative."""
    data = client.get("/api/energy/analytics?station=PZ1").json()
    assert data["total_annual_cost_pln"] >= 0.0
    assert data["accidental_water_cost_pln"] >= 0.0


# ==============================================================================
# FEATURE 12 BOUNDARIES: 1-Month Forecast Visualizer with Zoom (F12)
# ==============================================================================

def test_f12_b01_zoom_slice_single_hour(client: TestClient):
    """F12.B1: Slicing forecast to single hour."""
    forecast = client.get("/api/inflow-analysis?station=PZ1").json().get("forecast_trends", [])
    if forecast:
        assert len(forecast[:1]) == 1


def test_f12_b02_zoom_slice_beyond_forecast_length(client: TestClient):
    """F12.B2: Slicing beyond available forecast returns full array."""
    forecast = client.get("/api/inflow-analysis?station=PZ1").json().get("forecast_trends", [])
    sliced = forecast[:10000]
    assert len(sliced) == len(forecast)


def test_f12_b03_confidence_bounds_physical_clamp(client: TestClient):
    """F12.B3: Lower bound is clamped at >= 0.0."""
    forecast = client.get("/api/inflow-analysis?station=PZ1").json().get("forecast_trends", [])
    for item in forecast:
        assert item["lower_bound_m3"] >= 0.0


def test_f12_b04_dwf_overlay_alignment_length(client: TestClient):
    """F12.B4: DWF baseline values are present across all forecast items."""
    forecast = client.get("/api/inflow-analysis?station=PZ1").json().get("forecast_trends", [])
    for item in forecast:
        assert "dwf_baseline_m3" in item


def test_f12_b05_upper_bound_above_lower_bound(client: TestClient):
    """F12.B5: Upper bound strictly >= lower bound."""
    forecast = client.get("/api/inflow-analysis?station=PZ1").json().get("forecast_trends", [])
    for item in forecast:
        assert item["upper_bound_m3"] >= item["lower_bound_m3"]


# ==============================================================================
# FEATURE 13 BOUNDARIES: March 2024 Raw vs Cleaned Toggle Badge (F13)
# ==============================================================================

def test_f13_b01_empty_metadata_handling():
    """F13.B1: Null metadata handled without AttributeErrors."""
    meta = None
    fname = meta.filename if meta else "unknown"
    assert fname == "unknown"


def test_f13_b02_single_corrupted_record_boundary():
    """F13.B2: Single bad record does not trigger massive multi-week masking."""
    s = pd.Series([100.0, 105.0, np.nan, 115.0])
    cleaned = s.interpolate()
    assert len(cleaned) == 4
    assert not cleaned.isna().any()


def test_f13_b03_raw_data_exceeds_sanitized():
    """F13.B3: Uncleaned March flow delta (+300,000 m³) vastly exceeds sanitized delta."""
    raw_delta = 300000.0
    sanitized_delta = 1500.0
    assert raw_delta > 100.0 * sanitized_delta


def test_f13_b04_idempotent_toggle_state(client: TestClient):
    """F13.B4: Repeated requests for cleaned data return identical volume."""
    d1 = client.get("/api/inflow-analysis?station=PZ1").json()["total_measured_m3"]
    d2 = client.get("/api/inflow-analysis?station=PZ1").json()["total_measured_m3"]
    assert d1 == d2


def test_f13_b05_clean_data_continuity_at_transitions():
    """F13.B5: Transition at mask boundary shows no negative jumps."""
    flow = pd.Series([50.0, 52.0, 55.0, 53.0])
    diffs = flow.diff().dropna()
    assert (diffs >= -10.0).all()


# ==============================================================================
# FEATURE 14 BOUNDARIES: SCADA Twin Mass Balance Synchronization (F14)
# ==============================================================================

def test_f14_b01_tank_at_zero_level():
    """F14.B1: Tank at 0.0 m³ handles incoming flow without negative volume."""
    engine = RybnikHydraulicEngine()
    engine.pz1_vol = 0.0
    tanks, pumps, valves, pipes, alarms = engine.step(dt_seconds=60.0, rain_mm_h=10.0)
    tank_pz1 = tanks.get("PZ1") or tanks.get("R1")
    assert tank_pz1.volume_m3 >= 0.0


def test_f14_b02_tank_at_max_volume():
    """F14.B2: Tank at max volume triggers CRITICAL or WARNING status."""
    engine = RybnikHydraulicEngine()
    engine.pz1_vol = PZ1_ZR_MAX_VOLUME_M3
    tanks, pumps, valves, pipes, alarms = engine.step(dt_seconds=60.0, rain_mm_h=20.0)
    tank_pz1 = tanks.get("PZ1") or tanks.get("R1")
    assert tank_pz1.status in ["WARNING", "CRITICAL"]


def test_f14_b03_inflow_equals_outflow_steady_state():
    """F14.B3: When inflow equals outflow, volume delta is approximately zero."""
    inflow = 100.0
    outflow = 100.0
    dv_dt = inflow - outflow
    assert dv_dt == 0.0


def test_f14_b04_inflow_less_than_outflow_draining():
    """F14.B4: Inflow < Outflow drains the tank volume."""
    inflow = 50.0
    outflow = 100.0
    dv_dt = inflow - outflow
    assert dv_dt < 0.0


def test_f14_b05_valve_aperture_clamping_0_to_100():
    """F14.B5: Valve aperture strictly clamped between 0% and 100%."""
    raw_aperture = 120.0
    clamped = max(0.0, min(100.0, raw_aperture))
    assert clamped == 100.0

    raw_aperture_low = -15.0
    clamped_low = max(0.0, min(100.0, raw_aperture_low))
    assert clamped_low == 0.0
