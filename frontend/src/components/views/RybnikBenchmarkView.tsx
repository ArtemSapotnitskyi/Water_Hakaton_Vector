import React, { useState, useEffect, useMemo } from 'react';
import {
  UploadCloud,
  FileText,
  Play,
  CheckCircle2,
  FileSpreadsheet,
  AlertCircle,
  Sliders,
  Sparkles,
  ArrowRight,
  TrendingUp,
  RotateCcw,
  AlertTriangle,
  ShieldAlert,
  Cpu,
  Activity,
  Zap,
  Droplets,
  Clock,
  Wrench,
  BarChart3,
  Database,
  Layers,
  ChevronRight,
  Info
} from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';
import { InflowAnalysisResponse, JuryReportItem, HourlyTrend, ForecastItem } from '../../types';

export const RybnikBenchmarkView: React.FC = () => {
  const { lang } = useTelemetry();
  const [selectedPreset, setSelectedPreset] = useState<string>('rybnik_2025_2026_test');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<number>(0);
  const [results, setResults] = useState<InflowAnalysisResponse | null>(null);
  const [activeChartTab, setActiveChartTab] = useState<'flow' | 'forecast' | 'energy'>('flow');
  const [hoveredPoint, setHoveredPoint] = useState<HourlyTrend | null>(null);
  const [hoveredForecast, setHoveredForecast] = useState<ForecastItem | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const [isDragOver, setIsDragOver] = useState(false);

  const loadingSteps = [
    lang === 'pl' ? 'Wczytywanie i normalizacja pliku...' : 'Ingesting and normalizing dataset...',
    lang === 'pl' ? 'Dekompozycja składowej dobowej DWF...' : 'Decomposing diurnal DWF baseline...',
    lang === 'pl' ? 'Wykrywanie awarii pomp i zawieszeń aparatury pomiarowej...' : 'Detecting pump failures and sensor freezes...',
    lang === 'pl' ? 'Kalkulacja predykcji 48h i bilansu energii 1.00 zł/kWh...' : 'Generating 48h forecast and energy balance...',
  ];

  // Default evaluation on initial load
  useEffect(() => {
    handleRunBenchmark('rybnik_2025_2026_test');
  }, []);

  const handleRunBenchmark = async (presetName = selectedPreset, fileToUpload = uploadedFile) => {
    setIsLoading(true);
    setLoadingStep(0);

    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => (prev < loadingSteps.length - 1 ? prev + 1 : prev));
    }, 280);

    try {
      if (fileToUpload) {
        const formData = new FormData();
        formData.append('file', fileToUpload);
        const res = await fetch('/api/benchmark/upload', {
          method: 'POST',
          body: formData,
        });
        const data: InflowAnalysisResponse = await res.json();
        setResults(data);
      } else {
        const res = await fetch(`/api/benchmark/evaluate?preset=${presetName}`, {
          method: 'POST',
        });
        const data: InflowAnalysisResponse = await res.json();
        setResults(data);
      }
    } catch (err) {
      console.error('Benchmark execution error:', err);
    } finally {
      clearInterval(stepInterval);
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedFile(file);
      setUploadedFileName(file.name);
      setSelectedPreset('custom_file');
      handleRunBenchmark('custom_file', file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setUploadedFile(file);
      setUploadedFileName(file.name);
      setSelectedPreset('custom_file');
      handleRunBenchmark('custom_file', file);
    }
  };

  // Filtered Jury Records
  const filteredRecords = useMemo(() => {
    if (!results || !results.jury_records) return [];
    if (categoryFilter === 'ALL') return results.jury_records;
    if (categoryFilter === 'HARDWARE') {
      return results.jury_records.filter(
        (r) =>
          r.anomaly_type.toLowerCase().includes('pompy') ||
          r.anomaly_type.toLowerCase().includes('licznika') ||
          r.anomaly_type.toLowerCase().includes('aparatury') ||
          r.anomaly_type.toLowerCase().includes('awaria')
      );
    }
    if (categoryFilter === 'STORM') {
      return results.jury_records.filter(
        (r) =>
          r.anomaly_type.toLowerCase().includes('burz') ||
          r.anomaly_type.toLowerCase().includes('nawalny') ||
          r.anomaly_type.toLowerCase().includes('opad')
      );
    }
    if (categoryFilter === 'INFILTRATION') {
      return results.jury_records.filter(
        (r) =>
          r.anomaly_type.toLowerCase().includes('infiltracja') ||
          r.anomaly_type.toLowerCase().includes('gruntowych') ||
          r.anomaly_type.toLowerCase().includes('roztopowe')
      );
    }
    return results.jury_records;
  }, [results, categoryFilter]);

  // Scalers for Flow SVG Chart
  const trends = results?.hourly_trends || [];
  const maxFlow = useMemo(() => {
    if (!trends.length) return 100;
    return Math.max(...trends.map((t) => Math.max(t.measured_m3, t.dwf_baseline_m3 * 1.5))) * 1.15;
  }, [trends]);

  const chartWidth = 900;
  const chartHeight = 220;
  const padding = { top: 20, right: 30, bottom: 30, left: 45 };

  // Calculate coordinates for Flow Chart
  const points = useMemo(() => {
    if (!trends.length) return { measuredPath: '', dwfPath: '', areaPath: '', pts: [] };
    const stepX = (chartWidth - padding.left - padding.right) / Math.max(trends.length - 1, 1);
    const usableH = chartHeight - padding.top - padding.bottom;

    const coords = trends.map((t, i) => {
      const x = padding.left + i * stepX;
      const yMeas = chartHeight - padding.bottom - (t.measured_m3 / maxFlow) * usableH;
      const yDwf = chartHeight - padding.bottom - (t.dwf_baseline_m3 / maxFlow) * usableH;
      const yAcc = chartHeight - padding.bottom - (t.accidental_m3 / maxFlow) * usableH;
      return { x, yMeas, yDwf, yAcc, data: t };
    });

    const measuredPath = coords.reduce(
      (acc, p, i) => (i === 0 ? `M ${p.x} ${p.yMeas}` : `${acc} L ${p.x} ${p.yMeas}`),
      ''
    );
    const dwfPath = coords.reduce(
      (acc, p, i) => (i === 0 ? `M ${p.x} ${p.yDwf}` : `${acc} L ${p.x} ${p.yDwf}`),
      ''
    );
    const areaPath =
      coords.reduce(
        (acc, p, i) => (i === 0 ? `M ${p.x} ${p.yMeas}` : `${acc} L ${p.x} ${p.yMeas}`),
        ''
      ) +
      ` L ${coords[coords.length - 1].x} ${chartHeight - padding.bottom}` +
      ` L ${coords[0].x} ${chartHeight - padding.bottom} Z`;

    return { measuredPath, dwfPath, areaPath, pts: coords };
  }, [trends, maxFlow]);

  // Scalers for Forecast SVG Chart
  const forecastTrends = results?.forecast_trends || [];
  const maxForecastFlow = useMemo(() => {
    if (!forecastTrends.length) return 100;
    return Math.max(...forecastTrends.map((f) => f.upper_bound_m3)) * 1.15;
  }, [forecastTrends]);

  const forecastPoints = useMemo(() => {
    if (!forecastTrends.length) return { linePath: '', bandPath: '', dwfPath: '', pts: [] };
    const stepX = (chartWidth - padding.left - padding.right) / Math.max(forecastTrends.length - 1, 1);
    const usableH = chartHeight - padding.top - padding.bottom;

    const coords = forecastTrends.map((f, i) => {
      const x = padding.left + i * stepX;
      const yPred = chartHeight - padding.bottom - (f.predicted_flow_m3 / maxForecastFlow) * usableH;
      const yUpper = chartHeight - padding.bottom - (f.upper_bound_m3 / maxForecastFlow) * usableH;
      const yLower = chartHeight - padding.bottom - (f.lower_bound_m3 / maxForecastFlow) * usableH;
      const yDwf = chartHeight - padding.bottom - (f.dwf_baseline_m3 / maxForecastFlow) * usableH;
      return { x, yPred, yUpper, yLower, yDwf, data: f };
    });

    const linePath = coords.reduce(
      (acc, p, i) => (i === 0 ? `M ${p.x} ${p.yPred}` : `${acc} L ${p.x} ${p.yPred}`),
      ''
    );
    const dwfPath = coords.reduce(
      (acc, p, i) => (i === 0 ? `M ${p.x} ${p.yDwf}` : `${acc} L ${p.x} ${p.yDwf}`),
      ''
    );

    // Band path: upper line forward, lower line backward
    const upperStr = coords.reduce(
      (acc, p, i) => (i === 0 ? `M ${p.x} ${p.yUpper}` : `${acc} L ${p.x} ${p.yUpper}`),
      ''
    );
    const lowerStr = coords
      .slice()
      .reverse()
      .reduce((acc, p) => `${acc} L ${p.x} ${p.yLower}`, '');
    const bandPath = `${upperStr} ${lowerStr} Z`;

    return { linePath, bandPath, dwfPath, pts: coords };
  }, [forecastTrends, maxForecastFlow]);

  return (
    <div className="p-8 space-y-6">
      {/* Top Banner & Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2.5">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              {lang === 'pl'
                ? 'Poligon Testowy: Rybnik 2025–2026 (Benchmark)'
                : 'Test Benchmark: Rybnik 2025–2026'}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
              Konkurs PWiK Rybnik
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Silnik Analityczny Online
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            {lang === 'pl'
              ? 'Wgrywanie nowych danych testowych (CSV, TXT), inteligentna dekompozycja wód przypadkowych DWF, precyzyjne wykrywanie awarii pomp i liczników oraz kalkulacja kosztów energii (1 zł/kWh) dla Jury.'
              : 'Upload test datasets, decompose accidental stormwater from dry sanitary DWF baseline, detect pump & sensor failures, and compute excess energy costs for the jury.'}
          </p>
        </div>

        {/* Export CTA */}
        <a
          href="/api/benchmark/export"
          download
          data-tour="bench-export"
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span>{lang === 'pl' ? 'Pobierz Raport dla Jury (CSV)' : 'Export Jury Report (CSV)'}</span>
        </a>
      </div>

      {/* Upload Zone & Presets Section */}
      <div className="grid grid-cols-12 gap-6">
        {/* Upload Dropzone (7 Cols) */}
        <div
          data-tour="bench-upload"
          className="col-span-7 bg-white rounded-3xl p-6 border border-[#e8ecf1] shadow-2xs space-y-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {lang === 'pl' ? 'Wgraj Nowy Zbiór Danych' : 'Upload Dataset File'}
            </span>
            <span className="text-[11px] font-semibold text-slate-400">Obsługa: CSV, TXT, TSV, XLSX</span>
          </div>

          <label
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all ${
              isDragOver
                ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                : 'border-slate-200 hover:border-blue-500 hover:bg-blue-50/20'
            }`}
          >
            <input
              type="file"
              accept=".csv,.txt,.tsv,.xlsx,.ods"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 mb-2">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div className="text-xs font-bold text-slate-800">
              {uploadedFileName ? (
                <span className="text-blue-600 font-extrabold flex items-center space-x-1.5">
                  <FileText className="w-4 h-4" />
                  <span>{uploadedFileName}</span>
                </span>
              ) : (
                lang === 'pl'
                  ? 'Kliknij lub przeciągnij plik testowy 2025–2026'
                  : 'Click or drag test dataset file here'
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Automatyczne wykrywanie schematu: Data, Przepływ [m³], Prąd pomp [A], Energia [kWh]
            </div>
          </label>

          <div className="flex items-center justify-between pt-1">
            <div className="text-xs text-slate-500">
              {uploadedFileName ? (
                <span className="flex items-center space-x-1.5 text-emerald-600 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Plik wczytany — gotowy do analizy</span>
                </span>
              ) : (
                <span className="text-slate-400">Możesz też wybrać gotowy zestaw po prawej stronie</span>
              )}
            </div>

            <button
              onClick={() => handleRunBenchmark()}
              disabled={isLoading}
              data-tour="bench-run"
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-extrabold transition-all shadow-md shadow-blue-500/20"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>
                {isLoading
                  ? lang === 'pl' ? 'Przetwarzanie danych...' : 'Processing...'
                  : lang === 'pl' ? 'Uruchom Model Predykcyjny' : 'Run Predictive Model'}
              </span>
            </button>
          </div>

          {/* Animated Processing Indicator */}
          {isLoading && (
            <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100 space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                <span className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-blue-600 animate-spin" />
                  <span>{loadingSteps[loadingStep]}</span>
                </span>
                <span>{Math.round(((loadingStep + 1) / loadingSteps.length) * 100)}%</span>
              </div>
              <div className="w-full bg-blue-200/60 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${((loadingStep + 1) / loadingSteps.length) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Quick Presets (5 Cols) */}
        <div
          data-tour="bench-presets"
          className="col-span-5 bg-white rounded-3xl p-6 border border-[#e8ecf1] shadow-2xs space-y-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {lang === 'pl' ? 'Gotowe Zbiory Konkursowe' : 'Benchmark Presets'}
            </span>
            <span className="text-[11px] font-bold text-blue-600">PWiK Rybnik</span>
          </div>

          <div className="space-y-2">
            {[
              {
                id: 'rybnik_2025_2026_test',
                name: 'Zestaw Konkursowy Rybnik 2025–2026',
                desc: 'Oficjalny horyzont testowy hackathonu (Zlewnia PZ1 & PNB1)',
                tag: 'Oficjalny Test',
                badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
              },
              {
                id: 'pz1_historical',
                name: 'PZ1 2024 (ul. Pełczyńskiego)',
                desc: 'Dane rzeczywiste 2024 z filtrem zamrożenia licznika w marcu',
                tag: 'Baza Ucząca PZ1',
                badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
              },
              {
                id: 'pnb1_historical',
                name: 'PNB1 2024 (Zlewnia Niewiadom)',
                desc: 'Dane rzeczywiste z awarią pojedynczej pompy 05.06.2024',
                tag: 'Baza Ucząca PNB1',
                badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
              },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedPreset(p.id);
                  setUploadedFile(null);
                  setUploadedFileName(null);
                  handleRunBenchmark(p.id);
                }}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all ${
                  selectedPreset === p.id && !uploadedFile
                    ? 'border-blue-500 bg-blue-50/30 shadow-2xs ring-1 ring-blue-500/50'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-extrabold text-slate-900">{p.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${p.badgeColor}`}>
                    {p.tag}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">{p.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dataset Metadata Badge (If Available) */}
      {results?.metadata && (
        <div className="p-4 rounded-2xl bg-white border border-[#e8ecf1] shadow-2xs flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <Database className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-slate-900 flex items-center space-x-2">
                <span>{results.metadata.filename}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
                  {results.metadata.data_type}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Zakres: <strong>{results.metadata.date_range}</strong> | Próbkowanie: {results.metadata.sampling_rate}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-6 text-xs font-semibold text-slate-600">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Wielkość pliku</span>
              <span>{(results.metadata.file_size_kb / 1024).toFixed(2)} MB ({results.metadata.file_size_kb} KB)</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Liczba rekordów</span>
              <span className="font-bold text-slate-900">{results.metadata.total_records.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Jakość danych</span>
              <span className="font-bold text-emerald-600">{results.metadata.quality_score}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Results Section */}
      {results && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* 4 Clean Metric Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-[#e8ecf1] shadow-2xs">
              <div className="text-xs font-bold text-slate-400 mb-1">
                {lang === 'pl' ? 'Całkowita Objętość Przepływu' : 'Total Evaluated Inflow'}
              </div>
              <div className="text-2xl font-black text-slate-900">
                {(results.total_measured_m3 / 1000).toFixed(1)}k <span className="text-xs font-normal text-slate-400">m³</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Baza sanitarna DWF: <strong>{(results.total_dwf_m3 / 1000).toFixed(1)}k m³</strong>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#e8ecf1] shadow-2xs">
              <div className="text-xs font-bold text-slate-400 mb-1">
                {lang === 'pl' ? 'Wody Przypadkowe (Infiltracja)' : 'Accidental Stormwater'}
              </div>
              <div className="text-2xl font-black text-blue-600">
                {results.total_accidental_m3.toLocaleString()} <span className="text-xs font-normal text-slate-400">m³</span>
              </div>
              <div className="mt-1 text-[11px] text-blue-600 font-bold">
                ▲ {results.accidental_water_pct}% udział wód opadowych i obcych
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#e8ecf1] shadow-2xs">
              <div className="text-xs font-bold text-slate-400 mb-1">
                {lang === 'pl' ? 'Koszt Nadmiarowej Energii' : 'Excess Pumping Cost'}
              </div>
              <div className="text-2xl font-black text-rose-600">
                {results.financial_cost_pln.toLocaleString()} <span className="text-xs font-normal text-slate-400">PLN</span>
              </div>
              <div className="mt-1 text-[11px] text-rose-600 font-semibold">
                Stawka rozliczeniowa konkursu: <strong>1.00 zł/kWh</strong>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#e8ecf1] shadow-2xs">
              <div className="text-xs font-bold text-slate-400 mb-1">
                {lang === 'pl' ? 'Wykryte Incydenty i Awarie' : 'Identified Failures'}
              </div>
              <div className="text-2xl font-black text-slate-900 flex items-center space-x-2">
                <span>{results.jury_records.length}</span>
                <span className="text-xs font-normal text-slate-400">okresów zdarzeń</span>
              </div>
              <div className="mt-1 flex items-center space-x-2 text-[10px] font-bold">
                <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                  {results.failures_summary?.pump_trips || 1} awarii pomp
                </span>
                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                  {results.failures_summary?.meter_faults || 1} błędy licznika
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Chart Container */}
          <div className="bg-white rounded-3xl p-6 border border-[#e8ecf1] shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setActiveChartTab('flow')}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                    activeChartTab === 'flow'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>{lang === 'pl' ? 'Przepływ vs Baza DWF' : 'Flow vs Baseline DWF'}</span>
                </button>
                <button
                  onClick={() => setActiveChartTab('forecast')}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                    activeChartTab === 'forecast'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>{lang === 'pl' ? 'Predykcja 48h (Prognoza Modelu)' : '48h Predictive Forecast'}</span>
                </button>
              </div>

              {/* Chart Legend */}
              <div className="flex items-center space-x-4 text-[11px] font-bold">
                {activeChartTab === 'flow' ? (
                  <>
                    <span className="flex items-center space-x-1.5 text-blue-600">
                      <span className="w-3 h-1 bg-blue-600 rounded-full inline-block" />
                      <span>Przepływ Zmierzony (m³/h)</span>
                    </span>
                    <span className="flex items-center space-x-1.5 text-purple-600">
                      <span className="w-3 h-0.5 border-t-2 border-purple-600 border-dashed inline-block" />
                      <span>Baza DWF (Ścieki sanitarne)</span>
                    </span>
                    <span className="flex items-center space-x-1.5 text-sky-500">
                      <span className="w-3 h-2 bg-blue-100 border border-blue-300 rounded inline-block" />
                      <span>Wody Przypadkowe (Udar)</span>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center space-x-1.5 text-indigo-600">
                      <span className="w-3 h-1 bg-indigo-600 rounded-full inline-block" />
                      <span>Prognoza Przepływu (m³/h)</span>
                    </span>
                    <span className="flex items-center space-x-1.5 text-indigo-400">
                      <span className="w-3 h-2 bg-indigo-100 border border-indigo-200 rounded inline-block" />
                      <span>Przedział Ufności 95% (±1.96σ)</span>
                    </span>
                    <span className="flex items-center space-x-1.5 text-slate-400">
                      <span className="w-3 h-0.5 border-t border-slate-400 border-dashed inline-block" />
                      <span>Spodziewany DWF</span>
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* SVG Chart Display */}
            {activeChartTab === 'flow' ? (
              <div className="relative">
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="w-full h-56 select-none"
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  <defs>
                    <linearGradient id="accidentalAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                    const y = chartHeight - padding.bottom - pct * (chartHeight - padding.top - padding.bottom);
                    const val = Math.round(pct * maxFlow);
                    return (
                      <g key={idx}>
                        <line
                          x1={padding.left}
                          y1={y}
                          x2={chartWidth - padding.right}
                          y2={y}
                          stroke="#f1f5f9"
                          strokeWidth="1"
                        />
                        <text
                          x={padding.left - 8}
                          y={y + 4}
                          textAnchor="end"
                          fontSize="9"
                          fill="#94a3b8"
                          fontWeight="600"
                        >
                          {val}
                        </text>
                      </g>
                    );
                  })}

                  {/* Accidental Inflow Area */}
                  {points.areaPath && (
                    <path d={points.areaPath} fill="url(#accidentalAreaGrad)" />
                  )}

                  {/* DWF Baseline Line (Dashed Purple) */}
                  {points.dwfPath && (
                    <path
                      d={points.dwfPath}
                      fill="none"
                      stroke="#9333ea"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                    />
                  )}

                  {/* Measured Flow Line (Solid Blue) */}
                  {points.measuredPath && (
                    <path
                      d={points.measuredPath}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Interactive Points / Hover detection */}
                  {points.pts.map((pt, idx) => {
                    const isSpike = pt.data.accidental_m3 > pt.data.dwf_baseline_m3 * 0.8;
                    return (
                      <g
                        key={idx}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredPoint(pt.data)}
                      >
                        {/* Invisible larger hover zone */}
                        <circle cx={pt.x} cy={pt.yMeas} r="8" fill="transparent" />
                        {isSpike && (
                          <circle
                            cx={pt.x}
                            cy={pt.yMeas}
                            r="4"
                            fill="#ef4444"
                            stroke="#ffffff"
                            strokeWidth="1.5"
                          />
                        )}
                      </g>
                    );
                  })}
                </svg>

                {/* Hover Tooltip Overlay */}
                {hoveredPoint && (
                  <div className="absolute top-2 right-4 bg-slate-900/90 backdrop-blur-md text-white text-xs p-3 rounded-xl shadow-lg border border-slate-700 space-y-1">
                    <div className="font-extrabold text-blue-300">{hoveredPoint.time}</div>
                    <div className="flex justify-between space-x-4">
                      <span className="text-slate-300">Przepływ zmierzony:</span>
                      <strong className="text-white">{hoveredPoint.measured_m3} m³/h</strong>
                    </div>
                    <div className="flex justify-between space-x-4">
                      <span className="text-slate-300">Baza sanitarna DWF:</span>
                      <strong className="text-purple-300">{hoveredPoint.dwf_baseline_m3} m³/h</strong>
                    </div>
                    <div className="flex justify-between space-x-4">
                      <span className="text-slate-300">Wody przypadkowe:</span>
                      <strong className="text-blue-400">+{hoveredPoint.accidental_m3} m³/h</strong>
                    </div>
                    <div className="flex justify-between space-x-4 border-t border-slate-700 pt-1 mt-1">
                      <span className="text-slate-300">Koszt energii (1 zł/kWh):</span>
                      <strong className="text-rose-400">{hoveredPoint.cost_pln} PLN/h</strong>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative">
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="w-full h-56 select-none"
                  onMouseLeave={() => setHoveredForecast(null)}
                >
                  <defs>
                    <linearGradient id="forecastBandGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity="0.05" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                    const y = chartHeight - padding.bottom - pct * (chartHeight - padding.top - padding.bottom);
                    const val = Math.round(pct * maxForecastFlow);
                    return (
                      <g key={idx}>
                        <line
                          x1={padding.left}
                          y1={y}
                          x2={chartWidth - padding.right}
                          y2={y}
                          stroke="#f1f5f9"
                          strokeWidth="1"
                        />
                        <text
                          x={padding.left - 8}
                          y={y + 4}
                          textAnchor="end"
                          fontSize="9"
                          fill="#94a3b8"
                          fontWeight="600"
                        >
                          {val}
                        </text>
                      </g>
                    );
                  })}

                  {/* 95% Confidence Band */}
                  {forecastPoints.bandPath && (
                    <path d={forecastPoints.bandPath} fill="url(#forecastBandGrad)" />
                  )}

                  {/* DWF Reference line */}
                  {forecastPoints.dwfPath && (
                    <path
                      d={forecastPoints.dwfPath}
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                  )}

                  {/* Predicted Flow Line (Indigo) */}
                  {forecastPoints.linePath && (
                    <path
                      d={forecastPoints.linePath}
                      fill="none"
                      stroke="#4f46e5"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Hover Targets */}
                  {forecastPoints.pts.map((pt, idx) => (
                    <g
                      key={idx}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredForecast(pt.data)}
                    >
                      <circle cx={pt.x} cy={pt.yPred} r="7" fill="transparent" />
                      <circle cx={pt.x} cy={pt.yPred} r="2.5" fill="#4f46e5" />
                    </g>
                  ))}
                </svg>

                {/* Hover Tooltip Overlay for Forecast */}
                {hoveredForecast && (
                  <div className="absolute top-2 right-4 bg-slate-900/90 backdrop-blur-md text-white text-xs p-3 rounded-xl shadow-lg border border-slate-700 space-y-1">
                    <div className="font-extrabold text-indigo-300">
                      Horyzont: {hoveredForecast.time}
                    </div>
                    <div className="flex justify-between space-x-4">
                      <span className="text-slate-300">Prognozowany przepływ:</span>
                      <strong className="text-white">{hoveredForecast.predicted_flow_m3} m³/h</strong>
                    </div>
                    <div className="flex justify-between space-x-4">
                      <span className="text-slate-300">Przedział ufności 95%:</span>
                      <strong className="text-indigo-300">
                        [{hoveredForecast.lower_bound_m3} — {hoveredForecast.upper_bound_m3}] m³
                      </strong>
                    </div>
                    <div className="flex justify-between space-x-4">
                      <span className="text-slate-300">Szacowana energia:</span>
                      <strong className="text-amber-400">{hoveredForecast.predicted_energy_kwh} kWh</strong>
                    </div>
                    <div className="flex justify-between space-x-4 border-t border-slate-700 pt-1 mt-1">
                      <span className="text-slate-300">Ocena ryzyka przeciążenia:</span>
                      <span
                        className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                          hoveredForecast.risk_level === 'CRITICAL'
                            ? 'bg-rose-500/30 text-rose-300'
                            : hoveredForecast.risk_level === 'ELEVATED'
                            ? 'bg-amber-500/30 text-amber-300'
                            : 'bg-emerald-500/30 text-emerald-300'
                        }`}
                      >
                        {hoveredForecast.risk_level}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Critical Failures & Damage Moments Grid ("Momenty uszkodzeń i awarii") */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <h3 className="text-base font-extrabold text-slate-900">
                  {lang === 'pl'
                    ? 'Zidentyfikowane Uszkodzenia i Awarie Pompowni (Momenty Awarii)'
                    : 'Identified Equipment Failures & Damage Windows'}
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                Wykryto <strong>{results.jury_records.length}</strong> kluczowych incydentów w zbiorze
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {results.jury_records.slice(0, 4).map((inc, idx) => {
                const isCritical = inc.severity === 'CRITICAL';
                return (
                  <div
                    key={idx}
                    className={`p-5 rounded-2xl bg-white border transition-all shadow-2xs space-y-3 ${
                      isCritical ? 'border-rose-200 hover:border-rose-300' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                            isCritical
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {inc.severity === 'CRITICAL' ? 'KRYTYCZNA AWARIA' : 'OSTRZEŻENIE HYDRAULICZNE'}
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          {inc.station}
                        </span>
                      </div>
                      <span className="text-xs font-extrabold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                        {inc.date} ({inc.time_range})
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">{inc.anomaly_type}</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        {inc.root_cause || 'Wykryto asymetrię przepływowo-prądową w trakcie obciążenia.'}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Element</span>
                        <span className="font-bold text-slate-800 truncate block">
                          {inc.equipment_affected || 'Układ pomp'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Wody przypadkowe</span>
                        <span className="font-extrabold text-blue-600">+{inc.accidental_water_m3} m³</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Koszt strat</span>
                        <span className="font-extrabold text-rose-600">{inc.financial_loss_pln} PLN</span>
                      </div>
                    </div>

                    {inc.recommended_action && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-start space-x-2 text-[11px] text-slate-600">
                        <Wrench className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-slate-800">Działanie dyspozytorskie:</strong> {inc.recommended_action}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Test Benchmark Jury Table */}
          <div className="bg-white rounded-3xl p-6 border border-[#e8ecf1] shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {lang === 'pl'
                    ? 'Wyniki Detekcji Modelu dla Zbioru Testowego (Tabela Konkursowa dla Jury)'
                    : 'Model Prediction Outputs for Test Benchmark (Jury Rubric Table)'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Wymóg PWiK: Dzień, przedział godzinowy, objętość wód przypadkowych (m³), nadmiar energii (kWh) oraz straty (1 zł/kWh)
                </p>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center space-x-1.5 text-xs">
                {[
                  { id: 'ALL', label: 'Wszystkie' },
                  { id: 'HARDWARE', label: 'Awarie Sprzętowe' },
                  { id: 'STORM', label: 'Udary Burzowe' },
                  { id: 'INFILTRATION', label: 'Infiltracja' },
                ].map((btn) => (
                  <button
                    key={btn.id}
                    onClick={() => setCategoryFilter(btn.id)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                      categoryFilter === btn.id
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 font-semibold border-b border-slate-100 pb-2">
                    <th className="py-2.5 font-bold">Data</th>
                    <th className="py-2.5 font-bold">Przedział Godzin</th>
                    <th className="py-2.5 font-bold">Zlewnia / Obiekt</th>
                    <th className="py-2.5 font-bold">Baza DWF [m³]</th>
                    <th className="py-2.5 font-bold">Zmierzony [m³]</th>
                    <th className="py-2.5 font-bold text-blue-600">Wody Przypadkowe [m³]</th>
                    <th className="py-2.5 font-bold text-amber-600">Nadmiar kWh</th>
                    <th className="py-2.5 font-bold text-rose-600">Koszt PLN (1 zł/kWh)</th>
                    <th className="py-2.5 font-bold">Kategoria / Typ Awarii</th>
                    <th className="py-2.5 font-bold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 font-extrabold text-slate-900">{row.date}</td>
                      <td className="py-3 font-semibold text-slate-600">{row.time_range}</td>
                      <td className="py-3 font-bold text-slate-800">{row.station}</td>
                      <td className="py-3 text-slate-500">{row.dwf_baseline_m3}</td>
                      <td className="py-3 font-bold text-slate-900">{row.measured_flow_m3}</td>
                      <td className="py-3 font-extrabold text-blue-600">+{row.accidental_water_m3}</td>
                      <td className="py-3 font-bold text-amber-600">{row.excess_energy_kwh}</td>
                      <td className="py-3 font-extrabold text-rose-600">{row.financial_loss_pln} zł</td>
                      <td className="py-3 font-medium text-slate-700">
                        <div>{row.anomaly_type}</div>
                        {row.equipment_affected && (
                          <div className="text-[10px] text-slate-400">{row.equipment_affected}</div>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
