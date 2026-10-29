import {
  TelemetrySnapshot,
  InflowAnalysisResponse,
  IncidentRecord,
  EnergyAnalyticsResponse,
  DualModelComparisonResponse
} from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || '/api';

export async function getEnergyAnalytics(
  station = 'PZ1',
  tariff = 'C12A',
  preset?: string
): Promise<EnergyAnalyticsResponse> {
  const pParam = preset ? `&preset=${encodeURIComponent(preset)}` : '';
  const res = await fetch(`${API_BASE}/energy/analytics?station=${station}&tariff=${tariff}${pParam}`);
  if (!res.ok) throw new Error('Failed to fetch energy analytics');
  return res.json();
}

export async function uploadEnergyDataset(
  files: File[],
  station = 'PZ1',
  tariff = 'C12A'
): Promise<EnergyAnalyticsResponse> {
  const formData = new FormData();
  files.forEach((f) => formData.append('files', f));
  const res = await fetch(`${API_BASE}/energy/upload?station=${station}&tariff=${tariff}`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Failed to upload energy dataset');
  return res.json();
}

export async function getLatestTelemetry(): Promise<TelemetrySnapshot> {
  const res = await fetch(`${API_BASE}/telemetry/latest`);
  if (!res.ok) throw new Error('Failed to fetch telemetry');
  return res.json();
}

export async function controlSimulation(data: {
  action: string;
  speed?: number;
  mode?: string;
  disaster_type?: string;
  alarm_id?: string;
  operator?: string;
  dataset_id?: string;
  timeline_index?: number;
}) {
  const res = await fetch(`${API_BASE}/simulation/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function seekSimulationTimeline(index: number) {
  return controlSimulation({ action: 'seek_timeline', timeline_index: index });
}

export async function setSimulationDataset(datasetId: string) {
  return controlSimulation({ action: 'set_dataset', dataset_id: datasetId });
}

export async function jumpToSimulationEvent(eventId: string) {
  return controlSimulation({ action: 'jump_to_event', disaster_type: eventId });
}

export async function setValve(valveId: string, aperturePct: number) {
  const res = await fetch(`${API_BASE}/valves/set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ valve_id: valveId, aperture_pct: aperturePct }),
  });
  return res.json();
}

export async function setPump(pumpId: string, action: 'start' | 'stop' | 'trip') {
  const res = await fetch(`${API_BASE}/pumps/set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pump_id: pumpId, action }),
  });
  return res.json();
}

export async function getInflowAnalysis(
  station = 'PZ1',
  sensitivity = 1.2,
  cleanData = true,
  modelType: 'statistical_dwf' | 'ml_ensemble' | 'blended' = 'blended',
  preset?: string
): Promise<InflowAnalysisResponse> {
  const pParam = preset ? `&preset=${encodeURIComponent(preset)}` : '';
  const res = await fetch(
    `${API_BASE}/inflow-analysis?station=${station}&sensitivity=${sensitivity}&clean_data=${cleanData}&model_type=${modelType}${pParam}`
  );
  if (!res.ok) throw new Error('Failed to fetch inflow analysis');
  return res.json();
}

export async function getModelComparison(
  station = 'PZ1',
  sensitivity = 1.2,
  cleanData = true
): Promise<DualModelComparisonResponse> {
  const res = await fetch(
    `${API_BASE}/models/compare?station=${station}&sensitivity=${sensitivity}&clean_data=${cleanData}`
  );
  if (!res.ok) throw new Error('Failed to fetch model comparison');
  return res.json();
}

export async function getIncidents(): Promise<IncidentRecord[]> {
  const res = await fetch(`${API_BASE}/incidents`);
  if (!res.ok) throw new Error('Failed to fetch incidents');
  return res.json();
}

export function getJuryReportExportUrl(_station?: string, _sensitivity?: number): string {
  return `${API_BASE}/benchmark/export`;
}
