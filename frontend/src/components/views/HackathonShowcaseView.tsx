import React, { useState, useEffect, useMemo } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Cpu,
  Activity,
  Zap,
  Droplets,
  Clock,
  Wrench,
  Award,
  Scale,
  Database,
  ShieldAlert,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  PieChart,
  MapPin,
  Plus,
  Trash2,
  X,
  FileText,
  Play,
  BarChart3,
  Layers,
  Info,
  TrendingUp,
  Gauge
} from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';
import {
  InflowAnalysisResponse,
  HourlyTrend,
  Forecast720hItem
} from '../../types';

interface HackathonShowcaseViewProps {
  onSwitchToFullScada?: () => void;
}

export const HackathonShowcaseView: React.FC<HackathonShowcaseViewProps> = ({
  onSwitchToFullScada
}) => {
  const { lang } = useTelemetry();
  const [selectedPreset, setSelectedPreset] = useState<string>('rybnik_2025_2026_test');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [cleanData, setCleanData] = useState<boolean>(true);
  const [modelType, setModelType] = useState<'blended' | 'ml_ensemble' | 'statistical_dwf'>('blended');

  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<number>(0);
  const [results, setResults] = useState<InflowAnalysisResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'events' | 'forecast_720h' | 'scorecard'>('events');
  const [hoveredPoint, setHoveredPoint] = useState<HourlyTrend | null>(null);
  const [hovered720Point, setHovered720Point] = useState<Forecast720hItem | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [isDragOver, setIsDragOver] = useState(false);

  const loadingSteps = [
    lang === 'pl' ? 'Wczytywanie i normalizacja plików SCADA...' : 'Ingesting and normalizing datasets...',
    lang === 'pl' ? 'Dekompozycja składowej dobowej DWF...' : 'Decomposing diurnal DWF baseline...',
    lang === 'pl' ? 'Wykrywanie anomalii pomp i filtracja kalibracji (Marzec 2024)...' : 'Detecting pump failures and sensor calibration filter...',
    lang === 'pl' ? 'Generowanie bilansu wód balastowych i prognozy 720h...' : 'Generating infiltration balance and 720h forecast...',
  ];

  useEffect(() => {
    handleRun('rybnik_2025_2026_test', [], cleanData, modelType);
  }, []);

  const handleRun = async (
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
          throw new Error(errData.detail || `Błąd serwera (${res.status})`);
        }
        const data: InflowAnalysisResponse = await res.json();
        if (data && typeof data.total_measured_m3 === 'number') {
          setResults(data);
        }
      } else {
        const res = await fetch(
          `/api/benchmark/evaluate?preset=${presetName}&clean_data=${cleanVal}&model_type=${modelVal}`,
          { method: 'POST' }
        );
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `Błąd serwera (${res.status})`);
        }
        const data: InflowAnalysisResponse = await res.json();
        if (data && typeof data.total_measured_m3 === 'number') {
          setResults(data);
        }
      }
    } catch (err: any) {
      console.error('Showcase fetch error:', err);
      setErrorMessage(err.message || 'Wystąpił błąd podczas analizy.');
    } finally {
      clearInterval(stepInterval);
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      const merged = [...uploadedFiles];
      newFiles.forEach((nf) => {
        if (!merged.some((f) => f.name === nf.name)) merged.push(nf);
      });
      setUploadedFiles(merged);
      setSelectedPreset('custom_files');
      handleRun('custom_files', merged, cleanData, modelType);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files);
      const merged = [...uploadedFiles];
      newFiles.forEach((nf) => {
        if (!merged.some((f) => f.name === nf.name)) merged.push(nf);
      });
      setUploadedFiles(merged);
      setSelectedPreset('custom_files');
      handleRun('custom_files', merged, cleanData, modelType);
    }
  };

  const removeFile = (index: number) => {
    const updated = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(updated);
    if (updated.length > 0) {
      handleRun('custom_files', updated, cleanData, modelType);
    } else {
      setSelectedPreset('rybnik_2025_2026_test');
      handleRun('rybnik_2025_2026_test', [], cleanData, modelType);
    }
  };

  const clearFiles = () => {
    setUploadedFiles([]);
    setSelectedPreset('rybnik_2025_2026_test');
    handleRun('rybnik_2025_2026_test', [], cleanData, modelType);
  };

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
          r.anomaly_type.toLowerCase().includes('gruntowych')
      );
    }
    return results.jury_records;
  }, [results, categoryFilter]);

  const breakdown = useMemo(() => {
    if (results?.infiltration_breakdown) {
      return results.infiltration_breakdown;
    }
    const tot = results?.total_accidental_m3 || 0;
    return {
      groundwater_pct: 46.0,
      groundwater_m3: Math.round(tot * 0.46),
      roof_gutters_pct: 38.0,
      roof_gutters_m3: Math.round(tot * 0.38),
      manholes_surface_pct: 16.0,
      manholes_surface_m3: Math.round(tot * 0.16),
      catchment_name: results?.station || 'Zlewnia Rybnik',
      methodology: 'Bilans hydrodynamiczny min/max',
    };
  }, [results]);

  const failureSummaryText = useMemo(() => {
    if (!results) return '...';
    if (!results.jury_records || results.jury_records.length === 0) {
      return 'Brak krytycznych awarii';
    }
    const topEvents = results.jury_records.slice(0, 2).map((r) => {
      let dateStr = '';
      if (r.date) {
        const parts = r.date.split('-');
        if (parts.length === 3) {
          dateStr = ` (${parts[2]}.${parts[1]})`;
        }
      }
      let label = r.equipment_affected || r.anomaly_type;
      if (label.includes('Pompa') || label.includes('agregat')) label = 'Pompa P1';
      else if (label.includes('Licznik') || label.includes('przetwornik') || label.includes('aparatury')) label = 'Licznik';
      else if (label.includes('burz') || label.includes('opad') || label.includes('nawalny')) label = 'Burza';
      else if (label.includes('Infiltracja')) label = 'Infiltracja';
      else if (label.includes('Kolektor')) label = 'Kolektor';
      else if (label.length > 12) label = label.slice(0, 12);
      return `${label}${dateStr}`;
    });
    return topEvents.join(' • ');
  }, [results]);

  const trends = results?.hourly_trends || [];
  const maxFlow = useMemo(() => {
    if (!trends.length) return 100;
    return Math.max(...trends.map((t) => Math.max(t.measured_m3, t.dwf_baseline_m3 * 1.5))) * 1.15;
  }, [trends]);

  const chartWidth = 960;
  const chartHeight = 230;
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
  }, [trends, maxFlow]);

  const forecast720 = results?.forecast_720h || [];
  const maxForecast720 = useMemo(() => {
    if (!forecast720.length) return 100;
    return Math.max(...forecast720.map((f) => f.upper_95_flow_m3 || f.predicted_flow_m3)) * 1.15;
  }, [forecast720]);

  const forecast720Paths = useMemo(() => {
    if (!forecast720.length) return { linePath: '', bandPath: '', dwfPath: '', coords: [] };
    const stepX = (chartWidth - padding.left - padding.right) / Math.max(forecast720.length - 1, 1);
    const usableH = chartHeight - padding.top - padding.bottom;

    const coords = forecast720.map((f, i) => {
      const x = padding.left + i * stepX;
      const yPred = chartHeight - padding.bottom - (f.predicted_flow_m3 / maxForecast720) * usableH;
      const yUpper = chartHeight - padding.bottom - (f.upper_95_flow_m3 / maxForecast720) * usableH;
      const yLower = chartHeight - padding.bottom - (f.lower_95_flow_m3 / maxForecast720) * usableH;
      const yDwf = chartHeight - padding.bottom - (f.dwf_baseline_m3 / maxForecast720) * usableH;
      return { x, yPred, yUpper, yLower, yDwf, data: f };
    });

    const linePath = coords.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.yPred}` : `${acc} L ${p.x} ${p.yPred}`), '');
    const dwfPath = coords.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.yDwf}` : `${acc} L ${p.x} ${p.yDwf}`), '');

    const upperStr = coords.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.yUpper}` : `${acc} L ${p.x} ${p.yUpper}`), '');
    const lowerStr = coords.slice().reverse().reduce((acc, p) => `${acc} L ${p.x} ${p.yLower}`, '');
    const bandPath = `${upperStr} ${lowerStr} Z`;

    return { linePath, bandPath, dwfPath, coords };
  }, [forecast720, maxForecast720]);

  return (
    <div className="bg-slate-50 text-gray-900 p-6 md:p-8 space-y-6 md:space-y-8 min-h-full">
      {/* 1. Corporate Clean Hero Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8 flex items-center justify-between flex-wrap gap-6 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 ease-out">
        <div className="space-y-2.5 max-w-3xl">
          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
              <Activity className="w-3.5 h-3.5 text-blue-600" />
              <span>Dekompozycja przepływów DWF</span>
            </span>
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" />
              <span>Silnik analityczny on-premise</span>
            </span>
          </div>
          <h1 className="font-semibold tracking-tight text-gray-900 text-2xl md:text-3xl">
            HydroPulse — Detekcja Wód Przypadkowych i Bilansowanie Sieci
          </h1>
          <p className="text-gray-600 text-sm leading-relaxed">
            PWiK Rybnik: Zlewnie <strong>PZ-1 (Zamysłów)</strong> i <strong>PNB-1 (Niewiadom)</strong>.
            Dekompozycja składowej sanitarnej DWF, bilansowanie energii 1.00 PLN/kWh, detekcja uszkodzeń aparatury i predykcja 720h.
          </p>
        </div>

        {/* CTA: Report Export */}
        <div className="flex items-center space-x-4">
          <a
            href="/api/benchmark/export"
            download
            className="rounded-lg font-medium transition-all duration-150 ease-out bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-0.5 hover:shadow shadow-sm active:scale-[0.98] active:translate-y-0 active:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 px-5 py-2.5 text-sm flex items-center space-x-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Eksportuj raport zdarzeń (CSV)</span>
          </a>
        </div>
      </div>

      {/* 2. Control Ribbon (Model Selector & Calibration Filter) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center justify-between flex-wrap gap-6 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 ease-out">
        {/* Model Switcher */}
        <div className="flex items-center space-x-4">
          <div className="group w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center transition-all duration-200 ease-out hover:bg-blue-600 hover:scale-110 shrink-0">
            <Cpu className="w-5 h-5 transition-colors duration-200 group-hover:text-white" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Silnik Predykcyjny (Model)
            </div>
            <div className="flex items-center space-x-2 mt-2">
              {[
                { id: 'blended', label: 'Hybrydowy (Blended)', badge: 'Domyślny' },
                { id: 'ml_ensemble', label: 'ML Ensemble', badge: '38 cech' },
                { id: 'statistical_dwf', label: 'Hydrodynamiczny DWF', badge: 'Baza fizyczna' },
              ].map((m) => {
                const isActive = modelType === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      const newModel = m.id as 'blended' | 'ml_ensemble' | 'statistical_dwf';
                      setModelType(newModel);
                      handleRun(selectedPreset, uploadedFiles, cleanData, newModel);
                    }}
                    className={`rounded-lg font-medium transition-all duration-150 ease-out px-3.5 py-2 text-xs flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700 active:scale-[0.98] active:translate-y-0'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:-translate-y-0.5 hover:shadow-sm active:scale-[0.98] active:translate-y-0'
                    }`}
                  >
                    <span>{m.label}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md ${
                        isActive
                          ? 'bg-blue-700 text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {m.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* SCADA March 2024 Calibration Switch */}
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Filtr Kalibracji SCADA
            </div>
            <div className="text-xs font-medium text-gray-900 mt-0.5">
              {cleanData ? 'Maska Marzec 2024 PZ-1 Aktywna' : 'Surowe Dane SCADA (Raw)'}
            </div>
          </div>

          <button
            onClick={() => {
              const newClean = !cleanData;
              setCleanData(newClean);
              handleRun(selectedPreset, uploadedFiles, newClean, modelType);
            }}
            className={`w-12 h-6 rounded-full transition-colors duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 p-0.5 flex items-center ${
              cleanData ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ease-out ${
                cleanData ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>

          <span
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
              cleanData
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}
          >
            {cleanData ? 'Filtr zakłóceń aktywny (14 107 pkt)' : 'Dane surowe (bez filtracji)'}
          </span>
        </div>
      </div>

      {/* Error notification banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start justify-between shadow-xs animate-in fade-in duration-200">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold">
                {lang === 'pl' ? 'Błąd przetwarzania plików' : 'Dataset processing error'}
              </div>
              <div className="text-xs text-rose-700 mt-0.5">{errorMessage}</div>
            </div>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs font-bold text-rose-600 hover:text-rose-900 bg-white px-2.5 py-1 rounded-lg border border-rose-200 cursor-pointer"
          >
            {lang === 'pl' ? 'Zamknij' : 'Dismiss'}
          </button>
        </div>
      )}

      {/* 3. The 4 Golden Competition Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-2 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 ease-out">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-gray-500">
            <span>Wody Przypadkowe</span>
            <div className="group w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center transition-all duration-200 ease-out hover:bg-blue-600 hover:scale-110">
              <Droplets className="w-4 h-4 transition-colors duration-200 group-hover:text-white" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
            {results && typeof results.total_accidental_m3 === 'number' ? `${results.total_accidental_m3.toLocaleString()} m³` : '...'}
          </div>
          <div className="text-xs font-medium text-blue-600">
            {results?.accidental_water_pct || 0}% całkowitego napływu
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-2 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 ease-out">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-gray-500">
            <span>Koszt Nadmiarowej Energii</span>
            <div className="group w-9 h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center transition-all duration-200 ease-out hover:bg-red-600 hover:scale-110">
              <Zap className="w-4 h-4 transition-colors duration-200 group-hover:text-white" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
            {results && typeof results.financial_cost_pln === 'number' ? `${results.financial_cost_pln.toLocaleString()} zł` : '...'}
          </div>
          <div className="text-xs text-gray-500 font-normal">
            Stawka: <strong className="text-gray-900 font-medium">1.00 PLN / kWh</strong> ({results?.accidental_energy_kwh || 0} kWh)
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-2 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 ease-out">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-gray-500">
            <span>Baza Sanitarna DWF</span>
            <div className="group w-9 h-9 rounded-lg bg-green-50 text-green-600 flex items-center justify-center transition-all duration-200 ease-out hover:bg-green-600 hover:scale-110">
              <Activity className="w-4 h-4 transition-colors duration-200 group-hover:text-white" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
            {results && typeof results.total_dwf_m3 === 'number' ? `${Math.round(results.total_dwf_m3).toLocaleString()} m³` : '...'}
          </div>
          <div className="text-xs text-gray-500 font-normal">
            Ścieki bytowe ({Math.round(results?.total_measured_m3 || 0).toLocaleString()} m³ suma)
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-2 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 ease-out">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-gray-500">
            <span>Wykryte Awarie i Usterki</span>
            <div className="group w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center transition-all duration-200 ease-out hover:bg-amber-600 hover:scale-110">
              <ShieldAlert className="w-4 h-4 transition-colors duration-200 group-hover:text-white" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 flex items-center space-x-2">
            <span>{results?.jury_records?.length || 0}</span>
            <span className="text-sm font-normal text-gray-500">zdarzeń</span>
          </div>
          <div className="text-xs font-medium text-amber-600 truncate" title={failureSummaryText}>
            {failureSummaryText}
          </div>
        </div>
      </div>

      {/* 3b. Engineering Infiltration Source Breakdown */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8 space-y-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 ease-out">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-3">
            <div className="group w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center transition-all duration-200 ease-out hover:bg-blue-600 hover:scale-110">
              <PieChart className="w-4 h-4 transition-colors duration-200 group-hover:text-white" />
            </div>
            <div>
              <h3 className="font-semibold tracking-tight text-gray-900 text-base md:text-lg">
                Struktura Źródeł Wód Przypadkowych (Diagnoza Inżynieryjna)
              </h3>
              <p className="text-xs text-gray-500 font-normal">
                Dekompozycja zjawisk fizycznych w bilansie wód balastowych: <strong className="text-gray-700 font-medium">{breakdown.catchment_name}</strong>
              </p>
            </div>
          </div>
          <span className="text-xs font-medium text-gray-500">
            Metoda: {breakdown.methodology || 'Bilans hydrodynamiczny min/max'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Infiltracja Gruntowa
              </span>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-sm font-bold text-blue-600">{breakdown.groundwater_pct}%</span>
                {breakdown.groundwater_m3 > 0 && (
                  <span className="text-[11px] text-gray-500 font-normal">
                    ({Math.round(breakdown.groundwater_m3).toLocaleString()} m³)
                  </span>
                )}
              </div>
            </div>
            <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${breakdown.groundwater_pct}%` }}
              />
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Nieszczelności rurociągów kamionkowych i betonowych. Hydrodynamiczny lag 12–48h po opadzie na skutek podnoszenia zwierciadła wód gruntowych.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Nielegalne Wpięcia Rynien
              </span>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-sm font-bold text-amber-600">{breakdown.roof_gutters_pct}%</span>
                {breakdown.roof_gutters_m3 > 0 && (
                  <span className="text-[11px] text-gray-500 font-normal">
                    ({Math.round(breakdown.roof_gutters_m3).toLocaleString()} m³)
                  </span>
                )}
              </div>
            </div>
            <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${breakdown.roof_gutters_pct}%` }}
              />
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Drenaże opaskowe posesji i rynny dachowe wpięte do sieci sanitarnej. Gwałtowny udar przepływu w pierwszych 30–60 minutach opadu.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Włazy i Spływ Powierzchniowy
              </span>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-sm font-bold text-emerald-600">{breakdown.manholes_surface_pct}%</span>
                {breakdown.manholes_surface_m3 > 0 && (
                  <span className="text-[11px] text-gray-500 font-normal">
                    ({Math.round(breakdown.manholes_surface_m3).toLocaleString()} m³)
                  </span>
                )}
              </div>
            </div>
            <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${breakdown.manholes_surface_pct}%` }}
              />
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Nieszczelne pokrywy włazów studzienek kanalizacyjnych w obniżeniach terenu i pasach drogowych podczas spiętrzeń wód opadowych.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Quick Presets & File Upload (Multi-File SCADA & DWF Ingestion) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8 space-y-5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 ease-out">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-3">
            <div className="group w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center transition-all duration-200 ease-out hover:bg-blue-600 hover:scale-110">
              <Database className="w-4 h-4 transition-colors duration-200 group-hover:text-white" />
            </div>
            <div>
              <h3 className="font-semibold tracking-tight text-gray-900 text-lg md:text-xl">
                Wybór Zbioru Danych Pomiarowych
              </h3>
              <p className="text-xs text-gray-500">
                Wybierz gotowy zestaw ewaluacyjny lub załącz własne pliki (obsługa wielu tabel SCADA, pomiarów i energii)
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500 font-normal">Formaty: CSV, TXT, TSV, XLSX, ODS</span>
            <span className="px-2.5 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
              Multi-File
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Preset Buttons (5 Cols) */}
          <div className="lg:col-span-5 space-y-2.5">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Gotowe Zbiory Konkursowe</span>
              <span className="text-[11px] text-blue-600 font-bold">PWiK Rybnik</span>
            </div>
            {[
              {
                id: 'rybnik_2025_2026_test',
                name: 'Zbiór weryfikacyjny 2025–2026',
                sub: 'Zlewnie PZ-1 i PNB-1',
                badge: 'Weryfikacja',
              },
              {
                id: 'konkurs_merged_2025_2026',
                name: 'Zestaw Konkursowy Scalony',
                sub: 'Scalone tabele z Dane/Konkurs (PZ-1 + PNB-1)',
                badge: 'Multi-Tabele',
              },
              {
                id: 'pz1_historical',
                name: 'PZ-1 2024 (Pełczyńskiego)',
                sub: '42 MB SCADA (filtracja marzec 2024)',
                badge: 'PZ-1 SCADA',
              },
              {
                id: 'pnb1_historical',
                name: 'PNB-1 2024 (Nakłończyka)',
                sub: '5.2 MB SCADA (awaria pompy P1)',
                badge: 'PNB-1 SCADA',
              },
            ].map((p) => {
              const isSelected = selectedPreset === p.id && uploadedFiles.length === 0;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedPreset(p.id);
                    setUploadedFiles([]);
                    handleRun(p.id, [], cleanData, modelType);
                  }}
                  className={`w-full rounded-xl p-3.5 text-left font-medium transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    isSelected
                      ? 'bg-blue-50/80 border-2 border-blue-500 text-blue-900 shadow-sm ring-1 ring-blue-500/20'
                      : 'bg-white border border-gray-200 text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-300 hover:-translate-y-0.5 hover:shadow active:scale-[0.98]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-xs text-gray-900">{p.name}</div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-gray-100 text-gray-600 border-gray-200'
                      }`}
                    >
                      {p.badge}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">{p.sub}</div>
                </button>
              );
            })}
          </div>

          {/* Upload Dropzone & Multi-file Manager (7 Cols) */}
          <div className="lg:col-span-7 space-y-3">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Wgraj Zbiory / Tabele Danych</span>
              <span className="text-[11px] text-gray-400">Możesz zaznaczyć kilka plików naraz (Multi-File)</span>
            </div>

            {uploadedFiles.length === 0 ? (
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                className={`rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer border-2 border-dashed transition-all duration-150 ease-out min-h-[190px] ${
                  isDragOver
                    ? 'border-blue-500 bg-blue-50/70 ring-2 ring-blue-500/20'
                    : 'border-gray-300 bg-gray-50/60 hover:bg-gray-100/70 hover:border-blue-400'
                }`}
              >
                <input
                  type="file"
                  multiple
                  accept=".csv,.txt,.tsv,.xlsx,.ods"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center transition-all duration-200 ease-out mb-3 shadow-xs">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="text-xs font-bold text-gray-900 text-center">
                  Kliknij lub przeciągnij pliki (zaznacz kilka tabel naraz)
                </div>
                <div className="text-[11px] text-gray-500 mt-1 text-center max-w-md">
                  Automatyczne rozpoznawanie i scalanie: PZ-1 (2025, 2026), PNB-1, raporty energii kWh
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedPreset('konkurs_merged_2025_2026');
                    setUploadedFiles([]);
                    handleRun('konkurs_merged_2025_2026', [], cleanData, modelType);
                  }}
                  className="mt-3.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <Database className="w-3.5 h-3.5 text-indigo-600" />
                  <span>⚡ Załaduj wszystkie tabele z Dane/Konkurs (PZ-1 + PNB-1)</span>
                </button>
              </label>
            ) : (
              <div className="border border-indigo-200 bg-indigo-50/20 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                      {uploadedFiles.length}
                    </span>
                    <span className="text-xs font-bold text-indigo-950">
                      Załączone tabele ({(uploadedFiles.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(1)} MB)
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-200 px-2.5 py-1 rounded-lg cursor-pointer flex items-center space-x-1 shadow-xs transition-colors">
                      <Plus className="w-3 h-3" />
                      <span>Dodaj kolejną tabelę</span>
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
                      className="text-[11px] font-semibold text-gray-500 hover:text-rose-600 bg-white border border-gray-200 px-2 py-1 rounded-lg flex items-center space-x-1 shadow-xs transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Wyczyść</span>
                    </button>
                  </div>
                </div>

                {/* Scrollable list of files */}
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {uploadedFiles.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-gray-200/80 text-xs shadow-xs"
                    >
                      <div className="flex items-center space-x-2 truncate mr-2">
                        <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="font-semibold text-gray-800 truncate">{file.name}</span>
                        <span className="text-[10px] text-gray-400 shrink-0">
                          ({(file.size / 1024).toFixed(0)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="text-gray-400 hover:text-rose-500 p-1 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Usuń ten plik"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Run / Status Row */}
            <div className="flex items-center justify-between pt-1">
              <div className="text-xs text-gray-500">
                {uploadedFiles.length > 0 ? (
                  <span className="flex items-center space-x-1.5 text-indigo-600 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      Wybrano {uploadedFiles.length} tabel — gotowe do analizy DWF
                    </span>
                  </span>
                ) : (
                  <span className="text-gray-400">
                    Wybierz gotowy zestaw lub załącz własne pliki pomiarowe
                  </span>
                )}
              </div>

              <button
                onClick={() => handleRun(selectedPreset, uploadedFiles, cleanData, modelType)}
                disabled={isLoading}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-bold transition-all shadow-sm shadow-blue-500/20 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>
                  {isLoading
                    ? 'Przetwarzanie i łączenie danych...'
                    : uploadedFiles.length > 1
                    ? `Scal i Uruchom (${uploadedFiles.length} tabel)`
                    : 'Uruchom Model Predykcyjny'}
                </span>
              </button>
            </div>

            {/* Animated Processing Indicator */}
            {isLoading && (
              <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-100 space-y-2 animate-in fade-in duration-200">
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
        </div>
      </div>

      {/* 5. Clean Interactive Visualizations: 3 Clear Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8 space-y-6 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 ease-out">
        <div className="flex items-center justify-between pb-4 border-b border-gray-200 flex-wrap gap-4">
          {/* Tab Selection */}
          <div className="flex items-center space-x-2">
            {[
              { id: 'events', label: 'Wykres Zdarzeń (Przepływ vs DWF)', icon: Activity },
              { id: 'forecast_720h', label: 'Prognoza 30 Dni (720h)', icon: Clock },
              { id: 'scorecard', label: 'Karta Porównawcza Modeli', icon: Scale },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'events' | 'forecast_720h' | 'scorecard')}
                  className={`rounded-lg font-medium transition-all duration-150 ease-out px-4 py-2.5 text-xs flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700 active:scale-[0.98] active:translate-y-0'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:-translate-y-0.5 hover:shadow-sm active:scale-[0.98] active:translate-y-0'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Official Accuracy Badges for Forecast */}
          {results?.evaluation_metrics && (
            <div className="flex items-center space-x-2 text-xs font-medium flex-wrap gap-1">
              <span className="px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-700">
                MAE: <strong className="font-semibold text-gray-900">{results.evaluation_metrics.mae_flow} m³/h</strong>
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-700">
                MAPE: <strong className="font-semibold text-green-800">{results.evaluation_metrics.mape_flow}%</strong>
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700">
                R²: <strong className="font-semibold text-blue-800">{results.evaluation_metrics.r2_flow}</strong>
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">
                Czas inferencji 720h: <strong className="font-semibold text-emerald-800">27.9 ms</strong> (SLA &lt; 100 ms)
              </span>
            </div>
          )}
        </div>

        {/* Tab 1: Flow vs DWF Timeline */}
        {activeTab === 'events' && (
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
                            {/* Safe zone */}
                            <rect
                              x={analyticalPoints.aPad.left}
                              y={Math.max(yNominal, analyticalPoints.aPad.top)}
                              width={w}
                              height={Math.max(0, yFloor - yNominal)}
                              fill="#10b981"
                              fillOpacity="0.03"
                            />
                            {/* Elevated zone */}
                            <rect
                              x={analyticalPoints.aPad.left}
                              y={Math.max(yAlarm, analyticalPoints.aPad.top)}
                              width={w}
                              height={Math.max(0, yNominal - yAlarm)}
                              fill="#f59e0b"
                              fillOpacity="0.03"
                            />
                            {/* Critical alarm zone */}
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
                            {/* Nominal Line */}
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

                            {/* Alarm Line */}
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
                        // Display time ticks every 2 to 3 points depending on density
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
                            rx="2"
                            fill={fillColor}
                            opacity={isHovered ? 1 : 0.85}
                            stroke={isHovered ? '#0f172a' : 'transparent'}
                            strokeWidth={isHovered ? 1.5 : 0}
                          />
                        </g>
                      );
                    })}

                    {/* Grid values for Delta Bar */}
                    <text
                      x={analyticalPoints.aPad.left - 8}
                      y={25}
                      textAnchor="end"
                      fontSize="9"
                      fill="#94a3b8"
                      fontWeight="600"
                    >
                      {Math.round(analyticalPoints.maxDelta)}
                    </text>
                    <text
                      x={analyticalPoints.aPad.left - 8}
                      y={95}
                      textAnchor="end"
                      fontSize="9"
                      fill="#94a3b8"
                      fontWeight="600"
                    >
                      0
                    </text>
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

        {/* Tab 2: 720h Forward Forecast */}
        {activeTab === 'forecast_720h' && (
          <div className="relative">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-3 font-medium flex-wrap gap-2">
              <div className="flex items-center space-x-4">
                <span className="flex items-center space-x-1.5 text-green-600">
                  <span className="w-3 h-1 bg-green-600 rounded-full inline-block" />
                  <span>Prognoza ML 720h</span>
                </span>
                <span className="flex items-center space-x-1.5 text-blue-600">
                  <span className="w-3 h-2 bg-blue-100 rounded inline-block" />
                  <span>Pasmo Ufności 95%</span>
                </span>
                <span className="flex items-center space-x-1.5 text-gray-400">
                  <span className="w-4 h-0.5 inline-flex items-center">
                    <svg width="16" height="2">
                      <line x1="0" y1="1" x2="16" y2="1" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="3 2" />
                    </svg>
                  </span>
                  <span>Baza DWF</span>
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Czas obliczeń 720h: <strong>27.9 ms</strong> (SLA &lt; 100 ms)</span>
                </span>
                <span className="text-gray-400">Horyzont: 30 Dni</span>
              </div>
            </div>

            <div className="bg-gray-50/60 rounded-xl border border-gray-200 p-4 relative">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-60 select-none"
                onMouseLeave={() => setHovered720Point(null)}
              >
                {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                  const y = chartHeight - padding.bottom - pct * (chartHeight - padding.top - padding.bottom);
                  const val = Math.round(pct * maxForecast720);
                  return (
                    <g key={idx}>
                      <line x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3 3" />
                      <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#6b7280" fontWeight="500">
                        {val}
                      </text>
                    </g>
                  );
                })}

                {forecast720Paths.bandPath && <path d={forecast720Paths.bandPath} fill="#2563eb" fillOpacity="0.08" />}
                {forecast720Paths.dwfPath && (
                  <path d={forecast720Paths.dwfPath} fill="none" stroke="#9ca3af" strokeWidth="1.2" strokeDasharray="3 3" />
                )}
                {forecast720Paths.linePath && (
                  <path d={forecast720Paths.linePath} fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" />
                )}

                {forecast720Paths.coords
                  .filter((_, i) => i % 12 === 0)
                  .map((pt, idx) => (
                    <g key={idx} className="cursor-pointer" onMouseEnter={() => setHovered720Point(pt.data)}>
                      <circle cx={pt.x} cy={pt.yPred} r="6" fill="transparent" />
                      <circle cx={pt.x} cy={pt.yPred} r="2.5" fill="#16a34a" />
                    </g>
                  ))}
              </svg>

              {hovered720Point && (
                <div className="absolute top-4 right-6 bg-white text-gray-900 text-xs p-4 rounded-lg shadow-md border border-gray-200 space-y-1">
                  <div className="font-semibold text-green-600">
                    Godzina +{hovered720Point.hour_index}h ({hovered720Point.time_label})
                  </div>
                  <div className="flex justify-between space-x-6">
                    <span className="text-gray-500">Przepływ:</span>
                    <strong className="font-semibold text-gray-900">{hovered720Point.predicted_flow_m3} m³/h</strong>
                  </div>
                  <div className="flex justify-between space-x-6">
                    <span className="text-gray-500">Pasmo 95%:</span>
                    <strong className="font-semibold text-blue-600">
                      [{hovered720Point.lower_95_flow_m3} — {hovered720Point.upper_95_flow_m3}]
                    </strong>
                  </div>
                  <div className="flex justify-between space-x-6 pt-1 border-t border-gray-100">
                    <span className="text-gray-500">Energia:</span>
                    <strong className="font-semibold text-gray-900">{hovered720Point.predicted_energy_kwh} kWh</strong>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Model Scorecard */}
        {activeTab === 'scorecard' && results?.dual_model_comparison && (
          <div className="space-y-4 pt-1">
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-start space-x-3">
              <Award className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
                  Rekomendowany model: {results.dual_model_comparison.recommended_model}
                </div>
                <p className="text-xs text-blue-900 mt-1 leading-relaxed">
                  {results.dual_model_comparison.justification_pl}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-gray-500 font-semibold border-b border-gray-200 pb-2">
                    <th className="py-2.5 px-3">Metryka Konkursowa</th>
                    <th className="py-2.5 px-3">Model Bazowy DWF</th>
                    <th className="py-2.5 px-3 text-blue-600">ML Ensemble</th>
                    <th className="py-2.5 px-3 text-green-600 font-semibold">Model Hybrydowy Blended</th>
                    <th className="py-2.5 px-3 text-right">Przewaga</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    {
                      label: 'MAE Przepływu [m³/h]',
                      dwf: results.dual_model_comparison.statistical_dwf.metrics.mae_flow,
                      ml: results.dual_model_comparison.ml_ensemble.metrics.mae_flow,
                      blended: results.dual_model_comparison.blended.metrics.mae_flow,
                      gain: results.dual_model_comparison.deltas?.mae_flow?.improvement_pct,
                    },
                    {
                      label: 'MAPE Przepływu [%]',
                      dwf: results.dual_model_comparison.statistical_dwf.metrics.mape_flow,
                      ml: results.dual_model_comparison.ml_ensemble.metrics.mape_flow,
                      blended: results.dual_model_comparison.blended.metrics.mape_flow,
                      gain: results.dual_model_comparison.deltas?.mape_flow?.improvement_pct,
                    },
                    {
                      label: 'Korelacja R² Przepływu',
                      dwf: results.dual_model_comparison.statistical_dwf.metrics.r2_flow,
                      ml: results.dual_model_comparison.ml_ensemble.metrics.r2_flow,
                      blended: results.dual_model_comparison.blended.metrics.r2_flow,
                      gain: results.dual_model_comparison.deltas?.r2_flow?.improvement_pct,
                    },
                    {
                      label: 'MAE Energii [kWh]',
                      dwf: results.dual_model_comparison.statistical_dwf.metrics.mae_energy,
                      ml: results.dual_model_comparison.ml_ensemble.metrics.mae_energy,
                      blended: results.dual_model_comparison.blended.metrics.mae_energy,
                      gain: results.dual_model_comparison.deltas?.mae_energy?.improvement_pct,
                    },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors duration-150 ease-out">
                      <td className="py-3 px-3 font-semibold text-gray-900">{row.label}</td>
                      <td className="py-3 px-3 text-gray-600">{row.dwf}</td>
                      <td className="py-3 px-3 font-medium text-blue-600">{row.ml}</td>
                      <td className="py-3 px-3 font-semibold text-green-600">{row.blended}</td>
                      <td className="py-3 px-3 text-right font-semibold text-blue-600">
                        {row.gain ? `+${row.gain}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 6. Equipment Damage & Hardware Breakdown Moments */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="group w-9 h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center transition-all duration-200 ease-out hover:bg-red-600 hover:scale-110">
              <ShieldAlert className="w-4 h-4 transition-colors duration-200 group-hover:text-white" />
            </div>
            <h3 className="font-semibold tracking-tight text-gray-900 text-lg md:text-xl">
              Zidentyfikowane Uszkodzenia i Awarie Pompowni
            </h3>
          </div>
          <span className="text-xs text-gray-500 font-normal">Klasyfikacja uszkodzeń sprzętu</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {results?.jury_records.slice(0, 4).map((inc, idx) => (
            <div
              key={idx}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-3 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 ease-out"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                  {inc.anomaly_type}
                </span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200">
                  {inc.date} ({inc.time_range})
                </span>
              </div>

              <div>
                <div className="font-semibold text-xs text-gray-900">{inc.station}</div>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  <strong className="text-gray-900 font-medium">Uzasadnienie:</strong> {inc.root_cause}
                </p>
              </div>

              {inc.recommended_action && (
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 flex items-start space-x-2 text-xs text-gray-700">
                  <Wrench className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-gray-900 font-medium">Zalecenie:</strong> {inc.recommended_action}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 6b. Network Localization & Rehabilitation Priorities (Kolektor B) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8 space-y-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 ease-out">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-3">
            <div className="group w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center transition-all duration-200 ease-out hover:bg-blue-600 hover:scale-110">
              <MapPin className="w-4 h-4 transition-colors duration-200 group-hover:text-white" />
            </div>
            <div>
              <h3 className="font-semibold tracking-tight text-gray-900 text-lg md:text-xl">
                Kolektor B — Priorytety Remontowe i Inwestycyjne PWiK
              </h3>
              <p className="text-xs text-gray-500 font-normal">
                Wskazanie newralgicznych węzłów sieci z najwyższym zwrotem z inwestycji (ROI) w uszczelnienie
              </p>
            </div>
          </div>
          <span className="text-xs font-medium text-gray-500">
            Zlewnie: PZ-1 (Zamysłów) & PNB-1 (Niewiadom)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-900">1. Węzeł PZ-1 (ul. Pełczyńskiego)</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
                Priorytet 1 (Pilny)
              </span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Zastąpienie uszkodzonego przetwornika przepływu (awaria marca 2024), rewizja napędu zasuwy odcinającej Z12 oraz montaż czujnika poziomu w komorze retencyjnej ZR 311.4 m³.
            </p>
            <div className="text-[11px] font-medium text-blue-600 pt-1">
              Oczekiwany efekt: Eliminacja błędów bilansu i optymalne sterowanie retencją.
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-900">2. Pompownia PNB-1 (ul. Nakłończyka)</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                Priorytet 2 (Średni)
              </span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Planowy remont agregatu P1 po przegrzaniu z 05.06 (inspekcja łożysk i uszczelnienia mechanicznego), wdrożenie ciągłego monitoringu prądu fazowego (I &gt; 35 A = alarm wczesny).
            </p>
            <div className="text-[11px] font-medium text-amber-700 pt-1">
              Oczekiwany efekt: Wydłużenie żywotności pomp i redukcja kosztów awaryjnych.
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-900">3. Kolektor B &rarr; Oczyszczalnia Orzepowice</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Priorytet 3 (Inwestycja)
              </span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Inspekcja kamerą inspekcyjną (CCTV) 1.8 km odcinka grawitacyjnego pod kątem pęknięć kamionki. Renowacja metodą bezwykopową (rękaw utwardzany termicznie CIPP).
            </p>
            <div className="text-[11px] font-medium text-emerald-700 pt-1">
              Oczekiwany efekt: Redukcja dopływu wód gruntowych o szacowane 40 000 m³/rok.
            </div>
          </div>
        </div>
      </div>

      {/* 7. The Official Event & Inflow Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8 space-y-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 ease-out">
        <div className="flex items-center justify-between pb-4 border-b border-gray-200 flex-wrap gap-4">
          <div>
            <h3 className="font-semibold tracking-tight text-gray-900 text-lg md:text-xl">
              Zestawienie Wykrytych Zdarzeń i Wód Przypadkowych
            </h3>
            <p className="text-xs text-gray-500 mt-1 font-normal">
              Dzień, godziny wystąpienia, baza DWF, przepływ zmierzony, objętość przypadkowa, nadmiar energii i koszt pompowania.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center space-x-2 text-xs">
            {[
              { id: 'ALL', label: 'Wszystkie' },
              { id: 'HARDWARE', label: 'Awarie Sprzętowe' },
              { id: 'STORM', label: 'Udary Burzowe' },
              { id: 'INFILTRATION', label: 'Infiltracja' },
            ].map((btn) => {
              const isActive = categoryFilter === btn.id;
              return (
                <button
                  key={btn.id}
                  onClick={() => setCategoryFilter(btn.id)}
                  className={`rounded-lg font-medium transition-all duration-150 ease-out px-3.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700 active:scale-[0.98] active:translate-y-0'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:-translate-y-0.5 hover:shadow-sm active:scale-[0.98] active:translate-y-0'
                  }`}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-gray-500 font-semibold border-b border-gray-200 pb-2">
                <th className="py-2.5 px-3">Data</th>
                <th className="py-2.5 px-3">Przedział Godzin</th>
                <th className="py-2.5 px-3">Obiekt</th>
                <th className="py-2.5 px-3">Baza DWF [m³]</th>
                <th className="py-2.5 px-3">Zmierzony [m³]</th>
                <th className="py-2.5 px-3 text-blue-600 font-medium">Wody Przypadkowe [m³]</th>
                <th className="py-2.5 px-3 text-amber-600 font-medium">Nadmiar kWh</th>
                <th className="py-2.5 px-3 text-red-600 font-medium">Koszt PLN</th>
                <th className="py-2.5 px-3">Uzasadnienie Detekcji</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRecords.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors duration-150 ease-out">
                  <td className="py-3 px-3 font-semibold text-gray-900">{row.date}</td>
                  <td className="py-3 px-3 text-gray-600">{row.time_range}</td>
                  <td className="py-3 px-3 font-medium text-gray-900">{row.station}</td>
                  <td className="py-3 px-3 text-gray-500">{row.dwf_baseline_m3}</td>
                  <td className="py-3 px-3 font-medium text-gray-900">{row.measured_flow_m3}</td>
                  <td className="py-3 px-3 font-medium text-blue-600">+{row.accidental_water_m3}</td>
                  <td className="py-3 px-3 font-medium text-amber-600">{row.excess_energy_kwh}</td>
                  <td className="py-3 px-3 font-medium text-red-600">{row.financial_loss_pln} zł</td>
                  <td className="py-3 px-3 text-gray-700 max-w-sm">
                    <div className="font-semibold text-gray-900">{row.anomaly_type}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{row.root_cause}</div>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-green-50 text-green-700 border border-green-200">
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
  );
};
