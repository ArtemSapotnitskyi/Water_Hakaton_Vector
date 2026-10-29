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
  Info,
  Scale,
  Award,
  ShieldCheck,
  Filter,
  X,
  Plus,
  Trash2
} from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';
import {
  InflowAnalysisResponse,
  JuryReportItem,
  HourlyTrend,
  ForecastItem,
  Forecast720hItem,
  FeatureImportanceItem
} from '../../types';

export const RybnikBenchmarkView: React.FC = () => {
  const {
    lang,
    selectedBenchmarkPreset,
    setSelectedBenchmarkPreset,
    activeDatasetName,
    setActiveDatasetName,
    benchmarkResult,
    setBenchmarkResult
  } = useTelemetry();
  const [selectedPreset, setSelectedPreset] = useState<string>(selectedBenchmarkPreset || 'rybnik_2025_2026_test');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [cleanData, setCleanData] = useState<boolean>(true);
  const [modelType, setModelType] = useState<'blended' | 'ml_ensemble' | 'statistical_dwf'>('blended');

  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<number>(0);
  const [results, setResults] = useState<InflowAnalysisResponse | null>(benchmarkResult);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeChartTab, setActiveChartTab] = useState<'flow' | 'forecast' | 'forecast_720h' | 'comparison' | 'features'>('flow');
  const [hoveredPoint, setHoveredPoint] = useState<HourlyTrend | null>(null);
  const [hoveredForecast, setHoveredForecast] = useState<ForecastItem | null>(null);
  const [hoveredForecast720, setHoveredForecast720] = useState<Forecast720hItem | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const [isDragOver, setIsDragOver] = useState(false);

  const loadingSteps = [
    lang === 'pl' ? 'Wczytywanie i normalizacja plików...' : 'Ingesting and normalizing datasets...',
    lang === 'pl' ? 'Dekompozycja składowej dobowej DWF...' : 'Decomposing diurnal DWF baseline...',
    lang === 'pl' ? 'Wykrywanie awarii pomp i filtracja kalibracji (Marzec 2024)...' : 'Detecting pump failures and sensor calibration filter...',
    lang === 'pl' ? 'Trening Ensemble ML (GBDT + Ridge + RF) i predykcja 720h...' : 'Training Ensemble ML and rolling 720h forward forecast...',
  ];

  // Default evaluation on initial load if no benchmarkResult yet
  useEffect(() => {
    if (!benchmarkResult) {
      handleRunBenchmark(selectedPreset, [], cleanData, modelType);
    }
  }, []);

  const handleRunBenchmark = async (
    presetName = selectedPreset,
    filesToUpload = uploadedFiles,
    cleanVal = cleanData,
    modelVal = modelType
  ) => {
    setIsLoading(true);
    setLoadingStep(0);
    setErrorMessage(null);

    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => (prev < loadingSteps.length - 1 ? prev + 1 : prev));
    }, 280);

    try {
      if (filesToUpload && filesToUpload.length > 0) {
        const formData = new FormData();
        filesToUpload.forEach((file) => {
          formData.append('files', file);
        });
        const res = await fetch(`/api/benchmark/upload?clean_data=${cleanVal}&model_type=${modelVal}`, {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || (lang === 'pl' ? `Błąd serwera (${res.status})` : `Server error (${res.status})`));
        }
        const data: InflowAnalysisResponse = await res.json();
        if (!data || typeof data.total_measured_m3 !== 'number') {
          throw new Error(lang === 'pl' ? 'Otrzymano nieprawidłową strukturę odpowiedzi z serwera' : 'Invalid response structure from server');
        }
        setResults(data);
        setBenchmarkResult(data);
        setSelectedBenchmarkPreset('custom_files');
        setActiveDatasetName(filesToUpload.map((f) => f.name).join(', '));
      } else {
        const res = await fetch(
          `/api/benchmark/evaluate?preset=${presetName}&clean_data=${cleanVal}&model_type=${modelVal}`,
          {
            method: 'POST',
          }
        );
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || (lang === 'pl' ? `Błąd serwera (${res.status})` : `Server error (${res.status})`));
        }
        const data: InflowAnalysisResponse = await res.json();
        if (!data || typeof data.total_measured_m3 !== 'number') {
          throw new Error(lang === 'pl' ? 'Otrzymano nieprawidłową strukturę odpowiedzi z serwera' : 'Invalid response structure from server');
        }
        setResults(data);
        setBenchmarkResult(data);
        setSelectedBenchmarkPreset(presetName);
        const presetLabels: Record<string, string> = {
          konkurs_merged_2025_2026: 'Nowy Zbiór Konkursowy 2025–2026',
          rybnik_2025_2026_test: 'Zbiór Ewaluacyjny Rybnik 2025–2026',
          pz1_historical: 'PZ-1 Dane Historyczne (2024)',
          pnb1_historical: 'PNB-1 Dane Historyczne (2024)',
        };
        setActiveDatasetName(presetLabels[presetName] || data.metadata?.filename || presetName);
      }
    } catch (err: any) {
      console.error('Benchmark execution error:', err);
      setErrorMessage(err.message || (lang === 'pl' ? 'Wystąpił błąd podczas analizy danych.' : 'Failed to evaluate dataset.'));
    } finally {
      clearInterval(stepInterval);
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setUploadedFiles((prev) => {
        const merged = [...prev];
        newFiles.forEach((nf) => {
          if (!merged.some((f) => f.name === nf.name)) merged.push(nf);
        });
        return merged;
      });
      setSelectedPreset('custom_files');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files);
      setUploadedFiles((prev) => {
        const merged = [...prev];
        newFiles.forEach((nf) => {
          if (!merged.some((f) => f.name === nf.name)) merged.push(nf);
        });
        return merged;
      });
      setSelectedPreset('custom_files');
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearFiles = () => {
    setUploadedFiles([]);
    setSelectedPreset('konkurs_merged_2025_2026');
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

  const chartWidth = 960;
  const chartHeight = 220;
  const padding = { top: 20, right: 30, bottom: 30, left: 45 };

  const analyticalStats = useMemo(() => {
    if (!trends.length) {
      return {
        maxPeak: 0,
        peakRatio: '1.0',
        pctOverDwf: 0,
        totalAccidental: 0,
        totalExcessEnergy: 0,
        totalCost: 0,
        overloadHours: 0,
        peakTime: '',
        avgDwf: 60,
        nominalPumpCap: 160,
        alarmPumpCap: 310,
      };
    }

    const maxPeak = Math.max(...trends.map((t) => t.measured_m3));
    const peakItem = trends.find((t) => t.measured_m3 === maxPeak);
    const peakDwf = peakItem?.dwf_baseline_m3 || 50;
    const peakTime = peakItem?.time || '';
    const peakRatio = (maxPeak / Math.max(peakDwf, 1)).toFixed(1);
    const pctOverDwf = Math.round(((maxPeak - peakDwf) / Math.max(peakDwf, 1)) * 100);

    const totalAccidental = trends.reduce((acc, t) => acc + (t.accidental_m3 || 0), 0);
    const totalCost = trends.reduce((acc, t) => acc + (t.cost_pln || 0), 0);
    const totalExcessEnergy = trends.reduce((acc, t) => acc + (t.accidental_m3 * 0.24), 0);
    const overloadHours = trends.filter((t) => t.accidental_m3 > t.dwf_baseline_m3 * 0.5).length;

    const avgDwf = Math.round(trends.reduce((acc, t) => acc + t.dwf_baseline_m3, 0) / trends.length);
    const nominalPumpCap = Math.round(Math.max(avgDwf * 1.8, 160));
    const alarmPumpCap = Math.round(Math.max(avgDwf * 3.3, 310));

    return {
      maxPeak,
      peakRatio,
      pctOverDwf,
      totalAccidental: Math.round(totalAccidental),
      totalExcessEnergy: Math.round(totalExcessEnergy),
      totalCost: Number(totalCost.toFixed(2)),
      overloadHours,
      peakTime,
      avgDwf,
      nominalPumpCap,
      alarmPumpCap,
    };
  }, [trends]);

  const analyticalPoints = useMemo(() => {
    if (!trends.length) {
      return {
        measuredPath: '',
        dwfPath: '',
        surgeAreaPath: '',
        dwfAreaPath: '',
        coords: [],
        peakCoord: null,
        maxDelta: 100,
        aH: 260,
        aPad: { top: 35, right: 35, bottom: 42, left: 55 },
        usableH: 183,
        stepX: 10,
      };
    }

    const aH = 260;
    const aPad = { top: 35, right: 35, bottom: 42, left: 55 };
    const stepX = (chartWidth - aPad.left - aPad.right) / Math.max(trends.length - 1, 1);
    const usableH = aH - aPad.top - aPad.bottom;

    const coords = trends.map((t, i) => {
      const x = aPad.left + i * stepX;
      const yMeas = aH - aPad.bottom - (t.measured_m3 / maxFlow) * usableH;
      const yDwf = aH - aPad.bottom - (t.dwf_baseline_m3 / maxFlow) * usableH;
      const deltaQ = Math.max(0, t.measured_m3 - t.dwf_baseline_m3);
      return { x, yMeas, yDwf, deltaQ, data: t, index: i };
    });

    const measuredPath = coords.reduce(
      (acc, p, i) => (i === 0 ? `M ${p.x} ${p.yMeas}` : `${acc} L ${p.x} ${p.yMeas}`),
      ''
    );
    const dwfPath = coords.reduce(
      (acc, p, i) => (i === 0 ? `M ${p.x} ${p.yDwf}` : `${acc} L ${p.x} ${p.yDwf}`),
      ''
    );

    let surgeAreaPath = `M ${coords[0].x} ${coords[0].yMeas}`;
    for (let i = 1; i < coords.length; i++) {
      surgeAreaPath += ` L ${coords[i].x} ${coords[i].yMeas}`;
    }
    for (let i = coords.length - 1; i >= 0; i--) {
      surgeAreaPath += ` L ${coords[i].x} ${coords[i].yDwf}`;
    }
    surgeAreaPath += ' Z';

    const dwfAreaPath =
      coords.reduce(
        (acc, p, i) => (i === 0 ? `M ${p.x} ${p.yDwf}` : `${acc} L ${p.x} ${p.yDwf}`),
        ''
      ) +
      ` L ${coords[coords.length - 1].x} ${aH - aPad.bottom}` +
      ` L ${coords[0].x} ${aH - aPad.bottom} Z`;

    let peakCoord = coords[0];
    coords.forEach((c) => {
      if (c.data.measured_m3 > peakCoord.data.measured_m3) {
        peakCoord = c;
      }
    });

    const maxDelta = Math.max(...coords.map((c) => c.deltaQ), 50) * 1.15;

    return {
      measuredPath,
      dwfPath,
      surgeAreaPath,
      dwfAreaPath,
      coords,
      peakCoord,
      maxDelta,
      aH,
      aPad,
      usableH,
      stepX,
    };
  }, [trends, maxFlow, chartWidth]);

  // Scalers for 48h Forecast SVG Chart
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

  // Scalers for 720h (30-day) Forward Forecast SVG Chart
  const forecast720Trends = results?.forecast_720h || [];
  const maxForecast720Flow = useMemo(() => {
    if (!forecast720Trends.length) return 100;
    return Math.max(...forecast720Trends.map((f) => f.upper_95_flow_m3 || f.predicted_flow_m3)) * 1.15;
  }, [forecast720Trends]);

  const forecast720Points = useMemo(() => {
    if (!forecast720Trends.length) return { linePath: '', bandPath: '', dwfPath: '', coords: [] };
    const stepX = (chartWidth - padding.left - padding.right) / Math.max(forecast720Trends.length - 1, 1);
    const usableH = chartHeight - padding.top - padding.bottom;

    const coords = forecast720Trends.map((f, i) => {
      const x = padding.left + i * stepX;
      const yPred = chartHeight - padding.bottom - (f.predicted_flow_m3 / maxForecast720Flow) * usableH;
      const yUpper = chartHeight - padding.bottom - (f.upper_95_flow_m3 / maxForecast720Flow) * usableH;
      const yLower = chartHeight - padding.bottom - (f.lower_95_flow_m3 / maxForecast720Flow) * usableH;
      const yDwf = chartHeight - padding.bottom - (f.dwf_baseline_m3 / maxForecast720Flow) * usableH;
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

    const upperStr = coords.reduce(
      (acc, p, i) => (i === 0 ? `M ${p.x} ${p.yUpper}` : `${acc} L ${p.x} ${p.yUpper}`),
      ''
    );
    const lowerStr = coords
      .slice()
      .reverse()
      .reduce((acc, p) => `${acc} L ${p.x} ${p.yLower}`, '');
    const bandPath = `${upperStr} ${lowerStr} Z`;

    return { linePath, bandPath, dwfPath, coords };
  }, [forecast720Trends, maxForecast720Flow]);

  return (
    <div className="p-8 space-y-6">
      {/* Top Banner & Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2.5">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              {lang === 'pl'
                ? 'Analiza Weryfikacyjna: Rybnik 2025–2026'
                : 'Verification Benchmark: Rybnik 2025–2026'}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
              PWiK Rybnik
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Silnik Analityczny Online
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            {lang === 'pl'
              ? 'Wgrywanie nowych danych testowych (CSV, TXT), filtracja kalibracji SCADA, dekompozycja wód przypadkowych DWF, detekcja awarii pomp i prognoza 30 dni (720h).'
              : 'Upload test datasets, SCADA calibration filtering, DWF decomposition, pump failure detection and 30-day (720h) forecast.'}
          </p>
        </div>

        {/* Export CTA */}
        <a
          href="/api/benchmark/export"
          download
          data-tour="bench-export"
          className="flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-all duration-150 ease-out shadow-sm active:scale-[0.98]"
        >
          <FileSpreadsheet className="w-4 h-4 text-white" />
          <span>{lang === 'pl' ? 'Eksportuj Raport Zdarzeń (CSV)' : 'Export Event Report (CSV)'}</span>
        </a>
      </div>

      {/* Model Selection & SCADA Cleaning Ribbon */}
      <div className="p-4 rounded-2xl bg-white border border-[#e8ecf1] shadow-2xs flex items-center justify-between flex-wrap gap-4">
        {/* Model Selector */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Silnik Predykcyjny (Model)</div>
            <div className="flex items-center space-x-1.5 mt-1">
              {[
                { id: 'blended', label: 'Hybrydowy Blended', badge: 'Rekomendowany' },
                { id: 'ml_ensemble', label: 'ML Ensemble', badge: '38 Cech' },
                { id: 'statistical_dwf', label: 'Hydrodynamiczny DWF', badge: 'Baseline' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    const newModel = m.id as 'blended' | 'ml_ensemble' | 'statistical_dwf';
                    setModelType(newModel);
                    handleRunBenchmark(selectedPreset, uploadedFiles, cleanData, newModel);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    modelType === m.id
                      ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-500'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{m.label}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-full font-extrabold ${
                      modelType === m.id
                        ? 'bg-indigo-500/80 text-white'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {m.badge}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Clean Data Switch */}
        <div className="flex items-center space-x-3 border-l border-slate-100 pl-4">
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-slate-400">Filtr Kalibracji SCADA</div>
            <div className="text-xs font-extrabold text-slate-800">
              {cleanData ? 'Maska Marzec 2024 PZ-1 Włączona' : 'Surowe Dane SCADA (Raw)'}
            </div>
          </div>
          <button
            onClick={() => {
              const newClean = !cleanData;
              setCleanData(newClean);
              handleRunBenchmark(selectedPreset, uploadedFiles, newClean, modelType);
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              cleanData ? 'bg-emerald-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                cleanData ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          {results?.raw_vs_cleaned_stats && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                cleanData
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {cleanData
                ? `Usunięto ${results.raw_vs_cleaned_stats.corrupted_records_count} fałszywych skoków`
                : 'Błędy kalibracji aktywne w analizie'}
            </span>
          )}
        </div>
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
              {lang === 'pl' ? 'Wgraj Zbiory / Tabele Danych' : 'Upload Data Tables'}
            </span>
            <span className="text-[11px] font-semibold text-slate-400">
              {lang === 'pl' ? 'Możesz zaznaczyć kilka plików naraz (Multi-File)' : 'Select multiple tables at once'}
            </span>
          </div>

          {uploadedFiles.length === 0 ? (
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
                multiple
                accept=".csv,.txt,.tsv,.xlsx,.ods"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 mb-2">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div className="text-xs font-bold text-slate-800 text-center">
                {lang === 'pl'
                  ? 'Kliknij lub przeciągnij pliki (zaznacz kilka tabel naraz)'
                  : 'Click or drag files here (select multiple files at once)'}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 text-center">
                Automatyczne rozpoznawanie i łączenie: PZ-1 (2025, 2026), PNB-1, raporty energii kWh
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedPreset('konkurs_merged_2025_2026');
                  setSelectedBenchmarkPreset('konkurs_merged_2025_2026');
                  setActiveDatasetName('Nowy Zbiór Konkursowy 2025–2026');
                  setUploadedFiles([]);
                  handleRunBenchmark('konkurs_merged_2025_2026', [], cleanData, modelType);
                }}
                className="mt-3 px-3.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              >
                <Database className="w-3.5 h-3.5 text-indigo-600" />
                <span>{lang === 'pl' ? '⚡ Załaduj wszystkie tabele z Dane/Konkurs (PZ-1 + PNB-1)' : '⚡ Load all tables from Dane/Konkurs (PZ-1 + PNB-1)'}</span>
              </button>
            </label>
          ) : (
            <div className="border border-indigo-200 bg-indigo-50/25 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-extrabold">
                    {uploadedFiles.length}
                  </span>
                  <span className="text-xs font-extrabold text-indigo-950">
                    {lang === 'pl'
                      ? `Załączone tabele (${(uploadedFiles.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(1)} MB)`
                      : `Attached tables (${(uploadedFiles.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(1)} MB)`}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <label className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-200 px-2.5 py-1 rounded-lg cursor-pointer flex items-center space-x-1 shadow-2xs">
                    <Plus className="w-3 h-3" />
                    <span>{lang === 'pl' ? 'Dodaj kolejną tabelę' : 'Add table'}</span>
                    <input
                      type="file"
                      multiple
                      accept=".csv,.txt,.tsv,.xlsx,.ods"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={clearFiles}
                    className="text-[11px] font-bold text-slate-500 hover:text-rose-600 bg-white border border-slate-200 px-2 py-1 rounded-lg flex items-center space-x-1 shadow-2xs cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>{lang === 'pl' ? 'Wyczyść' : 'Clear'}</span>
                  </button>
                </div>
              </div>

              {/* Scrollable list of files */}
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {uploadedFiles.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className="flex items-center justify-between bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 text-xs shadow-2xs"
                  >
                    <div className="flex items-center space-x-2 truncate mr-2">
                      <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span className="font-bold text-slate-800 truncate">{file.name}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        ({(file.size / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="text-slate-400 hover:text-rose-500 p-1 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                      title={lang === 'pl' ? 'Usuń ten plik' : 'Remove file'}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <div className="text-xs text-slate-500">
              {uploadedFiles.length > 0 ? (
                <span className="flex items-center space-x-1.5 text-indigo-600 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    {lang === 'pl'
                      ? `Wybrano ${uploadedFiles.length} tabel — gotowe do scalenia`
                      : `${uploadedFiles.length} files selected — ready to merge`}
                  </span>
                </span>
              ) : (
                <span className="text-slate-400">
                  {lang === 'pl' ? 'Wybierz gotowy zestaw lub dodaj własne pliki' : 'Select a preset or upload files'}
                </span>
              )}
            </div>

            <button
              onClick={() => handleRunBenchmark(selectedPreset, uploadedFiles, cleanData, modelType)}
              disabled={isLoading}
              data-tour="bench-run"
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-extrabold transition-all shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>
                {isLoading
                  ? lang === 'pl' ? 'Przetwarzanie i łączenie danych...' : 'Processing and merging...'
                  : uploadedFiles.length > 1
                  ? lang === 'pl' ? `Scal i Uruchom (${uploadedFiles.length} tabel)` : `Merge & Run (${uploadedFiles.length} files)`
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
                id: 'konkurs_merged_2025_2026',
                name: 'Nowy Zbiór Konkursowy 2025–2026',
                desc: 'Scalone wszystkie tabele z Dane/Konkurs (PZ-1, PNB-1, Energia kWh)',
                tag: 'Wszystkie Tabele (Nowe)',
                badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200 font-extrabold',
              },
              {
                id: 'rybnik_2025_2026_test',
                name: 'Zbiór Ewaluacyjny Rybnik 2025–2026',
                desc: 'Horyzont ewaluacyjny (Zlewnie PZ-1 i PNB-1)',
                tag: 'Zbiór Testowy',
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
                  setSelectedBenchmarkPreset(p.id);
                  setActiveDatasetName(p.name);
                  setUploadedFiles([]);
                  handleRunBenchmark(p.id, [], cleanData, modelType);
                }}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all ${
                  selectedPreset === p.id && uploadedFiles.length === 0
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

      {/* Error notification banner if any upload or evaluation failed */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start justify-between shadow-2xs animate-in fade-in duration-200">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-black">
                {lang === 'pl' ? 'Błąd przetwarzania plików' : 'Dataset processing error'}
              </div>
              <div className="text-xs text-rose-700 mt-0.5">{errorMessage}</div>
            </div>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs font-bold text-rose-600 hover:text-rose-900 bg-white/80 px-2.5 py-1 rounded-lg border border-rose-200 cursor-pointer"
          >
            {lang === 'pl' ? 'Zamknij' : 'Dismiss'}
          </button>
        </div>
      )}

      {/* Dataset Metadata Badge (If Available) */}
      {results?.metadata && (
        <div className="p-4 rounded-2xl bg-white border border-[#e8ecf1] shadow-2xs flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <Database className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-slate-900 flex items-center space-x-2">
                <span>{results.metadata?.filename || 'Scalony Zbiór Danych'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
                  {results.metadata?.data_type || 'Telemetria SCADA'}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Zakres: <strong>{results.metadata?.date_range || 'Brak danych'}</strong> | Próbkowanie: {results.metadata?.sampling_rate || '1h'}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-6 text-xs font-semibold text-slate-600">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Wielkość pliku</span>
              <span>{((results.metadata?.file_size_kb || 0) / 1024).toFixed(2)} MB ({results.metadata?.file_size_kb || 0} KB)</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Liczba rekordów</span>
              <span className="font-bold text-slate-900">{(results.metadata?.total_records || 0).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Jakość danych</span>
              <span className="font-bold text-emerald-600">{results.metadata?.quality_score ?? 100}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Results Section */}
      {results && typeof results.total_measured_m3 === 'number' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* 4 Clean Metric Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-[#e8ecf1] shadow-2xs">
              <div className="text-xs font-bold text-slate-400 mb-1">
                {lang === 'pl' ? 'Całkowita Objętość Przepływu' : 'Total Evaluated Inflow'}
              </div>
              <div className="text-2xl font-black text-slate-900">
                {((results.total_measured_m3 || 0) / 1000).toFixed(1)}k <span className="text-xs font-normal text-slate-400">m³</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Baza sanitarna DWF: <strong>{((results.total_dwf_m3 || 0) / 1000).toFixed(1)}k m³</strong>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#e8ecf1] shadow-2xs">
              <div className="text-xs font-bold text-slate-400 mb-1">
                {lang === 'pl' ? 'Wody Przypadkowe (Infiltracja)' : 'Accidental Stormwater'}
              </div>
              <div className="text-2xl font-black text-blue-600">
                {(results.total_accidental_m3 || 0).toLocaleString()} <span className="text-xs font-normal text-slate-400">m³</span>
              </div>
              <div className="mt-1 text-[11px] text-blue-600 font-bold">
                ▲ {results.accidental_water_pct || 0}% udział wód opadowych i obcych
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#e8ecf1] shadow-2xs">
              <div className="text-xs font-bold text-slate-400 mb-1">
                {lang === 'pl' ? 'Koszt Nadmiarowej Energii' : 'Excess Pumping Cost'}
              </div>
              <div className="text-2xl font-black text-rose-600">
                {(results.financial_cost_pln || 0).toLocaleString()} <span className="text-xs font-normal text-slate-400">PLN</span>
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
                <span>{results.jury_records?.length || 0}</span>
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

          {/* Interactive Chart Container with 5 Tabs */}
          <div className="bg-white rounded-3xl p-6 border border-[#e8ecf1] shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
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
                  <span>Wykres Zdarzeń (Przepływ vs DWF)</span>
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
                  <span>Predykcja 48h</span>
                </button>
                <button
                  onClick={() => setActiveChartTab('forecast_720h')}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                    activeChartTab === 'forecast_720h'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Prognoza 30 dni (720h)</span>
                </button>
                <button
                  onClick={() => setActiveChartTab('comparison')}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                    activeChartTab === 'comparison'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>Porównanie Modeli</span>
                </button>
                <button
                  onClick={() => setActiveChartTab('features')}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                    activeChartTab === 'features'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Ważność Cech (38)</span>
                </button>
              </div>

              {/* Badges / Metrics Bar for Forecast */}
              {results.evaluation_metrics && (
                <div className="flex items-center space-x-2 text-[10px] font-bold">
                  <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                    MAE: <strong>{results.evaluation_metrics.mae_flow} m³/h</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                    MAPE: <strong>{results.evaluation_metrics.mape_flow}%</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                    R²: <strong>{results.evaluation_metrics.r2_flow}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                    Energia MAE: <strong>{results.evaluation_metrics.mae_energy} kWh</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Tab 1: Flow vs DWF Timeline */}
            {activeChartTab === 'flow' && (
              <div className="relative space-y-4 animate-in fade-in duration-200">
                {/* 1. Hydraulic Event Summary KPI Strip */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl">
                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                      Maks. Szczyt Napływu
                    </span>
                    <div className="text-base font-extrabold text-blue-950 mt-0.5">
                      {analyticalStats.maxPeak.toFixed(1)} <span className="text-xs font-semibold">m³/h</span>
                    </div>
                    <span className="text-[11px] font-bold text-rose-600 block mt-0.5">
                      +{analyticalStats.pctOverDwf}% DWF ({analyticalStats.peakRatio}x normy)
                    </span>
                  </div>

                  <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-xl">
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                      Łączne Wody Przypadkowe
                    </span>
                    <div className="text-base font-extrabold text-amber-950 mt-0.5">
                      +{analyticalStats.totalAccidental.toLocaleString()} <span className="text-xs font-semibold">m³</span>
                    </div>
                    <span className="text-[11px] font-medium text-amber-800 block mt-0.5">
                      Balast burzowo-roztopowy
                    </span>
                  </div>

                  <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                      Baza Sanitarna DWF (Śr.)
                    </span>
                    <div className="text-base font-extrabold text-emerald-950 mt-0.5">
                      {analyticalStats.avgDwf} <span className="text-xs font-semibold">m³/h</span>
                    </div>
                    <span className="text-[11px] font-medium text-emerald-700 block mt-0.5">
                      Czysty ściek bytowy
                    </span>
                  </div>

                  <div className="p-3 bg-rose-50/70 border border-rose-100 rounded-xl">
                    <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">
                      Koszt Energii Tłoczenia
                    </span>
                    <div className="text-base font-extrabold text-rose-950 mt-0.5">
                      {analyticalStats.totalCost.toFixed(2)} <span className="text-xs font-semibold">PLN</span>
                    </div>
                    <span className="text-[11px] font-medium text-rose-700 block mt-0.5">
                      Nadmiar {analyticalStats.totalExcessEnergy} kWh (1 zł/kWh)
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                      Czas Przeciążenia
                    </span>
                    <div className="text-base font-extrabold text-slate-900 mt-0.5">
                      {analyticalStats.overloadHours} <span className="text-xs font-semibold">godzin</span>
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 block mt-0.5">
                      Wymóg pracy 2 agregatów
                    </span>
                  </div>
                </div>

                {/* 2. Analytical Flow vs Capacity Limits & Time Axis */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 relative space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-2 flex-wrap gap-2">
                    <div className="flex items-center space-x-3.5 font-medium flex-wrap gap-y-1">
                      <span className="flex items-center space-x-1.5 text-blue-700">
                        <span className="w-3.5 h-1.5 bg-blue-600 rounded-full inline-block" />
                        <strong className="text-slate-900">Przepływ Zmierzony</strong>
                      </span>
                      <span className="flex items-center space-x-1.5 text-red-600">
                        <span className="w-4 h-0.5 inline-flex items-center">
                          <svg width="16" height="2">
                            <line x1="0" y1="1" x2="16" y2="1" stroke="#dc2626" strokeWidth="2" strokeDasharray="3 2" />
                          </svg>
                        </span>
                        <span>Baza sanitarna DWF</span>
                      </span>
                      <span className="flex items-center space-x-1.5 text-amber-600">
                        <span className="w-4 h-0.5 inline-flex items-center">
                          <svg width="16" height="2">
                            <line x1="0" y1="1" x2="16" y2="1" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 2" />
                          </svg>
                        </span>
                        <span>Próg P1 ({analyticalStats.nominalPumpCap} m³/h)</span>
                      </span>
                      <span className="flex items-center space-x-1.5 text-rose-600">
                        <span className="w-4 h-0.5 inline-flex items-center">
                          <svg width="16" height="2">
                            <line x1="0" y1="1" x2="16" y2="1" stroke="#e11d48" strokeWidth="1.5" strokeDasharray="4 2" />
                          </svg>
                        </span>
                        <span>Alarm / Retencja ({analyticalStats.alarmPumpCap} m³/h)</span>
                      </span>
                      <span className="flex items-center space-x-1.5 text-rose-700 font-semibold">
                        <span className="w-3 h-2 bg-gradient-to-t from-amber-400 to-rose-500 rounded inline-block" />
                        <span>Wody przypadkowe netto</span>
                      </span>
                    </div>

                    <span className="text-xs text-slate-400 font-medium">
                      Oś X: Godzina • Oś Y: m³/h
                    </span>
                  </div>

                  <div className="relative">
                    <svg
                      viewBox={`0 0 ${chartWidth} ${analyticalPoints.aH}`}
                      className="w-full h-64 select-none"
                      onMouseLeave={() => setHoveredPoint(null)}
                    >
                      <defs>
                        <linearGradient id="analyticalSurgeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.45" />
                          <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
                        </linearGradient>
                        <linearGradient id="analyticalDwfGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.08" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
                        </linearGradient>
                      </defs>

                      {/* Hydraulic Safety Bands (Background) */}
                      {(() => {
                        const yNominal =
                          analyticalPoints.aH -
                          analyticalPoints.aPad.bottom -
                          (analyticalStats.nominalPumpCap / maxFlow) * analyticalPoints.usableH;
                        const yAlarm =
                          analyticalPoints.aH -
                          analyticalPoints.aPad.bottom -
                          (analyticalStats.alarmPumpCap / maxFlow) * analyticalPoints.usableH;
                        const yFloor = analyticalPoints.aH - analyticalPoints.aPad.bottom;
                        const w = chartWidth - analyticalPoints.aPad.left - analyticalPoints.aPad.right;

                        return (
                          <g className="zones">
                            <rect
                              x={analyticalPoints.aPad.left}
                              y={Math.max(yNominal, analyticalPoints.aPad.top)}
                              width={w}
                              height={Math.max(0, yFloor - yNominal)}
                              fill="#10b981"
                              fillOpacity="0.03"
                            />
                            <rect
                              x={analyticalPoints.aPad.left}
                              y={Math.max(yAlarm, analyticalPoints.aPad.top)}
                              width={w}
                              height={Math.max(0, yNominal - yAlarm)}
                              fill="#f59e0b"
                              fillOpacity="0.03"
                            />
                            <rect
                              x={analyticalPoints.aPad.left}
                              y={analyticalPoints.aPad.top}
                              width={w}
                              height={Math.max(0, yAlarm - analyticalPoints.aPad.top)}
                              fill="#ef4444"
                              fillOpacity="0.04"
                            />
                          </g>
                        );
                      })()}

                      {/* Horizontal Grid & Values */}
                      {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                        const y =
                          analyticalPoints.aH -
                          analyticalPoints.aPad.bottom -
                          pct * analyticalPoints.usableH;
                        const val = Math.round(pct * maxFlow);
                        return (
                          <g key={idx}>
                            <line
                              x1={analyticalPoints.aPad.left}
                              y1={y}
                              x2={chartWidth - analyticalPoints.aPad.right}
                              y2={y}
                              stroke="#f1f5f9"
                              strokeWidth="1"
                            />
                            <text
                              x={analyticalPoints.aPad.left - 8}
                              y={y + 4}
                              textAnchor="end"
                              fontSize="10"
                              fill="#64748b"
                              fontWeight="600"
                            >
                              {val}
                            </text>
                          </g>
                        );
                      })}

                      {/* Threshold Lines */}
                      {(() => {
                        const yNominal =
                          analyticalPoints.aH -
                          analyticalPoints.aPad.bottom -
                          (analyticalStats.nominalPumpCap / maxFlow) * analyticalPoints.usableH;
                        const yAlarm =
                          analyticalPoints.aH -
                          analyticalPoints.aPad.bottom -
                          (analyticalStats.alarmPumpCap / maxFlow) * analyticalPoints.usableH;
                        const rightX = chartWidth - analyticalPoints.aPad.right;

                        return (
                          <g className="thresholds">
                            {yNominal > analyticalPoints.aPad.top && (
                              <>
                                <line
                                  x1={analyticalPoints.aPad.left}
                                  y1={yNominal}
                                  x2={rightX}
                                  y2={yNominal}
                                  stroke="#f59e0b"
                                  strokeWidth="1.2"
                                  strokeDasharray="4 3"
                                />
                                <text
                                  x={rightX - 6}
                                  y={yNominal - 4}
                                  textAnchor="end"
                                  fontSize="9"
                                  fill="#b45309"
                                  fontWeight="bold"
                                >
                                  Próg P1: {analyticalStats.nominalPumpCap} m³/h
                                </text>
                              </>
                            )}

                            {yAlarm > analyticalPoints.aPad.top && (
                              <>
                                <line
                                  x1={analyticalPoints.aPad.left}
                                  y1={yAlarm}
                                  x2={rightX}
                                  y2={yAlarm}
                                  stroke="#e11d48"
                                  strokeWidth="1.5"
                                  strokeDasharray="5 3"
                                />
                                <text
                                  x={rightX - 6}
                                  y={yAlarm - 4}
                                  textAnchor="end"
                                  fontSize="9"
                                  fill="#be123c"
                                  fontWeight="bold"
                                >
                                  Alarm / Retencja: {analyticalStats.alarmPumpCap} m³/h
                                </text>
                              </>
                            )}
                          </g>
                        );
                      })()}

                      {/* DWF Baseline Shaded Floor */}
                      {analyticalPoints.dwfAreaPath && (
                        <path d={analyticalPoints.dwfAreaPath} fill="url(#analyticalDwfGrad)" />
                      )}

                      {/* Pure Accidental Surge Area between Q_meas and Q_dwf */}
                      {analyticalPoints.surgeAreaPath && (
                        <path d={analyticalPoints.surgeAreaPath} fill="url(#analyticalSurgeGrad)" />
                      )}

                      {/* DWF Path */}
                      {analyticalPoints.dwfPath && (
                        <path
                          d={analyticalPoints.dwfPath}
                          fill="none"
                          stroke="#dc2626"
                          strokeWidth="2"
                          strokeDasharray="4 3"
                        />
                      )}

                      {/* Measured Flow Path */}
                      {analyticalPoints.measuredPath && (
                        <path
                          d={analyticalPoints.measuredPath}
                          fill="none"
                          stroke="#2563eb"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}

                      {/* X-Axis Ticks & Time Labels */}
                      {analyticalPoints.coords.map((c, idx) => {
                        const shouldLabel =
                          idx === 0 ||
                          idx === analyticalPoints.coords.length - 1 ||
                          idx % Math.max(1, Math.floor(analyticalPoints.coords.length / 8)) === 0;

                        const rawTime = c.data.time || '';
                        const timePart = rawTime.includes(' ') ? rawTime.split(' ')[1] : rawTime;

                        return (
                          <g key={`x-${idx}`}>
                            {shouldLabel && (
                              <>
                                <line
                                  x1={c.x}
                                  y1={analyticalPoints.aH - analyticalPoints.aPad.bottom}
                                  x2={c.x}
                                  y2={analyticalPoints.aH - analyticalPoints.aPad.bottom + 5}
                                  stroke="#94a3b8"
                                  strokeWidth="1"
                                />
                                <text
                                  x={c.x}
                                  y={analyticalPoints.aH - analyticalPoints.aPad.bottom + 17}
                                  textAnchor="middle"
                                  fontSize="9"
                                  fill="#475569"
                                  fontWeight="600"
                                >
                                  {timePart || `${idx}:00`}
                                </text>
                              </>
                            )}
                          </g>
                        );
                      })}

                      {/* Peak Callout Pin */}
                      {analyticalPoints.peakCoord && (
                        <g className="peak-callout">
                          <circle
                            cx={analyticalPoints.peakCoord.x}
                            cy={analyticalPoints.peakCoord.yMeas}
                            r="6"
                            fill="#ef4444"
                            className="animate-pulse"
                          />
                          <circle
                            cx={analyticalPoints.peakCoord.x}
                            cy={analyticalPoints.peakCoord.yMeas}
                            r="3"
                            fill="#ffffff"
                          />
                          <g
                            transform={`translate(${Math.min(
                              chartWidth - 145,
                              Math.max(analyticalPoints.aPad.left + 10, analyticalPoints.peakCoord.x - 65)
                            )}, ${Math.max(8, analyticalPoints.peakCoord.yMeas - 32)})`}
                          >
                            <rect
                              width="130"
                              height="22"
                              rx="6"
                              fill="#0f172a"
                              className="shadow-sm"
                            />
                            <text
                              x="65"
                              y="14"
                              textAnchor="middle"
                              fill="#ffffff"
                              fontSize="10"
                              fontWeight="bold"
                            >
                              SZCZYT: {analyticalStats.maxPeak.toFixed(1)} m³/h
                            </text>
                          </g>
                        </g>
                      )}

                      {/* Interactive Hover Dots & Vertical Crosshair */}
                      {analyticalPoints.coords.map((c, idx) => (
                        <g
                          key={idx}
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredPoint(c.data)}
                        >
                          <circle cx={c.x} cy={c.yMeas} r="9" fill="transparent" />
                          {c.deltaQ > c.data.dwf_baseline_m3 * 0.7 && (
                            <circle cx={c.x} cy={c.yMeas} r="3.5" fill="#ef4444" />
                          )}
                        </g>
                      ))}

                      {/* Crosshair on active hover */}
                      {hoveredPoint && (() => {
                        const hoverCoord = analyticalPoints.coords.find((c) => c.data.time === hoveredPoint.time);
                        if (!hoverCoord) return null;
                        return (
                          <g className="crosshair pointer-events-none">
                            <line
                              x1={hoverCoord.x}
                              y1={analyticalPoints.aPad.top}
                              x2={hoverCoord.x}
                              y2={analyticalPoints.aH - analyticalPoints.aPad.bottom}
                              stroke="#3b82f6"
                              strokeWidth="1.5"
                              strokeDasharray="3 2"
                            />
                            <circle cx={hoverCoord.x} cy={hoverCoord.yMeas} r="5" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
                            <circle cx={hoverCoord.x} cy={hoverCoord.yDwf} r="4" fill="#dc2626" stroke="#ffffff" strokeWidth="1.5" />
                          </g>
                        );
                      })()}
                    </svg>

                    {/* Rich Inspector Popover */}
                    {hoveredPoint && (
                      <div className="absolute top-2 right-4 bg-slate-900/95 backdrop-blur-xs text-white text-xs p-3.5 rounded-xl shadow-xl border border-slate-700/80 space-y-1.5 w-64 z-10 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-700">
                          <span className="font-extrabold text-blue-400">{hoveredPoint.time}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              hoveredPoint.accidental_m3 > 120
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : hoveredPoint.accidental_m3 > 30
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            }`}
                          >
                            {hoveredPoint.accidental_m3 > 120
                              ? 'Przeciążenie'
                              : hoveredPoint.accidental_m3 > 30
                              ? 'Podwyższony'
                              : 'Nominalny'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Przepływ zmierzony:</span>
                          <strong className="font-bold text-white">{hoveredPoint.measured_m3} m³/h</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Baza sanitarna DWF:</span>
                          <strong className="font-semibold text-rose-400">{hoveredPoint.dwf_baseline_m3} m³/h</strong>
                        </div>
                        <div className="flex justify-between text-amber-300 font-semibold">
                          <span>Wody przypadkowe ΔQ:</span>
                          <strong>+{hoveredPoint.accidental_m3} m³/h</strong>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-slate-800 text-[11px]">
                          <span className="text-slate-400">Koszt energii (1 zł/kWh):</span>
                          <strong className="text-emerald-400">{hoveredPoint.cost_pln} PLN/h</strong>
                        </div>
                        <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                          {hoveredPoint.accidental_m3 > 120
                            ? '🚨 Działanie: Załączenie agregatu P2 i otwarcie retencji'
                            : hoveredPoint.accidental_m3 > 30
                            ? '⚠️ Działanie: Praca pompy P1 w punkcie wyższej sprawności'
                            : '✅ Działanie: Standardowy cykl tłoczenia DWF'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Lower Synchronized Bar Track: Accidental Water Net Inflow (ΔQ) */}
                <div className="bg-slate-50/70 rounded-xl border border-gray-200 p-4 relative">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-slate-800 flex items-center space-x-1.5">
                      <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Natężenie Wód Przypadkowych Netto (ΔQ = Przepływ − DWF) [m³/h]</span>
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Zielony: &le;20 m³/h • Bursztynowy: 20–120 m³/h • Czerwony: &gt;120 m³/h
                    </span>
                  </div>

                  <svg
                    viewBox={`0 0 ${chartWidth} 115`}
                    className="w-full h-28 select-none"
                    onMouseLeave={() => setHoveredPoint(null)}
                  >
                    {/* Baseline */}
                    <line
                      x1={analyticalPoints.aPad.left}
                      y1={92}
                      x2={chartWidth - analyticalPoints.aPad.right}
                      y2={92}
                      stroke="#cbd5e1"
                      strokeWidth="1"
                    />

                    {/* Bars */}
                    {analyticalPoints.coords.map((c, idx) => {
                      const maxDelta = Math.max(analyticalPoints.maxDelta, 50);
                      const barH = Math.min(75, Math.max(2, (c.deltaQ / maxDelta) * 72));
                      const barY = 92 - barH;
                      const barW = Math.max(analyticalPoints.stepX * 0.65, 3.5);
                      const barX = c.x - barW / 2;

                      const isCritical = c.deltaQ > 120;
                      const isWarning = c.deltaQ > 20 && !isCritical;
                      const fillColor = isCritical
                        ? '#ef4444'
                        : isWarning
                        ? '#f59e0b'
                        : '#10b981';

                      const isHovered = hoveredPoint && hoveredPoint.time === c.data.time;

                      return (
                        <g
                          key={`bar-${idx}`}
                          className="cursor-pointer transition-all"
                          onMouseEnter={() => setHoveredPoint(c.data)}
                        >
                          <rect
                            x={barX}
                            y={barY}
                            width={barW}
                            height={barH}
                            rx="1.5"
                            fill={fillColor}
                            opacity={isHovered ? 1 : 0.85}
                          />
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* 4. Engineering / Dispatcher Takeaway Banner */}
                <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200/80 flex items-start space-x-3 text-xs text-slate-700">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-blue-950 font-bold block mb-0.5">
                      Wnioski z dekompozycji hydrodynamicznej dla PWiK Rybnik:
                    </strong>
                    Algorytm wykazuje, że szczyt przepływu ({analyticalStats.maxPeak.toFixed(1)} m³/h) nie wynikał z
                    kanalizacji sanitarnej (stabilna baza DWF ~{analyticalStats.avgDwf} m³/h), lecz w{' '}
                    <strong>{analyticalStats.pctOverDwf}%</strong> z wód przypadkowych (opadowo-roztopowych).
                    Wyliczone łączne straty energii wyniosły <strong>{analyticalStats.totalCost.toFixed(2)} PLN</strong>,
                    co uzasadnia wdrożenie algorytmu predykcyjnego i optymalizację buforowania retencyjnego.
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: 48h Predictive Forecast */}
            {activeChartTab === 'forecast' && (
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

                  {forecastPoints.bandPath && <path d={forecastPoints.bandPath} fill="url(#forecastBandGrad)" />}
                  {forecastPoints.dwfPath && (
                    <path
                      d={forecastPoints.dwfPath}
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                  )}
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
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: 720h (30-day) Forward Forecast */}
            {activeChartTab === 'forecast_720h' && (
              <div className="relative">
                <div className="flex items-center justify-between mb-2 text-xs text-slate-500">
                  <div className="flex items-center space-x-4 font-semibold">
                    <span className="flex items-center space-x-1.5 text-emerald-600">
                      <span className="w-3 h-1 bg-emerald-600 rounded-full inline-block" />
                      <span>Prognoza ML 720h (m³/h)</span>
                    </span>
                    <span className="flex items-center space-x-1.5 text-emerald-400">
                      <span className="w-3 h-2 bg-emerald-100 border border-emerald-300 rounded inline-block" />
                      <span>Pasmo Ufności 95%</span>
                    </span>
                    <span className="flex items-center space-x-1.5 text-slate-400">
                      <span className="w-3 h-0.5 border-t border-slate-400 border-dashed inline-block" />
                      <span>Profil DWF</span>
                    </span>
                  </div>
                  <div className="text-[11px] font-bold text-slate-400">
                    Horyzont: 30 Dni (720 Godzin)
                  </div>
                </div>

                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="w-full h-56 select-none"
                  onMouseLeave={() => setHoveredForecast720(null)}
                >
                  <defs>
                    <linearGradient id="forecast720BandGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.30" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.03" />
                    </linearGradient>
                  </defs>

                  {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                    const y = chartHeight - padding.bottom - pct * (chartHeight - padding.top - padding.bottom);
                    const val = Math.round(pct * maxForecast720Flow);
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

                  {forecast720Points.bandPath && (
                    <path d={forecast720Points.bandPath} fill="url(#forecast720BandGrad)" />
                  )}
                  {forecast720Points.dwfPath && (
                    <path
                      d={forecast720Points.dwfPath}
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="1.2"
                      strokeDasharray="2 2"
                    />
                  )}
                  {forecast720Points.linePath && (
                    <path
                      d={forecast720Points.linePath}
                      fill="none"
                      stroke="#059669"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  )}

                  {/* Sampled interactive hover nodes (every 12 hours) */}
                  {forecast720Points.coords
                    .filter((_, i) => i % 12 === 0)
                    .map((pt, idx) => (
                      <g
                        key={idx}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredForecast720(pt.data)}
                      >
                        <circle cx={pt.x} cy={pt.yPred} r="6" fill="transparent" />
                        <circle cx={pt.x} cy={pt.yPred} r="2" fill="#059669" />
                      </g>
                    ))}
                </svg>

                {hoveredForecast720 && (
                  <div className="absolute top-2 right-4 bg-slate-900/90 backdrop-blur-md text-white text-xs p-3 rounded-xl shadow-lg border border-slate-700 space-y-1">
                    <div className="font-extrabold text-emerald-300">
                      Godzina +{hoveredForecast720.hour_index}h ({hoveredForecast720.time_label})
                    </div>
                    <div className="flex justify-between space-x-4">
                      <span className="text-slate-300">Przepływ prognozowany:</span>
                      <strong className="text-white">{hoveredForecast720.predicted_flow_m3} m³/h</strong>
                    </div>
                    <div className="flex justify-between space-x-4">
                      <span className="text-slate-300">Pasmo ufności 95%:</span>
                      <strong className="text-emerald-300">
                        [{hoveredForecast720.lower_95_flow_m3} — {hoveredForecast720.upper_95_flow_m3}] m³
                      </strong>
                    </div>
                    <div className="flex justify-between space-x-4">
                      <span className="text-slate-300">Zużycie energii:</span>
                      <strong className="text-amber-400">{hoveredForecast720.predicted_energy_kwh} kWh</strong>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Dual Model Comparison Scorecard */}
            {activeChartTab === 'comparison' && (
              <div className="space-y-4 pt-2">
                {results.dual_model_comparison ? (
                  <>
                    <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-100 flex items-start space-x-3">
                      <Award className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-extrabold text-purple-900">
                          Rekomendowany Model Analityczny:{' '}
                          <span className="uppercase">{results.dual_model_comparison.recommended_model}</span>
                        </div>
                        <p className="text-xs text-purple-700 mt-1">
                          {results.dual_model_comparison.justification_pl}
                        </p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-slate-400 font-semibold border-b border-slate-100 pb-2">
                            <th className="py-2.5 font-bold">Metryka Oficjalna</th>
                            <th className="py-2.5 font-bold text-slate-700">Hydrodynamiczny DWF</th>
                            <th className="py-2.5 font-bold text-indigo-700">ML Ensemble</th>
                            <th className="py-2.5 font-bold text-emerald-700">Model Blended (Hybrydowy)</th>
                            <th className="py-2.5 font-bold">Zysk Dokładności</th>
                            <th className="py-2.5 font-bold text-right">Zwycięzca</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {[
                            {
                              label: 'MAE Przepływu [m³/h]',
                              dwf: results.dual_model_comparison.statistical_dwf.metrics.mae_flow,
                              ml: results.dual_model_comparison.ml_ensemble.metrics.mae_flow,
                              blended: results.dual_model_comparison.blended.metrics.mae_flow,
                              delta: results.dual_model_comparison.deltas?.mae_flow,
                            },
                            {
                              label: 'MAPE Przepływu [%]',
                              dwf: results.dual_model_comparison.statistical_dwf.metrics.mape_flow,
                              ml: results.dual_model_comparison.ml_ensemble.metrics.mape_flow,
                              blended: results.dual_model_comparison.blended.metrics.mape_flow,
                              delta: results.dual_model_comparison.deltas?.mape_flow,
                            },
                            {
                              label: 'R² Przepływu (Korelacja)',
                              dwf: results.dual_model_comparison.statistical_dwf.metrics.r2_flow,
                              ml: results.dual_model_comparison.ml_ensemble.metrics.r2_flow,
                              blended: results.dual_model_comparison.blended.metrics.r2_flow,
                              delta: results.dual_model_comparison.deltas?.r2_flow,
                            },
                            {
                              label: 'MAE Energii [kWh]',
                              dwf: results.dual_model_comparison.statistical_dwf.metrics.mae_energy,
                              ml: results.dual_model_comparison.ml_ensemble.metrics.mae_energy,
                              blended: results.dual_model_comparison.blended.metrics.mae_energy,
                              delta: results.dual_model_comparison.deltas?.mae_energy,
                            },
                            {
                              label: 'MAPE Energii [%]',
                              dwf: results.dual_model_comparison.statistical_dwf.metrics.mape_energy,
                              ml: results.dual_model_comparison.ml_ensemble.metrics.mape_energy,
                              blended: results.dual_model_comparison.blended.metrics.mape_energy,
                              delta: results.dual_model_comparison.deltas?.mape_energy,
                            },
                            {
                              label: 'R² Energii',
                              dwf: results.dual_model_comparison.statistical_dwf.metrics.r2_energy,
                              ml: results.dual_model_comparison.ml_ensemble.metrics.r2_energy,
                              blended: results.dual_model_comparison.blended.metrics.r2_energy,
                              delta: results.dual_model_comparison.deltas?.r2_energy,
                            },
                          ].map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="py-2.5 font-bold text-slate-800">{row.label}</td>
                              <td className="py-2.5 font-semibold text-slate-600">{row.dwf}</td>
                              <td className="py-2.5 font-bold text-indigo-700">{row.ml}</td>
                              <td className="py-2.5 font-extrabold text-emerald-700">{row.blended}</td>
                              <td className="py-2.5 font-bold text-blue-600">
                                {row.delta ? `+${row.delta.improvement_pct}%` : '—'}
                              </td>
                              <td className="py-2.5 text-right">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {row.delta?.winner === 'ml_ensemble' ? 'Ensemble ML' : 'Blended'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    Karta porównawcza modeli ładuje się lub wymaga uruchomienia benchmarku.
                  </div>
                )}
              </div>
            )}

            {/* Tab 5: Feature Importance Visualization */}
            {activeChartTab === 'features' && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-700">
                    Hierarchia 38 Cech Czasowych Modelu Ensemble (Feature Importance)
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Oparta na wagach drzew decyzyjnych GBDT i regresji Ridge
                  </span>
                </div>

                <div className="space-y-2.5">
                  {(results.feature_importance || []).map((feat, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800 flex items-center space-x-2">
                          <span>{feat.display_name}</span>
                          <span className="text-[10px] font-semibold text-slate-400">({feat.feature_name})</span>
                        </span>
                        <span className="font-extrabold text-blue-600">{feat.importance_pct}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, feat.importance_pct * 3.5)}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-400">{feat.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Critical Failures & Damage Moments Grid */}
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
                    ? 'Zestawienie Wykrytych Zdarzeń i Napływów Przypadkowych'
                    : 'Model Prediction Outputs for Verification Benchmark'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Wymóg PWiK: Dzień, przedział godzinowy, objętość wód przypadkowych (m³), nadmiar energii (kWh), straty (1 zł/kWh) i uzasadnienie detekcji
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
                    <th className="py-2.5 font-bold">Uzasadnienie Detekcji (Root Cause)</th>
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
                      <td className="py-3 font-medium text-slate-700 max-w-xs">
                        <div className="font-bold text-slate-900">{row.anomaly_type}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {row.root_cause || row.equipment_affected}
                        </div>
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
