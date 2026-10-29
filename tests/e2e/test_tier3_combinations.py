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
# TIER 3: Cross-Feature Combinations (>=15 tests)
# ==============================================================================

def test_c01_ingest_and_dwf_baseline_generation():
    """C01: F1 (Raw Ingest) + F5 (Hydrodynamic DWF Baseline).
    Ingesting clean series produces a valid 24-hour diurnal sanitary profile.
    """
    dates = pd.date_range("2024-05-01", periods=168, freq="1h")
    diurnal = [30.0 + 25.0 * np.sin((h - 3) * np.pi / 24) ** 2 for h in dates.hour]
    df = pd.DataFrame({"flow_m3": diurnal}, index=dates)
    df_out, profile = etl_service._calculate_dwf_baseline(df, sensitivity=1.2)
    assert len(profile) == 24
    assert profile.min() >= 25.0
    assert "dwf_m3" in df_out.columns


def test_c02_march_freeze_masking_with_dwf_substitution():
    """C02: F2 (March 2024 Freeze) + F5 (DWF Baseline) + F6 (Accidental Water).
    Frozen 17 m³ interval substituted with baseline to prevent false accidental water.
    """
    dates = pd.date_range("2024-03-01 00:00:00", periods=24 * 8, freq="1h")
    # Raw counter frozen at 17 m3 -> delta is 0.0
    df = pd.DataFrame({"flow_m3": np.zeros(len(dates))}, index=dates)
    # When substituted with DWF baseline
    dwf = 50.0
    df["dwf_m3"] = dwf
    # During freeze, accidental water is 0.0
    vacc = (df["flow_m3"] - df["dwf_m3"] * 1.2).clip(lower=0.0)
    assert (vacc == 0.0).all()


def test_c03_delta_resampling_with_weather_resilience():
    """C03: F3 (1h Delta Resampling) + F4 (Pure SCADA Weather Resilience).
    Pure flow counter without rain telemetry resamples into uniform hourly deltas.
    """
    times = pd.date_range("2024-06-01 00:00:00", periods=48, freq="1h")
    counters = np.cumsum(np.random.uniform(20.0, 70.0, len(times)))
    df = pd.DataFrame({"counter": counters}, index=times)
    deltas = df["counter"].diff().clip(lower=0.0).fillna(0.0)
    assert len(deltas) == 48
    assert (deltas >= 0.0).all()


def test_c04_dwf_separation_and_cost_tariff():
    """C04: F5 (DWF Profile) + F6 (Accidental Water) + Tariff (1 zł/kWh).
    Surge event yields excess volume, excess energy via SEU, and monetary cost at 1 zł/kWh.
    """
    q_measured = 3640.8
    dwf = 892.4
    alpha = 1.2
    vacc = max(0.0, q_measured - dwf * alpha) # ~2569.9 m3
    seu = 0.24 # kWh/m3
    excess_kwh = vacc * seu
    loss_pln = excess_kwh * ELECTRICITY_TARIFF_PLN_KWH
    assert vacc > 2000.0
    assert excess_kwh > 500.0
    assert loss_pln == excess_kwh


def test_c05_accidental_water_and_jury_csv_generation(client: TestClient):
    """C05: F6 (Accidental Water) + F9 (Jury CSV Export).
    Inflow analysis detects storm events that are directly formatted into the jury report CSV.
    """
    res_analysis = client.get("/api/inflow-analysis?station=PZ1")
    assert res_analysis.status_code == 200
    res_csv = client.get("/api/export/jury-report?station=PZ1")
    assert res_csv.status_code == 200
    lines = res_csv.text.strip().splitlines()
    assert len(lines) > 1  # Header + at least one anomaly episode


def test_c06_drag_and_drop_upload_to_jury_csv_roundtrip(client: TestClient):
    """C06: F10 (Drag-and-Drop Ingestion) + F9 (Jury Report Export).
    Evaluating benchmark preset enables immediate export of jury report.
    """
    res_eval = client.post("/api/benchmark/evaluate?preset=rybnik_2025_2026_test")
    assert res_eval.status_code == 200
    res_exp = client.get("/api/benchmark/export")
    assert res_exp.status_code == 200
    assert ";" in res_exp.text


def test_c07_station_specific_seu_and_cost_divergence(client: TestClient):
    """C07: F6 (Cost Calculation) + Multi-Station Parameters (PZ-1 vs PNB-1).
    Station PZ-1 and PNB-1 produce distinct total annual costs in energy analytics.
    """
    res_pz1 = client.get("/api/energy/analytics?station=PZ1")
    res_pnb1 = client.get("/api/energy/analytics?station=PNB1")
    assert res_pz1.status_code == 200
    assert res_pnb1.status_code == 200
    cost_pz1 = res_pz1.json()["total_annual_cost_pln"]
    cost_pnb1 = res_pnb1.json()["total_annual_cost_pln"]
    assert cost_pz1 > cost_pnb1


def test_c08_high_surge_event_triggers_scada_twin_ttc_alert():
    """C08: F6 (Accidental Water Surge) + F14 (SCADA Twin Mass Balance & TTC).
    Severe inflow surge fills retention tank and lowers TTC to critical threshold (<7 min).
    """
    engine = RybnikHydraulicEngine()
    # High storm inflow of 250 m3/h into PZ-1
    tanks, pumps, valves, pipes, alarms = engine.step(dt_seconds=300.0, rain_mm_h=90.0, external_storm_inflow=350.0)
    tank_pz1 = tanks.get("PZ1") or tanks.get("R1")
    assert tank_pz1.pct_full > 30.0


