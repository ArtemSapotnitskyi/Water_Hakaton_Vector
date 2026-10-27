import React, { useState } from 'react';
import {
  Play,
  Pause,
  CloudRain,
  AlertTriangle,
  RotateCcw,
  Download,
  Languages,
  Zap,
  Radio,
  ChevronDown,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { useTelemetry } from '../context/TelemetryContext';
import { NavTab } from './Sidebar';
import { getJuryReportExportUrl } from '../services/api';

interface HeaderProps {
  currentTab: NavTab;
  onOpenTour?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, onOpenTour }) => {
  const {
    telemetry,
    isConnected,
    lang,
    setLang,
    playSimulation,
    pauseSimulation,
    setSimulationSpeed,
    setSimulationMode,
    injectDisaster,
    t
  } = useTelemetry();

  const [showDisasterMenu, setShowDisasterMenu] = useState(false);

  const getTitle = () => {
    switch (currentTab) {
      case 'scada_twin':
        return lang === 'pl' ? 'Cyfrowy Bliźniak (SCADA) - PWiK Rybnik' : 'Digital Twin (SCADA) - PWiK Rybnik';
      case 'rybnik_benchmark':
        return lang === 'pl' ? 'Poligon Testowy: Rybnik 2025–2026' : 'Test Benchmark: Rybnik 2025–2026';
      case 'inflow_analysis':
        return lang === 'pl' ? 'Analiza Wód Przypadkowych (DWF)' : 'Inflow & Infiltration (DWF Model)';
      case 'energy_costs':
        return lang === 'pl' ? 'Efektywność Energetyczna i Koszty (1 zł/kWh)' : 'Energy Efficiency & Costs (1 PLN/kWh)';
      case 'incident_log':
        return lang === 'pl' ? 'Dziennik Zdarzeń i Akcji Dyspozytora' : 'Incident Log & Operator Actions';
    }
  };

  const isPaused = telemetry?.is_paused ?? false;
  const currentSpeed = telemetry?.speed_factor ?? 2;
  const mode = telemetry?.mode ?? 'AUTO';

  return (
    <header className="px-8 py-5 border-b border-[#e8ecf1] bg-[#fbfcfd] flex items-center justify-between">
      {/* Title & Connection Status */}
      <div>
        <div className="flex items-center space-x-3">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {getTitle()}
          </h1>
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{isConnected ? 'SCADA Live (10s)' : 'Łączenie...'}</span>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          {telemetry?.sim_time ? `Zegar telemetryczny: ${telemetry.sim_time}` : 'Symulator w gotowości'}
        </p>
      </div>

      {/* Control Buttons & Segmented Switches */}
      <div className="flex items-center space-x-2.5">
        {/* AUTO / MANUAL Segmented Control */}
        <div className="bg-[#f1f3f6] p-1 rounded-xl flex items-center space-x-1 border border-slate-200/60">
          <button
            onClick={() => setSimulationMode('AUTO')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              mode === 'AUTO'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            AUTO
          </button>
          <button
            onClick={() => setSimulationMode('MANUAL')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              mode === 'MANUAL'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            MANUAL
          </button>
        </div>

        {/* Speed Multipliers */}
        <div className="bg-[#f1f3f6] p-1 rounded-xl flex items-center space-x-0.5 border border-slate-200/60">
          <button
            onClick={() => (isPaused ? playSimulation() : pauseSimulation())}
            className="p-1.5 rounded-lg text-slate-700 hover:bg-white hover:shadow-2xs transition-all"
            title={isPaused ? 'Wznów' : 'Wstrzymaj'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
          </button>
          {[1, 2, 5, 10].map((s) => (
            <button
              key={s}
              onClick={() => setSimulationSpeed(s)}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${
                currentSpeed === s && !isPaused
                  ? 'bg-white text-blue-600 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Disaster Injection Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowDisasterMenu(!showDisasterMenu)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 transition-colors shadow-2xs"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>{t('inject_disaster')}</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {showDisasterMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95">
              <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Symulacja Zdarzeń Awaryjnych
              </div>
              <button
                onClick={() => {
                  injectDisaster('rain_150');
                  setShowDisasterMenu(false);
                }}
                className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center space-x-2.5 transition-colors"
              >
                <CloudRain className="w-4 h-4 text-blue-600" />
                <div>
                  <div className="font-semibold">Nawałnica 194.8 mm/h</div>
                  <div className="text-[10px] text-slate-400">Skok do rekordu z 13.07.2024</div>
                </div>
              </button>

              <button
                onClick={() => {
                  injectDisaster('pump_trip_p1');
                  setShowDisasterMenu(false);
                }}
                className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-700 flex items-center space-x-2.5 transition-colors"
              >
                <Zap className="w-4 h-4 text-rose-600" />
                <div>
                  <div className="font-semibold">Awaria Pompy P1</div>
                  <div className="text-[10px] text-slate-400">Wyzwolenie alarmu i blokady</div>
                </div>
              </button>

              <div className="border-t border-slate-100 my-1" />

              <button
                onClick={() => {
                  injectDisaster('reset_all');
                  setShowDisasterMenu(false);
                }}
                className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center space-x-2.5 transition-colors"
              >
                <RotateCcw className="w-4 h-4 text-slate-500" />
                <span>Przywróć stan nominalny</span>
              </button>
            </div>
          )}
        </div>

        {/* Tour Guide Button */}
        {onOpenTour && (
          <button
            onClick={onOpenTour}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-bold transition-all shadow-2xs"
            title="Włącz przewodnik po stronie"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>{lang === 'pl' ? 'Przewodnik' : 'Tour Guide'}</span>
          </button>
        )}

        {/* Language Switcher */}
        <button
          onClick={() => setLang(lang === 'pl' ? 'en' : 'pl')}
          className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-white hover:border-slate-300 transition-colors shadow-2xs"
        >
          <Languages className="w-3.5 h-3.5 text-slate-500" />
          <span>{lang.toUpperCase()}</span>
        </button>

        {/* Export Report */}
        <a
          href={getJuryReportExportUrl()}
          download
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-all shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{t('export_report')}</span>
        </a>
      </div>
    </header>
  );
};
