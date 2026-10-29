"""
Milestone 2 Empirical Challenger 2 Test Suite
Author: challenger_m2_2
Purpose: Empirically stress-test:
1. 100% weather resilience: training and 720h forward forecasting with pure SCADA flow/energy (absence of rain).
2. Numerical stability of guarded MAPE, sMAPE, MAE, R2: zero flow, near-zero nocturnal flow (MNF), extreme surges, constant series, empty/single arrays.
3. Processing latency: uncached and cached model training + 720h forward rollout strictly < 1.5s.
4. End-to-end integration with etl_service, compare_models, and API endpoints.
"""

import time
import pytest
import numpy as np
import pandas as pd
from pathlib import Path
from fastapi.testclient import TestClient

from main import app
from etl_service import etl_service
from ml_engine import (
    ml_engine,
    HydroPulseMLEngine,
    ScikitLearnEnergyRegressor,
    HydrodynamicHarmonicForecaster,
    calculate_metrics,
    extract_feature_matrix,
    FEATURE_NAMES
)
from config import (
    RYBNIK_DIR,
    PZ1_NOMINAL_DWF_PROFILE,
    PNB1_NOMINAL_DWF_PROFILE
)


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


# ==============================================================================
# CHALLENGE 1: 100% WEATHER RESILIENCE (COMPLETE ABSENCE OF RAIN TELEMETRY)
# ==============================================================================

