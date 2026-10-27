import React, { useState } from 'react';
import {
  ShieldAlert,
  ArrowRight,
  Droplet,
  CloudRain,
  Sparkles,
  Zap,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Layers,
  ArrowDownRight,
  MapPin,
  Cpu,
  SlidersHorizontal
} from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';
import { AdvancedCollectorMapView } from './AdvancedCollectorMapView';

export const ScadaTwinView: React.FC = () => {
  const { telemetry, adjustValve, togglePump, lang, injectDisaster } = useTelemetry();
  const [viewMode, setViewModeState] = useState<'SIMPLE' | 'ADVANCED'>(() => {
    try {
      const saved = localStorage.getItem('hydroflow_scada_view_mode');
      if (saved === 'SIMPLE' || saved === 'ADVANCED') return saved;
    } catch {
      // ignore
    }
    return 'ADVANCED';
  });

  const setViewMode = (mode: 'SIMPLE' | 'ADVANCED') => {
    setViewModeState(mode);
    try {
      localStorage.setItem('hydroflow_scada_view_mode', mode);
    } catch {
      // ignore
    }
  };

  if (!telemetry) {
    return (
      <div className="p-8 text-center text-slate-400">
        Ładowanie parametrów sieci PWiK Rybnik...
      </div>
    );
  }

  const { tanks, pumps, valves, rain_mm_h, rain_status } = telemetry;
  
  // Real Rybnik stations
  const pz1 = tanks.R1;  // PZ-1 (Zamysłów, ul. Pełczyńskiego) ZR=311.4 m3
  const pnb1 = tanks.R2; // PNB-1 (Niewiadom, ul. Nakłończyka) ZR=48.2 m3
  const wwtp = tanks.R3; // Oczyszczalnia Orzepowice (27 500 m3/doba)

  const zPz1 = valves.Z12;  // Discharge valve PZ1 -> Kolektor B
  const zPnb1 = valves.Z13; // Discharge valve PNB1 -> Kolektor B

  const p1Pz1 = pumps.P1_R1;
  const p2Pz1 = pumps.P2_R1;
  const p1Pnb1 = pumps.P1_R3;

  const getStatusColor = (status: string) => {
    if (status === 'CRITICAL') return 'text-rose-600 bg-rose-50 border-rose-200';
    if (status === 'WARNING') return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  };

  return (
    <div className="p-8 space-y-6">
      {/* Top SCADA Quick Stats Bar */}
      <div data-tour="scada-stats" className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#e8ecf1] shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
            <span>Dopływ Burzowy PZ-1 (Zamysłów)</span>
            <CloudRain className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {pz1?.inflow_m3_h ?? 0} <span className="text-xs font-normal text-slate-500">m³/h</span>
          </div>
          <div className="mt-1 flex items-center space-x-1 text-[11px] text-blue-600 font-semibold">
            <span>Opad: {rain_mm_h} mm/h</span>
            <span className="text-slate-400">({rain_status})</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#e8ecf1] shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
            <span>TTC Zbiornika PZ-1 (ZR 311.4 m³)</span>
            <Activity className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {pz1?.ttc_minutes !== null ? `${pz1?.ttc_minutes} min` : 'Bezpieczny'}
          </div>
          <div className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(pz1?.status || 'SAFE')}`}>
            {pz1?.status === 'CRITICAL' ? 'ALARM: PRZELEW RETENCJI' : (pz1?.status === 'WARNING' ? 'UWAGA: ZR > 75%' : 'STABILNY')}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#e8ecf1] shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
            <span>Obciążenie Kolektora B (Tranzyt)</span>
            <Droplet className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {wwtp?.inflow_m3_h ?? 720} <span className="text-xs font-normal text-slate-500">m³/h</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-medium">
            Limit Oczyszczalni Orzepowice: <strong className="text-slate-800">1 145 m³/h</strong>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#e8ecf1] shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
            <span>Koszt Tłoczenia Ścieków</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {telemetry.cost_accumulated_pln} <span className="text-xs font-normal text-slate-500">PLN</span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-600 font-medium">
            Taryfa PWiK Rybnik: 1.00 zł/kWh
          </div>
        </div>
      </div>

      {/* View Mode Toggle: Simple vs Advanced Collector Map */}
      <div className="flex items-center justify-between bg-white p-3 rounded-3xl border border-[#e8ecf1] shadow-2xs">
        <div className="flex items-center space-x-2">
          <div className="flex bg-slate-100 p-1 rounded-2xl space-x-1">
            <button
              onClick={() => setViewMode('SIMPLE')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
                viewMode === 'SIMPLE'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Cpu className="w-4 h-4 text-blue-600" />
              <span>{lang === 'pl' ? 'Tryb Podstawowy (Schemat PZ-1 / PNB-1)' : 'Basic Mode (Twin PZ-1 / PNB-1)'}</span>
            </button>

            <button
              onClick={() => setViewMode('ADVANCED')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
                viewMode === 'ADVANCED'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>{lang === 'pl' ? 'Tryb Zaawansowany: Mapa Kolektorów i Pompowni' : 'Advanced Mode: Collector & Station Map'}</span>
              <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-emerald-100 text-emerald-800 font-extrabold ml-1">
                PWiK Rybnik
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-400 font-semibold pr-3">
          {viewMode === 'SIMPLE' ? (
            <span>{lang === 'pl' ? 'Widok operacyjny kaskady Kolektora B' : 'Operational cascade view for Collector B'}</span>
          ) : (
            <span>{lang === 'pl' ? 'Topologia zlewisk A, B, C, przelewów burzowych i rzeki Nacyny' : 'Topology of watersheds A, B, C, storm weirs & Nacyna river'}</span>
          )}
        </div>
      </div>

      {viewMode === 'ADVANCED' ? (
        <AdvancedCollectorMapView />
      ) : (
        /* Main Grid: Interactive Synoptic Board (Left) + Detail Panel (Right) */
        <div className="grid grid-cols-12 gap-6">
        {/* Synoptic Board (8 Cols) */}
        <div className="col-span-8 bg-white rounded-3xl p-6 border border-[#e8ecf1] shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-extrabold text-slate-900">
                    Synoptyczna Topologia Sieci PWiK Rybnik
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    Schemat: ul. Pod Lasem 62
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Kaskada pompowni zlewni Kolektora "B": PZ-1 (Zamysłów) oraz PNB-1 (Niewiadom) ➔ Oczyszczalnia Orzepowice
                </p>
              </div>

              {/* Legend matching Photo 2 */}
              <div className="flex items-center space-x-3 text-[11px] font-semibold">
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-400 inline-block" />
                  <span className="text-slate-600">Zamysłów (PZ)</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-300 inline-block" />
                  <span className="text-slate-600">Niewiadom (PNB)</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                  <span className="text-slate-600">Oczyszczalnia</span>
                </span>
              </div>
            </div>

            {/* Interactive SVG / Schematic Board */}
            <div className="relative w-full min-h-[420px] bg-[#f8fafc] rounded-2xl border border-slate-200/80 p-5 overflow-hidden flex flex-col justify-between">
              {/* Rain Indicator Badge */}
              {rain_mm_h > 2 && (
                <div className="absolute top-3 right-4 flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-100/90 text-blue-800 text-[11px] font-bold animate-pulse shadow-xs z-20">
                  <CloudRain className="w-3.5 h-3.5 text-blue-600" />
                  <span>Deszcz nad Rybnikiem: {rain_mm_h} mm/h</span>
                </div>
              )}

              {/* Top Row: Two Cascades (Zamysłów & Niewiadom) */}
              <div className="grid grid-cols-2 gap-6 z-10">
                {/* 1. Zamysłów Cascade & PZ-1 */}
                <div className="space-y-3">
                  {/* Upstream feeder info pill */}
                  <div className="flex items-center justify-between px-3 py-1.5 bg-rose-50/80 border border-rose-200 rounded-xl text-[11px]">
                    <span className="font-bold text-rose-900">Dopływ z kaskady: PZ-2 (ul. Dolna) & PZ-4</span>
                    <span className="text-rose-700 font-semibold">ZR = 254 m³</span>
                  </div>

                  {/* Main PZ-1 Station Box (Salmon colored border) */}
                  <div data-tour="scada-r1" className="bg-white rounded-2xl p-4 border-2 border-rose-200 shadow-sm flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-black text-slate-900">
                          PZ-1 (ul. Pełczyńskiego)
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          N=2x21 kW | I=42 A | Q=115 m³/h
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${getStatusColor(pz1?.status || 'SAFE')}`}>
                        ZR: {pz1?.pct_full ?? 0}%
                      </span>
                    </div>

                    {/* Fluid Retention Tank Bar */}
                    <div className="w-full h-20 bg-slate-100 rounded-xl overflow-hidden relative border border-slate-200 flex flex-col justify-end">
                      <div
                        className={`w-full transition-all duration-500 rounded-b-xl ${
                          pz1?.status === 'CRITICAL' ? 'bg-rose-500' : (pz1?.status === 'WARNING' ? 'bg-amber-400' : 'bg-blue-500')
                        }`}
                        style={{ height: `${Math.min(100, Math.max(15, pz1?.pct_full || 25))}%` }}
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-1">
                        <span className="text-xs font-black text-slate-900 drop-shadow-xs">
                          {pz1?.volume_m3} / 311.4 m³ (ZR)
                        </span>
                        <span className="text-[10px] font-semibold text-slate-600">
                          Poziom: {pz1?.level_m} m
                        </span>
                      </div>
                    </div>

                    {/* Valve Z_PZ1 Slider */}
                    <div className="pt-1">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-700 mb-1">
                        <span>Zasuwa Z_PZ1 (do Kolektora B):</span>
                        <span className="text-blue-600">{zPz1?.aperture_pct}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={zPz1?.aperture_pct || 0}
                        onChange={(e) => adjustValve('Z12', parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                      <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                        <span>Napływ: {pz1?.inflow_m3_h} m³/h</span>
                        <span>Tłoczenie: <strong>{pz1?.outflow_m3_h} m³/h</strong></span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Niewiadom Cascade & PNB-1 */}
                <div className="space-y-3">
                  {/* Upstream feeder info pill */}
                  <div className="flex items-center justify-between px-3 py-1.5 bg-amber-50/80 border border-amber-200 rounded-xl text-[11px]">
                    <span className="font-bold text-amber-900">Dopływ z kaskady: PNB-4 (Górnośląska)</span>
                    <span className="text-amber-700 font-semibold">Q = 390 m³/h</span>
                  </div>

                  {/* Main PNB-1 Station Box (Yellow colored border) */}
                  <div data-tour="scada-r2" className="bg-white rounded-2xl p-4 border-2 border-amber-300 shadow-sm flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-black text-slate-900">
                          PNB-1 (ul. Nakłończyka)
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          N=2x11 kW | Q=47.5 m³/h | 05.06 awaria P1!
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${getStatusColor(pnb1?.status || 'SAFE')}`}>
                        ZR: {pnb1?.pct_full ?? 0}%
                      </span>
                    </div>

                    {/* Fluid Retention Tank Bar */}
                    <div className="w-full h-20 bg-slate-100 rounded-xl overflow-hidden relative border border-slate-200 flex flex-col justify-end">
                      <div
                        className="w-full bg-amber-400 transition-all duration-500 rounded-b-xl stripe-amber"
                        style={{ height: `${Math.min(100, Math.max(15, pnb1?.pct_full || 25))}%` }}
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-1">
                        <span className="text-xs font-black text-slate-900">
                          {pnb1?.volume_m3} / 48.2 m³ (ZR)
                        </span>
                        <span className="text-[10px] font-semibold text-slate-600">
                          Poziom: {pnb1?.level_m} m
                        </span>
                      </div>
                    </div>

                    {/* Valve Z_PNB1 Slider */}
                    <div className="pt-1">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-700 mb-1">
                        <span>Zasuwa Z_PNB1 (ks 500 Nowiny):</span>
                        <span className="text-blue-600">{zPnb1?.aperture_pct}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={zPnb1?.aperture_pct || 0}
                        onChange={(e) => adjustValve('Z13', parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                      <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                        <span>Napływ: {pnb1?.inflow_m3_h} m³/h</span>
                        <span>Tłoczenie: <strong>{pnb1?.outflow_m3_h} m³/h</strong></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Simulation Scenarios & Disaster Injections Bar (Replaces Photo 3 component) */}
              <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between z-10">
                <div className="flex items-center space-x-2 text-xs font-extrabold text-slate-700">
                  <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                  <span>{lang === 'pl' ? 'Scenariusze Symulacji PWiK:' : 'Simulation Scenarios:'}</span>
                </div>

                <div className="flex items-center space-x-2.5">
                  <button
                    onClick={() => injectDisaster('rain_150')}
                    className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-bold text-xs transition-colors flex items-center space-x-1.5 shadow-2xs"
                  >
                    <CloudRain className="w-3.5 h-3.5 text-blue-600" />
                    <span>{lang === 'pl' ? '🌧️ Nawałnica (194.8 mm/h)' : '🌧️ Storm Runoff (194.8 mm/h)'}</span>
                  </button>

                  <button
                    onClick={() => injectDisaster('pump_trip_p1')}
                    className={`px-3.5 py-2 rounded-xl font-bold text-xs transition-colors flex items-center space-x-1.5 shadow-2xs ${
                      p1Pz1?.status === 'FAULT'
                        ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                        : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>{lang === 'pl' ? '⚠️ Awaria Pompy P1 (PZ-1)' : '⚠️ P1 Pump Trip (PZ-1)'}</span>
                  </button>

                  <button
                    onClick={() => injectDisaster('reset_all')}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors shadow-2xs"
                  >
                    <span>☀️ {lang === 'pl' ? 'Reset DWF' : 'Reset DWF'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Pumps Bar (Rybnik Motors) */}
          <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-3 gap-4">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-900">Pompa P1 (PZ-1, 21 kW)</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  I: <strong>{p1Pz1?.current_A} A</strong> | Q: <strong>{p1Pz1?.flow_m3_h} m³/h</strong>
                </div>
              </div>
              <button
                onClick={() => togglePump('P1_R1', p1Pz1?.status === 'RUNNING' ? 'stop' : 'start')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors ${
                  p1Pz1?.status === 'RUNNING'
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                    : 'bg-rose-500 text-white hover:bg-rose-600'
                }`}
              >
                {p1Pz1?.status}
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-900">Pompa P2 (PZ-1, 21 kW)</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  I: <strong>{p2Pz1?.current_A} A</strong> | Q: <strong>{p2Pz1?.flow_m3_h} m³/h</strong>
                </div>
              </div>
              <button
                onClick={() => togglePump('P2_R1', p2Pz1?.status === 'RUNNING' ? 'stop' : 'start')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors ${
                  p2Pz1?.status === 'RUNNING'
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                    : 'bg-slate-300 text-slate-700 hover:bg-slate-400'
                }`}
              >
                {p2Pz1?.status}
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-900">Pompa P1 (PNB-1, 11 kW)</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  I: <strong>{p1Pnb1?.current_A} A</strong> | Q: <strong>{p1Pnb1?.flow_m3_h} m³/h</strong>
                </div>
              </div>
              <button
                onClick={() => togglePump('P1_PNB1', p1Pnb1?.status === 'RUNNING' ? 'stop' : 'start')}
                className="px-3 py-1 rounded-xl text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600"
              >
                {p1Pnb1?.status}
              </button>
            </div>
          </div>
        </div>

        {/* Right Detail Card (Matching Reference Images 2 & 4) */}
        <div className="col-span-4 space-y-5">
          {/* Main KPI Card */}
          <div className="bg-white rounded-3xl p-6 border border-[#e8ecf1] shadow-2xs">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              Zapełnienie Zbiornika Retencyjnego PZ-1
            </div>
            <div className="text-4xl font-extrabold text-slate-900 tracking-tight">
              {pz1?.pct_full ?? 0}%
            </div>
            <div className="flex items-center space-x-1.5 mt-1 text-xs font-bold text-amber-600">
              <span>Pojemność retencyjna: <strong>{pz1?.volume_m3} / 311.4 m³</strong></span>
            </div>

            <div className="mt-5 space-y-3 pt-4 border-t border-slate-100 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Maksymalny napływ burzowy</span>
                <span className="font-bold text-slate-900">240 m³/h</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Wolna objętość retencji (ZR)</span>
                <span className="font-bold text-blue-600">
                  {Math.max(0, 311.4 - (pz1?.volume_m3 || 0)).toFixed(1)} m³
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Łączna wydajność 2 pomp (Q)</span>
                <span className="font-bold text-slate-900">115.0 m³/h</span>
              </div>
            </div>
          </div>

          {/* Suggested Change Card (Exact replica of Reference Image 1 & 4) */}
          <div data-tour="scada-suggested" className="bg-white rounded-3xl p-6 border border-[#e8ecf1] shadow-2xs space-y-4">
            <div className="flex items-center space-x-2 text-amber-600 font-bold text-xs">
              <Sparkles className="w-4 h-4 fill-amber-500" />
              <span>Optymalizacja hydrauliczna PWiK</span>
            </div>

            <div>
              <h4 className="text-sm font-extrabold text-slate-900 leading-snug">
                Aktywacja sekwencyjna pompy P2 (21 kW) na PZ-1
              </h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Podczas fali opadów retencja ZR ({pz1?.pct_full}%) przejmuje uderzenie hydrauliczne. Załączenie drugiej pompy zwiększy odpływ do 115 m³/h i ustabilizuje poziom w bezpiecznej strefie zielonej.
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-semibold text-slate-500">
                <span>Zapas retencyjny</span>
                <span className="text-emerald-600 font-bold">+ 42.0% bufora</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="w-[82%] h-full bg-emerald-500 rounded-full stripe-green" />
              </div>
            </div>

            <div className="pt-2 flex items-center space-x-2">
              <button
                onClick={() => {
                  togglePump('P2_R1', 'start');
                  adjustValve('Z12', 100.0);
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all shadow-sm text-center"
              >
                Model this change (Załącz P2)
              </button>
              <button className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors">
                Odrzuć
              </button>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
