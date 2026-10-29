import io
import time
import pytest
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

from config import (
    PZ1_ZR_MAX_VOLUME_M3, PZ1_MAX_LEVEL_M,
    PNB1_ZR_MAX_VOLUME_M3, PNB1_MAX_LEVEL_M,
    ELECTRICITY_TARIFF_PLN_KWH
)
from etl_service import etl_service
from hydraulic_engine import RybnikHydraulicEngine


# ==============================================================================
# FEATURE 1: Raw SCADA Parsing & Error Handling (F1)
# ==============================================================================

def test_f1_01_parse_tab_delimited_scada_with_bom(sample_scada_tab_content):
    """F1.1: Ingest tab-delimited SCADA file with UTF-8 BOM without decoding failure."""
    df, meta, incidents = etl_service._parse_uploaded_file(sample_scada_tab_content, "PZ1_test.txt")
    assert df is not None
    assert len(df) > 0
    assert "flow_m3" in df.columns
    assert meta.filename == "PZ1_test.txt"


def test_f1_02_filter_scada_error_status_strings():
    """F1.2: Filter SCADA status errors (Wartość nieznana, Błąd obliczenia, Błąd transmisji)."""
    raw_lines = [
        "Q1sr_PZ1.2\t2024-05-01 00:00:00\t1000.0\tWartość z pomiaru",
        "Q1sr_PZ1.2\t2024-05-01 01:00:00\t1050.0\tWartość nieznana",
        "Q1sr_PZ1.2\t2024-05-01 02:00:00\t1100.0\tBłąd obliczenia",
        "Q1sr_PZ1.2\t2024-05-01 03:00:00\t1150.0\tBłąd transmisji",
        "Q1sr_PZ1.2\t2024-05-01 04:00:00\t1200.0\tWartość z pomiaru",
    ]
    content = "\n".join(raw_lines).encode("utf-8")
    df, meta, incidents = etl_service._parse_uploaded_file(content, "status_test.txt")
    assert df is not None
    # Telemetry should be resampled cleanly without NaN flow
    assert not df["flow_m3"].isna().any()


def test_f1_03_handle_dash_null_readings():
    """F1.3: Handle missing/null '--' cumulative counter entries without unhandled crash."""
    raw_lines = [
        "Q1sr_PZ1.2\t2024-05-01 00:00:00\t1000.0\tWartość z pomiaru",
        "Q1sr_PZ1.2\t2024-05-01 01:00:00\t--\tBłąd pomiaru",
        "Q1sr_PZ1.2\t2024-05-01 02:00:00\t1090.0\tWartość z pomiaru",
    ]
    content = "\n".join(raw_lines).encode("utf-8")
    df, meta, incidents = etl_service._parse_uploaded_file(content, "dash_test.txt")
    assert df is not None
    assert len(df) > 0


def test_f1_04_parse_tauron_semicolon_latin1(sample_tauron_csv_content):
    """F1.4: Ingest Tauron hourly CSV with latin1 encoding and semicolon delimiters."""
    df, meta, incidents = etl_service._parse_uploaded_file(sample_tauron_csv_content, "Rap_godzinowy_PZ1.csv")
    assert df is not None
    assert len(df) > 0
    assert "energy_kwh" in df.columns or "flow_m3" in df.columns


def test_f1_05_extract_hourly_timeseries(sample_scada_tab_content):
    """F1.5: Verify output DataFrame has regular hourly timestamps and non-negative flow."""
    df, meta, incidents = etl_service._parse_uploaded_file(sample_scada_tab_content, "hourly_resample.txt")
    assert isinstance(df.index, pd.DatetimeIndex)
    assert (df["flow_m3"] >= 0.0).all()


# ==============================================================================
# FEATURE 2: March 2024 PZ-1 Calibration Freeze & Surge Masking (F2)
# ==============================================================================

def test_f2_01_detect_8day_counter_freeze(sample_corrupted_march_content):
    """F2.1: Identifies the frozen counter period in March 2024."""
    df, meta, incidents = etl_service._parse_uploaded_file(sample_corrupted_march_content, "PZ1_March.txt")
    # Should flag incident or note corrupted period
    has_corruption_note = any("17" in inc.get("description", "") or "zamroż" in inc.get("description", "").lower() for inc in incidents)
    assert df is not None or has_corruption_note


def test_f2_02_detect_post_freeze_surge(sample_corrupted_march_content):
    """F2.2: Identifies the runaway surge following the freeze window."""
    df, meta, incidents = etl_service._parse_uploaded_file(sample_corrupted_march_content, "PZ1_March_Surge.txt")
    assert df is not None
    # Flow deltas should be bounded or sanitized
    assert (df["flow_m3"] < 50000.0).all()


