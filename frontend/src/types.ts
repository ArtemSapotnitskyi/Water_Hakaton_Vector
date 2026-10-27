export interface TankState {
  id: string;
  name: string;
  volume_m3: number;
  max_volume_m3: number;
  level_m: number;
  max_level_m: number;
  pct_full: number;
  status: 'SAFE' | 'WARNING' | 'CRITICAL';
  ttc_minutes: number | null;
  inflow_m3_h: number;
  outflow_m3_h: number;
}

export interface PumpState {
  id: string;
  name: string;
  station_id: string;
  status: 'RUNNING' | 'STOPPED' | 'FAULT' | 'DEGRADED';
  current_A: number;
  flow_m3_h: number;
  efficiency_pct: number;
  power_kw: number;
  vibration_mm_s: number;
}

export interface ValveState {
  id: string;
  name: string;
  from_node: string;
  to_node: string;
  aperture_pct: number;
  flow_m3_h: number;
  max_flow_m3_h: number;
  mode: string;
}

export interface PipeState {
  id: string;
  from_node: string;
  to_node: string;
  flow_m3_h: number;
  capacity_m3_h: number;
  utilization_pct: number;
}

export interface IncidentRecord {
  id: string;
  timestamp: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  station: string;
  title: string;
  description: string;
  requires_ack?: boolean;
  acknowledged?: boolean;
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
}

export interface TelemetrySnapshot {
  timestamp: string;
  sim_time: string;
  rain_mm_h: number;
  rain_status: 'DRY' | 'LIGHT' | 'MODERATE' | 'HEAVY' | 'EXTREME';
  mode: 'AUTO' | 'MANUAL';
  is_paused: boolean;
  speed_factor: number;
  tanks: Record<string, TankState>;
  pumps: Record<string, PumpState>;
  valves: Record<string, ValveState>;
  pipes: Record<string, PipeState>;
  active_alarms: IncidentRecord[];
  active_blocking_alarm: IncidentRecord | null;
  total_inflow_m3_h: number;
  total_outflow_m3_h: number;
  diverted_to_buffer_m3: number;
  cost_accumulated_pln: number;
}

export interface DatasetMetadata {
  filename: string;
  file_size_kb: number;
  total_records: number;
  date_range: string;
  data_type: string;
  sampling_rate: string;
  quality_score: number;
}

export interface ForecastItem {
  time: string;
  predicted_flow_m3: number;
  dwf_baseline_m3: number;
  upper_bound_m3: number;
  lower_bound_m3: number;
  predicted_energy_kwh: number;
  risk_level: 'SAFE' | 'ELEVATED' | 'CRITICAL';
}

export interface JuryReportItem {
  date: string;
  time_range: string;
  station: string;
  dwf_baseline_m3: number;
  measured_flow_m3: number;
  accidental_water_m3: number;
  excess_energy_kwh: number;
  financial_loss_pln: number;
  anomaly_type: string;
  status: string;
  severity?: 'CRITICAL' | 'WARNING' | 'INFO';
  equipment_affected?: string;
  root_cause?: string;
  recommended_action?: string;
}

export interface HourlyTrend {
  time: string;
  measured_m3: number;
  dwf_baseline_m3: number;
  accidental_m3: number;
  energy_kwh: number;
  cost_pln: number;
}

export interface SeasonalBreakdownItem {
  period_id: string;
  label: string;
  sublabel: string;
  category: 'DWF' | 'INFILTRATION' | 'STORM';
  dwf_m3: number;
  accidental_m3: number;
  total_flow_m3: number;
  accidental_pct: number;
  dwf_pct: number;
  relative_height_pct: number;
  peak_flow_m3_h: number;
  energy_cost_pln: number;
}

export interface EnergyHourlyItem {
  hour: string;
  kwh: number;
  rain_mm_h: number;
  power_kw: number;
  cost_c11_pln: number;
  cost_c12a_pln: number;
  tariff_zone: string;
  is_peak: boolean;
}

export interface EnergyMonthlyItem {
  month: string;
  total_kwh: number;
  peak_kwh: number;
  offpeak_kwh: number;
  cost_c11_pln: number;
  cost_c12a_pln: number;
  savings_pln: number;
}

export interface PumpFleetItem {
  id: string;
  name: string;
  station: string;
  power_kw: number;
  current_A: number;
  flow_m3_h: number;
  seu_kwh_m3: number;
  efficiency_pct: number;
  health_status: 'OPTIMAL' | 'WARNING' | 'CRITICAL';
  note: string;
  annual_cost_pln: number;
}

export interface EnergyAnalyticsResponse {
  station: string;
  tariff_type: string;
  tariff_rate_c11: number;
  tariff_rate_c12a_peak: number;
  tariff_rate_c12a_offpeak: number;
  current_power_kw: number;
  p1_kw: number;
  p2_kw: number;
  average_efficiency_pct: number;
  total_annual_cost_pln: number;
  accidental_water_cost_pln: number;
  potential_savings_c12a_pln: number;
  r2_correlation_rain_energy: number;
  hourly_cycle: EnergyHourlyItem[];
  monthly_trends: EnergyMonthlyItem[];
  scatter_points: { rain_mm_h: number; energy_kwh: number; label: string }[];
  pump_fleet: PumpFleetItem[];
}

export interface InflowAnalysisResponse {
  station: string;
  total_measured_m3: number;
  total_dwf_m3: number;
  total_accidental_m3: number;
  accidental_water_pct: number;
  total_energy_kwh: number;
  accidental_energy_kwh: number;
  financial_cost_pln: number;
  events_count: number;
  hourly_trends: HourlyTrend[];
  jury_records: JuryReportItem[];
  metadata?: DatasetMetadata;
  forecast_trends?: ForecastItem[];
  failures_summary?: Record<string, number>;
  seasonal_breakdown?: SeasonalBreakdownItem[];
}
