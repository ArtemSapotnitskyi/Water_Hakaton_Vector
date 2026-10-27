import React from 'react';
import { CheckCircle2, ShieldAlert, ArrowRight, X } from 'lucide-react';
import { useTelemetry } from '../context/TelemetryContext';
import { controlSimulation } from '../services/api';

export const EmergencyModal: React.FC = () => {
  const { telemetry, acknowledgeAlarm, adjustValve, togglePump, lang } = useTelemetry();

  const alarm = telemetry?.active_blocking_alarm;
  if (!alarm) return null;

  const handleExecuteEmergency = async () => {
    // 1. Open discharge gate to Kolektor B
    adjustValve('Z_PZ1', 100.0);
    adjustValve('Z12', 100.0);
    // 2. Start both pumps on PZ-1
    togglePump('P1_R1', 'start');
    togglePump('P2_R1', 'start');
    // 3. Trigger backend emergency handler
    await controlSimulation({ action: 'execute_emergency', operator: 'Dyspozytor Główny' });
    acknowledgeAlarm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border-2 border-rose-500 overflow-hidden transform animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-rose-500 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center animate-bounce">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-rose-100">
                SCADA Kwitowanie Alarmu Krytycznego
              </div>
              <h2 className="text-base font-extrabold">{alarm.title}</h2>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 rounded-full bg-white/20 text-white text-[11px] font-bold">
              {alarm.station}
            </span>
            <button
              onClick={acknowledgeAlarm}
              className="p-1 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
              title="Zamknij / Pomiń"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-950 text-xs leading-relaxed font-medium">
            {alarm.description}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Czas Zdarzenia</div>
              <div className="font-bold text-slate-800 mt-0.5">{alarm.timestamp}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Priorytet</div>
              <div className="font-bold text-rose-600 mt-0.5 flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
                <span>POZIOM 1 - KRYTYCZNY</span>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-100 text-xs text-blue-900 flex items-start space-x-3">
            <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex-shrink-0 flex items-center justify-center font-bold text-[11px] mt-0.5">
              AI
            </div>
            <div>
              <div className="font-bold">
                {lang === 'pl' ? 'Zalecana reakcja dyspozytorska:' : 'Recommended Dispatcher Action:'}
              </div>
              <div className="text-blue-800 text-[11px] mt-0.5">
                {lang === 'pl'
                  ? 'Natychmiastowe otwarcie zasuwy Z_PZ1 na 100% do Kolektora B oraz załączenie obu pomp P1 i P2 (2x21 kW) w celu bezpiecznego zrzutu ścieków i ochrony retencji ZR 311.4 m³ przed przelaniem.'
                  : 'Immediately open discharge valve Z_PZ1 to 100% into Collector B and stage both 21 kW pumps P1 & P2 to safely evacuate wastewater and protect retention basin ZR 311.4 m³.'}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-3">
          <button
            onClick={handleExecuteEmergency}
            className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm"
          >
            <span>
              {lang === 'pl' ? 'Zastosuj procedurę awaryjną (Otwórz Z_PZ1 & Załącz P1/P2)' : 'Execute Emergency Flush (Open Z_PZ1 & Start P1/P2)'}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={acknowledgeAlarm}
            className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{lang === 'pl' ? 'Potwierdź przyjęcie alarmu (ACK)' : 'Acknowledge Alarm (ACK)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
