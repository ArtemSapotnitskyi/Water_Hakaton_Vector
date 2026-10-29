from typing import Dict, List, Optional, Literal, Any, Union
from pydantic import BaseModel, Field


class TankState(BaseModel):
    id: str
    name: str
    volume_m3: float
    max_volume_m3: float
    level_m: float
    max_level_m: float
    pct_full: float
    status: str  # "SAFE", "WARNING", "CRITICAL"
    ttc_minutes: Optional[float] = None
    inflow_m3_h: float
    outflow_m3_h: float

class PumpState(BaseModel):
    id: str
    name: str
    station_id: str
    status: str  # "RUNNING", "STOPPED", "FAULT", "DEGRADED"
    current_A: float
    flow_m3_h: float
    efficiency_pct: float
    power_kw: float
    vibration_mm_s: float

class ValveState(BaseModel):
    id: str
    name: str
    from_node: str
    to_node: str
    aperture_pct: float  # 0 to 100%
    flow_m3_h: float
    max_flow_m3_h: float
    mode: str  # "AUTO", "MANUAL"

class PipeState(BaseModel):
    id: str
    from_node: str
    to_node: str
    flow_m3_h: float
    capacity_m3_h: float
    utilization_pct: float

class IncidentRecord(BaseModel):
    id: str
    timestamp: str
    severity: str  # "INFO", "WARNING", "CRITICAL"
    station: str
    title: str
    description: str
    requires_ack: bool = False
    acknowledged: bool = False
    acknowledged_at: Optional[str] = None
    acknowledged_by: Optional[str] = None

class TelemetrySnapshot(BaseModel):
    timestamp: str
    sim_time: str
    rain_mm_h: float
    rain_status: str  # "DRY", "LIGHT", "MODERATE", "HEAVY", "EXTREME"
    mode: str  # "AUTO", "MANUAL"
    is_paused: bool
    speed_factor: float
    tanks: Dict[str, TankState]
    pumps: Dict[str, PumpState]
    valves: Dict[str, ValveState]
    pipes: Dict[str, PipeState]
    active_alarms: List[IncidentRecord]
    active_blocking_alarm: Optional[IncidentRecord] = None
    total_inflow_m3_h: float
    total_outflow_m3_h: float
    diverted_to_buffer_m3: float
    cost_accumulated_pln: float
    dataset_id: Optional[str] = "rybnik_2025_2026_test"
    dataset_name: Optional[str] = "Zbiór weryfikacyjny 2025–2026 (PZ-1 + PNB-1)"
    timeline_index: Optional[int] = 0
    timeline_total: Optional[int] = 0
    timeline_progress_pct: Optional[float] = 0.0
    measured_flow_pz1_m3_h: Optional[float] = 0.0
    measured_flow_pnb1_m3_h: Optional[float] = 0.0
    measured_energy_kwh: Optional[float] = 0.0

class SimulationControlRequest(BaseModel):
    action: str  # "play", "pause", "set_speed", "set_mode", "inject_disaster", "acknowledge_alarm", "reset", "seek_timeline", "set_dataset", "jump_to_event"
    speed: Optional[float] = None
    mode: Optional[str] = None
    disaster_type: Optional[str] = None  # "rain_150", "pump_trip_p1", "power_outage", "reset_all", or event bookmark id
    alarm_id: Optional[str] = None
    operator: Optional[str] = "Dyspozytor Główny"
    dataset_id: Optional[str] = None
    timeline_index: Optional[int] = None

class ValveControlRequest(BaseModel):
    valve_id: str
    aperture_pct: float

class PumpControlRequest(BaseModel):
    pump_id: str
    action: str  # "start", "stop", "trip"

class DatasetMetadata(BaseModel):
    filename: str
    file_size_kb: float
    total_records: int
    date_range: str
    data_type: str
    sampling_rate: str
    quality_score: float

class ForecastItem(BaseModel):
    time: str
    predicted_flow_m3: float
    dwf_baseline_m3: float
    upper_bound_m3: float
    lower_bound_m3: float
    predicted_energy_kwh: float
    risk_level: str  # "SAFE", "ELEVATED", "CRITICAL"

