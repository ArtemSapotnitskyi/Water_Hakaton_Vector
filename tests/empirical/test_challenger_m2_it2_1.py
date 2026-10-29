"""
Empirical Challenger Test Suite for Milestone 2 Iteration 2:
Adversarial Verification of 4 Remediations:
1. 168h dataset training & rollout across boundary lengths (1, 12, 23, 24, 25, 167, 168, 169).
2. Cache key separation between df1 and df2 of equal length (content-awareness, raw vs clean, timestamp/sum hashing).
3. DWF profile input polymorphism (list of floats, list of ints, tuple, ndarray, Series).
4. Telemetry NaN resilience (tail single, tail multi, head multi, middle isolated NaNs).
"""
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest
import numpy as np
import pandas as pd
import time
from typing import List

from ml_engine import (
    ml_engine,
    HydroPulseMLEngine,
    HydrodynamicHarmonicForecaster,
    ScikitLearnEnergyRegressor,
    extract_feature_matrix
)
from config import PZ1_NOMINAL_DWF_PROFILE, PNB1_NOMINAL_DWF_PROFILE
from etl_service import etl_service


# ==============================================================================
# 1. 168H DATASET BOUNDARY CONDITIONS & VARIABLE HORIZONS
# ==============================================================================

@pytest.mark.parametrize("length", [1, 5, 12, 23, 24, 25, 167, 168, 169, 300])
def test_adv_boundary_dataset_lengths_and_168h_rollout(length: int):
    """
    Challenge 1: Verify datasets of boundary lengths (specifically 168h, 167h, 169h, 24h, 23h, 1h)
    train and forecast without raising ValueError (shape=(0, 38)) and produce complete 720h forecasts
    with non-negative, monotonic confidence bounds.
    """
    dwf_np = np.asarray(PZ1_NOMINAL_DWF_PROFILE)
    dates = pd.date_range("2024-01-01", periods=length, freq="1h")
    df = pd.DataFrame({
        "flow_m3": np.random.uniform(40.0, 80.0, length),
        "energy_kwh": np.random.uniform(4.0, 9.0, length)
    }, index=dates)

    eng = HydroPulseMLEngine()
    res = eng.train_and_forecast(df, dwf_np, station="PZ1", model_type="blended", horizon_hours=720)

    fc = res["forecast_720h"]
    assert len(fc) == 720
    for it in fc:
        assert not np.isnan(it.predicted_flow_m3)
        assert not np.isnan(it.predicted_energy_kwh)
        assert not np.isnan(it.lower_95_flow_m3)
        assert not np.isnan(it.upper_95_flow_m3)
        assert 0.0 <= it.lower_95_flow_m3 <= it.predicted_flow_m3 <= it.upper_95_flow_m3
        assert 0.0 <= it.lower_95_energy_kwh <= it.predicted_energy_kwh <= it.upper_95_energy_kwh


# ==============================================================================
# 2. CACHE KEY SEPARATION ACROSS EQUAL LENGTH DATASETS
# ==============================================================================

def test_adv_cache_key_separation_equal_length_differing_telemetry():
    """
    Challenge 2.1: Verify distinct datasets of identical length (e.g. 500 rows)
    produce separate cache entries in ScikitLearnEnergyRegressor and prevent
    silent cross-contamination.
    """
    dates = pd.date_range("2024-02-01", periods=500, freq="1h")
    df1 = pd.DataFrame({
        "flow_m3": np.full(500, 15.0),
        "energy_kwh": np.full(500, 3.5)
    }, index=dates)

    df2 = pd.DataFrame({
        "flow_m3": np.full(500, 450.0),
        "energy_kwh": np.full(500, 38.0)
    }, index=dates)

    reg = ScikitLearnEnergyRegressor()
    m1 = reg.fit(df1, station="PZ1")
    model1_flow = reg.model_flow

    m2 = reg.fit(df2, station="PZ1")
    model2_flow = reg.model_flow

    assert len(reg._cache) == 2, f"Expected 2 cache entries, got {len(reg._cache)}"
    assert model1_flow is not model2_flow, "Cache collided: identical model instance returned!"


def test_adv_cache_key_separation_real_pz1_raw_vs_cleaned():
    """
    Challenge 2.2: Verify real Rybnik PZ-1 raw vs cleaned telemetry (both 8,784 rows)
    yield distinct cache keys and distinct validation metrics.
    """
    df_raw = etl_service._load_pz1_historical(clean_data=False)[0]
    df_clean = etl_service._load_pz1_historical(clean_data=True)[0]

    assert len(df_raw) == len(df_clean) == 8784

    reg = ScikitLearnEnergyRegressor()
    m_raw = reg.fit(df_raw, station="PZ1")
    m_clean = reg.fit(df_clean, station="PZ1")

    assert len(reg._cache) == 2
    # Raw PZ-1 has March 18x surge distortion, so raw MAE must be substantially higher than cleaned MAE
    assert m_raw["mae_flow"] > m_clean["mae_flow"]


