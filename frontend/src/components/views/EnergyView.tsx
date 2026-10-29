import React, { useState, useEffect, useMemo } from 'react';
import {
  Zap,
  TrendingDown,
  Activity,
  DollarSign,
  Clock,
  Gauge,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  Sliders,
  CheckCircle2,
  FileSpreadsheet,
  AlertTriangle,
  Play,
  RotateCcw,
  BarChart3,
  Calendar,
  Layers,
  Wrench,
  Info,
  ShieldCheck,
  ChevronRight,
  Send,
  Database,
  UploadCloud,
  X
} from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';
import { getEnergyAnalytics, uploadEnergyDataset } from '../../services/api';
import {
  EnergyAnalyticsResponse,
  EnergyHourlyItem,
  EnergyMonthlyItem,
  PumpFleetItem
} from '../../types';

export const EnergyView: React.FC = () => {
  const { telemetry, lang, activeDatasetName } = useTelemetry();
  const [selectedPreset, setSelectedPreset] = useState<string>('PZ1');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [station, setStation] = useState<'PZ1' | 'PNB1' | 'ZMP'>('PZ1');
  const [tariff, setTariff] = useState<'C11' | 'C12A'>('C12A');
  const [data, setData] = useState<EnergyAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Active chart view tab
  const [chartMode, setChartMode] = useState<'cycle' | 'monthly' | 'scatter'>('cycle');
  const [hoveredPoint, setHoveredPoint] = useState<EnergyHourlyItem | null>(null);
  const [selectedHour, setSelectedHour] = useState<EnergyHourlyItem | null>(null);

  // SmartFlow Optimizer state
  const [smartFlowActive, setSmartFlowActive] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // What-If Tariff Simulator state
  const [shiftRetentionPct, setShiftRetentionPct] = useState(65);
  const [simulatedTariffPrice, setSimulatedTariffPrice] = useState(1.00);

  // Trigger feedback toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Handle direct file upload for energy analysis
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setUploadedFiles(files);
      setSelectedPreset('custom_files');
      setLoading(true);
      try {
        const res = await uploadEnergyDataset(files, station, tariff);
        setData(res);
        if (res.hourly_cycle.length > 0) {
          setSelectedHour(res.hourly_cycle[8] || res.hourly_cycle[0]);
        }
        showToast(
          lang === 'pl'
            ? `Wczytano i przeliczono efektywność dla: ${files.map((f) => f.name).join(', ')}`
            : `Uploaded and evaluated energy for: ${files.map((f) => f.name).join(', ')}`
        );
      } catch (err) {
        console.error('Energy upload error:', err);
        showToast('Błąd wczytywania pliku energii.');
      } finally {
        setLoading(false);
      }
    }
  };

  // Fetch energy analytics dynamically based on uploaded files or selected preset
  useEffect(() => {
    setLoading(true);
    if (uploadedFiles.length > 0) {
      uploadEnergyDataset(uploadedFiles, station, tariff)
        .then((res) => {
          setData(res);
          if (res.hourly_cycle.length > 0) {
            setSelectedHour(res.hourly_cycle[8] || res.hourly_cycle[0]);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      getEnergyAnalytics(station, tariff, selectedPreset)
        .then((res) => {
          setData(res);
          if (res.hourly_cycle.length > 0) {
            setSelectedHour(res.hourly_cycle[8] || res.hourly_cycle[0]);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [station, tariff, selectedPreset]);

  // Reactive power and efficiency dynamically calculated from active dataset
  const livePowerKw = useMemo(() => {
    return data?.current_power_kw || 48.2;
  }, [data]);

  const livePumpP1Kw = useMemo(() => {
    if (telemetry?.pumps?.['p1']?.status === 'FAULT') {
      return 0.0;
    }
    return data?.p1_kw || 24.1;
  }, [telemetry, data]);

  const livePumpP2Kw = useMemo(() => {
    if (telemetry?.pumps?.['p2']?.status === 'FAULT') {
      return 0.0;
    }
    return data?.p2_kw || 24.1;
  }, [telemetry, data]);

  const liveEfficiencyPct = useMemo(() => {
    if (telemetry?.pumps?.['p1']?.status === 'FAULT') {
      return 52.4;
    }
    if (telemetry?.pumps?.['p1']?.status === 'DEGRADED') {
      return 61.2;
    }
    return data?.average_efficiency_pct || 86.4;
  }, [telemetry, data]);

  // What-If Simulator calculations
  const whatIfCalculations = useMemo(() => {
    const baseAnnualKwh = data?.total_annual_cost_pln || 289610;
    const shiftableKwh = baseAnnualKwh * 0.28; // peak volume
    const priceDelta = 1.42 - 0.74; // C12A spread
    const annualSavings = Math.round((shiftableKwh * (shiftRetentionPct / 100)) * priceDelta * simulatedTariffPrice);
    const co2ReductionTons = Math.round(annualSavings * 0.00068);
    return {
      annualSavings,
      monthlySavings: Math.round(annualSavings / 12),
      co2ReductionTons,
    };
  }, [data, shiftRetentionPct, simulatedTariffPrice]);

  // Max kWh in hourly cycle for bar scaling
  const maxKwh = useMemo(() => {
    if (!data?.hourly_cycle?.length) return 70;
    return Math.max(...data.hourly_cycle.map((h) => h.kwh)) * 1.1;
  }, [data]);

  if (loading || !data) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-3 text-slate-400">
        <Activity className="w-8 h-8 text-amber-500 animate-spin" />
        <span className="text-sm font-bold text-slate-600">
          Wczytywanie telemetrii energetycznej Tauron & C12A...
        </span>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center space-x-2 text-xs font-bold animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Station, Dataset & File Upload Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-slate-200">
        {/* Preset & Station Selectors */}
        <div className="flex items-center space-x-1.5 bg-[#f1f3f6] p-1 rounded-xl border border-slate-200/60 flex-wrap">
          <button
            onClick={() => {
              setUploadedFiles([]);
              setSelectedPreset('konkurs_merged_2025_2026');
              setStation('PZ1');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
              selectedPreset === 'konkurs_merged_2025_2026' && uploadedFiles.length === 0
                ? 'bg-white text-blue-700 shadow-2xs border border-blue-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Zbiór 2025–2026 (PZ-1 + PNB-1)</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
              Konkurs
            </span>
          </button>

          <button
            onClick={() => {
              setUploadedFiles([]);
              setSelectedPreset('pz1_historical');
              setStation('PZ1');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              (selectedPreset === 'pz1_historical' || selectedPreset === 'PZ1') && uploadedFiles.length === 0
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            PZ-1 (ul. Pełczyńskiego)
          </button>

          <button
            onClick={() => {
              setUploadedFiles([]);
              setSelectedPreset('pnb1_historical');
              setStation('PNB1');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              (selectedPreset === 'pnb1_historical' || selectedPreset === 'PNB1') && uploadedFiles.length === 0
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            PNB-1 (Zlewnia Niewiadom)
          </button>

          <button
            onClick={() => {
              setUploadedFiles([]);
              setSelectedPreset('ZMP');
              setStation('ZMP');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedPreset === 'ZMP' && uploadedFiles.length === 0
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ZMP Ruda Śląska (Szczyt 13.07)
          </button>

          {/* Direct File Upload Button */}
          <label
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              uploadedFiles.length > 0
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span className="truncate max-w-[150px]">
              {uploadedFiles.length > 0
                ? uploadedFiles.length === 1
                  ? uploadedFiles[0].name
                  : `${uploadedFiles.length} tabel`
                : 'Wgraj plik (CSV/TXT)'}
            </span>
            <input
              type="file"
              multiple
              accept=".csv,.txt,.tsv,.xlsx,.ods"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          {uploadedFiles.length > 0 && (
            <button
              onClick={() => {
                setUploadedFiles([]);
                setSelectedPreset('pz1_historical');
                setStation('PZ1');
              }}
              title="Wyczyść pliki"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Tariff Switcher */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs text-xs font-bold">
            <span className="text-slate-400">Taryfa:</span>
            <button
              onClick={() => setTariff('C11')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                tariff === 'C11'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              C11 (1.00 zł)
            </button>
            <button
              onClick={() => setTariff('C12A')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                tariff === 'C12A'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              C12A (Dwustrefowa)
            </button>
          </div>

          {/* Export Audit CTA */}
          <a
            href={`/api/export/jury-report?station=${station}&sensitivity=1.2`}
            download
            onClick={() => showToast(`Pobrano raport audytu energetycznego dla ${station}`)}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Eksportuj Audyt Energii (CSV)</span>
          </a>
        </div>
      </div>

      {/* Top 4 Energy Metric Cards (Exact replica of Image 3 with dynamic reactivity) */}
      <div className="grid grid-cols-4 gap-4">
        {/* Card 1: Energy Tariff */}
        <div
          onClick={() => setTariff(tariff === 'C11' ? 'C12A' : 'C11')}
          className="p-4 rounded-2xl bg-white border border-[#e8ecf1] shadow-2xs cursor-pointer hover:border-emerald-300 transition-all group"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
            <span>Stawka Rozliczeniowa Energii</span>
            <DollarSign className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {tariff === 'C11' ? (
              <>
                1.00 <span className="text-xs font-normal text-slate-500">PLN / kWh</span>
              </>
            ) : (
              <>
                1.42 / 0.74 <span className="text-xs font-normal text-slate-500">PLN / kWh</span>
              </>
            )}
          </div>
          <div className="mt-1 text-[11px] text-emerald-600 font-bold flex items-center justify-between">
            <span>{tariff === 'C11' ? 'Stała cena rozliczeniowa' : 'Szczyt / Poza szczytem C12A'}</span>
            <span className="text-[10px] text-slate-400 group-hover:text-emerald-700">Przełącz ⇄</span>
          </div>
        </div>

        {/* Card 2: Live Active Power */}
        <div className="p-4 rounded-2xl bg-white border border-[#e8ecf1] shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
            <span>Moc Chwilowa Przepompowni</span>
            <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 flex items-center space-x-2">
            <span>{livePowerKw}</span>
            <span className="text-xs font-normal text-slate-500">kW</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-medium flex items-center space-x-1">
            <span>P1: {livePumpP1Kw} kW</span>
            <span>|</span>
            <span>P2: {livePumpP2Kw} kW</span>
            {telemetry?.pumps?.['p1']?.status === 'FAULT' && (
              <span className="text-[10px] font-bold text-rose-600 ml-1">(P1 TRIP!)</span>
            )}
          </div>
        </div>

        {/* Card 3: Pump Efficiency */}
        <div className="p-4 rounded-2xl bg-white border border-[#e8ecf1] shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
            <span>Średni Kk-d Pomp (η)</span>
            <Gauge className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {liveEfficiencyPct}%
          </div>
          <div
            className={`mt-1 text-[11px] font-semibold ${
              liveEfficiencyPct >= 80 ? 'text-emerald-600' : 'text-amber-600'
            }`}
          >
            {liveEfficiencyPct >= 80
              ? 'Brak objawów kawitacji / zatkania'
              : 'Podwyższone opory hydrauliczne'}
          </div>
        </div>

        {/* Card 4: Accidental Water Cost */}
        <div className="p-4 rounded-2xl bg-white border border-[#e8ecf1] shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
            <span>Koszt Wód Przypadkowych</span>
            <TrendingDown className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600">
            {data.accidental_water_cost_pln.toLocaleString()}{' '}
            <span className="text-xs font-normal text-slate-500">PLN / rok</span>
          </div>
          <div className="mt-1 text-[11px] text-rose-600 font-semibold flex items-center justify-between">
            <span>Zbędne tłoczenie deszczówki</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-bold border border-rose-200">
              1.00 zł/kWh
            </span>
          </div>
        </div>
      </div>

      {/* Main Charts & Tariff C12A Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Main Chart (8 cols) */}
        <div
          data-tour="energy-correlation"
          className="col-span-8 bg-white rounded-3xl p-6 border border-[#e8ecf1] shadow-2xs space-y-4"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Korelacja Opadów z Zużyciem Energii ({data.station.split(':')[1] || data.station})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Zbiór: {data.dataset_name || activeDatasetName} • Wykres godzinowy: wzrost poboru mocy po fali deszczowej
              </p>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center space-x-1.5 bg-[#f1f3f6] p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setChartMode('cycle')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  chartMode === 'cycle'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Profil 24h
              </button>
              <button
                onClick={() => setChartMode('monthly')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  chartMode === 'monthly'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Miesiące
              </button>
              <button
                onClick={() => setChartMode('scatter')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  chartMode === 'scatter'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Regresja R²
              </button>
            </div>
          </div>

          {/* Chart Display Area */}
          {chartMode === 'cycle' && (
            <div className="relative">
              {/* Stepped trend line / bar mock representation (Exact replica of Image 3) */}
              <div
                className="h-64 flex items-end justify-between px-2 pt-8 pb-4 relative select-none"
                onMouseLeave={() => setHoveredPoint(null)}
              >
                {/* Horizontal Guide lines */}
                <div className="absolute inset-x-0 top-1/4 border-b border-dashed border-slate-200/80 text-[10px] text-slate-400 font-semibold px-2">
                  Szczyt energetyczny: {Math.round(maxKwh)} kWh/h
                </div>
                <div className="absolute inset-x-0 top-3/4 border-b border-dashed border-slate-200/80 text-[10px] text-slate-400 font-semibold px-2">
                  Pobór bazowy bezdeszczowy: {Math.round(maxKwh * 0.18)} kWh/h
                </div>

                {/* 12 Diurnal Bars */}
                {data.hourly_cycle.map((pt, idx) => {
                  const isSelected = selectedHour?.hour === pt.hour;
                  const isHeavyRain = pt.rain_mm_h >= 50;

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedHour(pt)}
                      onMouseEnter={() => setHoveredPoint(pt)}
                      className="flex-1 flex flex-col items-center h-full justify-end group px-1 cursor-pointer"
                    >
                      {/* Bar Pillar */}
                      <div
                        className={`w-full rounded-t-lg transition-all relative ${
                          isSelected
                            ? 'bg-amber-500 ring-2 ring-slate-900 shadow-md'
                            : pt.is_peak
                            ? 'bg-amber-400/95 group-hover:bg-amber-500'
                            : 'bg-amber-300/85 group-hover:bg-amber-400'
                        }`}
                        style={{ height: `${(pt.kwh / maxKwh) * 100}%` }}
                      >
                        {/* Blue Rain Badge on top of heavy rain bars */}
                        {isHeavyRain && (
                          <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-xs whitespace-nowrap animate-pulse">
                            {pt.rain_mm_h} mm/h
                          </div>
                        )}
                      </div>

                      {/* Hour & kWh text labels */}
                      <span className="text-[10px] font-bold text-slate-500 mt-2">{pt.hour}</span>
                      <span className="text-[9px] text-slate-400 font-semibold">{pt.kwh} kWh</span>
                    </div>
                  );
                })}
              </div>

              {/* Hover Tooltip Overlay */}
              {hoveredPoint && (
                <div className="absolute top-2 right-4 bg-slate-900/90 backdrop-blur-md text-white text-xs p-3 rounded-xl shadow-lg border border-slate-700 space-y-1">
                  <div className="font-extrabold text-amber-300">Godzina {hoveredPoint.hour}</div>
                  <div className="flex justify-between space-x-4">
                    <span className="text-slate-300">Zużycie energii:</span>
                    <strong className="text-white">{hoveredPoint.kwh} kWh</strong>
                  </div>
                  <div className="flex justify-between space-x-4">
                    <span className="text-slate-300">Moc chwilowa:</span>
                    <strong className="text-amber-300">{hoveredPoint.power_kw} kW</strong>
                  </div>
                  <div className="flex justify-between space-x-4">
                    <span className="text-slate-300">Opad deszczomierza:</span>
                    <strong className="text-blue-400">{hoveredPoint.rain_mm_h} mm/h</strong>
                  </div>
                  <div className="flex justify-between space-x-4 border-t border-slate-700 pt-1 mt-1">
                    <span className="text-slate-300">Strefa C12A:</span>
                    <span
                      className={`font-bold text-[10px] px-1.5 py-0.5 rounded ${
                        hoveredPoint.is_peak ? 'bg-rose-500/30 text-rose-300' : 'bg-emerald-500/30 text-emerald-300'
                      }`}
                    >
                      {hoveredPoint.tariff_zone} ({hoveredPoint.cost_c12a_pln} zł)
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {chartMode === 'monthly' && (
            <div className="h-64 flex items-end justify-between px-2 pt-6 pb-2 border-b border-slate-100">
              {data.monthly_trends.map((m, idx) => {
                const maxMonthKwh = 45000 * (station === 'PNB1' ? 0.35 : 1);
                const hPct = Math.min(95, Math.max(15, (m.total_kwh / maxMonthKwh) * 100));
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group px-1">
                    <span className="text-[10px] font-bold text-slate-500 mb-1">{Math.round(m.total_kwh / 1000)}k</span>
                    <div
                      style={{ height: `${hPct}%` }}
                      className="w-full bg-blue-500/80 rounded-t-lg group-hover:bg-blue-600 transition-all relative"
                    >
                      <div
                        style={{ height: `${(m.peak_kwh / m.total_kwh) * 100}%` }}
                        className="w-full bg-amber-400 rounded-t-lg"
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 mt-2 truncate max-w-full">
                      {m.month.slice(0, 3)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {chartMode === 'scatter' && (
            <div className="h-64 p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Wykres rozrzutu: Opad (mm/h) vs Zużycie Energii (kWh)</span>
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px]">
                  Korelacja Pearsona R² = {data.r2_correlation_rain_energy} (Bardzo silna)
                </span>
              </div>
              <svg viewBox="0 0 500 150" className="w-full h-44">
                {/* Axes */}
                <line x1="40" y1="120" x2="480" y2="120" stroke="#cbd5e1" strokeWidth="1" />
                <line x1="40" y1="20" x2="40" y2="120" stroke="#cbd5e1" strokeWidth="1" />
                {/* Regression Line */}
                <line x1="40" y1="110" x2="480" y2="30" stroke="#2563eb" strokeWidth="2" strokeDasharray="4 4" />
                {/* Scatter Dots */}
                {data.scatter_points.map((pt, i) => {
                  const x = 40 + (pt.rain_mm_h / 200) * 440;
                  const y = 120 - (pt.energy_kwh / 70) * 100;
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r="3.5"
                      fill="#f59e0b"
                      stroke="#ffffff"
                      strokeWidth="1"
                      className="hover:r-5 transition-all cursor-pointer"
                    >
                      <title>{`${pt.label}: ${pt.energy_kwh} kWh`}</title>
                    </circle>
                  );
                })}
              </svg>
              <div className="flex justify-between text-[10px] text-slate-400 font-semibold px-4">
                <span>Opad 0 mm/h (Pobór bazowy)</span>
                <span>Opad 194.8 mm/h (Szczyt nawałnicy)</span>
              </div>
            </div>
          )}

          {/* Legend and Note */}
          <div className="flex items-center justify-between pt-2 text-xs font-semibold text-slate-500">
            <div className="flex items-center space-x-4">
              <span className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-sm bg-blue-600 inline-block" />
                <span>Intensywność opadu (mm/h)</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" />
                <span>Zużycie energii (kWh)</span>
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Model uwzględnia retencję zlewni τ = 15–25 min
            </span>
          </div>
        </div>

        {/* Right Tariff Zones C12A Card (4 cols, Exact replica of Image 3 with SmartFlow Action) */}
        <div
          data-tour="energy-tariffs"
          className="col-span-4 bg-white rounded-3xl p-6 border border-[#e8ecf1] shadow-2xs space-y-4 flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-slate-900 font-extrabold text-sm">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Taryfa Dwustrefowa C12A (Ruda / Rybnik)</span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Optymalizacja harmonogramu opróżniania bufora retencyjnego R2 w strefie pozaszczytowej:
            </p>

            <div className="space-y-3 text-xs">
              {/* Peak Zone */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="flex justify-between items-center font-extrabold text-slate-800">
                  <span>Strefa Szczytowa (Dojrzała)</span>
                  <span className="text-rose-600 font-black">Najdroższa (1.42 zł)</span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  8:00 - 11:00 oraz 20:00 - 21:00 (lato)
                </div>
              </div>

              {/* Off-Peak Zone */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100 space-y-1">
                <div className="flex justify-between items-center font-extrabold text-emerald-900">
                  <span>Strefa Poza Szczytem (Buforowanie)</span>
                  <span className="text-emerald-700 font-black">Oszczędność (0.74 zł)</span>
                </div>
                <div className="text-[11px] text-emerald-800 font-medium">
                  11:00 - 20:00 oraz 21:00 - 8:00
                </div>
              </div>
            </div>

            {/* SmartFlow Callout */}
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2">
              <div className="flex items-center space-x-1.5 font-extrabold text-amber-900">
                <Sparkles className="w-4 h-4 text-amber-600 fill-amber-500" />
                <span>Zalecenie Algorytmu SmartFlow:</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-900/90 font-medium">
                Zatrzymanie zrzutu ze zbiornika R2 (zamknięcie zasuwy Z24) w godzinach 20:00 – 21:00 pozwala zaoszczędzić do{' '}
                <strong className="text-slate-900">
                  {Math.round((data.potential_savings_c12a_pln || 50400) / 12).toLocaleString()} PLN/miesięcznie
                </strong> na energii elektrycznej.
              </p>
            </div>
          </div>

          {/* Action Trigger Button */}
          <div className="pt-2">
            <button
              onClick={() => {
                setSmartFlowActive(!smartFlowActive);
                showToast(
                  smartFlowActive
                    ? 'Harmonogram SmartFlow zatrzymany'
                    : 'Harmonogram SmartFlow wdrożony: Zasuwa Z24 zablokowana w szczycie 20:00–21:00'
                );
              }}
              className={`w-full py-3 rounded-xl font-extrabold text-xs transition-all shadow-sm flex items-center justify-center space-x-2 ${
                smartFlowActive
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              {smartFlowActive ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Harmonogram Aktywny (+140 PLN/doba)</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Wdróż Harmonogram SmartFlow</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Production Module 1: Interactive What-If Tariff Simulator */}
      <div className="bg-white rounded-3xl p-6 border border-[#e8ecf1] shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-slate-900">
                Symulator Oszczędności Dyspozytora (What-If Tariff Calculator)
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Modelowanie zysków z przesunięcia tłoczenia do taniej strefy nocnej przy użyciu pojemności retencyjnej
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs font-bold text-slate-600">
            <span>Stacja: </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
              {station}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6 items-center pt-2">
          {/* Sliders (7 cols) */}
          <div className="col-span-7 space-y-4">
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-1.5">
                <span>Przesunięcie wolumenu do strefy nocnej (21:00 – 08:00):</span>
                <span className="text-blue-600 font-extrabold">{shiftRetentionPct}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={shiftRetentionPct}
                onChange={(e) => setShiftRetentionPct(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-1">
                <span>0% (Brak retencji)</span>
                <span>50% (Standard)</span>
                <span>100% (Maksymalne buforowanie)</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-1.5">
                <span>Mnożnik taryfy rynkowej (Cena bazowa energii):</span>
                <span className="text-amber-600 font-extrabold">{simulatedTariffPrice.toFixed(2)} zł / kWh</span>
              </div>
              <input
                type="range"
                min="0.60"
                max="2.00"
                step="0.05"
                value={simulatedTariffPrice}
                onChange={(e) => setSimulatedTariffPrice(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-1">
                <span>0.60 zł/kWh (Tani prąd)</span>
                <span>1.00 zł/kWh (PWiK Benchmark)</span>
                <span>2.00 zł/kWh (Kryzys szczytowy)</span>
              </div>
            </div>
          </div>

          {/* Results Badge (5 cols) */}
          <div className="col-span-5 grid grid-cols-3 gap-3 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
            <div>
              <span className="text-[10px] font-bold text-emerald-800 uppercase block">Oszczędność miesięczna</span>
              <div className="text-lg font-black text-emerald-900 mt-0.5">
                {whatIfCalculations.monthlySavings.toLocaleString()} <span className="text-xs font-normal">zł</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-emerald-800 uppercase block">Oszczędność roczna</span>
              <div className="text-lg font-black text-emerald-900 mt-0.5">
                {whatIfCalculations.annualSavings.toLocaleString()} <span className="text-xs font-normal">zł</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-emerald-800 uppercase block">Redukcja CO₂</span>
              <div className="text-lg font-black text-emerald-900 mt-0.5">
                {whatIfCalculations.co2ReductionTons} <span className="text-xs font-normal">t/rok</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Production Module 2: Pump Fleet Technical Health & SEU Index */}
      <div className="bg-white rounded-3xl p-6 border border-[#e8ecf1] shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
          <div>
            <h4 className="text-sm font-extrabold text-slate-900">
              Karty Pracy i Wskaźnik Efektywności Pomp (SEU - Specific Energy Consumption)
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Norma branżowa: SEU poniżej 0.25 kWh/m³. Pompy o wyższym wskaźniku kwalifikowane są do inspekcji wirnika.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
            {data.pump_fleet.length} Jednostki Pompowania
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 font-semibold border-b border-slate-100 pb-2">
                <th className="py-2.5 font-bold">Oznaczenie Pompy</th>
                <th className="py-2.5 font-bold">Lokalizacja</th>
                <th className="py-2.5 font-bold">Moc Pn [kW]</th>
                <th className="py-2.5 font-bold">Prąd [A]</th>
                <th className="py-2.5 font-bold">Wydatek Q [m³/h]</th>
                <th className="py-2.5 font-bold text-blue-600">SEU [kWh/m³]</th>
                <th className="py-2.5 font-bold text-amber-600">Sprawność η</th>
                <th className="py-2.5 font-bold">Diagnoza Techniczna</th>
                <th className="py-2.5 font-bold text-right">Roczny Koszt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.pump_fleet.map((pump, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 font-extrabold text-slate-900 flex items-center space-x-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        pump.health_status === 'OPTIMAL'
                          ? 'bg-emerald-500'
                          : pump.health_status === 'WARNING'
                          ? 'bg-amber-500 animate-pulse'
                          : 'bg-rose-500'
                      }`}
                    />
                    <span>{pump.name}</span>
                  </td>
                  <td className="py-3 font-semibold text-slate-700">{pump.station}</td>
                  <td className="py-3 font-bold text-slate-900">{pump.power_kw} kW</td>
                  <td className="py-3 text-slate-600">{pump.current_A} A</td>
                  <td className="py-3 font-bold text-slate-900">{pump.flow_m3_h} m³/h</td>
                  <td className="py-3 font-extrabold text-blue-600">{pump.seu_kwh_m3}</td>
                  <td className="py-3 font-black text-amber-600">{pump.efficiency_pct}%</td>
                  <td className="py-3 text-slate-500">
                    <div className="flex items-center space-x-1.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          pump.health_status === 'OPTIMAL'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {pump.health_status}
                      </span>
                      <span className="text-[11px] truncate max-w-xs">{pump.note}</span>
                    </div>
                  </td>
                  <td className="py-3 font-extrabold text-slate-900 text-right">
                    {pump.annual_cost_pln.toLocaleString()} zł
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
