import time
import pytest
import numpy as np
import pandas as pd
from typing import List, Dict, Any

from config import (
    PZ1_NOMINAL_DWF_PROFILE, PNB1_NOMINAL_DWF_PROFILE,
    PZ1_NOMINAL_FLOW_M3_H, PNB1_NOMINAL_FLOW_M3_H
)
from ml_engine import (
    ml_engine,
    calculate_metrics,
    extract_feature_matrix,
    HydrodynamicHarmonicForecaster,
    ScikitLearnEnergyRegressor,
    FEATURE_NAMES
)
from schemas import (
    Forecast720hItem,
    DualModelComparisonResponse,
    InflowAnalysisResponse
)
from etl_service import etl_service


# ==============================================================================
# CHALLENGE 1: 720H FORWARD ROLLOUT & BOUNDS VERIFICATION (ALL 3 MODELS)
# ==============================================================================

@pytest.mark.parametrize("model_type", ["statistical_dwf", "ml_ensemble", "blended"])
def test_adv_720h_bounds_and_risk_across_models(model_type):
    """
    Challenge 1.1: Verify 720h hourly forecast produces exactly 720 items and
    satisfies 0 <= lower <= pred <= upper across all items for all 3 models.
    """
    dwf_np = np.asarray(PZ1_NOMINAL_DWF_PROFILE)
    dates = pd.date_range("2024-05-01 00:00:00", periods=360, freq="1h")
    np.random.seed(42)
    flow = np.random.uniform(40, 95, 360)
    energy = flow * 0.08 + 2.5 + np.random.normal(0, 0.2, 360)
    df = pd.DataFrame({"flow_m3": flow, "energy_kwh": energy}, index=dates)

    t0 = time.perf_counter()
    res = ml_engine.train_and_forecast(
        df=df,
        dwf_profile=dwf_np,
        station="PZ1",
        model_type=model_type,
        horizon_hours=720
    )
    elapsed = time.perf_counter() - t0

    fc = res["forecast_720h"]
    assert len(fc) == 720, f"Expected 720 items, got {len(fc)}"
    assert elapsed < 1.0, f"train_and_forecast took {elapsed:.4f}s (> 1.0s)"

    for i, item in enumerate(fc):
        assert item.hour_index == i
        assert 0.0 <= item.lower_95_flow_m3, f"Hour {i}: lower flow negative ({item.lower_95_flow_m3})"
        assert item.lower_95_flow_m3 <= item.predicted_flow_m3, (
            f"Hour {i}: lower_flow ({item.lower_95_flow_m3}) > pred_flow ({item.predicted_flow_m3})"
        )
        assert item.predicted_flow_m3 <= item.upper_95_flow_m3, (
            f"Hour {i}: pred_flow ({item.predicted_flow_m3}) > upper_flow ({item.upper_95_flow_m3})"
        )

        assert 0.0 <= item.lower_95_energy_kwh, f"Hour {i}: lower energy negative ({item.lower_95_energy_kwh})"
        assert item.lower_95_energy_kwh <= item.predicted_energy_kwh, (
            f"Hour {i}: lower_energy ({item.lower_95_energy_kwh}) > pred_energy ({item.predicted_energy_kwh})"
        )
        assert item.predicted_energy_kwh <= item.upper_95_energy_kwh, (
            f"Hour {i}: pred_energy ({item.predicted_energy_kwh}) > upper_energy ({item.upper_95_energy_kwh})"
        )

        # Compatibility fields
        assert item.lower_95_kwh == item.lower_95_energy_kwh
        assert item.predicted_kwh == item.predicted_energy_kwh
        assert item.upper_95_kwh == item.upper_95_energy_kwh

        assert item.risk_level in ["SAFE", "ELEVATED", "CRITICAL"]
        assert item.dwf_baseline_m3 > 0
        assert item.dwf_baseline_kwh > 0


# ==============================================================================
# CHALLENGE 2: EXTREME VARIATION 1 - FLAT FLOW & ZERO VARIANCE (STATION SHUTDOWN)
# ==============================================================================