class TestWeatherResilience:
    """Stress tests verifying the model operates autonomously on pure flow/energy telemetry without weather sensors."""

    def test_pure_flow_series_without_rain_or_energy_columns(self):
        """Verify feature extraction and 720h forecast on pure flow series (no rain, no energy columns)."""
        dates = pd.date_range("2024-01-01 00:00:00", periods=720, freq="1h")
        flow = 50.0 + 20.0 * np.sin(2 * np.pi * dates.hour / 24.0) + np.random.normal(0, 2.0, len(dates))
        df_pure = pd.DataFrame({"flow_m3": np.maximum(0.0, flow)}, index=dates)

        # 1. Feature extraction must succeed with exactly 38 features
        X, y_flow, y_energy, feat_names = extract_feature_matrix(df_pure, station="PZ1")
        assert X.shape[1] == 38
        assert len(feat_names) == 38
        assert not X.isna().any().any()
        assert not y_flow.isna().any()
        assert not y_energy.isna().any()

        # 2. Train and rollout 720h forward
        reg = ScikitLearnEnergyRegressor("hist_gradient_boosting")
        reg.fit(df_pure, station="PZ1")
        pred_f, pred_e, s_f, s_e = reg.predict_720h(df_pure, PZ1_NOMINAL_DWF_PROFILE, station="PZ1")

        assert len(pred_f) == 720
        assert len(pred_e) == 720
        assert (pred_f >= 0.0).all()
        assert (pred_e >= 0.0).all()
        assert not np.isnan(pred_f).any()
        assert not np.isnan(pred_e).any()
        assert not np.isinf(pred_f).any()
        assert not np.isinf(pred_e).any()

    def test_rain_column_all_nan_or_all_zero(self):
        """Verify that presence of an all-NaN or all-zero rain gauge column does not crash or distort features."""
        dates = pd.date_range("2024-03-01 00:00:00", periods=500, freq="1h")
        df = pd.DataFrame({
            "flow_m3": np.random.uniform(20.0, 100.0, len(dates)),
            "energy_kwh": np.random.uniform(4.0, 25.0, len(dates)),
            "rain_mm": np.full(len(dates), np.nan),  # all NaN
            "precipitation": np.zeros(len(dates))     # all Zero
        }, index=dates)

        X, y_f, y_e, _ = extract_feature_matrix(df, station="PNB1")
        assert X.shape[1] == 38
        assert not X.isna().any().any()

        engine = HydroPulseMLEngine()
        res = engine.train_and_forecast(
            df=df,
            dwf_profile=np.array(PNB1_NOMINAL_DWF_PROFILE, dtype=float),
            station="PNB1",
            model_type="blended",
            horizon_hours=720
        )
        assert len(res["forecast_720h"]) == 720
        for item in res["forecast_720h"]:
            assert 0.0 <= item.lower_95_flow_m3 <= item.predicted_flow_m3 <= item.upper_95_flow_m3
            assert 0.0 <= item.lower_95_energy_kwh <= item.predicted_energy_kwh <= item.upper_95_energy_kwh

    def test_forecast_all_three_models_under_pure_scada(self):
        """Verify all three model branches (statistical_dwf, ml_ensemble, blended) operate on pure SCADA."""
        dates = pd.date_range("2024-06-01 00:00:00", periods=360, freq="1h")
        df = pd.DataFrame({
            "flow_m3": 40.0 + 15.0 * np.sin(2 * np.pi * dates.hour / 24.0),
            "energy_kwh": 5.0 + 2.0 * np.sin(2 * np.pi * dates.hour / 24.0)
        }, index=dates)

        dwf_arr = np.array(PZ1_NOMINAL_DWF_PROFILE, dtype=float)
        engine = HydroPulseMLEngine()
        for m_type in ["statistical_dwf", "ml_ensemble", "blended"]:
            out = engine.train_and_forecast(df, dwf_arr, station="PZ1", model_type=m_type)
            assert len(out["forecast_720h"]) == 720
            assert len(out["forecast_trends"]) == 48
            metrics = out["evaluation_metrics"]
            assert metrics.mae_flow >= 0.0
            assert metrics.mape_flow >= 0.0
            assert not np.isnan(metrics.r2_flow)

    def test_dwf_profile_list_vs_ndarray_type_handling(self):
        """Verify HydrodynamicHarmonicForecaster handles both Python list and np.ndarray seamlessly."""
        dates = pd.date_range("2024-06-01 00:00:00", periods=48, freq="1h")
        df = pd.DataFrame({"flow_m3": 40.0 + 10.0 * np.sin(2 * np.pi * dates.hour / 24.0)}, index=dates)

        # When passing raw Python list (from config.py), type coercion handles it cleanly without TypeError
        forecaster = HydrodynamicHarmonicForecaster()
        pred_f_list, pred_e_list, _, _ = forecaster.predict_720h(df, PZ1_NOMINAL_DWF_PROFILE, station="PZ1")
        assert len(pred_f_list) == 720

        # When passing np.ndarray (as etl_service._calculate_dwf_baseline produces), it succeeds cleanly
        dwf_arr = np.array(PZ1_NOMINAL_DWF_PROFILE, dtype=float)
        pred_f_arr, pred_e_arr, _, _ = forecaster.predict_720h(df, dwf_arr, station="PZ1")
        assert len(pred_f_arr) == 720
        np.testing.assert_allclose(pred_f_list, pred_f_arr)

    def test_real_rybnik_pz1_pure_scada_weather_resilience(self):
        """Verify real PZ1 2024 telemetry runs end-to-end without any rain data."""
        pz1_path = RYBNIK_DIR / "PZ1_2024.txt"
        assert pz1_path.exists()
        with open(pz1_path, "rb") as f:
            content = f.read()

        res = etl_service.evaluate_uploaded_dataset(file_content=content, filename="PZ1_2024.txt")
        assert res.total_measured_m3 > 0.0
        assert res.forecast_720h is not None
        assert len(res.forecast_720h) == 720
        assert res.evaluation_metrics is not None
        assert res.evaluation_metrics.mape_flow >= 0.0


# ==============================================================================
# CHALLENGE 2: NUMERICAL STABILITY OF GUARDED MAPE, MAE, R2, sMAPE
# ==============================================================================

