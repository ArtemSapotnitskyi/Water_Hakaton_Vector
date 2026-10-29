import React from 'react';
import {
  Activity,
  Droplet,
  CloudRain,
  Zap,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';
import { NavTab } from '../Sidebar';

interface OverviewViewProps {
  onNavigate: (tab: NavTab) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ onNavigate }) => {
  const { telemetry } = useTelemetry();

  const r1 = telemetry?.tanks?.R1;
  const r2 = telemetry?.tanks?.R2;
  const rain_mm_h = telemetry?.rain_mm_h || 0;

  return (
    <div className="p-8 space-y-6">
      {/* Top Banner: Emergency Status */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-900 to-slate-900 text-white flex items-center justify-between shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-xs font-bold text-blue-300 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
            <span>Centrum Operacyjne PWiK - Stan Sieci Wodociągowo-Kanalizacyjnej</span>
          </div>
          <h2 className="text-xl font-extrabold tracking-tight">
            Szczyt burzowy 13.07.2024: 194.8 mm/h opadu w Rudzie Śląskiej
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Inteligentny algorytm predykcyjny monitoruje napływ do zbiornika R1 i w czasie rzeczywistym zarządza zasuwnicą Z12, kierując nadmiar do zbiornika buforowego R2 w celu ochrony miasta przed zalaniem.
          </p>
        </div>
        <button
          onClick={() => onNavigate('scada_twin')}
          className="flex items-center space-x-2 px-5 py-3 rounded-2xl bg-white text-slate-900 font-extrabold text-xs hover:bg-blue-50 transition-all shadow-md"
        >
          <span>Otwórz Cyfrowego Bliźniaka</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Grid of Key Dashboards */}
      <div className="grid grid-cols-3 gap-6">
        {/* Card 1: SCADA Hydraulic Status */}
        <div
          onClick={() => onNavigate('scada_twin')}
          className="bg-white rounded-3xl p-6 border border-[#e8ecf1] shadow-2xs hover:border-slate-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase">Cyfrowy Bliźniak SCADA</span>
              <Activity className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-3xl font-extrabold text-slate-900">
              {r1?.pct_full ?? 0}% <span className="text-xs font-normal text-slate-400">R1</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              TTC: <strong>{r1?.ttc_minutes ? `${r1.ttc_minutes} min` : 'Bezpieczny'}</strong> | Bufor R2: <strong>{r2?.pct_full ?? 0}%</strong>
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-600">
            <span>Steruj zasuwami i pompami</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Card 2: Rybnik Accidental Waters */}
        <div
          onClick={() => onNavigate('inflow_analysis')}
          className="bg-white rounded-3xl p-6 border border-[#e8ecf1] shadow-2xs hover:border-slate-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase">Wody Przypadkowe (Rybnik)</span>
              <Droplet className="w-4 h-4 text-rose-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-3xl font-extrabold text-slate-900">
              24 150 <span className="text-xs font-normal text-slate-400">m³</span>
            </div>
            <div className="text-xs text-rose-600 font-semibold mt-1">
              Udział infiltracji: 34.8% ścieków ogółem
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-rose-600">
            <span>Szczegóły wód przypadkowych</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Card 3: Energy and Tariffs */}
        <div
          onClick={() => onNavigate('energy_costs')}
          className="bg-white rounded-3xl p-6 border border-[#e8ecf1] shadow-2xs hover:border-slate-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase">Koszty Energii (1 zł/kWh)</span>
              <Zap className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-3xl font-extrabold text-slate-900">
              24 150 <span className="text-xs font-normal text-slate-400">PLN / rok</span>
            </div>
            <div className="text-xs text-emerald-600 font-semibold mt-1">
              Możliwa oszczędność z retencji: ~18 400 PLN
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-amber-600">
            <span>Analiza taryf C12A</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
};