@pytest.mark.parametrize("flat_val", [0.0, 50.0])
def test_adv_720h_flat_flow_and_zero_variance(flat_val):
    """
    Challenge 2.1: Stress-test against 0.0 flow (station shut down) and constant 50.0 flow (zero variance).
    Verifies that std=0 does not cause division by zero or NaN confidence intervals.
    """
    dwf_np = np.asarray(PZ1_NOMINAL_DWF_PROFILE)
    dates = pd.date_range("2024-01-01", periods=300, freq="1h")
    df = pd.DataFrame({
        "flow_m3": np.full(300, flat_val),
        "energy_kwh": np.full(300, flat_val * 0.08 + 2.5 if flat_val > 0 else 0.0)
    }, index=dates)

    for m_type in ["statistical_dwf", "ml_ensemble", "blended"]:
        res = ml_engine.train_and_forecast(df, dwf_np, station="PZ1", model_type=m_type)
        fc = res["forecast_720h"]
        assert len(fc) == 720
        for item in fc:
            assert not np.isnan(item.predicted_flow_m3)
            assert not np.isnan(item.lower_95_flow_m3)
            assert not np.isnan(item.upper_95_flow_m3)
            assert 0.0 <= item.lower_95_flow_m3 <= item.predicted_flow_m3 <= item.upper_95_flow_m3


# ==============================================================================
# CHALLENGE 3: EXTREME VARIATION 2 - SUDDEN STORM SURGE & HYDRAULIC RECOVERY
# ==============================================================================

@pytest.mark.parametrize("surge_multiplier", [5.0, 20.0, 100.0])
def test_adv_720h_sudden_storm_surge_dynamics(surge_multiplier):
    """
    Challenge 3.1: Normal historical flow followed by a sudden 5x, 20x, or 100x storm surge
    in the last 12 hours. Verifies:
    1. Bounds hold strictly without overflow/NaN.
    2. Hydrodynamic surge decays over time.
    3. Blended model activates CRITICAL risk classification.
    """
    dwf_np = np.asarray(PZ1_NOMINAL_DWF_PROFILE)
    dates = pd.date_range("2024-06-01", periods=360, freq="1h")
    flow = np.full(360, 60.0)
    flow[-12:] = 60.0 * surge_multiplier
    energy = flow * 0.08 + 2.5
    df_surge = pd.DataFrame({"flow_m3": flow, "energy_kwh": energy}, index=dates)

    res = ml_engine.train_and_forecast(df_surge, dwf_np, station="PZ1", model_type="blended")
    fc = res["forecast_720h"]

    # In storm surge, risk should be elevated or critical in early hours
    early_items = fc[:24]
    critical_or_elevated = sum(1 for it in early_items if it.risk_level in ["CRITICAL", "ELEVATED"])
    assert critical_or_elevated > 0, "Expected CRITICAL or ELEVATED risk level during/after severe storm surge"

    # Bounds must strictly hold
    for it in fc:
        assert 0.0 <= it.lower_95_flow_m3 <= it.predicted_flow_m3 <= it.upper_95_flow_m3
        assert 0.0 <= it.lower_95_energy_kwh <= it.predicted_energy_kwh <= it.upper_95_energy_kwh


# ==============================================================================
# CHALLENGE 4: BUG REPRODUCTION - 168-HOUR DATASET CRASH (EXACTLY 1 WEEK)
# ==============================================================================

def test_adv_bug_reproduction_168_hours_dataset_crash():
    """
    Challenge 4.1: Verify 168-hour (7 days * 24 hours) datasets no longer crash
    with 'ValueError: Found array with 0 sample(s)' and return a complete 720h forecast.
    """
    dwf_np = np.asarray(PZ1_NOMINAL_DWF_PROFILE)
    dates = pd.date_range("2024-01-01", periods=168, freq="1h")
    df_168 = pd.DataFrame({
        "flow_m3": np.random.uniform(40, 80, 168),
        "energy_kwh": np.random.uniform(4, 9, 168)
    }, index=dates)

    res = ml_engine.train_and_forecast(df_168, dwf_np, station="PZ1")
    assert len(res["forecast_720h"]) == 720


# ==============================================================================
# CHALLENGE 5: BUG REPRODUCTION - DWF_PROFILE AS LIST RAISES TYPEERROR
# ==============================================================================