class JuryReportItem(BaseModel):
    date: str
    time_range: str
    station: str
    dwf_baseline_m3: float
    measured_flow_m3: float
    accidental_water_m3: float  # wody przypadkowe
    excess_energy_kwh: float
    financial_loss_pln: float
    anomaly_type: str
    status: str
    severity: Optional[str] = "CRITICAL"
    equipment_affected: Optional[str] = None
    root_cause: Optional[str] = None
    recommended_action: Optional[str] = None

class SeasonalBreakdownItem(BaseModel):
    period_id: str
    label: str
    sublabel: str
    category: str
    dwf_m3: float
    accidental_m3: float
    total_flow_m3: float
    accidental_pct: float
    dwf_pct: float
    relative_height_pct: float
    peak_flow_m3_h: float
    energy_cost_pln: float

class EnergyHourlyItem(BaseModel):
    hour: str
    kwh: float
    rain_mm_h: float
    power_kw: float
    cost_c11_pln: float
    cost_c12a_pln: float
    tariff_zone: str
    is_peak: bool

class EnergyMonthlyItem(BaseModel):
    month: str
    total_kwh: float
    peak_kwh: float
    offpeak_kwh: float
    cost_c11_pln: float
    cost_c12a_pln: float
    savings_pln: float

class PumpFleetItem(BaseModel):
    id: str
    name: str
    station: str
    power_kw: float
    current_A: float
    flow_m3_h: float
    seu_kwh_m3: float
    efficiency_pct: float
    health_status: str
    note: str
    annual_cost_pln: float

class EnergyAnalyticsResponse(BaseModel):
    station: str
    tariff_type: str
    tariff_rate_c11: float
    tariff_rate_c12a_peak: float
    tariff_rate_c12a_offpeak: float
    current_power_kw: float
    p1_kw: float
    p2_kw: float
    average_efficiency_pct: float
    total_annual_cost_pln: float
    accidental_water_cost_pln: float
    potential_savings_c12a_pln: float
    r2_correlation_rain_energy: float
    hourly_cycle: List[EnergyHourlyItem]
    monthly_trends: List[EnergyMonthlyItem]
    scatter_points: List[dict]
    pump_fleet: List[PumpFleetItem]
    dataset_name: Optional[str] = None
    dataset_preset: Optional[str] = None
    dataset_records: Optional[int] = None
    dataset_date_range: Optional[str] = None

class RawVsCleanedStats(BaseModel):
    is_cleaned: bool = Field(..., description="Whether sensor calibration anomalies were masked and sanitized")
    corrupted_records_count: int = Field(..., description="Total raw SCADA telemetry records tainted in the anomaly window")
    masked_window_start: str = Field(..., description="ISO timestamp of corrupted window start")
    masked_window_end: str = Field(..., description="ISO timestamp of corrupted window end")
    anomaly_description: Optional[str] = None

class FeatureImportanceItem(BaseModel):
    feature_name: str = Field(..., description="Technical feature identifier (e.g. flow_lag_1, delta_flow_1h)")
    display_name: str = Field(..., description="Human-readable Polish label for dispatcher")
    importance_pct: float = Field(..., description="Normalized importance percentage [0-100%]")
    category: str = Field(..., description="Feature category: TELEMETRY_LAG, FLOW_DYNAMICS, CALENDAR_CYCLE, SEASONAL")
    description: str = Field(..., description="Physical explanation of what this feature captures")

class EvaluationMetricsPayload(BaseModel):
    mae_flow: float = Field(..., description="Mean Absolute Error for flow in m3/h")
    mape_flow: float = Field(..., description="Epsilon-guarded MAPE for flow in %")
    r2_flow: float = Field(..., description="Coefficient of determination R2 for flow")
    mae_energy: float = Field(..., description="Mean Absolute Error for energy in kWh")
    mape_energy: float = Field(..., description="Epsilon-guarded MAPE for energy in %")
    r2_energy: float = Field(..., description="Coefficient of determination R2 for energy")
    smape_energy: Optional[float] = Field(None, description="Symmetric MAPE for energy in %")

