import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  Activity,
  Droplet,
  CloudRain,
  AlertTriangle,
  Zap,
  Waves,
  Filter,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Move,
  Gauge,
  CheckCircle2,
  AlertOctagon,
  SlidersHorizontal
} from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';

export interface StationNode {
  id: string;
  code: string;
  name: string;
  district: string;
  collector: 'A' | 'B' | 'C' | 'WWTP';
  x: number;
  y: number;
  zr_m3: number;
  nominal_q_m3_h: number;
  power_kw: number;
  current_a: number;
  pumps_count: number;
  target_id?: string;
  is_major?: boolean;
  base_inflow_m3_h: number;
}

// Expansive, non-overlapping coordinates in a 2500 x 1350 canvas
const RYBNIK_STATIONS: StationNode[] = [
  // ==========================================
  // KOLEKTOR "B" (North Corridor: Y = 70 - 450)
  // ==========================================
  { id: 'PNB5', code: 'PNB-5', name: 'ul. Rymera', district: 'Niedobczyce', collector: 'B', x: 140, y: 100, zr_m3: 54.7, nominal_q_m3_h: 20.0, power_kw: 4.8, current_a: 5.3, pumps_count: 2, target_id: 'PNB2', base_inflow_m3_h: 12.0 },
  { id: 'PNB2', code: 'PNB-2', name: 'ul. Adamowicka', district: 'Niedobczyce', collector: 'B', x: 380, y: 100, zr_m3: 75.4, nominal_q_m3_h: 54.0, power_kw: 30.0, current_a: 36.0, pumps_count: 2, target_id: 'PNB3', base_inflow_m3_h: 24.0 },
  { id: 'PNB3', code: 'PNB-3', name: 'ul. Słoneczna', district: 'Niedobczyce', collector: 'B', x: 640, y: 100, zr_m3: 161.85, nominal_q_m3_h: 213.0, power_kw: 120.0, current_a: 130.0, pumps_count: 2, target_id: 'PNB4', base_inflow_m3_h: 65.0 },
  { id: 'PNB4', code: 'PNB-4', name: 'ul. Górnośląska', district: 'Niedobczyce', collector: 'B', x: 900, y: 100, zr_m3: 345.4, nominal_q_m3_h: 390.0, power_kw: 40.0, current_a: 42.0, pumps_count: 2, is_major: true, target_id: 'PNB1', base_inflow_m3_h: 95.0 },

  { id: 'PN1', code: 'PN-1', name: 'ul. Bolesława Śmiałego', district: 'Niewiadom', collector: 'B', x: 140, y: 220, zr_m3: 35.0, nominal_q_m3_h: 11.3, power_kw: 4.0, current_a: 5.0, pumps_count: 2, target_id: 'PN2', base_inflow_m3_h: 8.0 },
  { id: 'PN2', code: 'PN-2', name: 'ul. Szymanowskiego', district: 'Niewiadom', collector: 'B', x: 380, y: 220, zr_m3: 15.6, nominal_q_m3_h: 34.15, power_kw: 8.0, current_a: 10.0, pumps_count: 2, target_id: 'PN3', base_inflow_m3_h: 14.0 },
  { id: 'PN3', code: 'PN-3', name: 'ul. Chłodnicka', district: 'Niewiadom', collector: 'B', x: 640, y: 220, zr_m3: 14.0, nominal_q_m3_h: 26.0, power_kw: 6.0, current_a: 7.5, pumps_count: 2, target_id: 'PO4', base_inflow_m3_h: 12.0 },
  { id: 'PO4', code: 'PO-4', name: 'ul. Popielowska', district: 'Niewiadom', collector: 'B', x: 900, y: 220, zr_m3: 93.6, nominal_q_m3_h: 31.1, power_kw: 11.0, current_a: 12.0, pumps_count: 2, target_id: 'PNB1', base_inflow_m3_h: 18.0 },

  // PNB-1 Key Station
  { id: 'PNB1', code: 'PNB-1', name: 'ul. Nakłończyka', district: 'Niewiadom', collector: 'B', x: 1160, y: 160, zr_m3: 48.2, nominal_q_m3_h: 47.5, power_kw: 22.0, current_a: 22.0, pumps_count: 2, is_major: true, target_id: 'KOL_B_TRUNK', base_inflow_m3_h: 22.0 },

  // Zamysłów cascade
  { id: 'PZ3', code: 'PZ-3', name: 'ul. Dolna (boczna)', district: 'Zamysłów', collector: 'B', x: 900, y: 350, zr_m3: 7.3, nominal_q_m3_h: 15.0, power_kw: 8.8, current_a: 7.0, pumps_count: 2, target_id: 'PZ2', base_inflow_m3_h: 8.0 },
  { id: 'PZ2', code: 'PZ-2', name: 'ul. Dolna', district: 'Zamysłów', collector: 'B', x: 1160, y: 350, zr_m3: 124.35, nominal_q_m3_h: 330.0, power_kw: 22.0, current_a: 22.0, pumps_count: 2, target_id: 'PZ1', base_inflow_m3_h: 45.0 },
  { id: 'PZ5', code: 'PZ-5', name: 'ul. Janowicka', district: 'Zamysłów', collector: 'B', x: 1160, y: 270, zr_m3: 39.3, nominal_q_m3_h: 24.5, power_kw: 9.0, current_a: 9.1, pumps_count: 2, target_id: 'PZ1', base_inflow_m3_h: 15.0 },
  { id: 'PZ4', code: 'PZ-4', name: 'ul. Niewiadomska', district: 'Zamysłów', collector: 'B', x: 1160, y: 430, zr_m3: 130.0, nominal_q_m3_h: 220.0, power_kw: 40.0, current_a: 42.0, pumps_count: 2, target_id: 'PZ1', base_inflow_m3_h: 52.0 },

  // PZ-1 Main Hub
  { id: 'PZ1', code: 'PZ-1', name: 'ul. Pełczyńskiego', district: 'Zamysłów', collector: 'B', x: 1440, y: 350, zr_m3: 311.4, nominal_q_m3_h: 115.0, power_kw: 42.0, current_a: 42.0, pumps_count: 2, is_major: true, target_id: 'KOL_B_TRUNK', base_inflow_m3_h: 58.0 },

  // Smolna, Meksyk & Nowiny
  { id: 'PN7', code: 'PN-7', name: 'ul. Budowlanych/KPN', district: 'Nowiny', collector: 'B', x: 1680, y: 120, zr_m3: 15.0, nominal_q_m3_h: 30.0, power_kw: 5.5, current_a: 8.0, pumps_count: 2, target_id: 'KOL_B_TRUNK', base_inflow_m3_h: 16.0 },
  { id: 'PS2', code: 'PS-2', name: 'ul. Rejmonta', district: 'Smolna', collector: 'B', x: 1440, y: 190, zr_m3: 35.0, nominal_q_m3_h: 35.0, power_kw: 3.0, current_a: 3.5, pumps_count: 2, target_id: 'PS1', base_inflow_m3_h: 15.0 },
  { id: 'PS1', code: 'PS-1', name: 'ul. Łanowa', district: 'Smolna', collector: 'B', x: 1680, y: 220, zr_m3: 12.4, nominal_q_m3_h: 20.0, power_kw: 3.0, current_a: 3.5, pumps_count: 2, target_id: 'KOL_B_TRUNK', base_inflow_m3_h: 10.0 },
  { id: 'PM1', code: 'PM-1', name: 'ul. Chwałowicka', district: 'Meksyk', collector: 'B', x: 1680, y: 320, zr_m3: 23.7, nominal_q_m3_h: 25.0, power_kw: 14.8, current_a: 14.0, pumps_count: 2, target_id: 'KOL_B_TRUNK', base_inflow_m3_h: 18.0 },

  // ==========================================
  // KOLEKTOR "A" & "A1" (Central: Y = 520 - 860)
  // ==========================================
  { id: 'PP4', code: 'PP-4', name: 'ul. Wiosny Ludów', district: 'Popielów', collector: 'A', x: 140, y: 530, zr_m3: 10.0, nominal_q_m3_h: 12.5, power_kw: 7.4, current_a: 6.5, pumps_count: 2, target_id: 'PP2', base_inflow_m3_h: 8.0 },
  { id: 'PP5', code: 'PP-5', name: 'ul. Naprawcza', district: 'Popielów', collector: 'A', x: 140, y: 610, zr_m3: 12.0, nominal_q_m3_h: 12.0, power_kw: 4.8, current_a: 6.0, pumps_count: 2, target_id: 'PP2', base_inflow_m3_h: 8.0 },
  { id: 'PP2', code: 'PP-2', name: 'ul. Konarskiego', district: 'Popielów', collector: 'A', x: 380, y: 570, zr_m3: 62.2, nominal_q_m3_h: 345.0, power_kw: 30.0, current_a: 27.0, pumps_count: 2, target_id: 'PP1', base_inflow_m3_h: 35.0 },
  { id: 'PP1', code: 'PP-1', name: 'ul. Raciborska/Orzepowicka', district: 'Popielów', collector: 'A', x: 660, y: 570, zr_m3: 138.5, nominal_q_m3_h: 390.0, power_kw: 100.0, current_a: 100.0, pumps_count: 2, is_major: true, target_id: 'KOL_A_TRUNK', base_inflow_m3_h: 85.0 },

  { id: 'PR5', code: 'PR-5', name: 'ul. Szara', district: 'Radziejów', collector: 'A', x: 140, y: 700, zr_m3: 15.0, nominal_q_m3_h: 11.5, power_kw: 4.8, current_a: 6.1, pumps_count: 2, target_id: 'PR2', base_inflow_m3_h: 9.0 },
  { id: 'PR2', code: 'PR-2', name: 'ul. Popielowska', district: 'Radziejów', collector: 'A', x: 380, y: 700, zr_m3: 62.2, nominal_q_m3_h: 7.0, power_kw: 14.8, current_a: 14.0, pumps_count: 2, target_id: 'PR1', base_inflow_m3_h: 12.0 },
  { id: 'PR1', code: 'PR-1', name: 'ul. Okulickiego', district: 'Radziejów', collector: 'A', x: 660, y: 700, zr_m3: 108.6, nominal_q_m3_h: 300.0, power_kw: 60.0, current_a: 56.0, pumps_count: 2, is_major: true, target_id: 'KOL_A_TRUNK', base_inflow_m3_h: 60.0 },

  // Chwałowice ZROH-1 Giant Basin
  { id: 'PCH5', code: 'PCH-5', name: 'ul. Szewczyka', district: 'Chwałowice', collector: 'A', x: 140, y: 830, zr_m3: 42.6, nominal_q_m3_h: 22.0, power_kw: 14.8, current_a: 14.0, pumps_count: 2, target_id: 'PCH3', base_inflow_m3_h: 15.0 },
  { id: 'PCH3', code: 'PCH-3', name: 'ul. Szolca', district: 'Chwałowice', collector: 'A', x: 380, y: 830, zr_m3: 17.3, nominal_q_m3_h: 27.9, power_kw: 14.8, current_a: 14.0, pumps_count: 2, target_id: 'PCH1', base_inflow_m3_h: 20.0 },
  { id: 'PCH1', code: 'PCH-1', name: 'ul. Świerklańska (ZROH-1)', district: 'Chwałowice', collector: 'A', x: 660, y: 830, zr_m3: 457.1, nominal_q_m3_h: 420.0, power_kw: 55.0, current_a: 65.0, pumps_count: 2, is_major: true, target_id: 'KOL_A_TRUNK', base_inflow_m3_h: 75.0 },

  { id: 'PJ5', code: 'PJ-5', name: 'ul. Dworcowa', district: 'Jejkowice', collector: 'A', x: 960, y: 640, zr_m3: 116.6, nominal_q_m3_h: 150.0, power_kw: 18.0, current_a: 19.0, pumps_count: 2, target_id: 'PZBR4', base_inflow_m3_h: 40.0 },
  { id: 'PZBR4', code: 'PZBR-4', name: 'ul. Młyńska', district: 'Zebrzydowice', collector: 'A', x: 1220, y: 640, zr_m3: 76.6, nominal_q_m3_h: 147.0, power_kw: 20.0, current_a: 22.0, pumps_count: 2, target_id: 'PO1', base_inflow_m3_h: 38.0 },
  { id: 'PO2', code: 'PO-2', name: 'ul. Nad Zalewem', district: 'Orzepowice', collector: 'A', x: 1480, y: 600, zr_m3: 20.0, nominal_q_m3_h: 35.0, power_kw: 11.0, current_a: 12.0, pumps_count: 2, target_id: 'PO1', base_inflow_m3_h: 18.0 },
  { id: 'PO1', code: 'PO-1', name: 'ul. Rudzka (Orzepowice)', district: 'Orzepowice', collector: 'A', x: 1720, y: 640, zr_m3: 260.0, nominal_q_m3_h: 64.0, power_kw: 22.0, current_a: 24.0, pumps_count: 2, is_major: true, target_id: 'KOL_A_TRUNK', base_inflow_m3_h: 62.0 },

  // ==========================================
  // KOLEKTOR "C" (South: Y = 940 - 1260)
  // ==========================================
  { id: 'PK2', code: 'PK-2', name: 'ul. Mikołowska', district: 'Kamień', collector: 'C', x: 180, y: 980, zr_m3: 35.7, nominal_q_m3_h: 21.0, power_kw: 8.8, current_a: 11.0, pumps_count: 2, target_id: 'PK1', base_inflow_m3_h: 15.0 },
  { id: 'PK1', code: 'PK-1', name: 'ul. Hotelowa', district: 'Kamień', collector: 'C', x: 460, y: 980, zr_m3: 189.5, nominal_q_m3_h: 71.0, power_kw: 44.0, current_a: 42.0, pumps_count: 2, is_major: true, target_id: 'PG4', base_inflow_m3_h: 42.0 },
  { id: 'PG4', code: 'PG-4', name: 'ul. Gliwicka', district: 'Golejów', collector: 'C', x: 740, y: 980, zr_m3: 58.2, nominal_q_m3_h: 40.0, power_kw: 15.0, current_a: 18.0, pumps_count: 2, target_id: 'PRK1', base_inflow_m3_h: 28.0 },

  { id: 'PRK1', code: 'PRK-1', name: 'ul. Św. Maksymiliana', district: 'Rybnicka Kuźnia', collector: 'C', x: 1020, y: 980, zr_m3: 50.0, nominal_q_m3_h: 170.0, power_kw: 40.0, current_a: 41.0, pumps_count: 2, target_id: 'PW1', base_inflow_m3_h: 35.0 },
  { id: 'PW1', code: 'PW-1', name: 'ul. Wielopolska', district: 'Wielopole', collector: 'C', x: 1300, y: 980, zr_m3: 46.6, nominal_q_m3_h: 170.0, power_kw: 24.0, current_a: 26.0, pumps_count: 2, is_major: true, target_id: 'KOL_C_TRUNK', base_inflow_m3_h: 40.0 },

  { id: 'POJ1', code: 'POJ-1', name: 'ul. Rybnicka', district: 'Ochojec', collector: 'C', x: 240, y: 1160, zr_m3: 57.65, nominal_q_m3_h: 36.7, power_kw: 30.0, current_a: 27.0, pumps_count: 2, target_id: 'PGT3', base_inflow_m3_h: 25.0 },
  { id: 'PGT3', code: 'PGT-3', name: 'ul. Chwałowicka', district: 'Gotartowice', collector: 'C', x: 600, y: 1160, zr_m3: 60.1, nominal_q_m3_h: 55.0, power_kw: 9.4, current_a: 9.6, pumps_count: 2, target_id: 'PL1', base_inflow_m3_h: 30.0 },
  { id: 'PL1', code: 'PL-1', name: 'ul. Wolna', district: 'Ligota', collector: 'C', x: 1020, y: 1160, zr_m3: 198.0, nominal_q_m3_h: 103.0, power_kw: 30.0, current_a: 32.0, pumps_count: 2, is_major: true, target_id: 'KOL_C_TRUNK', base_inflow_m3_h: 55.0 },

  // ==========================================
  // DESTINATION: OCZYSZCZALNIA ORZEPOWICE (WWTP)
  // ==========================================
  { id: 'WWTP', code: 'WWTP', name: 'Oczyszczalnia Rybnik Orzepowice (ul. Rudzka)', district: 'Rybnik Centrum', collector: 'WWTP', x: 2150, y: 650, zr_m3: 27500.0, nominal_q_m3_h: 1145.8, power_kw: 280.0, current_a: 320.0, pumps_count: 6, is_major: true, base_inflow_m3_h: 720.0 },
];

