import React, { useEffect, useState, useMemo } from 'react';
import {
  Droplets,
  CloudRain,
  DollarSign,
  Download,
  AlertTriangle,
  Sliders,
  Sparkles,
  FileSpreadsheet,
  CheckCircle2,
  TrendingUp,
  Filter,
  Wrench,
  Search,
  X,
  Send,
  HelpCircle,
  Activity,
  Layers,
  Calendar,
  Clock,
  ArrowRight,
  ShieldCheck,
  Zap,
  UploadCloud
} from 'lucide-react';
import { getInflowAnalysis, getJuryReportExportUrl } from '../../services/api';
import { InflowAnalysisResponse, SeasonalBreakdownItem, JuryReportItem } from '../../types';
import { useTelemetry } from '../../context/TelemetryContext';

export const InflowAnalysisView: React.FC = () => {
  const { lang, telemetry } = useTelemetry();
  const [selectedPreset, setSelectedPreset] = useState<string>('pz1_historical');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [sensitivity, setSensitivity] = useState<number>(1.2);
  const [data, setData] = useState<InflowAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Interactivity states
  const [selectedPeriod, setSelectedPeriod] = useState<SeasonalBreakdownItem | null>(null);
  const [showWorkOrderModal, setShowWorkOrderModal] = useState(false);
  const [workOrderSubmitted, setWorkOrderSubmitted] = useState(false);
  const [actionIndex, setActionIndex] = useState(0);
  const [showMethodologyModal, setShowMethodologyModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState('');
  const [tableCategoryFilter, setTableCategoryFilter] = useState<'ALL' | 'CRITICAL' | 'PUMP' | 'INFILTRATION'>('ALL');

  // Trigger brief toast feedback
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Modernization Recommendations catalogue
  const actionsList = useMemo(() => {
    if (selectedPreset === 'rybnik_2025_2026_test' || (data && data.station.includes('Zlewnia PZ-1 / PNB-1'))) {
      return [
        {
          id: 'rybnik_buffer_balance',
          title: 'Optymalizacja buforowania retencji R2 i sterowania zasuwą Z12',
          desc: (cost: number) =>
            `Dynamiczne sterowanie retencją w zlewniach PZ-1 i PNB-1 redukuje udary burzowe o 42% i pozwala zaoszczędzić ok. ${cost.toLocaleString()} PLN w skali roku.`,
          target: 'Zbiornik buforowy R2 & Kolektor grawitacyjny',
          brigade: 'Dział Dyspozycji Mocy i SCADA PWiK Rybnik',
          workType: 'Implementacja algorytmu predykcyjnego TTC w PLC',
          progressPct: 88,
          reductionTag: 'Redukcja zrzutów burzowych: 42%',
          actionButtonText: 'Wdróż sterowanie predykcyjne',
        },
        {
          id: 'rybnik_smoke_tests',
          title: 'Wielkoobszarowa inspekcja dymowa przyłączy deszczowych',
          desc: (cost: number) =>
            `Identyfikacja i odcięcie nielegalnych podłączeń rynien w rejonie Zamysłowa i Niewiadomia obniży szczytowy napływ o 38%, oszczędzając ok. ${cost.toLocaleString()} PLN.`,
          target: 'Zlewnie PZ-1 i PNB-1 (Rybnik)',
          brigade: 'Brygady Pogotowia Sieciowego W-1 oraz W-2',
          workType: 'Generator dymu + inspekcja CCTV studzienek',
          progressPct: 75,
          reductionTag: 'Wyeliminowanie wpięć rynien: 38%',
          actionButtonText: 'Generuj zlecenia inspekcji',
        },
      ];
    } else if (selectedPreset === 'pnb1_historical' || (data && data.station.includes('PNB'))) {
      return [
        {
          id: 'pnb1_pump',
          title: 'Wymiana zabezpieczenia termicznego pompy P1 (PNB-1)',
          desc: (cost: number) =>
            `Usunięcie skutków awarii z 05.06.2024 i przywrócenie pracy w układzie kaskadowym zmniejszy straty hydrauliczne i koszty o ok. ${cost.toLocaleString()} PLN.`,
          target: 'Przepompownia PNB-1 (ul. Nakłończyka, Niewiadom)',
          brigade: 'Zespół Automatyki i Aparatury Pomiarowej A-1 (Mistrz: K. Zieliński)',
          workType: 'Wymiana przekaźnika termobimetalicznego oraz rewizja wirnika pompy P1',
          progressPct: 85,
          reductionTag: 'Przywrócenie sprawności pompy: 100%',
          actionButtonText: 'Zleć naprawę pompy P1',
        },
        {
          id: 'pnb1_buffer',
          title: 'Optymalizacja poziomów retencji w zbiorniku ZR 48.2 m³',
          desc: (cost: number) =>
            `Zwiększenie wykorzystania retencji buforowej przytnie szczyty burzowe i obniży koszty tłoczenia o ok. ${cost.toLocaleString()} PLN.`,
          target: 'Komora Retencyjna PNB-1',
          brigade: 'Dział Dyspozycji Mocy i SCADA',
          workType: 'Aktualizacja progów załączania L1/L2/L3 w sterowniku PLC',
          progressPct: 72,
          reductionTag: 'Redukcja szczytów tłoczenia: 28%',
          actionButtonText: 'Wdróż progi retencji',
        },
      ];
    } else {
      return [
        {
          id: 'pz1_smoke',
          title: 'Inspekcja dymowa i uszczelnienie kolektora Pełczyńskiego',
          desc: (cost: number) =>
            `Wyeliminowanie nielegalnych wpięć deszczowych zmniejszy przepływ szczytowy o 34%, obniżając roczne koszty energii przepompowni o ok. ${cost.toLocaleString()} PLN.`,
          target: 'Kolektor A (ul. Pełczyńskiego / Dolna Zamysłów)',
          brigade: 'Brygada Pogotowia Sieciowego W-2 (Mistrz: M. Kowalski)',
          workType: 'Inspekcja dymowa przyłączy + uszczelnienie kielichów iniekcją ciśnieniową',
          progressPct: 78,
          reductionTag: 'Redukcja przeciążeń pompy: 34%',
          actionButtonText: 'Generuj zlecenie inspekcji',
        },
        {
          id: 'pz1_cipp',
          title: 'Renowacja bezwykopowa rękawem CIPP kolektora DN400',
          desc: (cost: number) =>
            `Zlikwidowanie infiltracji wód gruntowych ze spękań rur na odcinku 450 m ograniczy dopływ nocny o 46%, oszczędzając ok. ${cost.toLocaleString()} PLN rocznie.`,
          target: 'Kolektor Dolotowy DN400 Zamysłów',
          brigade: 'Brygada Renowacji Bezwykopowej R-1 (Mistrz: P. Nowak)',
          workType: 'Wprowadzenie i polimeryzacja rękawa epoksydowego CIPP',
          progressPct: 84,
          reductionTag: 'Eliminacja infiltracji gruntowej: 46%',
          actionButtonText: 'Zleć renowację CIPP',
        },
        {
          id: 'pz1_hatches',
          title: 'Montaż wkładów antynapływowych w studzienkach (18 sztuk)',
          desc: (cost: number) =>
            `Zabezpieczenie studzienek przed spływem powierzchniowym z pasów drogowych obniży nagły udar deszczowy o 16%, generując ${cost.toLocaleString()} PLN oszczędności.`,
          target: 'Studzienki sieci grawitacyjnej Zamysłów',
          brigade: 'Pogotowie Eksploatacyjne E-3',
          workType: 'Instalacja uszczelnień i wkładów podwłazowych PE-HD',
          progressPct: 65,
          reductionTag: 'Ochrona przed spływem ulicznym: 16%',
          actionButtonText: 'Zleć montaż wkładów',
        },
      ];
    }
  }, [selectedPreset, data]);

  const currentAction = actionsList[actionIndex % actionsList.length];

  // Fetch real hydraulic data
  const fetchData = async (
    preset = selectedPreset,
    sens = sensitivity,
    files = uploadedFiles
  ) => {
    setLoading(true);
    try {
      if (files && files.length > 0) {
        const formData = new FormData();
        files.forEach((file) => formData.append('files', file));
        const res = await fetch(`/api/benchmark/upload?clean_data=true&model_type=blended`, {
          method: 'POST',
          body: formData,
        });
        const resData: InflowAnalysisResponse = await res.json();
        setData(resData);
        if (resData.seasonal_breakdown && resData.seasonal_breakdown.length > 0) {
          const storm = resData.seasonal_breakdown.find((s) => s.category === 'STORM');
          setSelectedPeriod(storm || resData.seasonal_breakdown[0]);
        }
      } else {
        const pParam = preset ? `&preset=${preset}` : '';
        const st = preset === 'pnb1_historical' ? 'PNB1' : 'PZ1';
        const res = await fetch(
          `/api/inflow-analysis?station=${st}&sensitivity=${sens}&clean_data=true&model_type=blended${pParam}`
        );
        const resData: InflowAnalysisResponse = await res.json();
        setData(resData);
        if (resData.seasonal_breakdown && resData.seasonal_breakdown.length > 0) {
          const storm = resData.seasonal_breakdown.find((s) => s.category === 'STORM');
          setSelectedPeriod(storm || resData.seasonal_breakdown[0]);
        }
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedPreset, sensitivity, uploadedFiles);
  }, [selectedPreset, sensitivity]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setUploadedFiles(files);
      setSelectedPreset('custom');
      fetchData('custom', sensitivity, files);
      showToast(`Wczytano plik: ${files.map((f) => f.name).join(', ')}`);
    }
  };

  // Seasonal periods (real or fallback)
  const seasonalPeriods: SeasonalBreakdownItem[] = useMemo(() => {
    if (data?.seasonal_breakdown && data.seasonal_breakdown.length > 0) {
      return data.seasonal_breakdown;
    }
    // High-fidelity fallback matching Image 1
    return [
      {
        period_id: 'jan_feb',
        label: 'Styczeń - Luty',
        sublabel: 'Suche zimy',
        category: 'DWF',
        dwf_m3: 91162,
        accidental_m3: 43,
        total_flow_m3: 92700,
        accidental_pct: 0.1,
        dwf_pct: 47.8,
        relative_height_pct: 65,
        peak_flow_m3_h: 94.0,
        energy_cost_pln: 10.3,
      },
      {
        period_id: 'apr',
        label: 'Kwiecień',
        sublabel: 'Roztopy wiosenne',
        category: 'DWF',
        dwf_m3: 44669,
        accidental_m3: 54681,
        total_flow_m3: 107286,
        accidental_pct: 51.0,
        dwf_pct: 41.2,
        relative_height_pct: 58,
        peak_flow_m3_h: 456.6,
        energy_cost_pln: 13123.4,
      },
      {
        period_id: 'may',
        label: 'Maj (Opady)',
        sublabel: 'Infiltracja',
        category: 'DWF',
        dwf_m3: 48513,
        accidental_m3: 46185,
        total_flow_m3: 103150,
        accidental_pct: 44.8,
        dwf_pct: 38.9,
        relative_height_pct: 54,
        peak_flow_m3_h: 447.0,
        energy_cost_pln: 11084.4,
      },
      {
        period_id: 'jun',
        label: 'Czerwiec (05.06)',
        sublabel: 'Awaria P1 + Burza',
        category: 'INFILTRATION',
        dwf_m3: 43302,
        accidental_m3: 59136,
        total_flow_m3: 110664,
        accidental_pct: 36.1,
        dwf_pct: 39.1,
        relative_height_pct: 78,
        peak_flow_m3_h: 375.1,
        energy_cost_pln: 14192.6,
      },
      {
        period_id: 'sep',
        label: 'Wrzesień',
        sublabel: 'Deszcze ciągłe',
        category: 'INFILTRATION',
        dwf_m3: 43758,
        accidental_m3: 68658,
        total_flow_m3: 120472,
        accidental_pct: 35.2,
        dwf_pct: 36.3,
        relative_height_pct: 82,
        peak_flow_m3_h: 501.3,
        energy_cost_pln: 16477.9,
      },
      {
        period_id: 'storm_jul',
        label: '13.07.2024 (Burza)',
        sublabel: '194.8 mm/h',
        category: 'STORM',
        dwf_m3: 2735,
        accidental_m3: 6015,
        total_flow_m3: 9296,
        accidental_pct: 64.7,
        dwf_pct: 29.4,
        relative_height_pct: 95,
        peak_flow_m3_h: 445.9,
        energy_cost_pln: 1443.6,
      },
    ];
  }, [data]);

  // Filtered table rows
  const filteredRecords = useMemo(() => {
    if (!data || !data.jury_records) return [];
    let list = data.jury_records;

    if (tableCategoryFilter === 'CRITICAL') {
      list = list.filter((r) => r.severity === 'CRITICAL');
    } else if (tableCategoryFilter === 'PUMP') {
      list = list.filter(
        (r) =>
          r.anomaly_type.toLowerCase().includes('pompy') ||
          r.anomaly_type.toLowerCase().includes('licznika') ||
          r.anomaly_type.toLowerCase().includes('aparatury')
      );
    } else if (tableCategoryFilter === 'INFILTRATION') {
      list = list.filter(
        (r) =>
          r.anomaly_type.toLowerCase().includes('infiltracja') ||
          r.anomaly_type.toLowerCase().includes('roztopowe')
      );
    }

    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase();
      list = list.filter(
        (r) =>
          r.date.includes(q) ||
          r.anomaly_type.toLowerCase().includes(q) ||
          r.station.toLowerCase().includes(q) ||
          r.time_range.toLowerCase().includes(q)
      );
    }

    return list;
  }, [data, tableCategoryFilter, tableSearch]);

  if (loading || !data) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-3 text-slate-400">
        <Activity className="w-8 h-8 text-blue-600 animate-spin" />
        <span className="text-sm font-bold text-slate-600">
          Obliczanie modeli hydraulicznych DWF i bilansu wód przypadkowych...
        </span>
        <span className="text-xs text-slate-400">Zbiór: {data?.station || selectedPreset} | Próg DWF: {sensitivity.toFixed(2)}x</span>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center space-x-2 text-xs font-bold animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Filter & Station Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Dataset Tabs */}
        <div className="flex items-center space-x-1.5 bg-[#f1f3f6] p-1 rounded-xl border border-slate-200/60 flex-wrap">
          <button
            onClick={() => {
              setSelectedPreset('rybnik_2025_2026_test');
              setUploadedFiles([]);
              setActionIndex(0);
              setWorkOrderSubmitted(false);
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
              selectedPreset === 'rybnik_2025_2026_test' && uploadedFiles.length === 0
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
              setSelectedPreset('pz1_historical');
              setUploadedFiles([]);
              setActionIndex(0);
              setWorkOrderSubmitted(false);
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedPreset === 'pz1_historical' && uploadedFiles.length === 0
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            PZ-1 (ul. Pełczyńskiego)
          </button>

          <button
            onClick={() => {
              setSelectedPreset('pnb1_historical');
              setUploadedFiles([]);
              setActionIndex(0);
              setWorkOrderSubmitted(false);
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedPreset === 'pnb1_historical' && uploadedFiles.length === 0
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            PNB-1 (Zlewnia Niewiadom)
          </button>

          {/* Upload Dropdown / Button */}
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
                setSelectedPreset('rybnik_2025_2026_test');
              }}
              title="Wyczyść pliki"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dynamic Sensitivity Slider */}
        <div
          data-tour="inflow-slider"
          className="flex items-center space-x-3 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-2xs"
        >
          <Sliders className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-xs font-semibold text-slate-600">
            Próg DWF: <strong className="text-slate-900">{sensitivity.toFixed(2)}x</strong>
          </span>
          <input
            type="range"
            min="1.0"
            max="1.8"
            step="0.05"
            value={sensitivity}
            onChange={(e) => setSensitivity(parseFloat(e.target.value))}
            className="w-28 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700">
            {sensitivity <= 1.1 ? 'Rygorystyczny' : sensitivity <= 1.3 ? 'Standard' : 'Tolerancyjny'}
          </span>
        </div>

        {/* Report Export CTA */}
        <a
          href={
            selectedPreset === 'rybnik_2025_2026_test' || uploadedFiles.length > 0
              ? '/api/benchmark/export'
              : getJuryReportExportUrl(selectedPreset === 'pnb1_historical' ? 'PNB1' : 'PZ1', sensitivity)
          }
          download
          onClick={() => showToast(`Pobrano raport DWF (${data.jury_records.length} rekordów)`)}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-all duration-150 ease-out shadow-sm active:scale-[0.98]"
        >
          <FileSpreadsheet className="w-4 h-4 text-white" />
          <span>Eksportuj Raport DWF (CSV)</span>
        </a>
      </div>

      {/* Main Bar Chart Card */}
      <div data-tour="inflow-chart" className="bg-white rounded-3xl p-6 border border-[#e8ecf1] shadow-2xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              Profil Infiltracji Wód Przypadkowych vs Baza Bezdeszczowa DWF
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Porównanie przepływu całkowitego do bazowego ścieku komunalnego — <strong className="text-slate-600 font-semibold">{data.station}</strong> ({data.metadata?.date_range || (selectedPreset === 'rybnik_2025_2026_test' ? 'Horyzont weryfikacyjny 2025–2026' : 'Rok 2024')}).
            </p>
          </div>
          {/* Legend */}
          <div className="flex items-center space-x-4 text-xs font-semibold">
            <div className="flex items-center space-x-1.5">
              <span className="w-3.5 h-3.5 rounded-sm stripe-green inline-block border border-emerald-400" />
              <span className="text-slate-600">Ściek bytowy (DWF)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3.5 h-3.5 rounded-sm stripe-blue inline-block border border-blue-400" />
              <span className="text-slate-600">Infiltracja opadowa</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3.5 h-3.5 rounded-sm bg-[#e11d48] inline-block shadow-xs" />
              <span className="text-rose-600 font-bold">Udar burzowy (Anomalia)</span>
            </div>
          </div>
        </div>

        {/* Visual Columns (Dynamic, responsive, and clickable) */}
        <div className="pt-6 pb-2">
          <div className="h-56 flex items-end space-x-3 px-4 border-b border-slate-100 relative">
            {/* Guide lines matching dataset scales */}
            <div className="absolute inset-x-0 top-0 border-b border-dashed border-slate-200/80 flex justify-between text-[10px] text-slate-400 font-semibold px-2">
              <span>Maksimum okresu ({Math.round(Math.max(...seasonalPeriods.map(p => p.peak_flow_m3_h || 100)))} m³/h)</span>
            </div>
            <div className="absolute inset-x-0 top-1/2 border-b border-dashed border-slate-200/80 flex justify-between text-[10px] text-slate-400 font-semibold px-2">
              <span>Średnia dobowa ({Math.round(data.total_measured_m3 / Math.max(seasonalPeriods.length * 720, 1))} m³/h)</span>
            </div>

            {/* Dynamic Bars rendered from real telemetry */}
            {seasonalPeriods.map((period) => {
              const isSelected = selectedPeriod?.period_id === period.period_id;
              const isStorm = period.category === 'STORM';
              const isInfiltration = period.category === 'INFILTRATION';

              let pctLabel = `${period.accidental_pct}% obcych`;
              if (period.accidental_pct < 1.0) {
                pctLabel = `${period.dwf_pct}% DWF`;
              } else if (isStorm) {
                pctLabel = `${period.accidental_pct}% (Udar)`;
              } else if (isInfiltration) {
                pctLabel = `${period.accidental_pct}% (Infiltracja)`;
              }

              const accHeightPct = Math.min(100, Math.max(8, period.accidental_pct));

              return (
                <div
                  key={period.period_id}
                  onClick={() => setSelectedPeriod(period)}
                  className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                >
                  {/* Top percentage text */}
                  <span
                    className={`text-[11px] mb-1 font-bold transition-all ${
                      isStorm
                        ? 'text-rose-600 font-extrabold'
                        : isInfiltration
                        ? 'text-blue-600 font-bold'
                        : 'text-slate-600'
                    }`}
                  >
                    {pctLabel}
                  </span>

                  {/* Multi-layer stacked bar showing DWF base and Infiltration / Storm cap */}
                  <div
                    style={{ height: `${period.relative_height_pct}%` }}
                    className={`w-full rounded-t-xl transition-all duration-300 relative group-hover:opacity-95 overflow-hidden flex flex-col justify-end ${
                      isSelected
                        ? 'ring-2 ring-offset-2 ring-slate-900 shadow-md scale-[1.02]'
                        : 'shadow-2xs'
                    }`}
                  >
                    {isStorm ? (
                      <>
                        <div
                          style={{ height: `${accHeightPct}%` }}
                          className="w-full bg-[#e11d48] shadow-inner transition-all duration-300"
                          title={`Udar burzowy: ${period.accidental_pct}%`}
                        />
                        <div
                          style={{ height: `${Math.max(0, 100 - accHeightPct)}%` }}
                          className="w-full stripe-green border-t border-emerald-400/60 transition-all duration-300"
                          title={`Baza sanitarna DWF: ${period.dwf_pct}%`}
                        />
                      </>
                    ) : isInfiltration ? (
                      <>
                        <div
                          style={{ height: `${accHeightPct}%` }}
                          className="w-full stripe-blue border-b border-blue-400/80 transition-all duration-300"
                          title={`Infiltracja opadowa: ${period.accidental_pct}%`}
                        />
                        <div
                          style={{ height: `${Math.max(0, 100 - accHeightPct)}%` }}
                          className="w-full stripe-green border-t border-emerald-400/60 transition-all duration-300"
                          title={`Baza sanitarna DWF: ${period.dwf_pct}%`}
                        />
                      </>
                    ) : (
                      <div
                        className="w-full h-full stripe-green border border-emerald-400/80 transition-all duration-300"
                        title="Norma sanitarna DWF"
                      />
                    )}
                  </div>

                  {/* Bottom labels */}
                  <span
                    className={`text-[11px] mt-2 text-center leading-tight transition-colors ${
                      isStorm ? 'font-extrabold text-rose-600' : 'font-bold text-slate-800'
                    }`}
                  >
                    {period.label}
                  </span>
                  <span className={`text-[10px] text-center ${isStorm ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
                    {period.sublabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Period Quick Inspector Drawer */}
        {selectedPeriod && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between flex-wrap gap-4 animate-in fade-in duration-200">
            <div className="flex items-center space-x-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs text-white ${
                  selectedPeriod.category === 'STORM'
                    ? 'bg-rose-600'
                    : selectedPeriod.category === 'INFILTRATION'
                    ? 'bg-blue-600'
                    : 'bg-emerald-600'
                }`}
              >
                {selectedPeriod.category === 'STORM' ? '!' : 'Q'}
              </div>
              <div>
                <div className="text-xs font-extrabold text-slate-900 flex items-center space-x-2">
                  <span>Okres: {selectedPeriod.label} ({selectedPeriod.sublabel})</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      selectedPeriod.category === 'STORM'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : selectedPeriod.category === 'INFILTRATION'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {selectedPeriod.category === 'STORM'
                      ? 'Udar Burzowy'
                      : selectedPeriod.category === 'INFILTRATION'
                      ? 'Infiltracja Opadowa'
                      : 'Norma Sanitarna DWF'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Przepływ całkowity: <strong>{selectedPeriod.total_flow_m3.toLocaleString()} m³</strong> | Szczyt:{' '}
                  <strong>{selectedPeriod.peak_flow_m3_h} m³/h</strong> | Koszt nadmiarowy:{' '}
                  <strong className="text-rose-600">{selectedPeriod.energy_cost_pln.toLocaleString()} PLN</strong>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <button
                onClick={() => {
                  setTableSearch(selectedPeriod.label.split(' ')[0]);
                  showToast(`Filtrowanie tabeli wg okresu: ${selectedPeriod.label}`);
                }}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold border border-slate-200 transition-colors"
              >
                Pokaż w tabeli konkursowej
              </button>
              <button
                onClick={() => setSelectedPeriod(null)}
                className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* KPI & Breakdown Cards (Exact replica of Image 1 bottom cards) */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Card: Sources breakdown */}
        <div data-tour="inflow-sources" className="col-span-7 bg-white rounded-3xl p-6 border border-[#e8ecf1] shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900">
                Struktura dopływów wód przypadkowych ({data.station})
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Łącznie skumulowano {data.total_accidental_m3.toLocaleString()} m³ wód opadowych ({data.metadata?.date_range || (selectedPreset === 'rybnik_2025_2026_test' ? 'Horyzont 2025–2026' : 'Rok 2024')})
              </p>
            </div>
            <button
              onClick={() => setShowMethodologyModal(true)}
              title="Metodyka wyznaczania DWF PN-EN 752"
              className="text-slate-400 hover:text-slate-600 text-xs font-semibold p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              •••
            </button>
          </div>

          <div className="grid grid-cols-2 gap-6 pt-2">
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase">Objętość Bazy vs Zmierzona</div>
              <div className="flex items-baseline space-x-3 mt-1">
                <span className="text-2xl font-black text-slate-900">
                  {(data.total_dwf_m3 / 1000).toFixed(1)}k <span className="text-xs font-normal text-slate-400">m³</span>
                </span>
                <span className="text-2xl font-black text-rose-600">
                  {(data.total_measured_m3 / 1000).toFixed(1)}k <span className="text-xs font-normal text-slate-400">m³</span>
                </span>
              </div>
              <div className="mt-2 text-xs font-bold text-rose-600 flex items-center space-x-1">
                <span>▲ {data.accidental_water_pct}% udział wód obcych</span>
              </div>
            </div>

            {/* Where the extra hours / waters go (Dynamic hydrodynamic decomposition) */}
            <div className="space-y-2.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase">Źródła nieszczelności i dopływu</div>
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Infiltracja przez spękania rur</span>
                  <span className="text-rose-600 font-bold">
                    {data.infiltration_breakdown ? data.infiltration_breakdown.groundwater_pct : 46}% ({(
                      ((data.infiltration_breakdown?.groundwater_m3 ?? data.total_accidental_m3 * 0.46)) / 1000
                    ).toFixed(1)}k m³)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-500 rounded-full stripe-rose transition-all duration-500"
                    style={{ width: `${data.infiltration_breakdown ? data.infiltration_breakdown.groundwater_pct : 46}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Nielegalne podłączenia rynien</span>
                  <span className="text-amber-600 font-bold">
                    {data.infiltration_breakdown ? data.infiltration_breakdown.roof_gutters_pct : 38}% ({(
                      ((data.infiltration_breakdown?.roof_gutters_m3 ?? data.total_accidental_m3 * 0.38)) / 1000
                    ).toFixed(1)}k m³)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full stripe-amber transition-all duration-500"
                    style={{ width: `${data.infiltration_breakdown ? data.infiltration_breakdown.roof_gutters_pct : 38}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Spływ powierzchniowy przez włazy</span>
                  <span className="text-blue-600 font-bold">
                    {data.infiltration_breakdown ? data.infiltration_breakdown.manholes_surface_pct : 16}% ({(
                      ((data.infiltration_breakdown?.manholes_surface_m3 ?? data.total_accidental_m3 * 0.16)) / 1000
                    ).toFixed(1)}k m³)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full stripe-blue transition-all duration-500"
                    style={{ width: `${data.infiltration_breakdown ? data.infiltration_breakdown.manholes_surface_pct : 16}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: Suggested Modernization Action (Exact replica of Image 1 right card) */}
        <div className="col-span-5 bg-white rounded-3xl p-6 border border-[#e8ecf1] shadow-2xs space-y-4">
          <div className="flex items-center justify-between text-xs font-bold text-amber-600">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 fill-amber-500" />
              <span>Sugerowane działanie modernizacyjne</span>
            </div>
            <span className="text-[10px] text-slate-400">
              {actionIndex + 1} z {actionsList.length}
            </span>
          </div>

          <div>
            <h4 className="text-sm font-extrabold text-slate-900 leading-snug">
              {currentAction.title}
            </h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {currentAction.desc(data.financial_cost_pln)}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-semibold text-slate-500">
              <span>{currentAction.reductionTag}</span>
              <span className="text-emerald-600 font-bold">Oszczędność: {data.financial_cost_pln.toLocaleString()} PLN</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                style={{ width: `${currentAction.progressPct}%` }}
                className="h-full bg-emerald-500 rounded-full stripe-green transition-all duration-300"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center space-x-2">
            <button
              onClick={() => setShowWorkOrderModal(true)}
              className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm text-center flex items-center justify-center space-x-1.5 ${
                workOrderSubmitted
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              {workOrderSubmitted ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Zlecenie w realizacji (W-2)</span>
                </>
              ) : (
                <span>{currentAction.actionButtonText}</span>
              )}
            </button>
            <button
              onClick={() => {
                setActionIndex((prev) => prev + 1);
                setWorkOrderSubmitted(false);
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
            >
              Pomiń
            </button>
          </div>
        </div>
      </div>

      {/* Official Jury Submission Table */}
      <div data-tour="inflow-table" className="bg-white rounded-3xl p-6 border border-[#e8ecf1] shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-4">
          <div>
            <h4 className="text-sm font-extrabold text-slate-900">
              Rejestr Zdarzeń Wód Przypadkowych
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Wyznaczone incydenty wód przypadkowych: Dzień, godziny wystąpienia, objętość (m³), koszt energii (1 zł/kWh)
            </p>
          </div>

          {/* Table Search & Filter Controls */}
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Szukaj po dacie lub typie..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
              />
            </div>

            <div className="flex items-center space-x-1 text-xs">
              {[
                { id: 'ALL', label: 'Wszystkie' },
                { id: 'CRITICAL', label: 'Krytyczne' },
                { id: 'PUMP', label: 'Awarie Pomp' },
                { id: 'INFILTRATION', label: 'Infiltracja' },
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setTableCategoryFilter(btn.id as any)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                    tableCategoryFilter === btn.id
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 font-semibold border-b border-slate-100 pb-2">
                <th className="py-2.5 font-bold">Data</th>
                <th className="py-2.5 font-bold">Godziny</th>
                <th className="py-2.5 font-bold">Stacja</th>
                <th className="py-2.5 font-bold">Baza DWF [m³]</th>
                <th className="py-2.5 font-bold">Zmierzony [m³]</th>
                <th className="py-2.5 font-bold text-blue-600">Wody Przypadkowe [m³]</th>
                <th className="py-2.5 font-bold text-amber-600">Nadmiar kWh</th>
                <th className="py-2.5 font-bold text-rose-600">Koszt Strat (PLN)</th>
                <th className="py-2.5 font-bold">Kategoria Anomalii</th>
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

      {/* Work Order Dispatch Modal */}
      {showWorkOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Elektroniczne Zlecenie Pracy PWiK
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Nr: ZLEC/2024/PWiK/{selectedPreset === 'pnb1_historical' ? 'PNB1' : 'PZ1'}/0891
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowWorkOrderModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Obiekt docelowy:</span>
                  <strong className="text-slate-900">{currentAction.target}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Jednostka wykonawcza:</span>
                  <strong className="text-slate-900">{currentAction.brigade}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Priorytet zlecenia:</span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-200 text-[10px]">
                    PILNY (Udar wód obcych &gt; 35%)
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Zakres prac technicznych</label>
                <p className="mt-1 p-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-700 font-medium">
                  {currentAction.workType}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                <div>
                  <span className="text-[10px] text-emerald-700 uppercase font-bold">Szacowane oszczędności</span>
                  <div className="text-base font-black text-emerald-800">
                    {data.financial_cost_pln.toLocaleString()} PLN
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-700 uppercase font-bold">Zmniejszenie przeciążeń</span>
                  <div className="text-base font-black text-emerald-800">
                    {currentAction.reductionTag.split(': ')[1] || '34%'}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center space-x-3">
              <button
                onClick={() => {
                  setWorkOrderSubmitted(true);
                  setShowWorkOrderModal(false);
                  showToast(`Zlecenie ZLEC/2024/PWiK/${selectedPreset === 'pnb1_historical' ? 'PNB1' : 'PZ1'}/0891 przekazane do realizacji!`);
                }}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs transition-all shadow-md shadow-blue-500/20 flex items-center justify-center space-x-2"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Zatwierdź i wyślij do brygady</span>
              </button>
              <button
                onClick={() => setShowWorkOrderModal(false)}
                className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Technical Methodology Modal */}
      {showMethodologyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Metodyka Wyznaczania DWF (PN-EN 752)
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Standard inżynieryjny PWiK Rybnik
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowMethodologyModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>
                <strong>Baza bezdeszczowa DWF (Dry Weather Flow)</strong> reprezentuje wyłącznie ścieki bytowo-gospodarcze pochodzące od mieszkańców zlewni.
              </p>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                <div>
                  <strong className="text-slate-900">1. Nocne minimum (MNF):</strong> Ścieki w godzinach 02:00–04:00 rano są punktem kalibracyjnym infiltracji wód gruntowych.
                </div>
                <div>
                  <strong className="text-slate-900">2. Separacja wód przypadkowych:</strong> Wszelki napływ przewyższający DWF × Próg ({sensitivity.toFixed(2)}x) kwalifikowany jest jako wody opadowe lub roztopowe.
                </div>
                <div>
                  <strong className="text-slate-900">3. Taryfa energetyczna:</strong> Koszt pompowania wód obcych rozliczany według stawki konkursowej <strong>1.00 zł/kWh</strong>.
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowMethodologyModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
