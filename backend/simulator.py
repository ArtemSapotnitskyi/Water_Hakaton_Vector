import asyncio
import datetime
import uuid
from pathlib import Path
from typing import List, Dict, Optional, Set
import pandas as pd
from fastapi import WebSocket
from config import SIMULATION_TICK_HZ
from data_loader import data_loader
from hydraulic_engine import hydraulic_engine
from schemas import (
    TelemetrySnapshot, IncidentRecord,
    SimulationControlRequest, TankState
)

class Simulator:
    def __init__(self):
        self.is_paused = False
        self.speed_factor = 2.0  # Default 2x speed for good visual dynamics
        self.mode = "AUTO"  # "AUTO" or "MANUAL"
        
        # Datasets & Timeline state
        self.active_dataset_id = "rybnik_2025_2026_test"
        self.active_dataset_name = "Zbiór weryfikacyjny 2025–2026 (PZ-1 + PNB-1)"
        self.timeline_data = self._load_dataset_by_id("rybnik_2025_2026_test")
        self.current_fractional_idx = 0.0
        self.current_step_idx = 0
        self.max_steps = len(self.timeline_data) if not self.timeline_data.empty else 1000
        self.current_sim_dt = self._parse_initial_dt()
        self.last_alarm_real_time: Optional[datetime.datetime] = None

        # Incidents / Alarms history
        self.incidents: List[IncidentRecord] = [
            IncidentRecord(
                id=str(uuid.uuid4())[:8],
                timestamp=self.current_sim_dt.strftime("%Y-%m-%d %H:%M:%S"),
                severity="INFO",
                station="PWiK Rybnik",
                title="System SCADA uruchomiony",
                description="Zainicjalizowano cyfrowy bliźniak sieci PWiK Rybnik w oparciu o oś czasu telemetrycznych zbiorów danych (2025–2026).",
                requires_ack=False,
                acknowledged=True,
            )
        ]
        self.active_blocking_alarm: Optional[IncidentRecord] = None
        self.critical_alarm_suppressed: bool = False

        # Connected WebSockets
        self.active_connections: Set[WebSocket] = set()

    def _parse_initial_dt(self) -> datetime.datetime:
        if not self.timeline_data.empty:
            first_val = self.timeline_data.iloc[0]["Data"]
            try:
                return pd.to_datetime(first_val)
            except Exception:
                pass
        return datetime.datetime(2025, 1, 1, 0, 0, 0)

    def get_sim_seconds_per_real_second(self) -> float:
        """
        Maps speed_factor to simulated seconds per real second:
        1x -> 1 hour in 10 minutes (600s real) -> 6.0 sim sec / real sec
        10x -> 1 hour in 15 seconds real -> 240.0 sim sec / real sec
        """
        if self.speed_factor <= 1.0:
            return max(1.0, self.speed_factor * 6.0)
        elif self.speed_factor <= 10.0:
            # Linear interpolation between 1x (6.0) and 10x (240.0)
            return 6.0 + (self.speed_factor - 1.0) * (234.0 / 9.0)
        else:
            # Scaled up to 60x (1440.0 sim sec / real sec = 1 hr / 2.5s)
            return 240.0 + (self.speed_factor - 10.0) * (1200.0 / 50.0)

    def _load_dataset_by_id(self, dataset_id: str, custom_df: Optional[pd.DataFrame] = None) -> pd.DataFrame:
        if custom_df is not None and not custom_df.empty:
            df = custom_df.copy()
            if "Data" not in df.columns:
                date_cols = [c for c in df.columns if any(k in str(c).lower() for k in ["data", "time", "godzina", "timestamp"])]
                if date_cols:
                    df["Data"] = df[date_cols[0]].astype(str)
                elif isinstance(df.index, pd.DatetimeIndex):
                    df["Data"] = df.index.astype(str)
                else:
                    df["Data"] = [f"Krok {i}" for i in range(len(df))]
            return df

        base_dir = Path(__file__).resolve().parent.parent / "Dane"

        if dataset_id == "rybnik_2025_2026_test":
            csv_path = base_dir / "Zestaw_Konkursowy_Scalony_2025_2026.csv"
            if csv_path.exists():
                try:
                    df = pd.read_csv(csv_path, sep=";", decimal=".")
                    return df
                except Exception as e:
                    print(f"[Simulator] Error loading {csv_path}: {e}")

            from etl_service import etl_service
            df_hourly, _, _, _ = etl_service._generate_rybnik_2025_2026_test_horizon()
            df = pd.DataFrame({
                "Data": df_hourly["timestamp"].astype(str),
                "Przeplyw_PZ1_m3": df_hourly["flow_m3_h"] * 0.82,
                "Przeplyw_PNB1_m3": df_hourly["flow_m3_h"] * 0.18,
                "Przeplyw_Calkowity_m3": df_hourly["flow_m3_h"],
                "Energia_PZ1_kWh": df_hourly["energy_kwh"] * 0.8,
                "Energia_PNB1_kWh": df_hourly["energy_kwh"] * 0.2,
                "Energia_Calkowita_kWh": df_hourly["energy_kwh"],
            })
            return df

        elif dataset_id in ["pz1_historical", "pnb1_historical", "rybnik_2024"]:
            from etl_service import etl_service
            try:
                pz1_df, _, _, _ = etl_service._load_pz1_historical(clean_data=True)
                pnb1_df, _, _, _ = etl_service._load_pnb1_historical()
                
                idx = pz1_df.index
                df = pd.DataFrame({
                    "Data": idx.astype(str),
                    "Przeplyw_PZ1_m3": pz1_df["flow_m3"].values if "flow_m3" in pz1_df.columns else 60.0,
                    "Przeplyw_PNB1_m3": pnb1_df["flow_m3"].reindex(idx, fill_value=18.0).values if "flow_m3" in pnb1_df.columns else 18.0,
                    "Energia_PZ1_kWh": pz1_df["flow_m3"].values * 0.08 if "flow_m3" in pz1_df.columns else 5.0,
                    "Energia_PNB1_kWh": 2.1,
                })
                df["Przeplyw_Calkowity_m3"] = df["Przeplyw_PZ1_m3"] + df["Przeplyw_PNB1_m3"]
                df["Energia_Calkowita_kWh"] = df["Energia_PZ1_kWh"] + df["Energia_PNB1_kWh"]
                return df
            except Exception as e:
                print(f"[Simulator] Error loading Rybnik 2024: {e}")

        elif dataset_id == "storm_ruda":
            storm_df = data_loader.load_ruda_storm_series("2024-07-13")
            storm_df["Data"] = storm_df["UTC"].astype(str)
            storm_df["Przeplyw_PZ1_m3"] = storm_df["storm_inflow_m3_h"] * 0.72
            storm_df["Przeplyw_PNB1_m3"] = storm_df["storm_inflow_m3_h"] * 0.28
            storm_df["Przeplyw_Calkowity_m3"] = storm_df["storm_inflow_m3_h"]
            storm_df["Energia_Calkowita_kWh"] = 28.5
            return storm_df

        # Default fallback
        return self._load_dataset_by_id("rybnik_2025_2026_test")

    def set_dataset(self, dataset_id: str, custom_df: Optional[pd.DataFrame] = None):
        self.active_dataset_id = dataset_id
        if dataset_id == "rybnik_2025_2026_test":
            self.active_dataset_name = "Zbiór weryfikacyjny 2025–2026 (PZ-1 + PNB-1)"
        elif dataset_id in ["pz1_historical", "rybnik_2024"]:
            self.active_dataset_name = "PWiK Rybnik 2024 (PZ-1 ul. Pełczyńskiego)"
        elif dataset_id == "pnb1_historical":
            self.active_dataset_name = "PWiK Rybnik 2024 (PNB-1 Zlewnia Niewiadom)"
        elif dataset_id == "storm_ruda":
            self.active_dataset_name = "Nawałnica 13.07.2024 (Stress-Test)"
        else:
            self.active_dataset_name = "Własny załadowany zbiór"

        self.timeline_data = self._load_dataset_by_id(dataset_id, custom_df)
        self.max_steps = len(self.timeline_data) if not self.timeline_data.empty else 1000
        self.current_fractional_idx = 0.0
        self.current_step_idx = 0
        self.current_sim_dt = self._parse_initial_dt()

    def jump_to_event(self, event_id: str):
        if self.timeline_data.empty:
            return

        target_idx = 0
        if event_id == "storm_sep_2025":
            matches = self.timeline_data[self.timeline_data["Data"].astype(str).str.contains("2025-09-14")]
            target_idx = int(matches.index[0]) if not matches.empty else 6144
        elif event_id == "storm_may_2026":
            matches = self.timeline_data[self.timeline_data["Data"].astype(str).str.contains("2026-05-12")]
            target_idx = int(matches.index[0]) if not matches.empty else 11904
        elif event_id == "storm_jul_2025":
            matches = self.timeline_data[self.timeline_data["Data"].astype(str).str.contains("2025-07-22")]
            target_idx = int(matches.index[0]) if not matches.empty else 4848
        elif event_id == "thaw_mar_2025":
            matches = self.timeline_data[self.timeline_data["Data"].astype(str).str.contains("2025-03-12")]
            target_idx = int(matches.index[0]) if not matches.empty else 1700
        elif event_id == "pump_trip_p1":
            self.handle_control(SimulationControlRequest(action="inject_disaster", disaster_type="pump_trip_p1"))
            return
        elif event_id == "rain_150":
            if "Przeplyw_PZ1_m3" in self.timeline_data.columns:
                target_idx = int(self.timeline_data["Przeplyw_PZ1_m3"].idxmax())
            else:
                target_idx = 0

        target_idx = max(0, min(self.max_steps - 1, target_idx))
        self.current_fractional_idx = float(target_idx)
        self.current_step_idx = target_idx
        try:
            self.current_sim_dt = pd.to_datetime(self.timeline_data.iloc[target_idx]["Data"])
        except Exception:
            pass

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        snapshot = self.get_snapshot()
        await websocket.send_json(snapshot.model_dump())

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    def get_snapshot(self) -> TelemetrySnapshot:
        if not self.timeline_data.empty:
            idx = int(self.current_fractional_idx) % self.max_steps
            next_idx = (idx + 1) % self.max_steps
            alpha = self.current_fractional_idx - int(self.current_fractional_idx)
            
            cur_row = self.timeline_data.iloc[idx]
            next_row = self.timeline_data.iloc[next_idx]
            
            sim_time_str = self.current_sim_dt.strftime("%Y-%m-%d %H:%M:%S")

            flow_pz1_cur = float(cur_row.get("Przeplyw_PZ1_m3", cur_row.get("flow_pz1_m3", 58.0)))
            flow_pz1_next = float(next_row.get("Przeplyw_PZ1_m3", next_row.get("flow_pz1_m3", 58.0)))
            flow_pz1 = (1.0 - alpha) * flow_pz1_cur + alpha * flow_pz1_next

            flow_pnb1_cur = float(cur_row.get("Przeplyw_PNB1_m3", cur_row.get("flow_pnb1_m3", 22.0)))
            flow_pnb1_next = float(next_row.get("Przeplyw_PNB1_m3", next_row.get("flow_pnb1_m3", 22.0)))
            flow_pnb1 = (1.0 - alpha) * flow_pnb1_cur + alpha * flow_pnb1_next

            energy_cur = float(cur_row.get("Energia_Calkowita_kWh", cur_row.get("energy_kwh", 10.0)))
            energy_next = float(next_row.get("Energia_Calkowita_kWh", next_row.get("energy_kwh", 10.0)))
            energy_kwh = (1.0 - alpha) * energy_cur + alpha * energy_next

            if "rain_mm_h" in cur_row:
                rain_cur = float(cur_row["rain_mm_h"])
                rain_next = float(next_row.get("rain_mm_h", rain_cur))
                rain_val = (1.0 - alpha) * rain_cur + alpha * rain_next
            else:
                excess_inflow = max(0.0, flow_pz1 - 65.0)
                rain_val = min(195.0, round(excess_inflow / 3.0, 1))
        else:
            sim_time_str = self.current_sim_dt.strftime("%Y-%m-%d %H:%M:%S")
            flow_pz1 = 58.0
            flow_pnb1 = 22.0
            energy_kwh = 10.0
            rain_val = 0.0

        # Step hydraulic engine with simulated timestep dt_sim
        dt_real = 1.0 / SIMULATION_TICK_HZ
        sim_sec_per_real = self.get_sim_seconds_per_real_second()
        dt_sim = (sim_sec_per_real * dt_real) if not self.is_paused else 0.0

        tanks, pumps, valves, pipes, _ = hydraulic_engine.step(
            dt_seconds=dt_sim,
            rain_mm_h=rain_val,
            actual_pz1_inflow=flow_pz1,
            actual_pnb1_inflow=flow_pnb1,
            actual_energy_kwh=energy_kwh
        )

        r1: TankState = tanks["R1"]
        if r1.status != "CRITICAL":
            self.critical_alarm_suppressed = False

        # Alert debouncing: prevent duplicate critical alarms in short succession
        if r1.status == "CRITICAL" and not self.active_blocking_alarm and not self.critical_alarm_suppressed:
            # Check if an unacknowledged critical alarm already exists for PZ-1
            has_unack = any(
                inc.station == "PZ-1 (Zamysłów)" and inc.severity == "CRITICAL" and not inc.acknowledged
                for inc in self.incidents
            )
            now_real = datetime.datetime.now()
            is_cooldown = (self.last_alarm_real_time is not None and (now_real - self.last_alarm_real_time).total_seconds() < 45.0)

            if not has_unack and not is_cooldown:
                is_overflow = (r1.pct_full >= 99.0)
                if is_overflow:
                    alarm_title = "ALARM KRYTYCZNY: Przelew w Zbiorniku ZR 311.4 m³"
                    alarm_desc = f"Zbiornik retencyjny ZR osiągnął 100% pojemności (PRZELEW). Dopływ burzowy {r1.inflow_m3_h} m³/h przekracza wydajność tłoczenia pomp. Wymagane natychmiastowe uruchomienie procedury awaryjnej (otwarcie zasuwy Z_PZ1 i załączenie obu pomp)."
                else:
                    ttc_disp = f"{r1.ttc_minutes} min" if (r1.ttc_minutes and r1.ttc_minutes > 0) else "< 7 min"
                    alarm_title = f"ALARM KRYTYCZNY: Spiętrzenie w Zbiorniku ZR (TTC {ttc_disp})"
                    alarm_desc = f"Dopływ burzowy {r1.inflow_m3_h} m³/h. Szacowany czas do przelania retencji ZR 311.4 m³ TTC = {ttc_disp}. Wymagane załączenie pomp i zrzut retencyjny."

                crit_alarm = IncidentRecord(
                    id=str(uuid.uuid4())[:8],
                    timestamp=sim_time_str,
                    severity="CRITICAL",
                    station="PZ-1 (Zamysłów)",
                    title=alarm_title,
                    description=alarm_desc,
                    requires_ack=True,
                    acknowledged=False,
                )
                self.active_blocking_alarm = crit_alarm
                self.incidents.insert(0, crit_alarm)
                self.last_alarm_real_time = now_real

        rain_status = "DRY"
        if rain_val > 100.0:
            rain_status = "EXTREME"
        elif rain_val > 40.0:
            rain_status = "HEAVY"
        elif rain_val > 10.0:
            rain_status = "MODERATE"
        elif rain_val > 0.5:
            rain_status = "LIGHT"

        # Deduplicate active alarms by (station, title) so UI never shows duplicated alerts
        seen_keys = set()
        active_alarms = []
        for inc in self.incidents:
            if inc.severity in ["WARNING", "CRITICAL"]:
                key = (inc.station, inc.title)
                if key not in seen_keys:
                    seen_keys.add(key)
                    active_alarms.append(inc)
            if len(active_alarms) >= 5:
                break
        progress_pct = round((self.current_fractional_idx / max(1, self.max_steps)) * 100.0, 1)

        return TelemetrySnapshot(
            timestamp=datetime.datetime.now().isoformat(),
            sim_time=sim_time_str,
            rain_mm_h=round(rain_val, 2),
            rain_status=rain_status,
            mode=hydraulic_engine.mode,
            is_paused=self.is_paused,
            speed_factor=self.speed_factor,
            tanks=tanks,
            pumps=pumps,
            valves=valves,
            pipes=pipes,
            active_alarms=active_alarms,
            active_blocking_alarm=self.active_blocking_alarm,
            total_inflow_m3_h=round(flow_pz1 + flow_pnb1, 1),
            total_outflow_m3_h=r1.outflow_m3_h,
            diverted_to_buffer_m3=round(hydraulic_engine.total_diverted_to_buffer_m3, 1),
            cost_accumulated_pln=round(hydraulic_engine.cost_accumulated_pln, 2),
            dataset_id=self.active_dataset_id,
            dataset_name=self.active_dataset_name,
            timeline_index=int(self.current_fractional_idx),
            timeline_total=self.max_steps,
            timeline_progress_pct=progress_pct,
            measured_flow_pz1_m3_h=round(flow_pz1, 1),
            measured_flow_pnb1_m3_h=round(flow_pnb1, 1),
            measured_energy_kwh=round(energy_kwh, 2),
        )

    def handle_control(self, req: SimulationControlRequest) -> Dict:
        if req.action == "play":
            self.is_paused = False
        elif req.action == "pause":
            self.is_paused = True
        elif req.action == "set_speed" and req.speed:
            self.speed_factor = max(0.5, min(60.0, req.speed))
        elif req.action == "seek_timeline" and req.timeline_index is not None:
            idx = max(0, min(self.max_steps - 1, req.timeline_index))
            self.current_fractional_idx = float(idx)
            self.current_step_idx = idx
            try:
                self.current_sim_dt = pd.to_datetime(self.timeline_data.iloc[idx]["Data"])
            except Exception:
                pass
        elif req.action == "set_dataset" and req.dataset_id:
            self.set_dataset(req.dataset_id)
        elif req.action == "jump_to_event" and req.disaster_type:
            self.jump_to_event(req.disaster_type)
        elif req.action == "set_mode" and req.mode:
            self.mode = req.mode
            hydraulic_engine.mode = req.mode
            self.incidents.insert(0, IncidentRecord(
                id=str(uuid.uuid4())[:8],
                timestamp=self.current_sim_dt.strftime("%Y-%m-%d %H:%M:%S"),
                severity="INFO",
                station="SCADA",
                title=f"Przełączenie trybu na {req.mode}",
                description=f"Operator {req.operator} zmienił nadrzędny tryb sterowania na {req.mode}.",
            ))
        elif req.action in ["acknowledge_alarm", "dismiss_alarm", "execute_emergency"]:
            if req.action == "execute_emergency":
                hydraulic_engine.valves["Z_PZ1"] = 100.0
                hydraulic_engine.set_pump("P1_PZ1", "start")
                hydraulic_engine.set_pump("P2_PZ1", "start")
                self.incidents.insert(0, IncidentRecord(
                    id=str(uuid.uuid4())[:8],
                    timestamp=self.current_sim_dt.strftime("%Y-%m-%d %H:%M:%S"),
                    severity="WARNING",
                    station="PZ-1 (Zamysłów)",
                    title="Procedura Awaryjna Wykonana",
                    description=f"Dyspozytor {req.operator} uruchomił zrzut awaryjny: Otwarto zasuwę Z_PZ1 na 100% i załączono obie pompy P1 oraz P2.",
                ))
            if self.active_blocking_alarm:
                self.active_blocking_alarm.acknowledged = True
                self.active_blocking_alarm.acknowledged_at = datetime.datetime.now().strftime("%H:%M:%S")
                self.active_blocking_alarm.acknowledged_by = req.operator or "Dyspozytor Główny"
            self.active_blocking_alarm = None
            self.critical_alarm_suppressed = True
            self.incidents.insert(0, IncidentRecord(
                id=str(uuid.uuid4())[:8],
                timestamp=self.current_sim_dt.strftime("%Y-%m-%d %H:%M:%S"),
                severity="INFO",
                station="SCADA",
                title="Alarm Skwitowany (ACK)",
                description=f"Dyspozytor {req.operator} potwierdził przyjęcie alarmu krytycznego.",
            ))
        elif req.action == "inject_disaster":
            dtype = req.disaster_type
            if dtype == "rain_150":
                self.jump_to_event("rain_150")
                self.incidents.insert(0, IncidentRecord(
                    id=str(uuid.uuid4())[:8],
                    timestamp=self.current_sim_dt.strftime("%Y-%m-%d %H:%M:%S"),
                    severity="WARNING",
                    station="Meteo Radar",
                    title="Symulacja: Skok nawałnicy burzowej",
                    description="Zainicjowano symulację ekstremalnego opadu nawalnego.",
                ))
            elif dtype == "pump_trip_p1":
                self.critical_alarm_suppressed = False
                hydraulic_engine.set_pump("P1_PZ1", "trip")
                trip_incident = IncidentRecord(
                    id=str(uuid.uuid4())[:8],
                    timestamp=self.current_sim_dt.strftime("%Y-%m-%d %H:%M:%S"),
                    severity="CRITICAL",
                    station="PZ-1 (Zamysłów)",
                    title="Awaria Zasilania Pompy P1 (21 kW)",
                    description="Zabezpieczenie termiczne wybiło pompę P1 na stacji PZ-1. Spadek wydajności tłoczenia o 60 m³/h!",
                    requires_ack=True,
                    acknowledged=False,
                )
                self.active_blocking_alarm = trip_incident
                self.incidents.insert(0, trip_incident)
            elif dtype == "reset_all":
                hydraulic_engine.pz1_vol = 95.0
                hydraulic_engine.pnb1_vol = 14.5
                hydraulic_engine.valves["Z_PZ1"] = 100.0
                hydraulic_engine.valves["Z_PNB1"] = 100.0
                hydraulic_engine.set_pump("P1_PZ1", "start")
                hydraulic_engine.set_pump("P2_PZ1", "stop")
                self.current_fractional_idx = 0.0
                self.current_step_idx = 0
                self.current_sim_dt = self._parse_initial_dt()
                self.active_blocking_alarm = None
                self.critical_alarm_suppressed = False
                self.incidents.insert(0, IncidentRecord(
                    id=str(uuid.uuid4())[:8],
                    timestamp=self.current_sim_dt.strftime("%Y-%m-%d %H:%M:%S"),
                    severity="INFO",
                    station="SCADA",
                    title="Reset stanu hydraulicznego",
                    description="Przywrócono nominalne parametry sieci PWiK Rybnik i wyczyszczono błędy.",
                ))

        return {"status": "ok", "mode": self.mode, "paused": self.is_paused}

    async def run_loop(self):
        """Continuous simulation broadcast loop"""
        dt_real = 1.0 / SIMULATION_TICK_HZ
        while True:
            try:
                if not self.is_paused and not self.timeline_data.empty:
                    sim_sec_per_real = self.get_sim_seconds_per_real_second()
                    dt_sim = sim_sec_per_real * dt_real
                    
                    # Advance smooth datetime
                    self.current_sim_dt += datetime.timedelta(seconds=dt_sim)
                    
                    # Advance fractional index in dataset (each index is 3600 seconds = 1 hour)
                    self.current_fractional_idx = (self.current_fractional_idx + (dt_sim / 3600.0)) % self.max_steps
                    self.current_step_idx = int(self.current_fractional_idx)
                
                snapshot = self.get_snapshot()
                payload = snapshot.model_dump()

                # Broadcast to all connected clients
                if self.active_connections:
                    dead_sockets = set()
                    for ws in list(self.active_connections):
                        try:
                            await ws.send_json(payload)
                        except Exception:
                            dead_sockets.add(ws)
                    self.active_connections.difference_update(dead_sockets)

            except Exception as e:
                print(f"[Simulator Loop] Error: {e}")

            await asyncio.sleep(dt_real)

simulator = Simulator()