export const AdvancedCollectorMapView: React.FC = () => {
  const { telemetry, lang, injectDisaster } = useTelemetry();

  // Selected Station & Filter
  const [selectedStationId, setSelectedStationId] = useState<string>(() => {
    try {
      return localStorage.getItem('hydroflow_selected_station') || 'PZ1';
    } catch {
      return 'PZ1';
    }
  });
  const [filterCollector, setFilterCollector] = useState<'ALL' | 'B' | 'A' | 'C'>(() => {
    try {
      const f = localStorage.getItem('hydroflow_filter_collector');
      if (f && ['ALL', 'B', 'A', 'C'].includes(f)) return f as any;
    } catch {
      // ignore
    }
    return 'ALL';
  });
  const [stormDischargeActive, setStormDischargeActive] = useState<boolean>(false);
  const [dischargeAperture, setDischargeAperture] = useState<number>(50);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Interactive Pan and Zoom state
  const [zoom, setZoom] = useState<number>(() => {
    try {
      const z = localStorage.getItem('hydroflow_map_zoom');
      if (z) {
        const val = parseFloat(z);
        if (!isNaN(val) && val >= 0.3 && val <= 2.5) return val;
      }
    } catch {
      // ignore
    }
    return 0.65;
  });
  const [pan, setPan] = useState<{ x: number; y: number }>(() => {
    try {
      const p = localStorage.getItem('hydroflow_map_pan');
      if (p) return JSON.parse(p);
    } catch {
      // ignore
    }
    return { x: 50, y: 20 };
  });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Keep map settings persisted in localStorage
  useEffect(() => {
    try { localStorage.setItem('hydroflow_selected_station', selectedStationId); } catch {}
  }, [selectedStationId]);

  useEffect(() => {
    try { localStorage.setItem('hydroflow_filter_collector', filterCollector); } catch {}
  }, [filterCollector]);

  useEffect(() => {
    try { localStorage.setItem('hydroflow_map_zoom', String(zoom)); } catch {}
  }, [zoom]);

  useEffect(() => {
    try { localStorage.setItem('hydroflow_map_pan', JSON.stringify(pan)); } catch {}
  }, [pan]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Live telemetry dynamic values
  const rain = telemetry?.rain_mm_h || 0;
  const pz1Tank = telemetry?.tanks?.R1;
  const pnb1Tank = telemetry?.tanks?.R2;
  const wwtpTank = telemetry?.tanks?.R3;
  const p1Pz1 = telemetry?.pumps?.P1_R1;
  const isPump1Tripped = p1Pz1?.status === 'FAULT';

  // Selected station object
  const selectedStation = useMemo(() => {
    return RYBNIK_STATIONS.find(s => s.id === selectedStationId) || RYBNIK_STATIONS[0];
  }, [selectedStationId]);

  // Compute dynamic physical state for EVERY station in Rybnik network
  const getStationDynamicState = useCallback((s: StationNode) => {
    // 1. PZ-1 (Zamysłów)
    if (s.id === 'PZ1') {
      const pct = pz1Tank?.pct_full ?? 32;
      const status = pz1Tank?.status || (isPump1Tripped ? 'CRITICAL' : 'SAFE');
      const volume = pz1Tank?.volume_m3 ?? 98;
      const flowOut = pz1Tank?.outflow_m3_h ?? (isPump1Tripped ? 55.0 : 115.0);
      const flowIn = pz1Tank?.inflow_m3_h ?? 58.0;
      const powerKw = isPump1Tripped ? 21.0 : (flowOut > 60 ? 42.0 : 21.0);
      const currentA = isPump1Tripped ? 21.0 : (flowOut > 60 ? 42.0 : 21.0);
      return { pct, status, volume, flowIn, flowOut, powerKw, currentA, isTripped: isPump1Tripped };
    }

    // 2. PNB-1 (Niewiadom)
    if (s.id === 'PNB1') {
      const pct = pnb1Tank?.pct_full ?? 30;
      const status = pnb1Tank?.status || 'SAFE';
      const volume = pnb1Tank?.volume_m3 ?? 14;
      const flowOut = pnb1Tank?.outflow_m3_h ?? 47.5;
      const flowIn = pnb1Tank?.inflow_m3_h ?? 22.0;
      return { pct, status, volume, flowIn, flowOut, powerKw: 22.0, currentA: 22.0, isTripped: false };
    }

    // 3. WWTP Orzepowice
    if (s.id === 'WWTP') {
      const pct = wwtpTank?.pct_full ?? 62;
      const status = wwtpTank?.status || 'SAFE';
      const volume = wwtpTank?.volume_m3 ?? 17280;
      const flowIn = wwtpTank?.inflow_m3_h ?? 720;
      return { pct, status, volume, flowIn, flowOut: flowIn, powerKw: 280.0, currentA: 320.0, isTripped: false };
    }

    // 4. Other 35 stations: physically scaled with real rain surge & catchment dynamics
    const rainSurge = rain * 2.8;
    const flowIn = Math.round((s.base_inflow_m3_h + rainSurge) * 10) / 10;
    
    // Pump automation (kicks in when inflow rises)
    let activePumps = flowIn > s.nominal_q_m3_h * 0.6 ? s.pumps_count : 1;
    let flowOut = Math.min(flowIn * 0.95, s.nominal_q_m3_h * (activePumps / s.pumps_count));
    flowOut = Math.round(flowOut * 10) / 10;

    let basePct = 28 + (flowIn / s.nominal_q_m3_h) * 35;
    if (stormDischargeActive) {
      basePct = Math.min(96, basePct + 30);
    }
    const pct = Math.min(98, Math.round(basePct));
    const volume = Math.round((pct / 100) * s.zr_m3 * 10) / 10;

    let status: 'SAFE' | 'WARNING' | 'CRITICAL' = 'SAFE';
    if (pct >= 85) status = 'CRITICAL';
    else if (pct >= 70) status = 'WARNING';

    const powerKw = Math.round((s.power_kw * (activePumps / s.pumps_count)) * 10) / 10;
    const currentA = Math.round((s.current_a * (activePumps / s.pumps_count)) * 10) / 10;

    return { pct, status, volume, flowIn, flowOut, powerKw, currentA, isTripped: false };
  }, [pz1Tank, pnb1Tank, wwtpTank, rain, stormDischargeActive, isPump1Tripped]);

  // Aggregate live network KPI metrics
  const networkMetrics = useMemo(() => {
    let totalPower = 0;
    let totalCurrent = 0;
    let bottlenecksCount = 0;

    RYBNIK_STATIONS.forEach(s => {
      const dyn = getStationDynamicState(s);
      totalPower += dyn.powerKw;
      totalCurrent += dyn.currentA;
      if (dyn.status === 'CRITICAL' || dyn.isTripped) {
        bottlenecksCount += 1;
      }
    });

    const wwtpFlow = wwtpTank?.inflow_m3_h ?? 720;
    return {
      totalPower: Math.round(totalPower),
      totalCurrent: Math.round(totalCurrent),
      bottlenecksCount,
      wwtpFlow: Math.round(wwtpFlow),
    };
  }, [getStationDynamicState, wwtpTank]);

  // Zoom helpers
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.15, 2.0));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.15, 0.4));
  const handleResetView = () => {
    setZoom(0.65);
    setPan({ x: 50, y: 20 });
  };

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom(prev => Math.min(2.0, Math.max(0.4, prev * zoomFactor)));
  };

  // Filtered station list
  const filteredStations = useMemo(() => {
    return RYBNIK_STATIONS.filter(s => {
      if (filterCollector !== 'ALL' && s.collector !== filterCollector && s.collector !== 'WWTP') {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          s.code.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.district.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [filterCollector, searchQuery]);

  // Total storm discharge rate
  const totalDischargeRate = useMemo(() => {
    if (!stormDischargeActive && rain < 15) return 0;
    const base = stormDischargeActive ? 280 : 0;
    return Math.round(base + (rain * 8.5) * (dischargeAperture / 100));
  }, [stormDischargeActive, rain, dischargeAperture]);

  const flowAnimationClass = rain > 20 || stormDischargeActive
    ? 'animate-flow-fast'
    : rain > 5
    ? 'animate-flow-normal'
    : 'animate-flow-slow';

  return (
    <div className="space-y-4">
      {/* ============================================================== */}
      {/* 1. TOP TOOLBAR: WATERSHED FILTER CHIPS & SEARCH (Decongested!) */}
      {/* ============================================================== */}
      <div className="bg-white px-5 py-3 rounded-2xl border border-[#e8ecf1] shadow-2xs flex items-center justify-between gap-4">
        {/* Left: Watershed Filter Pills */}
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
            {lang === 'pl' ? 'Zlewnia:' : 'Watershed:'}
          </span>
          <div className="flex bg-slate-100 p-1 rounded-xl space-x-1">
            {[
              { id: 'ALL', label: lang === 'pl' ? 'Wszystkie (A+B+C)' : 'All (A+B+C)' },
              { id: 'B', label: 'Kol. B (Zamysłów/Niewiadom)', color: 'text-blue-700' },
              { id: 'A', label: 'Kol. A (Popielów/Chwałowice)', color: 'text-emerald-700' },
              { id: 'C', label: 'Kol. C (Kamień/Wielopole)', color: 'text-amber-700' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterCollector(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterCollector === tab.id
                    ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200 font-extrabold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className={filterCollector === tab.id ? tab.color : ''}>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Middle: Integrated Search */}
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            placeholder={lang === 'pl' ? 'Szukaj stacji / ulicy...' : 'Search station or street...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs px-3 py-1.5 pl-8 rounded-xl bg-slate-50 border border-slate-200 focus:outline-hidden focus:border-blue-500 text-slate-800 placeholder-slate-400 font-medium"
          />
          <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Right Label */}
        <div className="text-xs font-semibold text-slate-400">
          <span>{lang === 'pl' ? 'PWiK Rybnik • Schemat Cyfrowy' : 'PWiK Rybnik • Digital Twin'}</span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. REAL-TIME SCADA HUD: POWER CONSUMPTION & THROUGHPUT MONITOR */}
      {/* ============================================================== */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-2xl border border-slate-200 flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Zap className="w-4 h-4 fill-amber-500" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {lang === 'pl' ? 'Moc Sieci PWiK' : 'Active Network Power'}
              </div>
              <div className="text-lg font-black text-slate-900">
                {networkMetrics.totalPower} <span className="text-xs font-normal text-slate-500">kW</span>
              </div>
            </div>
          </div>
          <div className="text-[10px] font-semibold text-slate-500 text-right">
            <span>Prąd: <strong className="text-slate-800">{networkMetrics.totalCurrent} A</strong></span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-slate-200 flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Droplet className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {lang === 'pl' ? 'Tranzyt do Orzepowic' : 'WWTP Inflow'}
              </div>
              <div className="text-lg font-black text-slate-900">
                {networkMetrics.wwtpFlow} <span className="text-xs font-normal text-slate-500">m³/h</span>
              </div>
            </div>
          </div>
          <div className="text-[10px] font-semibold text-slate-500 text-right">
            <span>Limit: <strong className="text-slate-800">1 145 m³/h</strong></span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-slate-200 flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              isPump1Tripped || networkMetrics.bottlenecksCount > 0
                ? 'bg-rose-100 text-rose-600 animate-pulse'
                : 'bg-emerald-50 text-emerald-600'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {lang === 'pl' ? 'Wąskie Gardła / Spadek' : 'Hydraulic Bottlenecks'}
              </div>
              <div className={`text-lg font-black ${
                isPump1Tripped || networkMetrics.bottlenecksCount > 0 ? 'text-rose-600' : 'text-slate-900'
              }`}>
                {isPump1Tripped ? '1 ALARM' : `${networkMetrics.bottlenecksCount} punktów`}
              </div>
            </div>
          </div>
          <div className="text-[10px] font-semibold text-right">
            {isPump1Tripped ? (
              <span className="text-rose-600 font-bold">Awaria pompy PZ-1</span>
            ) : (
              <span className="text-emerald-600 font-bold">Przepustowość OK</span>
            )}
          </div>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-slate-200 flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <Waves className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {lang === 'pl' ? 'Zrzut Burzowy (Nacyna)' : 'Storm Discharge Rate'}
              </div>
              <div className="text-lg font-black text-cyan-700">
                {totalDischargeRate} <span className="text-xs font-normal text-slate-500">m³/h</span>
              </div>
            </div>
          </div>
          <div className="text-[10px] font-semibold text-slate-500 text-right">
            <span>Opad: <strong className="text-slate-800">{rain} mm/h</strong></span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. MAIN WORKSPACE: INTERACTIVE DRAGGABLE MAP (Left) + INSPECTOR (Right) */}
      {/* ============================================================== */}
      <div className="grid grid-cols-12 gap-5">
        {/* Map Viewport Area (8 Cols) */}
        <div className="col-span-8 bg-white rounded-3xl p-3 border border-[#e8ecf1] shadow-2xs relative flex flex-col justify-between">
          {/* Viewport Frame with Draggable & Zoomable Canvas */}
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            className={`w-full h-[620px] bg-[#f8fafc] rounded-2xl border border-slate-200/90 relative overflow-hidden select-none ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            {/* Subtle Engineering Grid Background */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-25">
              <defs>
                <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#94a3b8" strokeWidth="0.6" strokeDasharray="2 2" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#gridPattern)" />
            </svg>

            {/* ============================================================== */}
            {/* TRANSFORMED CANVAS LAYER (Holds all Conduits, Stations & WWTP) */}
            {/* ============================================================== */}
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
                transition: isDragging ? 'none' : 'transform 0.12s ease-out',
                width: '2500px',
                height: '1350px'
              }}
              className="absolute left-0 top-0 will-change-transform"
            >
              {/* SVG Pipe Conduits Layer (All paths strictly have fill="none" to prevent black triangles!) */}
              <svg
                width="2500"
                height="1350"
                viewBox="0 0 2500 1350"
                className="absolute inset-0 w-full h-full pointer-events-none"
              >
                <defs>
                  {/* Glowing Filter for Storm Relief Water */}
                  <filter id="reliefGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <filter id="warningGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* -------------------------------------------------------- */}
                {/* 1. KOLEKTOR "B" CONDUITS (Rendered ONLY if ALL or B) */}
                {/* -------------------------------------------------------- */}
                {(filterCollector === 'ALL' || filterCollector === 'B') && (
                  <g id="conduits-kolektor-b">
                    {/* Base Outer Pipe Casings (fill="none" everywhere!) */}
                    <path d="M 240 100 L 380 100" fill="none" stroke="#cbd5e1" strokeWidth="10" strokeLinecap="round" />
                    <path d="M 480 100 L 640 100" fill="none" stroke="#cbd5e1" strokeWidth="10" strokeLinecap="round" />
                    <path d="M 740 100 L 900 100" fill="none" stroke="#cbd5e1" strokeWidth="12" strokeLinecap="round" />
                    <path d="M 1000 100 L 1160 160" fill="none" stroke="#cbd5e1" strokeWidth="12" strokeLinecap="round" />

                    <path d="M 240 220 L 380 220" fill="none" stroke="#cbd5e1" strokeWidth="8" strokeLinecap="round" />
                    <path d="M 480 220 L 640 220" fill="none" stroke="#cbd5e1" strokeWidth="8" strokeLinecap="round" />
                    <path d="M 740 220 L 900 220" fill="none" stroke="#cbd5e1" strokeWidth="10" strokeLinecap="round" />
                    <path d="M 1000 220 L 1160 160" fill="none" stroke="#cbd5e1" strokeWidth="10" strokeLinecap="round" />

                    {/* Main Trunk PNB-1 via ks 500 Nowiny/Chabrowa */}
                    <path d="M 1260 160 L 1860 160" fill="none" stroke="#94a3b8" strokeWidth="14" strokeLinecap="round" />

                    {/* Zamysłów cascade */}
                    <path d="M 1000 350 L 1160 350" fill="none" stroke="#cbd5e1" strokeWidth="8" strokeLinecap="round" />
                    <path d="M 1260 270 L 1440 350" fill="none" stroke="#cbd5e1" strokeWidth="10" strokeLinecap="round" />
                    <path d="M 1260 350 L 1440 350" fill="none" stroke="#cbd5e1" strokeWidth="12" strokeLinecap="round" />
                    <path d="M 1260 430 L 1440 350" fill="none" stroke="#cbd5e1" strokeWidth="12" strokeLinecap="round" />
                    {/* PZ-1 -> Trunk B */}
                    <path d="M 1540 350 L 1860 350" fill="none" stroke={isPump1Tripped ? '#fca5a5' : '#94a3b8'} strokeWidth="14" strokeLinecap="round" />

                    {/* Smolna, Meksyk & Nowiny */}
                    <path d="M 1540 190 L 1680 220" fill="none" stroke="#cbd5e1" strokeWidth="8" strokeLinecap="round" />
                    <path d="M 1780 220 L 1860 220" fill="none" stroke="#cbd5e1" strokeWidth="10" strokeLinecap="round" />
                    <path d="M 1780 120 L 1860 120" fill="none" stroke="#cbd5e1" strokeWidth="8" strokeLinecap="round" />
                    <path d="M 1780 320 L 1860 320" fill="none" stroke="#cbd5e1" strokeWidth="10" strokeLinecap="round" />

                    {/* Main Trunk B (ks 800) down to WWTP - MUST HAVE fill="none"! */}
                    <path d="M 1860 120 L 1860 630 L 2150 630" fill="none" stroke="#94a3b8" strokeWidth="16" strokeLinecap="round" />

                    {/* ACTIVE FLOWING WATER STREAMS (Inner Colored Cores) */}
                    <path d="M 240 100 L 380 100" fill="none" stroke="#38bdf8" strokeWidth="5" strokeDasharray="8 6" className={flowAnimationClass} />
                    <path d="M 480 100 L 640 100" fill="none" stroke="#38bdf8" strokeWidth="5" strokeDasharray="8 6" className={flowAnimationClass} />
                    <path d="M 740 100 L 900 100" fill="none" stroke="#2563eb" strokeWidth="7" strokeDasharray="10 8" className={flowAnimationClass} />
                    <path d="M 1000 100 L 1160 160" fill="none" stroke="#2563eb" strokeWidth="7" strokeDasharray="10 8" className={flowAnimationClass} />

                    <path d="M 240 220 L 380 220" fill="none" stroke="#38bdf8" strokeWidth="4" strokeDasharray="8 6" className={flowAnimationClass} />
                    <path d="M 480 220 L 640 220" fill="none" stroke="#38bdf8" strokeWidth="4" strokeDasharray="8 6" className={flowAnimationClass} />
                    <path d="M 740 220 L 900 220" fill="none" stroke="#2563eb" strokeWidth="6" strokeDasharray="10 8" className={flowAnimationClass} />
                    <path d="M 1000 220 L 1160 160" fill="none" stroke="#2563eb" strokeWidth="6" strokeDasharray="10 8" className={flowAnimationClass} />

                    {/* ks 500 Nowiny/Chabrowa Main Stream */}
                    <path d="M 1260 160 L 1860 160" fill="none" stroke="#1d4ed8" strokeWidth="8" strokeDasharray="14 10" className={flowAnimationClass} />

                    {/* PZ-1 Stream (Turns Red / Reduced if Pump Tripped!) */}
                    <path
                      d="M 1540 350 L 1860 350"
                      fill="none"
                      stroke={isPump1Tripped ? '#ef4444' : '#1d4ed8'}
                      strokeWidth={isPump1Tripped ? '4' : '8'}
                      strokeDasharray={isPump1Tripped ? '6 6' : '14 10'}
                      className={flowAnimationClass}
                    />

                    {/* Trunk B Vertical Stream to WWTP - MUST HAVE fill="none"! */}
                    <path
                      d="M 1860 120 L 1860 630 L 2150 630"
                      fill="none"
                      stroke="#1e40af"
                      strokeWidth="10"
                      strokeDasharray="18 12"
                      className={flowAnimationClass}
                    />

                    {/* Traveling Water Droplet Particles along ks 500 & Trunk B */}
                    <circle r="4.5" fill="#60a5fa" filter="drop-shadow(0 0 3px #38bdf8)">
                      <animateMotion path="M 1260 160 L 1860 160" dur={rain > 20 ? '1.2s' : '2.4s'} repeatCount="indefinite" />
                    </circle>
                    <circle r="4.5" fill="#60a5fa" filter="drop-shadow(0 0 3px #38bdf8)">
                      <animateMotion path="M 1440 350 L 1860 350" dur={isPump1Tripped ? '4.5s' : (rain > 20 ? '1.0s' : '2.0s')} repeatCount="indefinite" />
                    </circle>
                    <circle r="5.5" fill="#93c5fd" filter="drop-shadow(0 0 4px #2563eb)">
                      <animateMotion path="M 1860 160 L 1860 630 L 2150 630" dur={rain > 20 ? '1.8s' : '3.6s'} repeatCount="indefinite" />
                    </circle>

                    {/* Throughput / Bottleneck Alert Badge (Positioned safely at y=385, NOT overlapping PM-1!) */}
                    {isPump1Tripped && (
                      <g transform="translate(1560, 385)">
                        <rect x="0" y="0" width="180" height="26" rx="8" fill="#fef2f2" stroke="#f87171" strokeWidth="1.5" />
                        <text x="10" y="17" fill="#b91c1c" fontSize="11" fontWeight="bold">
                          Spadek przepustowości: -60 m³/h
                        </text>
                      </g>
                    )}
                  </g>
                )}

                {/* -------------------------------------------------------- */}
                {/* 2. KOLEKTOR "A" & "A1" CONDUITS (Rendered ONLY if ALL or A) */}
                {/* -------------------------------------------------------- */}
                {(filterCollector === 'ALL' || filterCollector === 'A') && (
                  <g id="conduits-kolektor-a">
                    {/* Base Pipe Casings (fill="none" everywhere!) */}
                    <path d="M 240 530 L 380 570" fill="none" stroke="#cbd5e1" strokeWidth="8" strokeLinecap="round" />
                    <path d="M 240 610 L 380 570" fill="none" stroke="#cbd5e1" strokeWidth="8" strokeLinecap="round" />
                    <path d="M 480 570 L 660 570" fill="none" stroke="#cbd5e1" strokeWidth="12" strokeLinecap="round" />

                    <path d="M 240 700 L 380 700" fill="none" stroke="#cbd5e1" strokeWidth="8" strokeLinecap="round" />
                    <path d="M 480 700 L 660 700" fill="none" stroke="#cbd5e1" strokeWidth="12" strokeLinecap="round" />

                    <path d="M 240 830 L 380 830" fill="none" stroke="#cbd5e1" strokeWidth="8" strokeLinecap="round" />
                    <path d="M 480 830 L 660 830" fill="none" stroke="#cbd5e1" strokeWidth="14" strokeLinecap="round" />

                    <path d="M 760 570 L 960 640" fill="none" stroke="#cbd5e1" strokeWidth="12" strokeLinecap="round" />
                    <path d="M 760 700 L 960 640" fill="none" stroke="#cbd5e1" strokeWidth="12" strokeLinecap="round" />
                    <path d="M 760 830 L 960 640" fill="none" stroke="#cbd5e1" strokeWidth="14" strokeLinecap="round" />

                    <path d="M 1060 640 L 1220 640" fill="none" stroke="#cbd5e1" strokeWidth="12" strokeLinecap="round" />
                    <path d="M 1320 640 L 1720 640" fill="none" stroke="#cbd5e1" strokeWidth="14" strokeLinecap="round" />
                    <path d="M 1580 600 L 1720 640" fill="none" stroke="#cbd5e1" strokeWidth="8" strokeLinecap="round" />

                    {/* Main Trunk A Conduit into WWTP */}
                    <path d="M 1820 640 L 2150 640" fill="none" stroke="#94a3b8" strokeWidth="16" strokeLinecap="round" />

                    {/* ACTIVE FLOWING STREAMS */}
                    <path d="M 240 530 L 380 570" fill="none" stroke="#34d399" strokeWidth="4" strokeDasharray="8 6" className={flowAnimationClass} />
                    <path d="M 240 610 L 380 570" fill="none" stroke="#34d399" strokeWidth="4" strokeDasharray="8 6" className={flowAnimationClass} />
                    <path d="M 480 570 L 660 570" fill="none" stroke="#059669" strokeWidth="7" strokeDasharray="10 8" className={flowAnimationClass} />

                    <path d="M 240 700 L 380 700" fill="none" stroke="#34d399" strokeWidth="4" strokeDasharray="8 6" className={flowAnimationClass} />
                    <path d="M 480 700 L 660 700" fill="none" stroke="#059669" strokeWidth="7" strokeDasharray="10 8" className={flowAnimationClass} />

                    <path d="M 240 830 L 380 830" fill="none" stroke="#34d399" strokeWidth="4" strokeDasharray="8 6" className={flowAnimationClass} />
                    <path d="M 480 830 L 660 830" fill="none" stroke="#059669" strokeWidth="8" strokeDasharray="12 8" className={flowAnimationClass} />

                    <path d="M 760 570 L 960 640" fill="none" stroke="#059669" strokeWidth="7" strokeDasharray="12 8" className={flowAnimationClass} />
                    <path d="M 760 700 L 960 640" fill="none" stroke="#059669" strokeWidth="7" strokeDasharray="12 8" className={flowAnimationClass} />
                    <path d="M 760 830 L 960 640" fill="none" stroke="#047857" strokeWidth="9" strokeDasharray="14 10" className={flowAnimationClass} />

                    <path d="M 1060 640 L 1220 640" fill="none" stroke="#047857" strokeWidth="8" strokeDasharray="14 10" className={flowAnimationClass} />
                    <path d="M 1320 640 L 1720 640" fill="none" stroke="#047857" strokeWidth="9" strokeDasharray="14 10" className={flowAnimationClass} />
                    <path d="M 1820 640 L 2150 640" fill="none" stroke="#065f46" strokeWidth="11" strokeDasharray="18 12" className={flowAnimationClass} />

                    {/* Traveling Water Droplets along Kolektor A */}
                    <circle r="5" fill="#a7f3d0" filter="drop-shadow(0 0 3px #10b981)">
                      <animateMotion path="M 760 830 L 960 640 L 1720 640" dur={rain > 20 ? '1.5s' : '3.0s'} repeatCount="indefinite" />
                    </circle>
                    <circle r="5.5" fill="#6ee7b7" filter="drop-shadow(0 0 4px #059669)">
                      <animateMotion path="M 1720 640 L 2150 640" dur={rain > 20 ? '0.8s' : '1.6s'} repeatCount="indefinite" />
                    </circle>
                  </g>
                )}

                {/* -------------------------------------------------------- */}
                {/* 3. KOLEKTOR "C" CONDUITS (Rendered ONLY if ALL or C) */}
                {/* -------------------------------------------------------- */}
                {(filterCollector === 'ALL' || filterCollector === 'C') && (
                  <g id="conduits-kolektor-c">
                    {/* Base Pipe Casings (fill="none" everywhere!) */}
                    <path d="M 280 980 L 460 980" fill="none" stroke="#cbd5e1" strokeWidth="8" strokeLinecap="round" />
                    <path d="M 560 980 L 740 980" fill="none" stroke="#cbd5e1" strokeWidth="12" strokeLinecap="round" />
                    <path d="M 840 980 L 1020 980" fill="none" stroke="#cbd5e1" strokeWidth="12" strokeLinecap="round" />
                    <path d="M 1120 980 L 1300 980" fill="none" stroke="#cbd5e1" strokeWidth="14" strokeLinecap="round" />

                    <path d="M 340 1160 L 600 1160" fill="none" stroke="#cbd5e1" strokeWidth="8" strokeLinecap="round" />
                    <path d="M 700 1160 L 1020 1160" fill="none" stroke="#cbd5e1" strokeWidth="12" strokeLinecap="round" />
                    <path d="M 1120 1160 L 1860 1160" fill="none" stroke="#94a3b8" strokeWidth="14" strokeLinecap="round" />
                    <path d="M 1400 980 L 1860 980" fill="none" stroke="#94a3b8" strokeWidth="14" strokeLinecap="round" />

                    {/* Main Trunk C Vertical Conduit into WWTP - MUST HAVE fill="none"! */}
                    <path d="M 1860 1160 L 1860 670 L 2150 670" fill="none" stroke="#94a3b8" strokeWidth="16" strokeLinecap="round" />

                    {/* ACTIVE FLOWING STREAMS */}
                    <path d="M 280 980 L 460 980" fill="none" stroke="#fbbf24" strokeWidth="4" strokeDasharray="8 6" className={flowAnimationClass} />
                    <path d="M 560 980 L 740 980" fill="none" stroke="#f59e0b" strokeWidth="7" strokeDasharray="10 8" className={flowAnimationClass} />
                    <path d="M 840 980 L 1020 980" fill="none" stroke="#f59e0b" strokeWidth="7" strokeDasharray="10 8" className={flowAnimationClass} />
                    <path d="M 1120 980 L 1300 980" fill="none" stroke="#d97706" strokeWidth="8" strokeDasharray="12 8" className={flowAnimationClass} />

                    <path d="M 340 1160 L 600 1160" fill="none" stroke="#fbbf24" strokeWidth="4" strokeDasharray="8 6" className={flowAnimationClass} />
                    <path d="M 700 1160 L 1020 1160" fill="none" stroke="#f59e0b" strokeWidth="7" strokeDasharray="10 8" className={flowAnimationClass} />
                    <path d="M 1120 1160 L 1860 1160" fill="none" stroke="#d97706" strokeWidth="8" strokeDasharray="14 10" className={flowAnimationClass} />
                    <path d="M 1400 980 L 1860 980" fill="none" stroke="#d97706" strokeWidth="8" strokeDasharray="14 10" className={flowAnimationClass} />

                    {/* Trunk C Vertical Stream to WWTP - MUST HAVE fill="none"! */}
                    <path d="M 1860 1160 L 1860 670 L 2150 670" fill="none" stroke="#b45309" strokeWidth="10" strokeDasharray="18 12" className={flowAnimationClass} />

                    {/* Traveling Water Droplets along Kolektor C */}
                    <circle r="5" fill="#fde68a" filter="drop-shadow(0 0 3px #f59e0b)">
                      <animateMotion path="M 1120 1160 L 1860 1160 L 1860 670" dur={rain > 20 ? '1.8s' : '3.6s'} repeatCount="indefinite" />
                    </circle>
                  </g>
                )}

                {/* -------------------------------------------------------- */}
                {/* 4. STORM OVERFLOW FLUMES (Cyan Water Waves) */}
                {/* -------------------------------------------------------- */}
                {(stormDischargeActive || rain > 20) && (
                  <g id="storm-relief-flumes">
                    {/* PB-B1 to Nacyna River */}
                    <path
                      d="M 1860 220 C 1960 220, 2020 140, 2140 140"
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="9"
                      strokeDasharray="10 6"
                      className="animate-flow-fast"
                      filter="url(#reliefGlow)"
                    />
                    <text x="1980" y="125" fill="#0891b2" fontSize="12" fontWeight="bold">
                      PB-B1 &rarr; Rzeka Nacyna ({totalDischargeRate} m³/h)
                    </text>

                    {/* PB-WWTP into Ruda River */}
                    <path
                      d="M 2330 650 L 2460 650"
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="10"
                      strokeDasharray="12 8"
                      className="animate-flow-fast"
                      filter="url(#reliefGlow)"
                    />
                    <text x="2350" y="635" fill="#0891b2" fontSize="12" fontWeight="bold">
                      Zrzut do rzeki Ruda
                    </text>
                  </g>
                )}
              </svg>

              {/* ============================================================== */}
              {/* STATIONS HTML NODES LAYER (Crisp, High-Contrast Mini Tanks) */}
              {/* ============================================================== */}
              {filteredStations.map((station) => {
                const dynamic = getStationDynamicState(station);
                const isSelected = selectedStationId === station.id;

                const borderClass =
                  station.collector === 'B'
                    ? 'border-blue-400 hover:border-blue-600'
                    : station.collector === 'A'
                    ? 'border-emerald-400 hover:border-emerald-600'
                    : station.collector === 'C'
                    ? 'border-amber-400 hover:border-amber-600'
                    : 'border-emerald-600';

                const statusColor =
                  dynamic.status === 'CRITICAL' || dynamic.isTripped
                    ? 'border-rose-500 ring-2 ring-rose-400 shadow-rose-200'
                    : dynamic.status === 'WARNING'
                    ? 'border-amber-500 ring-1 ring-amber-300'
                    : '';

                // Central WWTP Station
                if (station.id === 'WWTP') {
                  return (
                    <div
                      key={station.id}
                      onClick={() => setSelectedStationId(station.id)}
                      style={{ left: `${station.x}px`, top: `${station.y}px` }}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-30 transition-all ${
                        isSelected ? 'scale-105 ring-4 ring-emerald-300' : 'hover:scale-102'
                      }`}
                    >
                      <div className="w-68 bg-slate-900 text-white rounded-3xl p-4 shadow-2xl border-2 border-emerald-500 flex flex-col justify-between">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                          <div>
                            <div className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-wider">
                              Centralny Węzeł Oczyszczania
                            </div>
                            <div className="text-sm font-black text-white">
                              OCZYSZCZALNIA ORZEPOWICE
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                            ul. Rudzka
                          </span>
                        </div>

                        {/* Animated Aeration Basin / Water Surface */}
                        <div className="mt-3 bg-slate-800 rounded-2xl p-2.5 border border-slate-700">
                          <div className="flex justify-between text-[11px] font-bold text-slate-300 mb-1">
                            <span>Dopływ z kolektorów A+B+C:</span>
                            <span className="text-emerald-400 font-black">{dynamic.flowIn} m³/h</span>
                          </div>
                          {/* Animated Aeration Water Chamber */}
                          <div className="w-full h-8 bg-slate-900 rounded-xl overflow-hidden relative border border-emerald-500/30">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 transition-all duration-700 flex items-center justify-center text-[10px] font-extrabold text-white"
                              style={{ width: `${dynamic.pct}%` }}
                            >
                              <span className="drop-shadow-xs">{dynamic.pct}% Wydajności</span>
                            </div>
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                            <span>Moc: <strong className="text-amber-400">{dynamic.powerKw} kW</strong></span>
                            <span>Projekt: 27 500 m³/doba</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Standard Station Card with Crisp High-Contrast Fluid Tank
                return (
                  <div
                    key={station.id}
                    onClick={() => setSelectedStationId(station.id)}
                    style={{ left: `${station.x}px`, top: `${station.y}px` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20 transition-all ${
                      isSelected
                        ? 'scale-110 ring-4 ring-slate-900 shadow-xl'
                        : 'hover:scale-105 shadow-sm'
                    }`}
                  >
                    <div
                      className={`w-52 bg-white rounded-2xl p-2.5 border-2 ${borderClass} ${statusColor} flex items-center justify-between gap-2.5`}
                    >
                      {/* Left: Telemetry & Specs */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-black text-slate-900 truncate">
                            {station.code}
                          </span>
                          {station.is_major && (
                            <span className="w-2 h-2 rounded-full bg-blue-600 inline-block animate-pulse" />
                          )}
                          {dynamic.isTripped && (
                            <span className="px-1 py-0.2 rounded text-[8px] font-black bg-rose-600 text-white animate-bounce">
                              AWARIA!
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-semibold truncate leading-tight">
                          {station.district}
                        </div>

                        {/* Power & Flow metrics */}
                        <div className="mt-1 pt-1 border-t border-slate-100 flex items-center justify-between text-[9px]">
                          <span className="font-extrabold text-amber-600 flex items-center space-x-0.5">
                            <Zap className="w-2.5 h-2.5 fill-amber-500" />
                            <span>{dynamic.powerKw} kW</span>
                          </span>
                          <span className="font-bold text-slate-600">
                            Q: {dynamic.flowOut} m³/h
                          </span>
                        </div>
                      </div>

                      {/* Right: High-Contrast Fluid Tank with clear Badge */}
                      <div className="w-16 h-18 bg-sky-50/70 rounded-xl relative border border-slate-200 overflow-hidden flex flex-col justify-end p-0.5 shadow-inner">
                        {/* Realistic Wave Water Volume */}
                        <div
                          className={`w-full rounded-b-lg transition-all duration-700 relative overflow-hidden ${
                            dynamic.status === 'CRITICAL' || dynamic.isTripped
                              ? 'bg-gradient-to-t from-rose-600 to-rose-400'
                              : dynamic.status === 'WARNING'
                              ? 'bg-gradient-to-t from-amber-500 to-amber-300'
                              : 'bg-gradient-to-t from-blue-600 to-sky-400'
                          }`}
                          style={{ height: `${Math.min(100, Math.max(16, dynamic.pct))}%` }}
                        >
                          <div className="absolute inset-x-0 top-0 h-1.5 bg-white/40 animate-wave-slow" />
                        </div>

                        {/* High-Contrast Floating Readout Pill */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                          <div className="bg-white/90 backdrop-blur-2xs px-1.5 py-0.5 rounded-md border border-slate-200/90 shadow-2xs">
                            <span className="text-[10px] font-black text-slate-900 block leading-none">
                              {dynamic.pct}%
                            </span>
                            <span className="text-[8px] font-bold text-slate-600 block leading-tight mt-0.5">
                              ZR {Math.round(station.zr_m3)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ============================================================== */}
            {/* FLOATING MAP NAVIGATION & ZOOM CONTROLS (Top-Right) */}
            {/* ============================================================== */}
            <div className="absolute top-4 right-4 z-40 flex items-center space-x-1.5 bg-white/95 backdrop-blur-xs p-1.5 rounded-2xl border border-slate-200 shadow-md">
              <button
                onClick={handleZoomIn}
                title="Przybliż (Zoom In)"
                className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm transition-colors"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={handleZoomOut}
                title="Oddal (Zoom Out)"
                className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm transition-colors"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={handleResetView}
                title="Wyśrodkuj widok (Reset)"
                className="px-2.5 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center space-x-1 text-xs font-bold transition-colors"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>{Math.round(zoom * 100)}%</span>
              </button>
            </div>

            {/* Guidance Pill */}
            <div className="absolute top-4 left-4 z-30 pointer-events-none">
              <div className="bg-white/90 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-slate-200/90 shadow-2xs flex items-center space-x-2 text-[11px] text-slate-500 font-medium">
                <Move className="w-3.5 h-3.5 text-blue-600" />
                <span>{lang === 'pl' ? 'Przeciągaj, aby przesuwać • Kółko myszy: zoom' : 'Drag to pan • Mouse wheel to zoom'}</span>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* DEDICATED SIMULATION SCENARIOS BAR (Replacing crowded Photo 4) */}
          {/* ============================================================== */}
          <div className="mt-3 pt-3 px-1 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-extrabold text-slate-600">
              <SlidersHorizontal className="w-4 h-4 text-blue-600" />
              <span>{lang === 'pl' ? 'Scenariusze Symulacji Topologii:' : 'Topology Simulation Scenarios:'}</span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setStormDischargeActive(!stormDischargeActive)}
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all shadow-xs ${
                  stormDischargeActive
                    ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                <Waves className="w-4 h-4" />
                <span>
                  {stormDischargeActive
                    ? (lang === 'pl' ? `Zrzut Aktywny (${totalDischargeRate} m³/h)` : `Relief Active (${totalDischargeRate} m³/h)`)
                    : (lang === 'pl' ? 'Symuluj Zrzut Burzowy' : 'Simulate Storm Relief')}
                </span>
              </button>

              <button
                onClick={() => injectDisaster('pump_trip_p1')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ease-out shadow-sm flex items-center space-x-1.5 ${
                  isPump1Tripped
                    ? 'bg-red-100 text-red-800 border border-red-300 animate-pulse'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>{lang === 'pl' ? 'Awaria Pompy P1 (PZ-1)' : 'Pump P1 Trip'}</span>
              </button>

              <button
                onClick={() => {
                  setStormDischargeActive(true);
                  setDischargeAperture(85);
                  injectDisaster('rain_150');
                }}
                className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-medium text-xs transition-all duration-150 ease-out flex items-center space-x-1.5 shadow-sm"
              >
                <CloudRain className="w-3.5 h-3.5 text-blue-600" />
                <span>{lang === 'pl' ? 'Nawałnica (194.8 mm/h)' : 'Storm Runoff'}</span>
              </button>

              <button
                onClick={() => {
                  setStormDischargeActive(false);
                  injectDisaster('reset_all');
                }}
                className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-xs transition-all duration-150 ease-out shadow-sm"
              >
                <span>{lang === 'pl' ? 'Reset DWF' : 'Reset DWF'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* RIGHT DOCKED SIDEBAR: STATION INSPECTOR & DISCHARGE PANEL (4 Cols) */}
        {/* ============================================================== */}
        <div className="col-span-4 space-y-4">
          {/* Station Details with 3D Cutaway Tank Visualizer */}
          <div className="bg-white rounded-3xl p-5 border border-[#e8ecf1] shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <span className={`px-2.5 py-1 rounded-xl text-xs font-black ${
                  selectedStation.collector === 'B'
                    ? 'bg-blue-100 text-blue-800'
                    : selectedStation.collector === 'A'
                    ? 'bg-emerald-100 text-emerald-800'
                    : selectedStation.collector === 'C'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-900 text-white'
                }`}>
                  {selectedStation.code}
                </span>
                <span className="text-xs font-bold text-slate-600">
                  {selectedStation.district}
                </span>
              </div>

              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                getStationDynamicState(selectedStation).isTripped
                  ? 'bg-rose-600 text-white animate-pulse'
                  : getStationDynamicState(selectedStation).status === 'CRITICAL'
                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                  : getStationDynamicState(selectedStation).status === 'WARNING'
                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                  : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
              }`}>
                {getStationDynamicState(selectedStation).isTripped
                  ? 'AWARIA AGREGATU'
                  : getStationDynamicState(selectedStation).status}
              </span>
            </div>

            <div>
              <h4 className="text-base font-extrabold text-slate-900">
                {selectedStation.name}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                {lang === 'pl'
                  ? `Zlewnia Kolektora "${selectedStation.collector}" • PWiK Rybnik Sp. z o.o.`
                  : `Collector "${selectedStation.collector}" Watershed • PWiK Rybnik`}
              </p>
            </div>

            {/* 3D Cutaway Animated Reservoir Visualizer */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-semibold">
                  {lang === 'pl' ? 'Pojemność retencyjna (ZR):' : 'Retention Volume (ZR):'}
                </span>
                <strong className="text-slate-900">
                  {getStationDynamicState(selectedStation).volume} / {selectedStation.zr_m3} m³
                </strong>
              </div>

              {/* Realistic Animated Wave Reservoir Container */}
              <div className="w-full h-24 bg-white rounded-xl border-2 border-slate-200 overflow-hidden relative flex flex-col justify-end shadow-inner">
                {/* Fluid column with wave top */}
                <div
                  className={`w-full transition-all duration-700 relative overflow-hidden ${
                    getStationDynamicState(selectedStation).status === 'CRITICAL' || getStationDynamicState(selectedStation).isTripped
                      ? 'bg-gradient-to-t from-rose-600 via-rose-500 to-rose-400'
                      : getStationDynamicState(selectedStation).status === 'WARNING'
                      ? 'bg-gradient-to-t from-amber-500 via-amber-400 to-yellow-300'
                      : 'bg-gradient-to-t from-blue-600 via-sky-500 to-cyan-400'
                  }`}
                  style={{ height: `${Math.min(100, Math.max(15, getStationDynamicState(selectedStation).pct))}%` }}
                >
                  <div className="absolute inset-x-0 top-0 h-2 bg-white/50 animate-wave-slow" />
                </div>

                {/* Level Measurement Lines */}
                <div className="absolute inset-0 flex flex-col justify-between p-2 pointer-events-none">
                  <div className="flex justify-between text-[9px] text-slate-400 font-bold border-b border-dashed border-slate-300">
                    <span>100% (Przelew)</span>
                    <span>{selectedStation.zr_m3} m³</span>
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-400 font-bold border-b border-dashed border-slate-300">
                    <span>50% (Bufor)</span>
                    <span>{(selectedStation.zr_m3 / 2).toFixed(1)} m³</span>
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                    <span>0% (Dno)</span>
                    <span>0 m³</span>
                  </div>
                </div>

                {/* Center Percentage Display */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-white/90 backdrop-blur-xs px-3 py-1 rounded-full border border-slate-200 shadow-xs text-xs font-black text-slate-900">
                    {getStationDynamicState(selectedStation).pct}% Zapełnienia
                  </div>
                </div>
              </div>
            </div>

            {/* Electrical & Flow Specifications */}
            <div className="space-y-2 text-xs pt-1">
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">{lang === 'pl' ? 'Pobór mocy agregatu' : 'Power Consumption'}</span>
                <strong className="text-amber-600 font-extrabold flex items-center space-x-1">
                  <Zap className="w-3.5 h-3.5 fill-amber-500" />
                  <span>{getStationDynamicState(selectedStation).powerKw} kW</span>
                </strong>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">{lang === 'pl' ? 'Prąd znamionowy (I)' : 'Nominal Current (I)'}</span>
                <strong className="text-slate-900">{getStationDynamicState(selectedStation).currentA} A</strong>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">{lang === 'pl' ? 'Wydajność tłoczenia (Q)' : 'Nominal Flow (Q)'}</span>
                <strong className="text-blue-600 font-black">
                  {getStationDynamicState(selectedStation).flowOut} m³/h
                </strong>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">{lang === 'pl' ? 'Kierunek tłoczenia' : 'Discharge Route'}</span>
                <strong className="text-slate-700">
                  {selectedStation.target_id || (lang === 'pl' ? 'Kolektor Główny' : 'Trunk Collector')}
                </strong>
              </div>
            </div>
          </div>

          {/* Storm Overflow Spillway Controls Card */}
          <div className="bg-white rounded-3xl p-5 border border-[#e8ecf1] shadow-2xs space-y-3">
            <div className="flex items-center space-x-2 text-blue-600 font-bold text-xs">
              <Waves className="w-4 h-4 text-blue-500" />
              <span>{lang === 'pl' ? 'Przelewy Burzowe i Ulga Retencyjna' : 'Storm Relief & Weirs'}</span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              {lang === 'pl'
                ? 'Automatyczna regulacja zasuw przelewowych chroni zlewnie Zamysłowa i Niewiadomia przed podtopieniami piwnic w trakcie nawalnych deszczy.'
                : 'Automated relief weirs protect Zamysłów and Niewiadom basins from basement backflooding during storm downpours.'}
            </p>

            {/* Slider */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                <span>{lang === 'pl' ? 'Otwarcie zasuwy PB-B1:' : 'PB-B1 Relief Aperture:'}</span>
                <span className="text-blue-600 font-extrabold">{dischargeAperture}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={dischargeAperture}
                onChange={(e) => setDischargeAperture(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>0% ({lang === 'pl' ? 'Zamknięta' : 'Closed'})</span>
                <span className="text-blue-600 font-bold">{totalDischargeRate} m³/h</span>
                <span>100% ({lang === 'pl' ? 'Pełny zrzut' : 'Full'})</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