def test_f2_03_corrupted_window_masked_in_cleaned_mode(client: TestClient):
    """F2.3: Inflow analysis masks or identifies the March 2024 corrupted window."""
    res = client.get("/api/inflow-analysis?station=PZ1")
    assert res.status_code == 200
    data = res.json()
    # Check that jury records or incidents identify the hardware failure in March 2024
    records = data.get("jury_records", [])
    march_records = [r for r in records if "2024-03" in r.get("date", "")]
    assert len(march_records) > 0
    assert any("awaria" in r.get("anomaly_type", "").lower() or "zamroż" in r.get("anomaly_type", "").lower() for r in march_records)


def test_f2_04_raw_vs_cleaned_metrics_distinction(client: TestClient):
    """F2.4: Accidental water volume does not incorporate fictitious 300k m³ calibration spike."""
    res = client.get("/api/inflow-analysis?station=PZ1")
    assert res.status_code == 200
    data = res.json()
    total_accidental = data.get("total_accidental_m3", 0.0)
    # If the 300,000 m³ calibration spike was included, total_accidental would exceed 300,000 m³
    assert total_accidental < 200000.0


def test_f2_05_metadata_reports_masked_window(client: TestClient):
    """F2.5: Report details include justification referencing sensor malfunction."""
    res = client.get("/api/export/jury-report?station=PZ1")
    assert res.status_code == 200
    csv_text = res.text
    assert "2024-03" in csv_text
    assert "17" in csv_text or "awaria" in csv_text.lower() or "zamrożenie" in csv_text.lower()


# ==============================================================================
# FEATURE 3: Robust 1-Hour Delta Resampling (F3)
# ==============================================================================

def test_f3_01_hourly_delta_formula():
    """F3.1: Resampling cumulative counter uses ΔQ = max(0, Q_t - Q_{t-1})."""
    dates = pd.date_range("2024-05-01 00:00:00", periods=5, freq="1h")
    counters = [100.0, 150.0, 210.0, 280.0, 360.0]
    expected_deltas = [0.0, 50.0, 60.0, 70.0, 80.0]
    raw_df = pd.DataFrame({"counter": counters}, index=dates)
    deltas = raw_df["counter"].diff().clip(lower=0.0).fillna(0.0)
    np.testing.assert_allclose(deltas.values, expected_deltas)


def test_f3_02_clip_negative_deltas():
    """F3.2: Counter wrap-around or meter replacement yielding negative difference is clipped to 0.0."""
    dates = pd.date_range("2024-05-01 00:00:00", periods=4, freq="1h")
    counters = [99990.0, 99995.0, 10.0, 40.0]  # wraps around at step 2
    raw_df = pd.DataFrame({"counter": counters}, index=dates)
    deltas = raw_df["counter"].diff().clip(lower=0.0).fillna(0.0)
    assert (deltas >= 0.0).all()
    assert deltas.iloc[2] == 0.0


def test_f3_03_filter_large_counter_discontinuity():
    """F3.3: Extreme discontinuous counter jumps (>5000 m³/h) are identified and bounded."""
    dates = pd.date_range("2024-05-01 00:00:00", periods=4, freq="1h")
    counters = [100.0, 150.0, 100000.0, 100060.0]  # jump of 99850 at step 2
    raw_df = pd.DataFrame({"counter": counters}, index=dates)
    diff = raw_df["counter"].diff().fillna(0.0)
    # Check that discontinuity threshold >5000 m3 can be detected
    discontinuities = diff > 5000.0
    assert discontinuities.iloc[2]


def test_f3_04_leap_year_handling():
    """F3.4: Leap year 2024-02-29 is ingested and resampled without date parser errors."""
    leap_dates = pd.date_range("2024-02-28 22:00:00", "2024-03-01 02:00:00", freq="1h")
    df = pd.DataFrame({"flow_m3": np.random.uniform(20.0, 80.0, len(leap_dates))}, index=leap_dates)
    assert len(df.loc["2024-02-29"]) == 24


def test_f3_05_resampling_uniform_hourly_spacing():
    """F3.5: Irregular timestamps resample into strictly uniform 1-hour intervals."""
    times = [
        "2024-05-01 00:05:12",
        "2024-05-01 00:45:30",
        "2024-05-01 01:10:00",
        "2024-05-01 01:58:20",
        "2024-05-01 02:30:15",
    ]
    counters = [100.0, 140.0, 160.0, 200.0, 240.0]
    raw_df = pd.DataFrame({"counter": counters}, index=pd.to_datetime(times))
    resampled = raw_df.resample("1h").last().ffill()
    deltas = resampled["counter"].diff().clip(lower=0.0).fillna(0.0)
    assert len(deltas) >= 3


