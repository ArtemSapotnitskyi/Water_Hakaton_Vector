import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  CheckCircle2,
  Filter,
  Search,
  UserCheck
} from 'lucide-react';
import { getIncidents } from '../../services/api';
import { IncidentRecord } from '../../types';

export const IncidentsView: React.FC = () => {
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    getIncidents().then(setIncidents).catch(console.error);
    const interval = setInterval(() => {
      getIncidents().then(setIncidents).catch(console.error);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const filtered = incidents.filter((inc) => {
    if (filterSeverity !== 'ALL' && inc.severity !== filterSeverity) return false;
    if (
      searchTerm &&
      !inc.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !inc.description.toLowerCase().includes(searchTerm.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const getSeverityBadge = (sev: string) => {
    if (sev === 'CRITICAL') {
      return (
        <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-700 border border-red-200 flex items-center space-x-1">
          <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
          <span>KRYTYCZNY</span>
        </span>
      );
    }
    if (sev === 'WARNING') {
      return (
        <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 flex items-center space-x-1">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          <span>OSTRZEŻENIE</span>
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200 flex items-center space-x-1">
        <Info className="w-3.5 h-3.5 text-gray-500" />
        <span>INFORMACJA</span>
      </span>
    );
  };

  return (
    <div className="p-6 md:p-8 space-y-6 bg-slate-50 min-h-full">
      {/* Top Controls */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg border border-gray-200">
          {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map((sev) => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ease-out ${
                filterSeverity === sev
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {sev === 'ALL' ? 'Wszystkie zdarzenia' : sev}
            </button>
          ))}
        </div>

        <div className="relative w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Filtruj wg opisu, stacji..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white text-xs pl-8 pr-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:border-blue-500 transition-all duration-150 ease-out"
          />
        </div>
      </div>

      {/* Incidents Table */}
      <div data-tour="incident-table" className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm space-y-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 ease-out">
        <div className="flex items-center justify-between pb-3 border-b border-gray-200">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-gray-900">
              Dziennik Rejestru SCADA i Działań Dyspozytora
            </h3>
            <p className="text-xs text-gray-500 mt-0.5 font-normal">
              Automatyczny audyt przełączeń zasuwy Z12, awarii pomp, skoków nawałnicowych i kwitowań ACK
            </p>
          </div>
          <span className="text-xs font-medium text-gray-500">
            Pozycji: {filtered.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-gray-500 font-semibold border-b border-gray-200 pb-2">
                <th className="py-2.5 font-semibold">Czas Zdarzenia</th>
                <th className="py-2.5 font-semibold">Poziom</th>
                <th className="py-2.5 font-semibold">Obiekt / Stacja</th>
                <th className="py-2.5 font-semibold">Tytuł Zdarzenia</th>
                <th className="py-2.5 font-semibold">Szczegóły Komunikatu</th>
                <th className="py-2.5 font-semibold text-right">Kwitowanie (ACK)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((inc) => (
                <tr key={inc.id} className="hover:bg-gray-50 transition-colors duration-150 ease-out">
                  <td className="py-3 font-medium text-gray-600 whitespace-nowrap">
                    {inc.timestamp}
                  </td>
                  <td className="py-3 whitespace-nowrap">{getSeverityBadge(inc.severity)}</td>
                  <td className="py-3 font-semibold text-gray-900 whitespace-nowrap">
                    {inc.station}
                  </td>
                  <td className="py-3 font-semibold text-gray-900">{inc.title}</td>
                  <td className="py-3 text-gray-600 max-w-md">{inc.description}</td>
                  <td className="py-3 text-right whitespace-nowrap">
                    {inc.requires_ack ? (
                      inc.acknowledged ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-[10px] font-medium bg-green-50 text-green-700 border border-green-200">
                          <CheckCircle2 className="w-3 h-3 text-green-600" />
                          <span>Skwitowano ({inc.acknowledged_by || 'Dyspozytor'})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-[10px] font-medium bg-red-50 text-red-700 border border-red-300">
                          <span>Wymaga KWITOWANIA</span>
                        </span>
                      )
                    ) : (
                      <span className="text-gray-400 text-[11px]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