class TestNumericalStabilityGuardedMetrics:
    """Stress tests verifying zero-division protection, NaN/Inf immunity, and edge-case behavior."""

    def test_zero_flow_all_zeros(self):
        """y_true = [0, 0, 0], y_pred = [0, 0, 0]: verify no zero division, NaN, or Inf."""
        y_true = np.zeros(100)
        y_pred = np.zeros(100)
        m = calculate_metrics(y_true, y_pred, eps=0.1)

        assert m["mae"] == 0.0
        assert m["mape"] == 0.0
        assert m["smape"] == 0.0
        assert m["r2"] == 1.0  # Perfect fit for identical constant zero series
        assert not np.isnan(m["mape"])
        assert not np.isinf(m["mape"])

    def test_zero_flow_actuals_with_nonzero_predictions(self):
        """y_true = [0, 0, 0], y_pred = [10, 20, 5]: denom clamped to eps=0.1, no Inf."""
        y_true = np.array([0.0, 0.0, 0.0])
        y_pred = np.array([10.0, 20.0, 5.0])
        m = calculate_metrics(y_true, y_pred, eps=0.1)

        # Expected: errors = [10, 20, 5], denom = [0.1, 0.1, 0.1]
        # mape = 100 * mean([100, 200, 50]) = 11666.67%
        assert np.isfinite(m["mape"])
        assert m["mape"] > 0.0
        assert np.isfinite(m["mae"])
        assert np.isfinite(m["smape"])
        assert np.isfinite(m["r2"])

    def test_near_zero_nocturnal_flow_mnf_stability(self):
        """Near-zero nocturnal minimum night flows (1e-6 to 0.05 m3/h): verify stable calculation."""
        mnf_levels = [1e-6, 1e-4, 0.001, 0.01, 0.05, 0.1]
        for mnf in mnf_levels:
            y_true = np.full(50, mnf)
            y_pred = np.full(50, mnf * 1.2)  # 20% overestimation
            m = calculate_metrics(y_true, y_pred, eps=0.1)

            assert np.isfinite(m["mae"])
            assert np.isfinite(m["mape"])
            assert np.isfinite(m["smape"])
            assert np.isfinite(m["r2"])
            assert m["mape"] >= 0.0

    def test_extreme_inflow_surges(self):
        """Extreme storm surges (1e4, 1e6, 1e8 m3/h): verify no numerical overflow or crash."""
        y_true = np.array([1e4, 5e5, 1e6, 1e8])
        y_pred = np.array([1.1e4, 4.9e5, 1.05e6, 0.95e8])
        m = calculate_metrics(y_true, y_pred, eps=0.1)

        assert np.isfinite(m["mae"])
        assert np.isfinite(m["mape"])
        assert np.isfinite(m["smape"])
        assert np.isfinite(m["r2"])
        # Expected MAPE should be roughly ~6-8%
        assert 0.0 < m["mape"] < 25.0

    def test_mixed_zero_near_zero_and_extreme_values(self):
        """Adversarial combination: zeros, near-zeros, and extreme surges in the same series."""
        y_true = np.array([0.0, 1e-5, 0.02, 50.0, 120.0, 50000.0, 0.0])
        y_pred = np.array([0.05, 0.0, 0.03, 48.0, 130.0, 52000.0, 0.0])
        m = calculate_metrics(y_true, y_pred, eps=0.1)

        for k, v in m.items():
            assert np.isfinite(v), f"Metric {k} was not finite: {v}"
            assert not np.isnan(v), f"Metric {k} was NaN: {v}"

    def test_empty_and_single_element_inputs(self):
        """Boundary condition: empty array or single element array."""
        m_empty = calculate_metrics([], [])
        assert m_empty == {"mae": 0.0, "mape": 0.0, "r2": 0.0, "smape": 0.0}

        m_single = calculate_metrics([42.0], [42.0])
        assert m_single["mae"] == 0.0
        assert m_single["mape"] == 0.0
        assert m_single["r2"] == 1.0

        m_single_diff = calculate_metrics([40.0], [50.0])
        assert m_single_diff["mae"] == 10.0
        assert m_single_diff["mape"] == 25.0

    def test_constant_series_zero_variance_r2_guard(self):
        """Constant series in y_true has zero variance (ss_tot == 0). Check zero-variance guard."""
        # Exact match
        m1 = calculate_metrics(np.full(100, 75.0), np.full(100, 75.0))
        assert m1["r2"] == 1.0

        # Inexact match on constant series
        m2 = calculate_metrics(np.full(100, 75.0), np.full(100, 80.0))
        assert m2["r2"] == 0.0
        assert m2["mae"] == 5.0
        assert np.isfinite(m2["mape"])


# ==============================================================================
# CHALLENGE 3: PROCESSING LATENCY BENCHMARK (< 1.5s REQUIREMENT)
# ==============================================================================