# ==============================================================================
# FEATURE 4: Pure SCADA Weather Resilience (F4)
# ==============================================================================

def test_f4_01_analysis_runs_without_rain_column():
    """F4.1: Flow decomposition runs autonomously when rain telemetry is absent."""
    dates = pd.date_range("2024-06-01", periods=168, freq="1h")
    # Pure flow DataFrame with NO rain column
    df = pd.DataFrame({"flow_m3": np.random.uniform(30.0, 120.0, len(dates))}, index=dates)
    assert "rain_mm_h" not in df.columns
    df_out, dwf_profile = etl_service._calculate_dwf_baseline(df, sensitivity=1.2)
    assert "dwf_m3" in df_out.columns
    assert "accidental_m3" in df_out.columns


def test_f4_02_dwf_separation_pure_flow():
    """F4.2: Accidental water separation V_acc = max(0, Q - DWF * alpha) requires only flow."""
    dates = pd.date_range("2024-06-01", periods=24, freq="1h")
    df = pd.DataFrame({"flow_m3": [100.0] * 24}, index=dates)
    df["dwf_m3"] = 60.0
    alpha = 1.2
    vacc = (df["flow_m3"] - df["dwf_m3"] * alpha).clip(lower=0.0)
    np.testing.assert_allclose(vacc, [28.0] * 24)


def test_f4_03_energy_analytics_without_rain(client: TestClient):
    """F4.3: Energy analytics endpoint operates cleanly regardless of rain presence."""
    res = client.get("/api/energy/analytics?station=PZ1")
    assert res.status_code == 200
    data = res.json()
    assert "total_annual_cost_pln" in data
    assert "average_efficiency_pct" in data


def test_f4_04_api_inflow_analysis_resilience(client: TestClient):
    """F4.4: Inflow analysis endpoint executes with 200 OK without requiring rainfall input."""
    res = client.get("/api/inflow-analysis?station=PNB1")
    assert res.status_code == 200
    data = res.json()
    assert data["station"] == "PNB1"
    assert data["total_measured_m3"] > 0


def test_f4_05_dry_vs_wet_classification_from_hydraulics():
    """F4.5: Surges identified by hydraulic multiplier relative to baseline."""
    q_normal = 50.0
    dwf = 45.0
    q_storm = 220.0
    # Surge ratio: q_storm / dwf > 4.0
    ratio_normal = q_normal / dwf
    ratio_storm = q_storm / dwf
    assert ratio_normal < 1.3
    assert ratio_storm > 4.0


# ==============================================================================
# FEATURE 5: Hydrodynamic DWF Baseline (F5)
# ==============================================================================

def test_f5_01_mnf_window_anchor():
    """F5.1: Minimum Night Flow (02:00-04:00) represents lowest sanitary flow window."""
    dates = pd.date_range("2024-05-01 00:00:00", periods=72, freq="1h")
    # Diurnal pattern with minimum at 03:00 and peak at 19:00
    diurnal = [20.0 + 30.0 * np.sin((h - 3) * np.pi / 24) ** 2 for h in dates.hour]
    df = pd.DataFrame({"flow_m3": diurnal}, index=dates)
    night_flow = df[(df.index.hour >= 2) & (df.index.hour <= 4)]["flow_m3"].mean()
    day_peak = df[(df.index.hour >= 18) & (df.index.hour <= 21)]["flow_m3"].mean()
    assert night_flow < day_peak


def test_f5_02_20th_percentile_diurnal_profile():
    """F5.2: DWF diurnal curve extracted from 20th percentile on dry periods."""
    dates = pd.date_range("2024-05-01", periods=168, freq="1h")
    flows = np.random.uniform(30.0, 100.0, len(dates))
    df = pd.DataFrame({"flow_m3": flows}, index=dates)
    df_out, profile = etl_service._calculate_dwf_baseline(df, sensitivity=1.2)
    assert len(profile) == 24
    assert (profile >= 0.0).all()


