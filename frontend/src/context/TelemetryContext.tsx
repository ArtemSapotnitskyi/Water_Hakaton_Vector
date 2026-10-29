import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { TelemetrySnapshot, InflowAnalysisResponse } from '../types';
import { getLatestTelemetry, controlSimulation, setValve, setPump } from '../services/api';

type Language = 'pl' | 'en';

interface TelemetryContextType {
  telemetry: TelemetrySnapshot | null;
  isConnected: boolean;
  lang: Language;
  setLang: (l: Language) => void;
  playSimulation: () => void;
  pauseSimulation: () => void;
  setSimulationSpeed: (speed: number) => void;
  setSimulationMode: (mode: 'AUTO' | 'MANUAL') => void;
  injectDisaster: (type: 'rain_150' | 'pump_trip_p1' | 'reset_all') => void;
  acknowledgeAlarm: () => void;
  adjustValve: (valveId: string, pct: number) => void;
  togglePump: (pumpId: string, action: 'start' | 'stop' | 'trip') => void;
  seekSimulationTimeline: (index: number) => void;
  setSimulationDataset: (datasetId: string) => void;
  jumpToSimulationEvent: (eventId: string) => void;
  t: (key: string) => string;
  selectedBenchmarkPreset: string;
  setSelectedBenchmarkPreset: (preset: string) => void;
  activeDatasetName: string;
  setActiveDatasetName: (name: string) => void;
  benchmarkResult: InflowAnalysisResponse | null;
  setBenchmarkResult: (res: InflowAnalysisResponse | null) => void;
}

const translations: Record<Language, Record<string, string>> = {
  pl: {
    overview: 'Przegląd sieci',
    scada_twin: 'Cyfrowy Bliźniak (SCADA)',
    rybnik_benchmark: 'Ewaluacja Rybnik 2025–2026',
    valves_flows: 'Zasuwy i Przepływy',
    inflow_analysis: 'Wody Przypadkowe (DWF)',
    energy_costs: 'Efektywność i Koszty',
    pump_health: 'Kondycja Pomp',
    incident_log: 'Dziennik Zdarzeń',
    notifications: 'Powiadomienia',
    settings: 'Ustawienia',
    help: 'Pomoc i Dokumentacja',
    dispatcher: 'Dyspozytor Główny',
    role: 'PWiK Centrum Dyspozytorskie',
    live_scada: 'Telemetria Na Żywo',
    auto_mode: 'AUTO (Algorytm)',
    manual_mode: 'MANUAL (Dyspozytor)',
    export_report: 'Eksportuj Raport (CSV)',
    storm_replay: 'Scenariusz burzowy 13.07.2024',
    inject_disaster: 'Symulacja Zdarzeń',
    rain_spike: 'Nawałnica 194.8 mm/h',
    pump_trip: 'Awaria Pompy P1',
    reset_state: 'Reset parametrów',
    alarm_critical: 'ALARM KRYTYCZNY',
    confirm_alarm: 'Potwierdź przyjęcie alarmu (ACK)',
    execute_emergency: 'Zastosuj procedurę awaryjną (Otwórz Z12)',
    safe: 'Bezpieczny',
    warning: 'Ostrzeżenie',
    critical: 'Krytyczny',
    ttc_label: 'Czas do spiętrzenia (TTC)',
  },
  en: {
    overview: 'Network Overview',
    scada_twin: 'Digital Twin (SCADA)',
    rybnik_benchmark: 'Rybnik 2025–2026 Evaluation',
    valves_flows: 'Valves & Flow Routing',
    inflow_analysis: 'Inflow & Infiltration (DWF)',
    energy_costs: 'Energy & Financial Costs',
    pump_health: 'Pump Degradation',
    incident_log: 'Incident Log',
    notifications: 'Notifications',
    settings: 'Settings',
    help: 'Help & Documentation',
    dispatcher: 'Chief Dispatcher',
    role: 'PWiK Operations Center',
    live_scada: 'Live SCADA Stream',
    auto_mode: 'AUTO (Algorithmic)',
    manual_mode: 'MANUAL (Override)',
    export_report: 'Export Report (CSV)',
    storm_replay: 'Historic Storm 13.07.2024',
    inject_disaster: 'Simulate Event',
    rain_spike: 'Flash Flood 194.8 mm/h',
    pump_trip: 'Pump P1 Trip',
    reset_state: 'Reset System',
    alarm_critical: 'CRITICAL ALARM',
    confirm_alarm: 'Acknowledge Alarm (ACK)',
    execute_emergency: 'Execute Emergency Diversion (Open Z12)',
    safe: 'Safe',
    warning: 'Warning',
    critical: 'Critical',
    ttc_label: 'Time To Critical (TTC)',
  },
};