# ==============================================================================
# 3. DWF PROFILE INPUT POLYMORPHISM
# ==============================================================================

@pytest.mark.parametrize("dwf_input", [
    list(PZ1_NOMINAL_DWF_PROFILE),
    [int(x) for x in PZ1_NOMINAL_DWF_PROFILE],
    tuple(PZ1_NOMINAL_DWF_PROFILE),
    np.array(PZ1_NOMINAL_DWF_PROFILE, dtype=np.float64),
    pd.Series(PZ1_NOMINAL_DWF_PROFILE)
])
def test_adv_dwf_profile_input_polymorphism(dwf_input):
    """
    Challenge 3: Verify all forecaster interfaces accept DWF profiles formatted as
    list of floats, list of ints, tuples, numpy ndarrays, or pandas Series without TypeError.
    """
    dates = pd.date_range("2024-03-01", periods=168, freq="1h")
    df = pd.DataFrame({
        "flow_m3": np.random.uniform(50, 90, 168),
        "energy_kwh": np.random.uniform(5, 10, 168)
    }, index=dates)

    # 1. HydrodynamicHarmonicForecaster
    b1 = HydrodynamicHarmonicForecaster()
    q1, e1, s1f, s1e = b1.predict_720h(df, dwf_input, station="PZ1")
    assert len(q1) == 720 and not np.isnan(s1f)

    # 2. ScikitLearnEnergyRegressor
    b2 = ScikitLearnEnergyRegressor()
    b2.fit(df, station="PZ1")
    q2, e2, s2f, s2e = b2.predict_720h(df, dwf_input, station="PZ1")
    assert len(q2) == 720 and not np.isnan(s2f)

    # 3. HydroPulseMLEngine.train_and_forecast
    eng = HydroPulseMLEngine()
    res = eng.train_and_forecast(df, dwf_input, station="PZ1", model_type="blended")
    assert len(res["forecast_720h"]) == 720

    # 4. HydroPulseMLEngine.compare_models
    comp = eng.compare_models(df, dwf_input, station="PZ1")
    assert comp.recommended_model in ["statistical_dwf", "ml_ensemble", "blended"]


# ==============================================================================
# 4. TELEMETRY MISSING VALUE (NAN) RESILIENCE
# ==============================================================================

@pytest.mark.parametrize("nan_pattern", [
    "tail_single_flow",
    "tail_single_energy",
    "tail_both_single",
    "tail_five_consecutive",
    "head_five_consecutive",
    "middle_isolated"
])
def test_adv_nan_telemetry_resilience(nan_pattern: str):
    """
    Challenge 4: Verify unhandled NaNs in historical telemetry (tail, head, middle)
    are sanitized cleanly without ValueError or NaN propagation in confidence bounds.
    """
    dates = pd.date_range("2024-04-01", periods=240, freq="1h")
    df = pd.DataFrame({
        "flow_m3": np.random.uniform(40, 80, 240),
        "energy_kwh": np.random.uniform(4, 9, 240)
    }, index=dates)

    if nan_pattern == "tail_single_flow":
        df.iloc[-1, 0] = np.nan
    elif nan_pattern == "tail_single_energy":
        df.iloc[-1, 1] = np.nan
    elif nan_pattern == "tail_both_single":
        df.iloc[-1, 0] = np.nan
        df.iloc[-1, 1] = np.nan
    elif nan_pattern == "tail_five_consecutive":
        df.iloc[-5:, 0] = np.nan
        df.iloc[-5:, 1] = np.nan
    elif nan_pattern == "head_five_consecutive":
        df.iloc[:5, 0] = np.nan
        df.iloc[:5, 1] = np.nan
    elif nan_pattern == "middle_isolated":
        df.iloc[50, 0] = np.nan
        df.iloc[75, 1] = np.nan

    dwf_np = np.asarray(PZ1_NOMINAL_DWF_PROFILE)
    eng = HydroPulseMLEngine()
    res = eng.train_and_forecast(df, dwf_np, station="PZ1", model_type="blended")

    for item in res["forecast_720h"]:
        assert not np.isnan(item.predicted_flow_m3)
        assert not np.isnan(item.predicted_energy_kwh)
        assert not np.isnan(item.lower_95_flow_m3)
        assert not np.isnan(item.upper_95_flow_m3)
        assert 0.0 <= item.lower_95_flow_m3 <= item.predicted_flow_m3 <= item.upper_95_flow_m3
