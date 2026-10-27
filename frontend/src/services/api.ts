import { TelemetrySnapshot, InflowAnalysisResponse, IncidentRecord, EnergyAnalyticsResponse } from '../types';

const API_BASE = '/api';

export async function getEnergyAnalytics(
  station = 'PZ1',
  tariff = 'C12A'
): Promise<EnergyAnalyticsResponse> {
  const res = await fetch(`${API_BASE}/energy/analytics?station=${station}&tariff=${tariff}`);
  if (!res.ok) throw new Error('Failed to fetch energy analytics');
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
}) {
  const res = await fetch(`${API_BASE}/simulation/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
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
  sensitivity = 1.2
): Promise<InflowAnalysisResponse> {
  const res = await fetch(
    `${API_BASE}/inflow-analysis?station=${station}&sensitivity=${sensitivity}`
  );
  if (!res.ok) throw new Error('Failed to fetch inflow analysis');
  return res.json();
}

export async function getIncidents(): Promise<IncidentRecord[]> {
  const res = await fetch(`${API_BASE}/incidents`);
  if (!res.ok) throw new Error('Failed to fetch incidents');
  return res.json();
}

export function getJuryReportExportUrl(station = 'PZ1', sensitivity = 1.2): string {
  return `${API_BASE}/export/jury-report?station=${station}&sensitivity=${sensitivity}`;
}