class TestProcessingLatency:
    """Stress tests measuring model training + 720h forward rollout latency under strictly enforced < 1.5s SLA."""

    def test_uncached_training_and_720h_rollout_hist_gradient_boosting(self):
        """Verify uncached HistGradientBoostingRegressor fit + 720h rollout strictly < 1.5s on full annual dataset."""
        dates = pd.date_range("2024-01-01", periods=8784, freq="1h")
        np.random.seed(42)
        flow = 50.0 + 25.0 * np.sin(2 * np.pi * dates.hour / 24.0) + np.random.normal(0, 3.0, 8784)
        df_8784 = pd.DataFrame({"flow_m3": np.maximum(5.0, flow)}, index=dates)

        reg = ScikitLearnEnergyRegressor("hist_gradient_boosting")
        # Ensure fresh instance without cache
        reg._cache.clear()

        t0 = time.perf_counter()
        reg.fit(df_8784, station="PZ1")
        pred_f, pred_e, s_f, s_e = reg.predict_720h(df_8784, PZ1_NOMINAL_DWF_PROFILE, station="PZ1")
        elapsed = time.perf_counter() - t0

        print(f"\n[LATENCY BENCHMARK] Uncached HGBR fit + 720h rollout (8,784 rows): {elapsed:.4f}s")
        assert len(pred_f) == 720
        assert elapsed < 1.5, f"Uncached HGBR execution took {elapsed:.4f}s (exceeded 1.5s SLA)!"

    def test_uncached_training_and_720h_rollout_ridge(self):
        """Verify uncached Ridge fit + 720h rollout strictly < 1.5s on full annual dataset."""
        dates = pd.date_range("2024-01-01", periods=8784, freq="1h")
        flow = 60.0 + 20.0 * np.sin(2 * np.pi * dates.hour / 24.0)
        df_8784 = pd.DataFrame({"flow_m3": flow}, index=dates)

        reg = ScikitLearnEnergyRegressor("ridge")
        reg._cache.clear()

        t0 = time.perf_counter()
        reg.fit(df_8784, station="PZ1")
        pred_f, pred_e, _, _ = reg.predict_720h(df_8784, PZ1_NOMINAL_DWF_PROFILE, station="PZ1")
        elapsed = time.perf_counter() - t0

        print(f"\n[LATENCY BENCHMARK] Uncached Ridge fit + 720h rollout (8,784 rows): {elapsed:.4f}s")
        assert len(pred_f) == 720
        assert elapsed < 1.5, f"Uncached Ridge execution took {elapsed:.4f}s (exceeded 1.5s SLA)!"

    def test_uncached_training_and_720h_rollout_random_forest(self):
        """Verify uncached RandomForestRegressor fit + 720h rollout strictly < 1.5s."""
        dates = pd.date_range("2024-01-01", periods=2160, freq="1h")  # 90 days
        flow = 50.0 + 20.0 * np.sin(2 * np.pi * dates.hour / 24.0)
        df = pd.DataFrame({"flow_m3": flow}, index=dates)

        reg = ScikitLearnEnergyRegressor("random_forest")
        reg._cache.clear()

        t0 = time.perf_counter()
        reg.fit(df, station="PZ1")
        pred_f, pred_e, _, _ = reg.predict_720h(df, PZ1_NOMINAL_DWF_PROFILE, station="PZ1")
        elapsed = time.perf_counter() - t0

        print(f"\n[LATENCY BENCHMARK] Uncached Random Forest fit + 720h rollout (2,160 rows): {elapsed:.4f}s")
        assert len(pred_f) == 720
        assert elapsed < 1.5, f"Uncached Random Forest execution took {elapsed:.4f}s (exceeded 1.5s SLA)!"

    def test_full_train_and_forecast_end_to_end_latency(self):
        """Verify full HydroPulseMLEngine.train_and_forecast (Branch 1 + Branch 2 + Blended + CIs) < 1.5s."""
        dates = pd.date_range("2024-01-01", periods=4000, freq="1h")
        df = pd.DataFrame({
            "flow_m3": 50.0 + 20.0 * np.sin(2 * np.pi * dates.hour / 24.0) + np.random.normal(0, 2.0, 4000),
            "energy_kwh": 6.5 + 2.5 * np.sin(2 * np.pi * dates.hour / 24.0)
        }, index=dates)

        engine = HydroPulseMLEngine()
        dwf_arr = np.array(PZ1_NOMINAL_DWF_PROFILE, dtype=float)
        # Cold run
        t0 = time.perf_counter()
        res = engine.train_and_forecast(df, dwf_arr, station="PZ1", model_type="blended", horizon_hours=720)
        elapsed = time.perf_counter() - t0

        print(f"\n[LATENCY BENCHMARK] Full train_and_forecast end-to-end (4,000 rows): {elapsed:.4f}s")
        assert len(res["forecast_720h"]) == 720
        assert elapsed < 1.5, f"train_and_forecast took {elapsed:.4f}s, exceeding 1.5s SLA!"

    def test_latency_repeatability_five_consecutive_runs(self):
        """Verify latency stability across 5 consecutive runs with no memory or GC degradation."""
        dates = pd.date_range("2024-01-01", periods=2000, freq="1h")
        df = pd.DataFrame({"flow_m3": 40.0 + 10.0 * np.sin(2 * np.pi * dates.hour / 24.0)}, index=dates)

        dwf_arr = np.array(PZ1_NOMINAL_DWF_PROFILE, dtype=float)
        latencies = []
        for i in range(5):
            eng = HydroPulseMLEngine()
            t0 = time.perf_counter()
            eng.train_and_forecast(df, dwf_arr, station="PZ1", model_type="blended")
            latencies.append(time.perf_counter() - t0)

        max_lat = max(latencies)
        mean_lat = np.mean(latencies)
        print(f"\n[LATENCY STABILITY] 5 runs -> mean: {mean_lat:.4f}s, max: {max_lat:.4f}s, min: {min(latencies):.4f}s")
        assert max_lat < 1.5, f"Maximum latency {max_lat:.4f}s exceeded 1.5s SLA!"