class SingleModelEvaluation(BaseModel):
    model_id: Literal["statistical_dwf", "ml_ensemble", "blended"]
    model_name: str
    model_description: str
    metrics: EvaluationMetricsPayload
    training_time_ms: float
    inference_time_ms: float

class MetricDeltaItem(BaseModel):
    absolute_diff: float
    improvement_pct: float
    winner: Literal["statistical_dwf", "ml_ensemble", "tie"]

class DualModelComparisonResponse(BaseModel):
    station: str
    evaluation_window: Dict[str, Any]
    statistical_dwf: SingleModelEvaluation
    ml_ensemble: SingleModelEvaluation
    blended: SingleModelEvaluation
    deltas: Dict[str, MetricDeltaItem]
    recommended_model: Literal["statistical_dwf", "ml_ensemble", "blended"]
    justification_pl: str
    justification_en: str

class Forecast720hItem(BaseModel):
    timestamp: str = Field(..., description="ISO timestamp YYYY-MM-DDTHH:00:00")
    time_label: str = Field(..., description="Short display label e.g. 15.07 14:00")
    hour_index: int = Field(..., description="Horizon hour index 0..719")
    predicted_flow_m3: float
    predicted_energy_kwh: float
    dwf_baseline_m3: float
    dwf_baseline_kwh: float
    lower_95_flow_m3: float
    upper_95_flow_m3: float
    lower_95_energy_kwh: float
    upper_95_energy_kwh: float
    risk_level: Literal["SAFE", "ELEVATED", "CRITICAL"] = "SAFE"
    predicted_kwh: Optional[float] = None
    lower_95_kwh: Optional[float] = None
    upper_95_kwh: Optional[float] = None

class InfiltrationBreakdown(BaseModel):
    groundwater_pct: float = Field(..., description="Infiltracja gruntowa - procent udzialu")
    groundwater_m3: float = Field(..., description="Infiltracja gruntowa - objetosc w m3")
    roof_gutters_pct: float = Field(..., description="Nielegalne wpiecia rynien - procent udzialu")
    roof_gutters_m3: float = Field(..., description="Nielegalne wpiecia rynien - objetosc w m3")
    manholes_surface_pct: float = Field(..., description="Wlazy i splyw powierzchniowy - procent udzialu")
    manholes_surface_m3: float = Field(..., description="Wlazy i splyw powierzchniowy - objetosc w m3")
    catchment_name: str = Field(..., description="Nazwa analizowanej zlewni / stacji")
    methodology: str = Field(
        default="Bilans hydrodynamiczny min/max (PN-EN 752 / ATV-A 118)",
        description="Metoda dekompozycji fizycznej"
    )

class InflowAnalysisResponse(BaseModel):
    station: str
    total_measured_m3: float
    total_dwf_m3: float
    total_accidental_m3: float
    accidental_water_pct: float
    total_energy_kwh: float
    accidental_energy_kwh: float
    financial_cost_pln: float
    events_count: int
    hourly_trends: List[dict]
    jury_records: List[JuryReportItem]
    metadata: Optional[DatasetMetadata] = None
    forecast_trends: Optional[List[ForecastItem]] = None
    failures_summary: Optional[Dict[str, int]] = None
    seasonal_breakdown: Optional[List[dict]] = None
    raw_vs_cleaned_stats: Optional[RawVsCleanedStats] = None
    model_type: Optional[str] = "blended"
    evaluation_metrics: Optional[EvaluationMetricsPayload] = None
    feature_importance: Optional[List[FeatureImportanceItem]] = None
    forecast_720h: Optional[List[Forecast720hItem]] = None
    dwf_series: Optional[List[dict]] = None
    dual_model_comparison: Optional[DualModelComparisonResponse] = None
    infiltration_breakdown: Optional[InfiltrationBreakdown] = None

