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
        <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 flex items-center space-x-1">
          <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
          <span>KRYTYCZNY</span>
        </span>
      );
    }
    if (sev === 'WARNING') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center space-x-1">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          <span>OSTRZEŻENIE</span>
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 flex items-center space-x-1">
        <Info className="w-3.5 h-3.5 text-slate-500" />
        <span>INFORMACJA</span>
      </span>
    );
  };

  return (
    <div className="p-8 space-y-6">
      {/* Top Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 bg-[#f1f3f6] p-1 rounded-xl border border-slate-200/60">
          {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map((sev) => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterSeverity === sev
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {sev === 'ALL' ? 'Wszystkie zdarzenia' : sev}
            </button>
          ))}
        </div>

        <div className="relative w-72">
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filtruj wg opisu, stacji..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white text-xs pl-8 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-slate-400"
          />
        </div>
      </div>

      {/* Incidents Table */}
      <div data-tour="incident-table" className="bg-white rounded-3xl p-6 border border-[#e8ecf1] shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              Dziennik Rejestru SCADA i Działań Dyspozytora
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Automatyczny audyt przełączeń zasuwy Z12, awarii pomp, skoków nawałnicowych i kwitowań ACK
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500">
            Pozycji: {filtered.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 font-semibold border-b border-slate-100 pb-2">
                <th className="py-2.5 font-bold">Czas Zdarzenia</th>
                <th className="py-2.5 font-bold">Poziom</th>
                <th className="py-2.5 font-bold">Obiekt / Stacja</th>
                <th className="py-2.5 font-bold">Tytuł Zdarzenia</th>
                <th className="py-2.5 font-bold">Szczegóły Komunikatu</th>
                <th className="py-2.5 font-bold text-right">Kwitowanie (ACK)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((inc) => (
                <tr key={inc.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 font-semibold text-slate-600 whitespace-nowrap">
                    {inc.timestamp}
                  </td>
                  <td className="py-3 whitespace-nowrap">{getSeverityBadge(inc.severity)}</td>
                  <td className="py-3 font-bold text-slate-900 whitespace-nowrap">
                    {inc.station}
                  </td>
                  <td className="py-3 font-extrabold text-slate-900">{inc.title}</td>
                  <td className="py-3 text-slate-600 max-w-md">{inc.description}</td>
                  <td className="py-3 text-right whitespace-nowrap">
                    {inc.requires_ack ? (
                      inc.acknowledged ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Skwitowano ({inc.acknowledged_by || 'Dyspozytor'})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-300 animate-pulse">
                          <span>Wymaga KWITOWANIA</span>
                        </span>
                      )
                    ) : (
                      <span className="text-slate-400 text-[11px]">—</span>
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