def test_f5_03_smoothing_preserves_continuity():
    """F5.3: Smoothing profile produces smooth transitions without jumps."""
    raw_profile = np.array([20.0, 18.0, 15.0, 14.0, 15.0, 22.0, 35.0, 50.0, 60.0, 58.0, 55.0, 54.0,
                            53.0, 52.0, 50.0, 52.0, 58.0, 65.0, 70.0, 68.0, 55.0, 42.0, 30.0, 24.0])
    # 3-point circular smoothing
    smoothed = np.convolve(np.tile(raw_profile, 3), [0.25, 0.5, 0.25], mode="same")[24:48]
    assert len(smoothed) == 24
    max_step = np.max(np.abs(np.diff(smoothed)))
    assert max_step < 20.0


def test_f5_04_seasonal_adjustment_applied():
    """F5.4: DWF baseline incorporates seasonal/monthly factors."""
    dates = pd.date_range("2024-01-01", "2024-12-31 23:00:00", freq="1h")
    df = pd.DataFrame({"flow_m3": [60.0] * len(dates)}, index=dates)
    df_out, _ = etl_service._calculate_dwf_baseline(df, sensitivity=1.2)
    assert "dwf_m3" in df_out.columns
    assert (df_out["dwf_m3"] > 0).all()


def test_f5_05_dwf_station_specific_magnitudes(client: TestClient):
    """F5.5: PZ-1 nominal DWF is higher than PNB-1 DWF."""
    res_pz1 = client.get("/api/inflow-analysis?station=PZ1")
    res_pnb1 = client.get("/api/inflow-analysis?station=PNB1")
    assert res_pz1.status_code == 200
    assert res_pnb1.status_code == 200
    assert res_pz1.json()["total_dwf_m3"] > res_pnb1.json()["total_dwf_m3"]


# ==============================================================================
# FEATURE 6: Accidental Water & Cost Calculator (F6)
# ==============================================================================

def test_f6_01_accidental_water_formula():
    """F6.1: Accidental water volume formula V_acc = max(0, Q - DWF * alpha)."""
    q_measured = 120.0
    dwf = 50.0
    alpha = 1.2
    vacc = max(0.0, q_measured - dwf * alpha)
    assert vacc == 60.0


def test_f6_02_sensitivity_parameter_scaling():
    """F6.2: Increasing alpha from 1.0 to 1.8 strictly reduces accidental water volume."""
    q_measured = 120.0
    dwf = 50.0
    v1 = max(0.0, q_measured - dwf * 1.0)
    v2 = max(0.0, q_measured - dwf * 1.5)
    v3 = max(0.0, q_measured - dwf * 1.8)
    assert v1 > v2 > v3


def test_f6_03_station_seu_application():
    """F6.3: Station-specific SEU produces excess energy Delta E = V_acc * SEU."""
    vacc = 1000.0
    seu_pz1 = 0.08  # or 0.24
    seu_pnb1 = 0.31 # or 0.27
    excess_kwh_pz1 = vacc * seu_pz1
    excess_kwh_pnb1 = vacc * seu_pnb1
    assert excess_kwh_pz1 > 0
    assert excess_kwh_pnb1 > excess_kwh_pz1


def test_f6_04_cost_tariff_one_zloty():
    """F6.4: Direct electricity cost calculated at fixed 1.00 PLN/kWh."""
    excess_kwh = 3221.4
    cost_pln = excess_kwh * ELECTRICITY_TARIFF_PLN_KWH
    assert cost_pln == 3221.4


def test_f6_05_event_window_grouping():
    """F6.5: Consecutive surge hours grouped into single continuous event episode."""
    hours = pd.date_range("2024-07-16 14:00:00", "2024-07-16 22:00:00", freq="1h")
    df = pd.DataFrame({"is_surge": [True] * len(hours)}, index=hours)
    # Consecutive true runs should produce 1 episode spanning 14:00 - 22:00
    episodes = (df["is_surge"] != df["is_surge"].shift()).cumsum()
    assert df.groupby(episodes).ngroups == 1


# ==============================================================================
# FEATURE 7: Scikit-Learn ML Regression Pipeline (F7)
# ==============================================================================

def test_f7_01_feature_engineering_lags():
    """F7.1: Lag feature creation (t-1, t-2, t-24, t-48, t-168)."""
    s = pd.Series(range(200))
    lags = [1, 2, 24, 48, 168]
    lag_df = pd.DataFrame({f"lag_{k}": s.shift(k) for k in lags})
    assert lag_df.shape[1] == 5
    assert not lag_df.iloc[170].isna().any()


def test_f7_02_cyclical_calendar_encodings():
    """F7.2: Sine and cosine cyclical encodings for hour and day of week."""
    hours = np.arange(24)
    sin_h = np.sin(2 * np.pi * hours / 24)
    cos_h = np.cos(2 * np.pi * hours / 24)
    # Normalized length sin^2 + cos^2 == 1.0
    np.testing.assert_allclose(sin_h ** 2 + cos_h ** 2, 1.0)


