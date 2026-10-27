import asyncio
import datetime
import uuid
from typing import List, Dict, Optional, Set
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
        
        # Load storm dataset
        self.storm_data = data_loader.load_ruda_storm_series("2024-07-13")
        self.current_step_idx = 0
        self.max_steps = len(self.storm_data) if not self.storm_data.empty else 1000

        # Incidents / Alarms history
        self.incidents: List[IncidentRecord] = [
            IncidentRecord(
                id=str(uuid.uuid4())[:8],
                timestamp=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                severity="INFO",
                station="PWiK Rybnik",
                title="System SCADA uruchomiony",
                description="Zainicjalizowano cyfrowy bliźniak sieci PWiK Rybnik: Kolektor B, stacje PZ-1 (Zamysłów) i PNB-1 (Niewiadom) oraz Oczyszczalnia Orzepowice.",
                requires_ack=False,
                acknowledged=True,
            )
        ]
        self.active_blocking_alarm: Optional[IncidentRecord] = None
        self.critical_alarm_suppressed: bool = False

        # Connected WebSockets
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        # Immediately send current snapshot
        snapshot = self.get_snapshot()
        await websocket.send_json(snapshot.model_dump())

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    def get_snapshot(self) -> TelemetrySnapshot:
        # Get current rain and storm runoff row
        if not self.storm_data.empty:
            row = self.storm_data.iloc[self.current_step_idx % self.max_steps]
            rain_val = float(row.get("rain_mm_h", 0.0))
            sim_time_str = str(row.get("UTC", "2024-07-13 14:00:00"))
            storm_inflow = float(row.get("storm_inflow_m3_h", 350.0))
        else:
            rain_val = 0.0
            sim_time_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            storm_inflow = 350.0

        # Step hydraulic engine
        dt_sec = (1.0 / SIMULATION_TICK_HZ) * self.speed_factor if not self.is_paused else 0.0
        tanks, pumps, valves, pipes, _ = hydraulic_engine.step(
            dt_seconds=dt_sec,
            rain_mm_h=rain_val,
            external_storm_inflow=storm_inflow
        )

        # Check for emergency alarm trigger
        r1: TankState = tanks["R1"]
        if r1.status != "CRITICAL":
            self.critical_alarm_suppressed = False

        if r1.status == "CRITICAL" and not self.active_blocking_alarm and not self.critical_alarm_suppressed:
            crit_alarm = IncidentRecord(
                id=str(uuid.uuid4())[:8],
                timestamp=sim_time_str,
                severity="CRITICAL",
                station="PZ-1 (Zamysłów)",
                title="ALARM KRYTYCZNY: Spiętrzenie w Zbiorniku ZR (TTC < 7 min)",
                description=f"Dopływ burzowy {r1.inflow_m3_h} m³/h. Szacowany czas do przelania retencji ZR 311.4 m³ TTC = {r1.ttc_minutes} min. Wymagane uruchomienie pomp i otwarcie zasuwy wylotowej Z_PZ1.",
                requires_ack=True,
                acknowledged=False,
            )
            self.active_blocking_alarm = crit_alarm
            self.incidents.insert(0, crit_alarm)

        rain_status = "DRY"
        if rain_val > 100.0:
            rain_status = "EXTREME"
        elif rain_val > 40.0:
            rain_status = "HEAVY"
        elif rain_val > 10.0:
            rain_status = "MODERATE"
        elif rain_val > 0.5:
            rain_status = "LIGHT"

        active_alarms = [inc for inc in self.incidents if inc.severity in ["WARNING", "CRITICAL"]][:5]

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
            total_inflow_m3_h=r1.inflow_m3_h,
            total_outflow_m3_h=r1.outflow_m3_h,
            diverted_to_buffer_m3=round(hydraulic_engine.total_diverted_to_buffer_m3, 1),
            cost_accumulated_pln=round(hydraulic_engine.cost_accumulated_pln, 2),
        )

    def handle_control(self, req: SimulationControlRequest) -> Dict:
        if req.action == "play":
            self.is_paused = False
        elif req.action == "pause":
            self.is_paused = True
        elif req.action == "set_speed" and req.speed:
            self.speed_factor = max(0.5, min(20.0, req.speed))
        elif req.action == "set_mode" and req.mode:
            self.mode = req.mode
            hydraulic_engine.mode = req.mode
            self.incidents.insert(0, IncidentRecord(
                id=str(uuid.uuid4())[:8],
                timestamp=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
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
                    timestamp=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
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
                timestamp=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                severity="INFO",
                station="SCADA",
                title="Alarm Skwitowany (ACK)",
                description=f"Dyspozytor {req.operator} potwierdził przyjęcie alarmu krytycznego.",
            ))
        elif req.action == "inject_disaster":
            dtype = req.disaster_type
            if dtype == "rain_150":
                # Jump storm index to maximum peak of 13.07.2024
                # Find maximum rain row
                if not self.storm_data.empty:
                    max_idx = int(self.storm_data["rain_mm_h"].idxmax())
                    self.current_step_idx = max(0, max_idx - 10)
                self.incidents.insert(0, IncidentRecord(
                    id=str(uuid.uuid4())[:8],
                    timestamp=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    severity="WARNING",
                    station="Meteo Radar",
                    title="Symulacja: Skok nawałnicy burzowej",
                    description="Zainicjowano symulację ekstremalnego opadu nawalnego (szczyt 194.8 mm/h).",
                ))
            elif dtype == "pump_trip_p1":
                self.critical_alarm_suppressed = False
                hydraulic_engine.set_pump("P1_PZ1", "trip")
                trip_incident = IncidentRecord(
                    id=str(uuid.uuid4())[:8],
                    timestamp=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
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
                self.current_step_idx = 0
                self.active_blocking_alarm = None
                self.critical_alarm_suppressed = False
                self.incidents.insert(0, IncidentRecord(
                    id=str(uuid.uuid4())[:8],
                    timestamp=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    severity="INFO",
                    station="SCADA",
                    title="Reset stanu hydraulicznego",
                    description="Przywrócono nominalne parametry sieci PWiK Rybnik i wyczyszczono błędy.",
                ))

        return {"status": "ok", "mode": self.mode, "paused": self.is_paused}

    async def run_loop(self):
        """Continuous simulation broadcast loop"""
        while True:
            try:
                if not self.is_paused:
                    self.current_step_idx += 1
                
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

            await asyncio.sleep(1.0 / SIMULATION_TICK_HZ)

simulator = Simulator()
