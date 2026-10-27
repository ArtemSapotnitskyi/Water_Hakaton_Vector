import React, { useState } from 'react';
import { TelemetryProvider } from './context/TelemetryContext';
import { Sidebar, NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { EmergencyModal } from './components/EmergencyModal';
import { InteractiveTour, TourStep } from './components/InteractiveTour';
import { ScadaTwinView } from './components/views/ScadaTwinView';
import { RybnikBenchmarkView } from './components/views/RybnikBenchmarkView';
import { InflowAnalysisView } from './components/views/InflowAnalysisView';
import { EnergyView } from './components/views/EnergyView';
import { IncidentsView } from './components/views/IncidentsView';

const tourStepsByTab: Record<NavTab, TourStep[]> = {
  scada_twin: [
    {
      targetSelector: '[data-tour="scada-stats"]',
      title_pl: '1. Kluczowe Wskaźniki Telemetryczne (SCADA)',
      title_en: '1. Key Telemetry Indicators (SCADA)',
      desc_pl: 'Bieżący podgląd napływu burzowego, wskaźnika TTC (czas do przelania), wody skierowanej do bufora oraz skumulowanych kosztów energii w czasie rzeczywistym.',
      desc_en: 'Live telemetry stream of storm inflow, TTC (time to critical overflow), water redirected to retention, and accumulated energy costs.',
    },
    {
      targetSelector: '[data-tour="scada-r1"]',
      title_pl: '2. Przepompownia PZ-1 (Zamysłów, ul. Pełczyńskiego)',
      title_en: '2. Pumping Station PZ-1 (Zamysłów, Pełczyńskiego)',
      desc_pl: 'Główna stacja zlewni Zamysłów: zbiornik retencyjny ZR 311.40 m³, 2 pompy o mocy 21 kW (I=42 A). Odbiera ścieki z kaskady PZ-2 i PZ-4.',
      desc_en: 'Master pumping station of Zamysłów: retention basin ZR 311.40 m³, dual 21 kW motors (I=42 A). Receives flows from PZ-2 and PZ-4.',
    },
    {
      targetSelector: '[data-tour="scada-r2"]',
      title_pl: '3. Przepompownia PNB-1 (Niewiadom, ul. Nakłończyka)',
      title_en: '3. Pumping Station PNB-1 (Niewiadom, Nakłończyka)',
      desc_pl: 'Stacja zlewni Niewiadom ze zbiornikiem ZR 48.20 m³ i pompami 11 kW. To tutaj 05.06.2024 wystąpiła awaria jednej z pomp, po czym stacja pracowała w trybie solo.',
      desc_en: 'Niewiadom basin station with retention ZR 48.20 m³ and 11 kW pumps. Here on 05.06.2024 pump 1 failed, running in solo mode.',
    },
    {
      targetSelector: '[data-tour="scada-suggested"]',
      title_pl: '4. Optymalizacja Pracy Pomp i Retencji',
      title_en: '4. Pump & Retention Optimization',
      desc_pl: 'Inteligentny asystent dyspozytora: automatyczna rekomendacja załączenia drugiej pompy szczytowej P2 przy wzroście poziomu w zbiorniku retencyjnym.',
      desc_en: 'Dispatcher assistant: automated recommendation to stage secondary pump P2 when retention basin level rises.',
    },
  ],
  rybnik_benchmark: [
    {
      targetSelector: '[data-tour="bench-upload"]',
      title_pl: '1. Wgrywanie Nowych Zbiorów Testowych',
      title_en: '1. Uploading Test Benchmark Files',
      desc_pl: 'Strefa do wgrywania plików z danymi testowymi Rybnik 2025–2026 w formatach CSV, TXT lub XLSX dostarczonych podczas finału konkursu.',
      desc_en: 'Dropzone for uploading new Rybnik 2025-2026 evaluation files in CSV, TXT, or XLSX formats provided by the hackathon jury.',
    },
    {
      targetSelector: '[data-tour="bench-presets"]',
      title_pl: '2. Gotowe Zestawy Benchmarkowe',
      title_en: '2. Ready Benchmark Presets',
      desc_pl: 'Szybki wybór oficjalnego zestawu konkursowego Rybnik 2025–2026 lub zbiorów historycznych PZ1/PNB1 do natychmiastowej walidacji.',
      desc_en: 'Quick selection of the official Rybnik 2025-2026 test set or 2024 historical sets for instant model evaluation.',
    },
    {
      targetSelector: '[data-tour="bench-run"]',
      title_pl: '3. Uruchomienie Modelu Predykcyjnego',
      title_en: '3. Run Predictive Evaluation',
      desc_pl: 'Przycisk uruchamia model bazowy DWF, filtruje anomalie czujników, kalkuluje objętość wód przypadkowych (m³) i straty energetyczne (1 zł/kWh).',
      desc_en: 'Triggers the DWF model, filters sensor anomalies, computes accidental water volumes (m³) and energy costs (1 PLN/kWh).',
    },
    {
      targetSelector: '[data-tour="bench-export"]',
      title_pl: '4. Pobranie Raportu dla Jury (CSV)',
      title_en: '4. Export Jury Rubric Report (CSV)',
      desc_pl: 'Jedno kliknięcie generuje oficjalny plik z tabelą predykcji spełniającą 100% wymagań regulaminowych hackathonu.',
      desc_en: 'Single click downloads the official CSV report meeting 100% of the hackathon evaluation requirements.',
    },
  ],
  inflow_analysis: [
    {
      targetSelector: '[data-tour="inflow-slider"]',
      title_pl: '1. Suwak Czułości Modelu DWF',
      title_en: '1. DWF Baseline Sensitivity Slider',
      desc_pl: 'Umożliwia interaktywne dostrajanie mnożnika progu detekcji ścieków bytowych w zależności od warunków glebowych i pory roku.',
      desc_en: 'Allows interactive tuning of the dry weather flow detection threshold based on ground saturation and season.',
    },
    {
      targetSelector: '[data-tour="inflow-chart"]',
      title_pl: '2. Profil Słupkowy Wód Przypadkowych',
      title_en: '2. Accidental Water Column Breakdown',
      desc_pl: 'Wykres z diagonalnym paskowaniem: zielony to norma bytowa DWF, niebieski to infiltracja deszczowa, a karminowy to krytyczny udar nawałnicowy.',
      desc_en: 'Diagonal striped chart: green is dry baseline DWF, blue is rain infiltration, and magenta is extreme storm surge.',
    },
    {
      targetSelector: '[data-tour="inflow-sources"]',
      title_pl: '3. Struktura Źródeł Nieszczelności',
      title_en: '3. Inflow Source Breakdown',
      desc_pl: 'Szacunek inżynieryjny: 46% infiltracja przez pęknięcia, 38% nielegalne rynny deszczowe, 16% nieszczelne włazy studzienek.',
      desc_en: 'Engineering estimate: 46% pipe crack infiltration, 38% illegal roof gutters, 16% manhole surface runoff.',
    },
    {
      targetSelector: '[data-tour="inflow-table"]',
      title_pl: '4. Tabela Oceny Konkursowej',
      title_en: '4. Competition Scoring Table',
      desc_pl: 'Dedykowana tabela zawierająca wymagane kolumny: data, godziny wystąpienia, m³, nadmiar kWh oraz koszt PLN.',
      desc_en: 'Dedicated table with required columns: date, time range, m³, excess kWh, and PLN cost.',
    },
  ],
  energy_costs: [
    {
      targetSelector: '[data-tour="energy-correlation"]',
      title_pl: '1. Korelacja Deszczu i Zużycia Energii',
      title_en: '1. Rain vs Energy Correlation',
      desc_pl: 'Wykazuje bezpośredni wpływ opadów na skoki zużycia kWh przez pompy. Dowód na konieczność uszczelniania sieci.',
      desc_en: 'Demonstrates direct impact of rainfall on pump power spikes. Evidence for pipe rehabilitation.',
    },
    {
      targetSelector: '[data-tour="energy-tariffs"]',
      title_pl: '2. Optymalizacja Taryfowa C12A',
      title_en: '2. Tariff C12A Optimization',
      desc_pl: 'Wskazuje godziny szczytowe (najdroższe) i pozwala zaoszczędzić do 4 200 zł/miesięcznie dzięki retencjonowaniu ścieków w buforze R2.',
      desc_en: 'Highlights peak expensive hours and shows up to 4,200 PLN/month savings by buffering sewage in R2.',
    },
  ],
  incident_log: [
    {
      targetSelector: '[data-tour="incident-table"]',
      title_pl: '1. Rejestr Audytowy SCADA (ACK)',
      title_en: '1. SCADA Audit Log (ACK)',
      desc_pl: 'Pełny rejestr zdarzeń automatycznych oraz manualnych interwencji dyspozytora z potwierdzeniami kwitowania alarmów krytycznych.',
      desc_en: 'Full audit trail of automated actions and dispatcher overrides with operator acknowledgment timestamps.',
    },
  ],
};

export function AppContent() {
  const [currentTab, setCurrentTab] = useState<NavTab>(() => {
    try {
      const saved = localStorage.getItem('hydroflow_current_tab');
      if (saved && ['scada_twin', 'rybnik_benchmark', 'inflow_analysis', 'energy_costs', 'incident_log'].includes(saved)) {
        return saved as NavTab;
      }
    } catch {
      // ignore
    }
    return 'scada_twin';
  });
  const [isTourOpen, setIsTourOpen] = useState(false);

  const handleTabChange = (tab: NavTab) => {
    setCurrentTab(tab);
    try {
      localStorage.setItem('hydroflow_current_tab', tab);
    } catch {
      // ignore
    }
  };

  const currentSteps = tourStepsByTab[currentTab] || tourStepsByTab.scada_twin;

  return (
    <div className="min-h-screen bg-[#eceff2] p-4 flex items-center justify-center font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Outer rounded container mirroring the user's reference images */}
      <div className="w-full max-w-[1600px] h-[92vh] min-h-[750px] bg-white rounded-[28px] shadow-xl border border-slate-200/80 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onTabChange={handleTabChange}
          onOpenTour={() => setIsTourOpen(true)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#f8fafc] overflow-y-auto">
          {/* Top Sticky Header */}
          <Header
            currentTab={currentTab}
            onOpenTour={() => setIsTourOpen(true)}
          />

          {/* Tab View Body: Keep-Alive so all views remain mounted and continuously update */}
          <main className="flex-1 overflow-y-auto relative">
            <div
              className={`h-full ${currentTab === 'scada_twin' ? 'block' : 'hidden'}`}
              style={{ display: currentTab === 'scada_twin' ? 'block' : 'none' }}
            >
              <ScadaTwinView />
            </div>

            <div
              className={`h-full ${currentTab === 'rybnik_benchmark' ? 'block' : 'hidden'}`}
              style={{ display: currentTab === 'rybnik_benchmark' ? 'block' : 'none' }}
            >
              <RybnikBenchmarkView />
            </div>

            <div
              className={`h-full ${currentTab === 'inflow_analysis' ? 'block' : 'hidden'}`}
              style={{ display: currentTab === 'inflow_analysis' ? 'block' : 'none' }}
            >
              <InflowAnalysisView />
            </div>

            <div
              className={`h-full ${currentTab === 'energy_costs' ? 'block' : 'hidden'}`}
              style={{ display: currentTab === 'energy_costs' ? 'block' : 'none' }}
            >
              <EnergyView />
            </div>

            <div
              className={`h-full ${currentTab === 'incident_log' ? 'block' : 'hidden'}`}
              style={{ display: currentTab === 'incident_log' ? 'block' : 'none' }}
            >
              <IncidentsView />
            </div>
          </main>
        </div>
      </div>

      {/* Blocking Emergency Modal for Red Alert / Operator ACK */}
      <EmergencyModal />

      {/* Interactive Feature Tour / Spotlight Walkthrough */}
      <InteractiveTour
        steps={currentSteps}
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <TelemetryProvider>
      <AppContent />
    </TelemetryProvider>
  );
}