const TelemetryContext = createContext<TelemetryContextType | undefined>(undefined);

export const TelemetryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lang, setLang] = useState<Language>('pl');
  const [selectedBenchmarkPreset, setSelectedBenchmarkPreset] = useState<string>('rybnik_2025_2026_test');
  const [activeDatasetName, setActiveDatasetName] = useState<string>('Zbiór Ewaluacyjny Rybnik 2025–2026');
  const [benchmarkResult, setBenchmarkResult] = useState<InflowAnalysisResponse | null>(null);

  const t = (key: string): string => {
    return translations[lang]?.[key] || key;
  };

  useEffect(() => {
    // Initial fetch via REST
    getLatestTelemetry().then(setTelemetry).catch(console.error);

    // WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/telemetry`;
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWS = () => {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data: TelemetrySnapshot = JSON.parse(event.data);
          setTelemetry(data);
        } catch (e) {
          console.error('WS parse error:', e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        reconnectTimeout = setTimeout(connectWS, 2000);
      };

      ws.onerror = (err) => {
        console.error('WS error:', err);
        ws?.close();
      };
    };

    connectWS();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  const playSimulation = () => controlSimulation({ action: 'play' });
  const pauseSimulation = () => controlSimulation({ action: 'pause' });
  const setSimulationSpeed = (speed: number) => controlSimulation({ action: 'set_speed', speed });
  const setSimulationMode = (mode: 'AUTO' | 'MANUAL') => controlSimulation({ action: 'set_mode', mode });
  const injectDisaster = (type: 'rain_150' | 'pump_trip_p1' | 'reset_all') =>
    controlSimulation({ action: 'inject_disaster', disaster_type: type });
  const acknowledgeAlarm = () => controlSimulation({ action: 'acknowledge_alarm' });
  const adjustValve = (valveId: string, pct: number) => setValve(valveId, pct);
  const togglePump = (pumpId: string, action: 'start' | 'stop' | 'trip') => setPump(pumpId, action);
  const seekSimulationTimeline = (index: number) =>
    controlSimulation({ action: 'seek_timeline', timeline_index: index });
  const setSimulationDataset = (datasetId: string) =>
    controlSimulation({ action: 'set_dataset', dataset_id: datasetId });
  const jumpToSimulationEvent = (eventId: string) =>
    controlSimulation({ action: 'jump_to_event', disaster_type: eventId });

  return (
    <TelemetryContext.Provider
      value={{
        telemetry,
        isConnected,
        lang,
        setLang,
        playSimulation,
        pauseSimulation,
        setSimulationSpeed,
        setSimulationMode,
        injectDisaster,
        acknowledgeAlarm,
        adjustValve,
        togglePump,
        seekSimulationTimeline,
        setSimulationDataset,
        jumpToSimulationEvent,
        t,
        selectedBenchmarkPreset,
        setSelectedBenchmarkPreset,
        activeDatasetName,
        setActiveDatasetName,
        benchmarkResult,
        setBenchmarkResult,
      }}
    >
      {children}
    </TelemetryContext.Provider>
  );
};

export const useTelemetry = () => {
  const ctx = useContext(TelemetryContext);
  if (!ctx) throw new Error('useTelemetry must be used within TelemetryProvider');
  return ctx;
};