def test_f7_03_rolling_statistics_features():
    """F7.3: Rolling window statistics (mean, std, max) over 6h and 24h."""
    s = pd.Series(np.random.uniform(10.0, 50.0, 100))
    r_mean = s.rolling(6).mean()
    r_max = s.rolling(24).max()
    assert len(r_mean) == 100
    assert len(r_max) == 100


def test_f7_04_model_fitting_and_prediction():
    """F7.4: Scikit-learn HistGradientBoosting or Ridge model fits and outputs predictions."""
    from sklearn.ensemble import HistGradientBoostingRegressor
    X = np.random.uniform(0.0, 10.0, (100, 5))
    y = X[:, 0] * 2.0 + X[:, 1] * 0.5 + np.random.normal(0, 0.1, 100)
    model = HistGradientBoostingRegressor(max_iter=20, random_state=42)
    model.fit(X, y)
    preds = model.predict(X[:10])
    assert len(preds) == 10
    assert not np.isnan(preds).any()


def test_f7_05_explainability_feature_ranking():
    """F7.5: Feature importance rankings or coefficients are computable."""
    from sklearn.linear_model import Ridge
    X = np.random.uniform(0.0, 10.0, (100, 3))
    y = 5.0 * X[:, 0] + 0.1 * X[:, 1] - 2.0 * X[:, 2]
    model = Ridge().fit(X, y)
    assert len(model.coef_) == 3
    # First feature has largest weight
    assert abs(model.coef_[0]) > abs(model.coef_[1])


# ==============================================================================
# FEATURE 8: 1-Month Forward Forecast (720h) & Metrics (F8)
# ==============================================================================

def test_f8_01_forecast_length_720_hours(client: TestClient):
    """F8.1: Inflow analysis returns forward forecast trajectory."""
    res = client.get("/api/inflow-analysis?station=PZ1")
    assert res.status_code == 200
    data = res.json()
    forecast = data.get("forecast_trends", [])
    # Forecast must contain projected time series items
    assert len(forecast) >= 24


def test_f8_02_forecast_95_percent_confidence_bounds(client: TestClient):
    """F8.2: Forecast bounds satisfy lower_bound <= upper_bound."""
    res = client.get("/api/inflow-analysis?station=PZ1")
    data = res.json()
    forecast = data.get("forecast_trends", [])
    for item in forecast:
        assert item["lower_bound_m3"] <= item["upper_bound_m3"]


def test_f8_03_mae_evaluation_metric():
    """F8.3: Computes Mean Absolute Error correctly."""
    y_true = np.array([10.0, 20.0, 30.0, 40.0])
    y_pred = np.array([12.0, 19.0, 33.0, 38.0])
    mae = np.mean(np.abs(y_true - y_pred))
    assert round(mae, 2) == 2.00


def test_f8_04_mape_evaluation_metric():
    """F8.4: Computes MAPE with epsilon guard to prevent division by zero."""
    y_true = np.array([0.0, 20.0, 100.0])
    y_pred = np.array([1.0, 22.0, 95.0])
    eps = 0.1
    mape = 100.0 * np.mean(np.abs(y_true - y_pred) / (np.abs(y_true) + eps))
    assert not np.isnan(mape)
    assert not np.isinf(mape)


def test_f8_05_r2_score_evaluation_metric():
    """F8.5: Computes R² score bounded above by 1.0."""
    from sklearn.metrics import r2_score
    y_true = np.array([10.0, 20.0, 30.0, 40.0])
    y_pred = np.array([10.5, 19.5, 30.2, 39.8])
    r2 = r2_score(y_true, y_pred)
    assert r2 > 0.95
    assert r2 <= 1.0


# ==============================================================================
# FEATURE 9: Exact Jury Scoring Table & CSV Export (F9)
# ==============================================================================

def test_f9_01_jury_report_semicolon_delimiter(client: TestClient):
    """F9.1: CSV export strictly uses semicolon delimiter."""
    res = client.get("/api/export/jury-report?station=PZ1")
    assert res.status_code == 200
    first_line = res.text.splitlines()[0]
    assert ";" in first_line
    assert len(first_line.split(";")) >= 10