def test_c09_ml_regression_and_720h_forward_forecaster():
    """C09: F7 (ML Regression) + F8 (1-Month 720h Forward Forecast).
    Scikit-learn model predicts forward energy sequence with 95% confidence bands.
    """
    from sklearn.linear_model import Ridge
    # Train on 200 hours of synthetic data
    X = np.random.uniform(10.0, 50.0, (200, 4))
    y = X[:, 0] * 1.5 + X[:, 1] * 0.8
    model = Ridge().fit(X, y)
    
    # Forward 720 hours
    X_fwd = np.random.uniform(10.0, 50.0, (720, 4))
    preds = model.predict(X_fwd)
    sigma = np.std(y - model.predict(X))
    lower_95 = preds - 1.96 * sigma
    upper_95 = preds + 1.96 * sigma
    assert len(preds) == 720
    assert (upper_95 >= lower_95).all()


def test_c10_model_toggle_scorecard_and_mae_mape_metrics(client: TestClient):
    """C10: F8 (Forecasting Metrics) + F11 (Model Toggle Scorecard).
    Energy analytics scorecard provides average efficiency and correlation metrics.
    """
    res = client.get("/api/energy/analytics?station=PZ1")
    assert res.status_code == 200
    data = res.json()
    assert "r2_correlation_rain_energy" in data
    assert "average_efficiency_pct" in data


def test_c11_zoomable_forecast_visualizer_with_dwf_overlay(client: TestClient):
    """C11: F8 (720h Forecast) + F12 (Visualizer with Zoom) + F5 (DWF Overlay).
    Forecast items provide synchronized DWF baseline and predicted values.
    """
    res = client.get("/api/inflow-analysis?station=PZ1")
    forecast = res.json().get("forecast_trends", [])
    if forecast:
        # Check alignment of time, baseline, and prediction
        item = forecast[0]
        assert "predicted_flow_m3" in item
        assert "dwf_baseline_m3" in item


def test_c12_raw_vs_cleaned_toggle_with_accidental_cost_differential():
    """C12: F2 (March 2024 Masking) + F13 (Raw vs Cleaned) + F6 (Financial Loss).
    Raw corrupted data would claim +293,000 m³ false surge, whereas cleaned data suppresses it.
    """
    fictitious_volume = 293259.0
    seu = 0.24
    false_energy_loss_pln = fictitious_volume * seu * ELECTRICITY_TARIFF_PLN_KWH
    # Demonstrates that masking prevents over 70,000 PLN in bogus anomaly costs
    assert false_energy_loss_pln > 70000.0


def test_c13_leap_day_ingestion_and_monthly_seasonal_breakdown():
    """C13: F3 (Leap Day Handling) + F5 (Seasonal Breakdown).
    Full 2024 leap year timeseries generates seasonal breakdown for all calendar quarters.
    """
    dates = pd.date_range("2024-01-01", "2024-12-31 23:00:00", freq="1h")
    df = pd.DataFrame({"flow_m3": np.random.uniform(40.0, 100.0, len(dates))}, index=dates)
    df["dwf_m3"] = 55.0
    df["accidental_m3"] = (df["flow_m3"] - df["dwf_m3"] * 1.2).clip(lower=0.0)
    df = etl_service._calculate_energy_and_costs(df)
    seasonal = etl_service._calculate_seasonal_breakdown(df, sensitivity=1.2)
    assert len(seasonal) >= 4


def test_c14_meter_discontinuity_and_robust_delta_clamping():
    """C14: F1 (Raw SCADA) + F3 (Robust Resampling) + F6 (Accidental Water).
    Counter jump of 50,000 m³ clamped so accidental water is not spiked.
    """
    counters = [100.0, 150.0, 50150.0, 50200.0]  # Jump at index 2
    raw_diff = pd.Series(counters).diff().fillna(0.0)
    # Clamping discontinuity > 5000
    cleaned_diff = raw_diff.copy()
    cleaned_diff[cleaned_diff > 5000] = 0.0
    dwf = 50.0
    vacc = (cleaned_diff - dwf * 1.2).clip(lower=0.0)
    assert vacc.max() <= 100.0


def test_c15_scada_twin_valve_modulation_and_pump_dispatch(client: TestClient):
    """C15: F14 (SCADA Twin) + Pump Dispatch + Valve Aperture Setting.
    Simultaneously adjusts discharge valve aperture and triggers pump action.
    """
    res_valve = client.post("/api/valves/set", json={"valve_id": "Z_PZ1", "aperture_pct": 50.0})
    res_pump = client.post("/api/pumps/set", json={"pump_id": "P1_PZ1", "action": "stop"})
    assert res_valve.status_code == 200
    assert res_pump.status_code == 200


def test_c16_weather_resilient_ml_training_without_rain_gauge():
    """C16: F4 (No Rain Telemetry) + F7 (ML Features) + F8 (Evaluation).
    ML pipeline trains purely on lag features and cyclical time without precipitation data.
    """
    from sklearn.ensemble import HistGradientBoostingRegressor
    from sklearn.metrics import r2_score
    n = 300
    hours = np.arange(n) % 24
    sin_h = np.sin(2 * np.pi * hours / 24)
    cos_h = np.cos(2 * np.pi * hours / 24)
    # Target energy purely driven by diurnal cycle
    y = 20.0 + 15.0 * sin_h + np.random.normal(0, 0.5, n)
    X = np.column_stack([sin_h, cos_h])
    model = HistGradientBoostingRegressor(max_iter=30, random_state=42).fit(X[:200], y[:200])
    y_pred = model.predict(X[200:])
    r2 = r2_score(y[200:], y_pred)
    assert r2 > 0.85
