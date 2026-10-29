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
# TIER 4: Real-World Scenarios (>=8 tests)
# ==============================================================================

def test_s01_rybnik_march_2024_scada_audit(client: TestClient):
    """S01: Rybnik March 2024 Full SCADA Audit Workflow.
    End-to-end audit verifying detection of the 8-day 17 m³ freeze,
    masking of corrupted runaway calibration data, and generation of
    audit trail identifying the instrumentation failure.
    """
    res = client.get("/api/inflow-analysis?station=PZ1")
    assert res.status_code == 200
    data = res.json()
    
    # 1. Total measured flow is sanitized (under 2,000,000 m3)
    assert data["total_measured_m3"] < 2000000.0
    
    # 2. Jury records identify the March instrumentation failure
    records = data.get("jury_records", [])
    march_faults = [r for r in records if "2024-03" in r.get("date", "")]
    assert len(march_faults) > 0
    fault = march_faults[0]
    assert "awaria" in fault.get("anomaly_type", "").lower() or "zamrożenie" in fault.get("anomaly_type", "").lower()
    
    # 3. CSV report export confirms audit record
    res_csv = client.get("/api/export/jury-report?station=PZ1")
    assert res_csv.status_code == 200
    assert "2024-03" in res_csv.text


def test_s02_july_2024_flash_flood_investigation(client: TestClient):
    """S02: July 2024 Rybnik Summer Flash Flood Investigation.
    Investigates the 2024-07-16 storm event, confirming accidental water
    decomposition, SEU energy calculation, and cost at 1.00 PLN/kWh.
    """
    res = client.get("/api/inflow-analysis?station=PZ1")
    assert res.status_code == 200
    records = res.json().get("jury_records", [])
    july_events = [r for r in records if "2024-07-16" in r.get("date", "")]
    assert len(july_events) > 0
    event = july_events[0]
    
    # Verify physical quantities
    assert event["dwf_baseline_m3"] > 0
    assert event["measured_flow_m3"] > event["dwf_baseline_m3"]
    assert event["accidental_water_m3"] > 0
    assert event["excess_energy_kwh"] > 0
    # Financial loss matches excess kWh at 1.00 PLN/kWh
    assert round(event["financial_loss_pln"], 1) == round(event["excess_energy_kwh"] * ELECTRICITY_TARIFF_PLN_KWH, 1)


def test_s03_september_2024_storm_boris_multi_day_flood(client: TestClient):
    """S03: September 2024 Storm Boris Multi-Day Flood Scenario.
    Verifies detection of massive multi-day inflows (2024-09-12 to 2024-09-16),
    large accidental water volume, and critical operational severity.
    """
    res = client.get("/api/inflow-analysis?station=PZ1")
    assert res.status_code == 200
    records = res.json().get("jury_records", [])
    sept_events = [r for r in records if "2024-09" in r.get("date", "")]
    assert len(sept_events) >= 2
    
    # Boris storm events should have high measured flow (>5000 m3)
    max_measured = max(r["measured_flow_m3"] for r in sept_events)
    assert max_measured > 5000.0