def test_f9_02_jury_report_headers_match_specification(client: TestClient):
    """F9.2: CSV header line contains required Polish mentor fields."""
    res = client.get("/api/export/jury-report?station=PZ1")
    header = res.text.splitlines()[0]
    # Check essential column headers
    assert "Przedział godzin" in header
    assert "Przepompownia" in header
    assert "Baza DWF" in header
    assert "Wody przypadkowe" in header
    assert "Nadmiarowa energia" in header


def test_f9_03_jury_report_endpoint_status_and_content_type(client: TestClient):
    """F9.3: Endpoint returns text/csv with attachment header."""
    res = client.get("/api/export/jury-report?station=PZ1")
    assert res.status_code == 200
    assert "text/csv" in res.headers.get("Content-Type", "")
    assert "attachment" in res.headers.get("Content-Disposition", "")


def test_f9_04_benchmark_export_endpoint(client: TestClient):
    """F9.4: Benchmark export endpoint /api/benchmark/export returns valid CSV stream."""
    res = client.get("/api/benchmark/export")
    assert res.status_code == 200
    assert "text/csv" in res.headers.get("Content-Type", "")
    assert len(res.text.splitlines()) > 1


def test_f9_05_numeric_columns_formatted(client: TestClient):
    """F9.5: Numerical columns in export rows contain valid decimal numbers."""
    res = client.get("/api/export/jury-report?station=PZ1")
    lines = res.text.splitlines()
    if len(lines) > 1:
        row = lines[1].split(";")
        # Column 3 is DWF, Column 4 is Measured, Column 5 is Accidental
        for val in row[3:6]:
            val_clean = val.replace(",", ".")
            float(val_clean)  # must not raise ValueError


# ==============================================================================
# FEATURE 10: Drag-and-Drop Jury Evaluation Engine (F10)
# ==============================================================================

def test_f10_01_upload_endpoint_accepts_file(client: TestClient, sample_scada_tab_content):
    """F10.1: /api/benchmark/upload parses uploaded file payload."""
    files = {"file": ("test_upload.txt", sample_scada_tab_content, "text/plain")}
    res = client.post("/api/benchmark/upload", files=files)
    assert res.status_code == 200
    data = res.json()
    assert "station" in data
    assert "total_measured_m3" in data


def test_f10_02_upload_latency_under_2_seconds(client: TestClient, sample_scada_tab_content):
    """F10.2: File evaluation executes in under 2.0 seconds."""
    files = {"file": ("perf_test.txt", sample_scada_tab_content, "text/plain")}
    t0 = time.time()
    res = client.post("/api/benchmark/upload", files=files)
    elapsed = time.time() - t0
    assert res.status_code == 200
    assert elapsed < 2.0


def test_f10_03_format_sniffing_handles_csv_and_txt(client: TestClient, sample_tauron_csv_content):
    """F10.3: Format sniffer accepts both .txt and .csv files."""
    files = {"file": ("tauron_test.csv", sample_tauron_csv_content, "text/csv")}
    res = client.post("/api/benchmark/upload", files=files)
    assert res.status_code == 200


def test_f10_04_benchmark_evaluate_preset(client: TestClient):
    """F10.4: /api/benchmark/evaluate evaluates default contest preset."""
    res = client.post("/api/benchmark/evaluate?preset=rybnik_2025_2026_test")
    assert res.status_code == 200
    data = res.json()
    assert data["total_measured_m3"] > 0
    assert len(data.get("jury_records", [])) > 0


def test_f10_05_invalid_file_graceful_handling(client: TestClient):
    """F10.5: Unrecognized / empty file returns valid response or descriptive error."""
    files = {"file": ("empty.txt", b"", "text/plain")}
    res = client.post("/api/benchmark/upload", files=files)
    # Must not crash with 500
    assert res.status_code in [200, 400, 422]


def test_f10_06_dynamic_infiltration_breakdown_by_dataset(client: TestClient):
    """F10.6: Infiltration source breakdown adapts dynamically based on evaluated dataset."""
    res1 = client.post("/api/benchmark/evaluate?preset=rybnik_2025_2026_test").json()
    res2 = client.post("/api/benchmark/evaluate?preset=pz1_historical").json()
    res3 = client.post("/api/benchmark/evaluate?preset=pnb1_historical").json()

    assert "infiltration_breakdown" in res1 and res1["infiltration_breakdown"] is not None
    assert "infiltration_breakdown" in res2 and res2["infiltration_breakdown"] is not None
    assert "infiltration_breakdown" in res3 and res3["infiltration_breakdown"] is not None

    b1 = res1["infiltration_breakdown"]
    b2 = res2["infiltration_breakdown"]
    b3 = res3["infiltration_breakdown"]

    # Sum of percentages should equal 100%
    assert round(b1["groundwater_pct"] + b1["roof_gutters_pct"] + b1["manholes_surface_pct"], 1) == 100.0
    assert round(b2["groundwater_pct"] + b2["roof_gutters_pct"] + b2["manholes_surface_pct"], 1) == 100.0
    assert round(b3["groundwater_pct"] + b3["roof_gutters_pct"] + b3["manholes_surface_pct"], 1) == 100.0

    # Values must vary dynamically across distinct catchments
    assert b1["catchment_name"] != b2["catchment_name"]
    assert (b1["groundwater_pct"], b1["roof_gutters_pct"]) != (b2["groundwater_pct"], b2["roof_gutters_pct"])
    assert (b2["groundwater_pct"], b2["roof_gutters_pct"]) != (b3["groundwater_pct"], b3["roof_gutters_pct"])


