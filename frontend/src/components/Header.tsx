import React from 'react';
import {
  Download,
  Languages,
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
    t
  } = useTelemetry();

  const getTitle = () => {
    switch (currentTab) {
      case 'scada_twin':
        return lang === 'pl' ? 'Cyfrowy Bliźniak (SCADA) - PWiK Rybnik' : 'Digital Twin (SCADA) - PWiK Rybnik';
      case 'rybnik_benchmark':
        return lang === 'pl' ? 'Analiza Weryfikacyjna: Rybnik 2025–2026' : 'Verification Benchmark: Rybnik 2025–2026';
      case 'inflow_analysis':
        return lang === 'pl' ? 'Analiza Wód Przypadkowych (DWF)' : 'Inflow & Infiltration (DWF Model)';
      case 'energy_costs':
        return lang === 'pl' ? 'Efektywność Energetyczna i Koszty (1 zł/kWh)' : 'Energy Efficiency & Costs (1 PLN/kWh)';
      case 'incident_log':
        return lang === 'pl' ? 'Dziennik Zdarzeń i Akcji Dyspozytora' : 'Incident Log & Operator Actions';
    }
  };

  return (
    <header className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
      {/* Title & Connection Status */}
      <div>
        <div className="flex items-center space-x-3">
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">
            {getTitle()}
          </h1>
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{isConnected ? 'SCADA Live (10s)' : 'Łączenie...'}</span>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-0.5 font-normal">
          {telemetry?.sim_time ? `Zegar telemetryczny: ${telemetry.sim_time}` : 'Symulator w gotowości'}
        </p>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center space-x-2.5">
        {/* Tour Guide Button */}
        {onOpenTour && (
          <button
            onClick={onOpenTour}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-medium transition-all shadow-sm cursor-pointer"
            title="Włącz przewodnik"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>{lang === 'pl' ? 'Przewodnik' : 'Tour'}</span>
          </button>
        )}

        {/* Language Switcher */}
        <button
          onClick={() => setLang(lang === 'pl' ? 'en' : 'pl')}
          className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm cursor-pointer"
        >
          <Languages className="w-3.5 h-3.5 text-gray-500" />
          <span>{lang.toUpperCase()}</span>
        </button>

        {/* Export Report */}
        <a
          href={getJuryReportExportUrl()}
          download
          className="rounded-lg font-medium transition-all duration-150 ease-out bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-0.5 hover:shadow shadow-sm active:scale-[0.98] active:translate-y-0 active:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 px-3.5 py-1.5 text-xs flex items-center space-x-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{t('export_report')}</span>
        </a>
      </div>
    </header>
  );
};