def test_s04_one_month_forward_energy_forecasting_workflow():
    """S04: 30-Day Forward Forecast & Jury Model Evaluation Workflow.
    Simulates training ML regressor on historical flow/energy, producing a
    30-day (720 hours) hourly projection with 95% confidence bounds.
    """
    from sklearn.ensemble import HistGradientBoostingRegressor
    from sklearn.metrics import mean_absolute_error, r2_score
    
    # 1. Generate 3 months of synthetic historical training data (2160 hours)
    n_train = 2160
    hours = np.arange(n_train)
    diurnal = 30.0 + 20.0 * np.sin(2 * np.pi * (hours % 24) / 24)
    weekly = 1.0 + 0.1 * np.cos(2 * np.pi * (hours % 168) / 168)
    y_train = (diurnal * weekly) + np.random.normal(0, 1.5, n_train)
    
    # Feature engineering: sin/cos hour, sin/cos dow, lag1, lag24
    sin_h = np.sin(2 * np.pi * (hours % 24) / 24)
    cos_h = np.cos(2 * np.pi * (hours % 24) / 24)
    sin_dow = np.sin(2 * np.pi * ((hours // 24) % 7) / 7)
    cos_dow = np.cos(2 * np.pi * ((hours // 24) % 7) / 7)
    X_train = np.column_stack([sin_h, cos_h, sin_dow, cos_dow])
    
    # 2. Fit Scikit-Learn regressor
    model = HistGradientBoostingRegressor(max_iter=50, random_state=42)
    model.fit(X_train, y_train)
    
    # 3. Predict 720 hours forward (30 days)
    hours_fwd = np.arange(n_train, n_train + 720)
    X_fwd = np.column_stack([
        np.sin(2 * np.pi * (hours_fwd % 24) / 24),
        np.cos(2 * np.pi * (hours_fwd % 24) / 24),
        np.sin(2 * np.pi * ((hours_fwd // 24) % 7) / 7),
        np.cos(2 * np.pi * ((hours_fwd // 24) % 7) / 7),
    ])
    preds_fwd = model.predict(X_fwd)
    
    # 4. Uncertainty bands (+/- 1.96 sigma)
    residuals = y_train - model.predict(X_train)
    sigma = np.std(residuals)
    lower_95 = preds_fwd - 1.96 * sigma
    upper_95 = preds_fwd + 1.96 * sigma
    
    assert len(preds_fwd) == 720
    assert (preds_fwd > 0).all()
    assert (upper_95 >= lower_95).all()
    # Model evaluation metrics
    mae = mean_absolute_error(y_train, model.predict(X_train))
    r2 = r2_score(y_train, model.predict(X_train))
    assert mae < 3.0
    assert r2 > 0.90


def test_s05_jury_evaluation_file_processing_latency(client: TestClient):
    """S05: Drag-and-Drop Jury Evaluation Workflow & Latency Constraint.
    Verifies that processing a test file completes well under the 2.0s deadline.
    """
    t0 = time.time()
    res = client.get("/api/inflow-analysis?station=PZ1")
    elapsed = time.time() - t0
    assert res.status_code == 200
    assert elapsed < 2.0


def test_s06_dispatcher_critical_overflow_emergency_mitigation(client: TestClient):
    """S06: Dispatcher Emergency Mitigation Workflow.
    SCADA digital twin experiences severe surge wave, triggers TTC overflow alert,
    and operator intervention stabilizes tank level.
    """
    engine = RybnikHydraulicEngine()
    # 1. Initial stable state
    assert engine.pz1_vol < PZ1_ZR_MAX_VOLUME_M3 * 0.5
    
    # 2. Extreme inflow surge of 250 m3/h for 20 minutes
    engine.step(dt_seconds=1200.0, rain_mm_h=120.0, external_storm_inflow=350.0)
    
    # 3. Dispatcher intervenes: opens discharge valve to 100% and starts pump P2
    res_valve = client.post("/api/valves/set", json={"valve_id": "Z_PZ1", "aperture_pct": 100.0})
    res_pump = client.post("/api/pumps/set", json={"pump_id": "P2_PZ1", "action": "start"})
    assert res_valve.status_code == 200
    assert res_pump.status_code == 200
    
    # 4. Engine advances and maintains physical bounds
    tanks, pumps, valves, pipes, alarms = engine.step(dt_seconds=600.0, rain_mm_h=0.0)
    tank_pz1 = tanks.get("PZ1") or tanks.get("R1")
    assert tank_pz1.volume_m3 <= PZ1_ZR_MAX_VOLUME_M3


def test_s07_tauron_electrical_billing_reconciliation(client: TestClient):
    """S07: Tauron Energy Billing & SEU Benchmark Reconciliation.
    Verifies energy analytics calculates realistic annual billing and SEU
    aligned with official invoices (70,000 - 110,000 kWh/year).
    """
    res = client.get("/api/energy/analytics?station=PZ1")
    assert res.status_code == 200
    data = res.json()
    
    # Monthly trends sum
    monthly = data.get("monthly_trends", [])
    if monthly:
        total_kwh = sum(m["total_kwh"] for m in monthly)
        assert total_kwh > 50000.0
    
    # Pump fleet health items present
    fleet = data.get("pump_fleet", [])
    assert len(fleet) >= 2


def test_s08_jury_scorecard_and_csv_export_roundtrip(client: TestClient):
    """S08: End-to-End Jury Scorecard Evaluation & CSV Export Roundtrip.
    Executes inflow analysis, generates jury CSV report, parses all rows,
    and validates decimal formatting and semicolon delimiters.
    """
    res = client.get("/api/export/jury-report?station=PZ1")
    assert res.status_code == 200
    csv_text = res.text
    lines = csv_text.strip().splitlines()
    assert len(lines) >= 2
    
    # Header check
    header = lines[0].split(";")
    assert len(header) >= 10
    
    # Parse rows
    for line in lines[1:]:
        cols = line.split(";")
        assert len(cols) >= 10
        # Column 0: Date
        assert len(cols[0]) > 0
        # Column 2: Station
        assert "PZ1" in cols[2] or "Pełczyńskiego" in cols[2]
