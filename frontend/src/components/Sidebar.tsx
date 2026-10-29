import React from 'react';
import {
  Activity,
  Droplets,
  Zap,
  ClipboardList,
  Bell,
  HelpCircle,
  FlaskConical
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
    <aside className="w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col justify-between py-5 px-3.5 select-none h-full">
      {/* Top Branding */}
      <div>
        <div className="flex items-center px-2 mb-6">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-semibold shadow-sm">
              <Droplets className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-semibold text-gray-900 tracking-tight text-base">HydroPulse</span>
            </div>
          </div>
        </div>

        {/* Operations Section */}
        <div className="space-y-1">
          <div className="px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Dyspozytornia SCADA
          </div>
          {operationsNavItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200/60 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span className={isActive ? 'text-blue-600' : 'text-gray-400'}>{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Analytics Section */}
        <div className="mt-6">
          <div className="px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Analiza i Raporty
          </div>
          <div className="space-y-1">
            {analyticsNavItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200/60 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <span className={isActive ? 'text-blue-600' : 'text-gray-400'}>{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.isBenchmark && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      isActive ? 'bg-blue-200 text-blue-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      2025–2026
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Footer Section */}
      <div className="pt-4 border-t border-gray-100 space-y-1 px-1">
        <button
          onClick={() => onTabChange('incident_log')}
          className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <Bell className="w-4 h-4 text-gray-400" />
            <span>{t('notifications')}</span>
          </div>
          {unreadAlarmsCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-red-600 text-white font-medium text-[10px] flex items-center justify-center">
              {unreadAlarmsCount}
            </span>
          )}
        </button>

        <button
          onClick={onOpenTour}
          className="w-full flex items-center space-x-3 px-2.5 py-2 rounded-lg text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/60 transition-colors"
        >
          <HelpCircle className="w-4 h-4 text-blue-600" />
          <span>Przewodnik po systemie</span>
        </button>

        {/* User Profile Card */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center px-1">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-semibold text-xs">
              DP
            </div>
            <div className="text-left">
              <div className="text-xs font-semibold text-gray-900 leading-tight">Dyspozytor Główny</div>
              <div className="text-[11px] text-gray-500 leading-tight">PWiK Rybnik</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