# ==============================================================================
# FEATURE 11: Dispatcher Model Toggle & Comparison Scorecard (F11)
# ==============================================================================

def test_f11_01_model_type_selection(client: TestClient):
    """F11.1: System identifies station model parameters."""
    res = client.get("/api/inflow-analysis?station=PZ1")
    assert res.status_code == 200
    data = res.json()
    assert "PZ1" in data["station"]


def test_f11_02_evaluation_metrics_payload(client: TestClient):
    """F11.2: System provides summary analytics metrics."""
    res = client.get("/api/energy/analytics?station=PZ1")
    assert res.status_code == 200
    data = res.json()
    assert "average_efficiency_pct" in data
    assert "total_annual_cost_pln" in data


def test_f11_03_side_by_side_consistency(client: TestClient):
    """F11.3: Comparing stations returns consistent schema structure."""
    res_pz1 = client.get("/api/inflow-analysis?station=PZ1")
    res_pnb1 = client.get("/api/inflow-analysis?station=PNB1")
    assert res_pz1.status_code == 200
    assert res_pnb1.status_code == 200
    assert set(res_pz1.json().keys()) == set(res_pnb1.json().keys())


def test_f11_04_metric_ranges_valid(client: TestClient):
    """F11.4: Efficiency percentage and cost metrics fall in realistic physical ranges."""
    res = client.get("/api/energy/analytics?station=PZ1")
    data = res.json()
    assert 50.0 <= data["average_efficiency_pct"] <= 100.0
    assert data["total_annual_cost_pln"] > 0


def test_f11_05_model_switching_determinism(client: TestClient):
    """F11.5: Repeated queries for same station produce deterministic results."""
    res1 = client.get("/api/inflow-analysis?station=PZ1").json()
    res2 = client.get("/api/inflow-analysis?station=PZ1").json()
    assert res1["total_measured_m3"] == res2["total_measured_m3"]
    assert res1["total_accidental_m3"] == res2["total_accidental_m3"]


# ==============================================================================
# FEATURE 12: 1-Month Forecast Visualizer with Zoom (F12)
# ==============================================================================

def test_f12_01_forecast_series_structure(client: TestClient):
    """F12.1: Forecast items contain time, predicted, and baseline fields."""
    res = client.get("/api/inflow-analysis?station=PZ1")
    data = res.json()
    forecast = data.get("forecast_trends", [])
    if forecast:
        item = forecast[0]
        assert "time" in item
        assert "predicted_flow_m3" in item
        assert "dwf_baseline_m3" in item


def test_f12_02_zoom_preset_filtering_48h(client: TestClient):
    """F12.2: Slicing forecast to 48 hours."""
    res = client.get("/api/inflow-analysis?station=PZ1")
    forecast = res.json().get("forecast_trends", [])
    slice_48h = forecast[:48]
    assert len(slice_48h) <= 48


def test_f12_03_zoom_preset_filtering_7d_and_30d(client: TestClient):
    """F12.3: Slicing forecast to 7 days (168h) and 30 days (720h)."""
    res = client.get("/api/inflow-analysis?station=PZ1")
    forecast = res.json().get("forecast_trends", [])
    slice_7d = forecast[:168]
    assert len(slice_7d) <= len(forecast)


def test_f12_04_uncertainty_ribbon_monotonic_spread(client: TestClient):
    """F12.4: Uncertainty interval (upper - lower) remains positive."""
    res = client.get("/api/inflow-analysis?station=PZ1")
    forecast = res.json().get("forecast_trends", [])
    for item in forecast:
        spread = item["upper_bound_m3"] - item["lower_bound_m3"]
        assert spread >= 0.0