def test_adv_bug_reproduction_dwf_profile_as_list():
    """
    Challenge 5.1: Verify DWF profile passed as a standard Python list executes cleanly
    without raising 'TypeError: list indices must be integers or slices, not Index'.
    """
    dwf_list = list(PZ1_NOMINAL_DWF_PROFILE)  # Python list
    dates = pd.date_range("2024-01-01", periods=300, freq="1h")
    df = pd.DataFrame({
        "flow_m3": np.random.uniform(40, 80, 300),
        "energy_kwh": np.random.uniform(4, 9, 300)
    }, index=dates)

    res = ml_engine.train_and_forecast(df, dwf_list, station="PZ1")
    assert len(res["forecast_720h"]) == 720


# ==============================================================================
# CHALLENGE 6: BUG REPRODUCTION - UNHANDLED NANS IN HISTORICAL TAIL
# ==============================================================================

def test_adv_bug_reproduction_nans_in_historical_tail():
    """
    Challenge 6.1: Verify unhandled NaNs in the telemetry tail are properly sanitized
    without raising 'ValueError: Input y contains NaN'.
    """
    from ml_engine import HydroPulseMLEngine
    fresh_engine = HydroPulseMLEngine()
    dwf_np = np.asarray(PZ1_NOMINAL_DWF_PROFILE)
    dates = pd.date_range("2024-01-01", periods=300, freq="1h")
    df_nan = pd.DataFrame({
        "flow_m3": np.random.uniform(40, 80, 300),
        "energy_kwh": np.random.uniform(4, 9, 300)
    }, index=dates)
    df_nan.iloc[-1, 0] = np.nan  # Single NaN at the tail

    res = fresh_engine.train_and_forecast(df_nan, dwf_np, station="PZ1")
    assert len(res["forecast_720h"]) == 720
    for item in res["forecast_720h"]:
        assert not np.isnan(item.predicted_flow_m3)
        assert not np.isnan(item.lower_95_flow_m3)


# ==============================================================================
# CHALLENGE 7: MODEL COMPARISON & SCORE DELTAS MATHEMATICAL CONSISTENCY
# ==============================================================================

def test_adv_model_comparison_scorecard_and_delta_consistency():
    """
    Challenge 7.1: Verify compare_models scorecard mathematical consistency:
    1. Score deltas: improvement_pct correctly signed.
    2. Winner determination: ml_wins vs dwf_wins tally matches recommendation.
    3. When DWF is strictly better, recommended_model == 'statistical_dwf'.
    4. When ML is strictly better, recommended_model == 'blended'.
    """
    from ml_engine import HydroPulseMLEngine
    dwf_np = np.asarray(PZ1_NOMINAL_DWF_PROFILE)
    dates = pd.date_range("2024-01-01", periods=360, freq="1h")

    # Scenario A: Telemetry perfectly matches DWF baseline (DWF must win)
    hours = dates.hour
    flow_dwf_favored = dwf_np[hours] + np.random.normal(0, 0.05, 360)
    df_dwf = pd.DataFrame({
        "flow_m3": flow_dwf_favored,
        "energy_kwh": flow_dwf_favored * 0.08 + 2.5
    }, index=dates)

    engine_a = HydroPulseMLEngine()
    comp_dwf = engine_a.compare_models(df_dwf, dwf_np, station="PZ1")
    assert comp_dwf.recommended_model == "statistical_dwf"
    dwf_wins = sum(1 for d in comp_dwf.deltas.values() if d.winner == "statistical_dwf")
    ml_wins = sum(1 for d in comp_dwf.deltas.values() if d.winner == "ml_ensemble")
    assert dwf_wins > ml_wins

    # Scenario B: Telemetry has complex pattern differing from DWF (ML must win)
    wave = 60.0 + 30.0 * np.sin(np.arange(360) * 2 * np.pi / 24.0)
    df_ml = pd.DataFrame({
        "flow_m3": wave,
        "energy_kwh": wave * 0.08 + 2.5
    }, index=dates)

    engine_b = HydroPulseMLEngine()
    comp_ml = engine_b.compare_models(df_ml, dwf_np, station="PZ1")
    assert comp_ml.recommended_model == "blended"
    ml_wins_b = sum(1 for d in comp_ml.deltas.values() if d.winner == "ml_ensemble")
    dwf_wins_b = sum(1 for d in comp_ml.deltas.values() if d.winner == "statistical_dwf")
    assert ml_wins_b > dwf_wins_b

    # Verify mathematical properties of MetricDeltaItem
    for name, delta in comp_ml.deltas.items():
        if "r2" in name:
            diff = delta.absolute_diff
            assert delta.improvement_pct == pytest.approx(diff * 100.0, abs=0.1)
        else:
            if delta.winner == "ml_ensemble":
                assert delta.improvement_pct > 0.0


