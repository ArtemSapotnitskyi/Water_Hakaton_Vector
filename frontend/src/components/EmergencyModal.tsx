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
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden transform animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-red-600 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-red-100">
                SCADA Kwitowanie Alarmu Krytycznego
              </div>
              <h2 className="text-base font-semibold">{alarm.title}</h2>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-md bg-white/20 text-white text-xs font-medium">
              {alarm.station}
            </span>
            <button
              onClick={acknowledgeAlarm}
              className="p-1 rounded-md bg-white/20 hover:bg-white/30 text-white transition-colors"
              title="Zamknij / Pomiń"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          <div className="p-4 rounded-lg bg-red-50 border border-red-100 text-red-950 text-xs leading-relaxed font-normal">
            {alarm.description}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
              <div className="text-[10px] text-gray-500 font-medium uppercase">Czas Zdarzenia</div>
              <div className="font-semibold text-gray-900 mt-0.5">{alarm.timestamp}</div>
            </div>
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
              <div className="text-[10px] text-gray-500 font-medium uppercase">Priorytet</div>
              <div className="font-semibold text-red-600 mt-0.5 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-red-600 inline-block" />
                <span>POZIOM 1 - KRYTYCZNY</span>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start space-x-3">
            <div className="w-6 h-6 rounded-md bg-blue-600 text-white flex-shrink-0 flex items-center justify-center font-semibold text-[10px] mt-0.5">
              SCADA
            </div>
            <div>
              <div className="font-semibold text-blue-900">
                {lang === 'pl' ? 'Zalecana reakcja dyspozytorska:' : 'Recommended Dispatcher Action:'}
              </div>
              <div className="text-blue-800 text-xs mt-0.5 leading-relaxed">
                {lang === 'pl'
                  ? 'Natychmiastowe otwarcie zasuwy Z_PZ1 na 100% do Kolektora B oraz załączenie obu pomp P1 i P2 (2x21 kW) w celu bezpiecznego zrzutu ścieków i ochrony retencji ZR 311.4 m³ przed przelaniem.'
                  : 'Immediately open discharge valve Z_PZ1 to 100% into Collector B and stage both 21 kW pumps P1 & P2 to safely evacuate wastewater and protect retention basin ZR 311.4 m³.'}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end space-x-3">
          <button
            onClick={handleExecuteEmergency}
            className="rounded-lg font-medium transition-all duration-150 ease-out bg-blue-600 text-white hover:bg-blue-700 shadow-sm active:scale-[0.98] active:translate-y-0 px-4 py-2 text-xs flex items-center space-x-1.5"
          >
            <span>
              {lang === 'pl' ? 'Zastosuj procedurę awaryjną' : 'Execute Emergency Flush'}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={acknowledgeAlarm}
            className="rounded-lg font-medium transition-all duration-150 ease-out bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 shadow-sm active:scale-[0.98] active:translate-y-0 px-4 py-2 text-xs flex items-center space-x-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
            <span>{lang === 'pl' ? 'Potwierdź przyjęcie alarmu (ACK)' : 'Acknowledge Alarm (ACK)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