# ==============================================================================
# CHALLENGE 4: DUAL MODEL COMPARISON SCORECARD & HTTP API INTEGRATION
# ==============================================================================

class TestDualModelComparisonAndAPI:
    """Stress tests on compare_models and FastAPI endpoints."""

    def test_compare_models_generates_valid_scorecard(self):
        """Verify compare_models executes cleanly and returns complete scorecard with deltas."""
        dates = pd.date_range("2024-05-01", periods=1000, freq="1h")
        df = pd.DataFrame({
            "flow_m3": 70.0 + 20.0 * np.sin(2 * np.pi * dates.hour / 24.0),
            "energy_kwh": 8.0 + 2.0 * np.sin(2 * np.pi * dates.hour / 24.0)
        }, index=dates)

        dwf_arr = np.array(PZ1_NOMINAL_DWF_PROFILE, dtype=float)
        engine = HydroPulseMLEngine()
        scorecard = engine.compare_models(df, dwf_arr, station="PZ1")

        assert scorecard.station == "PZ1"
        assert scorecard.recommended_model in ["statistical_dwf", "ml_ensemble", "blended"]
        assert len(scorecard.deltas) == 6
        assert scorecard.statistical_dwf.metrics.mae_flow >= 0.0
        assert scorecard.ml_ensemble.metrics.mae_flow >= 0.0
        assert scorecard.blended.metrics.mae_flow >= 0.0
        assert len(scorecard.justification_pl) > 10

    def test_fastapi_models_compare_endpoint(self, client: TestClient):
        """Verify GET /api/models/compare endpoint returns 200 and schema compliant payload."""
        res = client.get("/api/models/compare?station=PZ1")
        assert res.status_code == 200
        data = res.json()
        assert data["station"] == "PZ1"
        assert "statistical_dwf" in data
        assert "ml_ensemble" in data
        assert "blended" in data
        assert "deltas" in data
        assert "recommended_model" in data

    def test_fastapi_inflow_analysis_all_model_types(self, client: TestClient):
        """Verify GET /api/inflow-analysis supports all model_type queries and returns 720h forecasts."""
        for m_type in ["statistical_dwf", "ml_ensemble", "blended"]:
            res = client.get(f"/api/inflow-analysis?station=PZ1&model_type={m_type}")
            assert res.status_code == 200
            data = res.json()
            assert data["model_type"] == m_type
            assert len(data.get("forecast_720h", [])) == 720
            assert len(data.get("forecast_trends", [])) == 48
            assert "evaluation_metrics" in data
            metrics = data["evaluation_metrics"]
            assert metrics["mape_flow"] >= 0.0
            assert not np.isnan(metrics["mape_flow"])