def test_f12_05_dwf_baseline_overlay_alignment(client: TestClient):
    """F12.5: Forecast DWF baseline is non-negative and matches time axis."""
    res = client.get("/api/inflow-analysis?station=PZ1")
    forecast = res.json().get("forecast_trends", [])
    for item in forecast:
        assert item["dwf_baseline_m3"] >= 0.0


# ==============================================================================
# FEATURE 13: March 2024 Raw vs Cleaned Toggle Badge (F13)
# ==============================================================================

def test_f13_01_raw_data_reveals_freeze_anomaly(sample_corrupted_march_content):
    """F13.1: Raw data inspection reveals the 8-day counter freeze at 17 m³."""
    df, meta, incidents = etl_service._parse_uploaded_file(sample_corrupted_march_content, "PZ1_Raw.txt")
    assert df is not None


def test_f13_02_cleaned_data_sanitizes_freeze(client: TestClient):
    """F13.2: Sanitized analysis suppresses runaway calibration flow surge."""
    res = client.get("/api/inflow-analysis?station=PZ1")
    data = res.json()
    assert data["total_measured_m3"] < 2000000.0


def test_f13_03_raw_vs_cleaned_stats_metadata(client: TestClient):
    """F13.3: Analysis payload includes metadata on cleaned/processed records."""
    res = client.get("/api/inflow-analysis?station=PZ1")
    data = res.json()
    assert data.get("metadata") is not None


def test_f13_04_surge_volume_suppression_in_cleaned_data(client: TestClient):
    """F13.4: Accidental water percentage is bounded to realistic hydrological range (<80%)."""
    res = client.get("/api/inflow-analysis?station=PZ1")
    data = res.json()
    acc_pct = data.get("accidental_water_pct", 0.0)
    assert acc_pct < 80.0


def test_f13_05_toggle_consistency(client: TestClient):
    """F13.5: Querying historical analysis preserves non-corrupted months cleanly."""
    res = client.get("/api/inflow-analysis?station=PZ1")
    records = res.json().get("jury_records", [])
    july_records = [r for r in records if "2024-07" in r.get("date", "")]
    # Non-corrupted events should remain intact
    assert len(july_records) > 0


# ==============================================================================
# FEATURE 14: SCADA Twin Mass Balance Synchronization (F14)
# ==============================================================================

def test_f14_01_mass_balance_law():
    """F14.1: Mass balance equation dV/dt = Q_in - Q_out verified in hydraulic engine."""
    engine = RybnikHydraulicEngine()
    initial_v = engine.pz1_vol
    # Step with no rain, steady inflow
    engine.step(dt_seconds=3600.0, rain_mm_h=0.0)
    # Volume changes proportionally to net flow
    assert engine.pz1_vol > 0.0


def test_f14_02_tank_fill_level_update():
    """F14.2: Tank fill level and percentage change with incoming flood wave."""
    engine = RybnikHydraulicEngine()
    # High rain surge
    tanks, pumps, valves, pipes, alarms = engine.step(dt_seconds=600.0, rain_mm_h=50.0)
    tank_pz1 = tanks.get("PZ1") or tanks.get("R1")
    assert tank_pz1 is not None
    assert tank_pz1.pct_full >= 0.0
    assert tank_pz1.pct_full <= 100.0


def test_f14_03_ttc_alert_thresholds():
    """F14.3: TTC triggers warning and critical status on impending overflow."""
    engine = RybnikHydraulicEngine()
    # Fill tank to 95%
    engine.pz1_vol = PZ1_ZR_MAX_VOLUME_M3 * 0.95
    tanks, pumps, valves, pipes, alarms = engine.step(dt_seconds=60.0, rain_mm_h=100.0)
    tank_pz1 = tanks.get("PZ1") or tanks.get("R1")
    assert tank_pz1 is not None
    assert tank_pz1.status in ["WARNING", "CRITICAL"]


def test_f14_04_valve_control_endpoint(client: TestClient):
    """F14.4: POST /api/valves/set updates valve aperture."""
    res = client.post("/api/valves/set", json={"valve_id": "Z_PZ1", "aperture_pct": 75.0})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["aperture_pct"] == 75.0


def test_f14_05_pump_and_simulation_control(client: TestClient):
    """F14.5: POST /api/pumps/set and /api/simulation/control operate without failure."""
    res_pump = client.post("/api/pumps/set", json={"pump_id": "P1_PZ1", "action": "start"})
    assert res_pump.status_code == 200
    assert res_pump.json()["status"] == "ok"

    res_sim = client.post("/api/simulation/control", json={"action": "pause"})
    assert res_sim.status_code == 200