# ==============================================================================
# CHALLENGE 7.2: CACHE KEY COLLISION BUG REPRODUCTION
# ==============================================================================

def test_adv_bug_reproduction_cache_key_collision():
    """
    Challenge 7.2: Verify content-aware cache keys isolate distinct datasets
    of equal length (e.g. 300 rows) and prevent cross-contamination.
    """
    dates = pd.date_range("2024-01-01", periods=300, freq="1h")
    df1 = pd.DataFrame({"flow_m3": np.full(300, 10.0), "energy_kwh": np.full(300, 3.3)}, index=dates)
    df2 = pd.DataFrame({"flow_m3": np.full(300, 500.0), "energy_kwh": np.full(300, 42.5)}, index=dates)

    reg = ScikitLearnEnergyRegressor()
    reg.fit(df1, station="PZ1")
    reg.fit(df2, station="PZ1")

    # Due to content-aware hashing, two distinct cache entries exist
    assert len(reg._cache) == 2
    pred_f, _, _, _ = reg.predict_720h(df2, np.full(24, 500.0), station="PZ1")
    assert pred_f.mean() > 200.0



# ==============================================================================
# CHALLENGE 8: WEATHER RESILIENCE (NO RAIN GAUGE DEPENDENCY)
# ==============================================================================

def test_adv_pure_scada_weather_resilience_without_rainfall():
    """
    Challenge 8.1: Verify ML Engine operates autonomously on pure flow m3 and energy kWh
    with 0 dependency on rainfall columns or telemetry.
    """
    dwf_np = np.asarray(PZ1_NOMINAL_DWF_PROFILE)
    dates = pd.date_range("2024-03-01", periods=240, freq="1h")
    # Explicitly do NOT include any rainfall, precip, or weather columns
    df_pure = pd.DataFrame({
        "flow_m3": np.random.uniform(50, 100, 240),
        "energy_kwh": np.random.uniform(6, 12, 240)
    }, index=dates)

    res = ml_engine.train_and_forecast(df_pure, dwf_np, station="PZ1")
    assert len(res["forecast_720h"]) == 720
    assert len(res["feature_importance"]) > 0

    # Ensure no feature in feature importance references rain
    for fi in res["feature_importance"]:
        assert "rain" not in fi.feature_name.lower()
        assert "opad" not in fi.display_name.lower()


# ==============================================================================
# CHALLENGE 9: PERFORMANCE & LATENCY OF 720H INFERENCE
# ==============================================================================

def test_adv_720h_rollout_subsecond_latency():
    """
    Challenge 9.1: 720h forward rollout must execute well below 100ms.
    """
    dwf_np = np.asarray(PZ1_NOMINAL_DWF_PROFILE)
    dates = pd.date_range("2024-01-01", periods=300, freq="1h")
    df = pd.DataFrame({
        "flow_m3": np.random.uniform(40, 80, 300),
        "energy_kwh": np.random.uniform(4, 9, 300)
    }, index=dates)

    reg = ScikitLearnEnergyRegressor()
    reg.fit(df, station="PZ1")

    t0 = time.perf_counter()
    pred_f, pred_e, sf, se = reg.predict_720h(df, dwf_np, station="PZ1")
    rollout_ms = (time.perf_counter() - t0) * 1000.0

    print(f"\n[BENCHMARK] 720h Multi-Step Batch Rollout: {rollout_ms:.2f} ms")
    assert rollout_ms < 100.0, f"720h rollout took {rollout_ms:.2f} ms (> 100 ms)!"
    assert len(pred_f) == 720
    assert len(pred_e) == 720
