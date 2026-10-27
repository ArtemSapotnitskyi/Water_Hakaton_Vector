import React from 'react';
import {
  Activity,
  Droplets,
  Zap,
  ClipboardList,
  Bell,
  Settings,
  HelpCircle,
  Search,
  SlidersHorizontal,
  FlaskConical,
  MoreHorizontal
} from 'lucide-react';
import { useTelemetry } from '../context/TelemetryContext';

export type NavTab =
  | 'scada_twin'
  | 'rybnik_benchmark'
  | 'inflow_analysis'
  | 'energy_costs'
  | 'incident_log';

interface SidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenTour?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange, onOpenTour }) => {
  const { t, telemetry } = useTelemetry();

  const operationsNavItems: { id: NavTab; label: string; icon: React.ReactNode; isNew?: boolean }[] = [
    { id: 'scada_twin', label: t('scada_twin'), icon: <Activity className="w-4 h-4" /> },
    { id: 'incident_log', label: t('incident_log'), icon: <ClipboardList className="w-4 h-4" /> },
  ];

  const analyticsNavItems: { id: NavTab; label: string; icon: React.ReactNode; isBenchmark?: boolean }[] = [
    { id: 'rybnik_benchmark', label: t('rybnik_benchmark'), icon: <FlaskConical className="w-4 h-4" />, isBenchmark: true },
    { id: 'inflow_analysis', label: t('inflow_analysis'), icon: <Droplets className="w-4 h-4" /> },
    { id: 'energy_costs', label: t('energy_costs'), icon: <Zap className="w-4 h-4" /> },
  ];

  const unreadAlarmsCount = telemetry?.active_alarms?.length || 2;

  return (
    <aside className="w-64 flex-shrink-0 bg-[#fbfcfd] border-r border-[#e8ecf1] flex flex-col justify-between py-5 px-3.5 select-none h-full">
      {/* Top Branding */}
      <div>
        <div className="flex items-center justify-between px-2 mb-5">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center text-white font-bold shadow-sm shadow-orange-500/20">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <div>
              <span className="font-bold text-slate-900 tracking-tight text-lg">hydroflow</span>
            </div>
          </div>
          <button className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Search */}
        <div className="relative mb-5 px-1">
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Szukaj stacji, pomp, zasuwy..."
            className="w-full bg-[#f1f3f6] text-xs text-slate-700 pl-8 pr-8 py-2 rounded-xl border border-transparent focus:outline-none focus:border-slate-300 focus:bg-white transition-all placeholder:text-slate-400 font-medium"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400 bg-white px-1.5 py-0.5 rounded shadow-2xs border border-slate-200">
            ⌘K
          </kbd>
        </div>

        {/* Operations Section */}
        <div className="space-y-1">
          <div className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Dyspozytornia SCADA
          </div>
          {operationsNavItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-[#f1f3f6]'
                }`}
              >
                <span className={isActive ? 'text-white' : 'text-slate-500'}>{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Analytics & Jury Testing Section */}
        <div className="mt-5">
          <div className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Ewaluacja & Konkurs PWiK
          </div>
          <div className="space-y-1">
            {analyticsNavItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-[#f1f3f6]'
                  }`}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <span className={isActive ? 'text-white' : 'text-slate-500'}>{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.isBenchmark && (
                    <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase ${
                      isActive ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-700'
                    }`}>
                      Test
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Footer Section */}
      <div className="pt-4 border-t border-[#edf0f4] space-y-1 px-1">
        <button
          onClick={() => onTabChange('incident_log')}
          className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-[#f1f3f6] transition-colors"
        >
          <div className="flex items-center space-x-3">
            <Bell className="w-4 h-4 text-slate-400" />
            <span>{t('notifications')}</span>
          </div>
          {unreadAlarmsCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-orange-500 text-white font-bold text-[10px] flex items-center justify-center">
              {unreadAlarmsCount}
            </span>
          )}
        </button>

        <button
          onClick={onOpenTour}
          className="w-full flex items-center space-x-3 px-2.5 py-2 rounded-xl text-xs font-bold text-blue-600 bg-blue-50/70 hover:bg-blue-100/70 transition-colors"
        >
          <HelpCircle className="w-4 h-4 text-blue-600" />
          <span>Przewodnik po stronie</span>
        </button>

        {/* User Profile Card */}
        <div className="mt-3 pt-3 border-t border-[#edf0f4] flex items-center justify-between px-1">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-slate-900 leading-tight">Nizam / Dyspozytor</div>
              <div className="text-[10px] text-slate-400 leading-tight">PWiK Operations</div>
            </div>
          </div>
          <button className="text-slate-400 hover:text-slate-600 p-1">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
