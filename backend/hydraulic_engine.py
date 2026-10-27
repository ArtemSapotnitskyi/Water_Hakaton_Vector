import math
from typing import Dict, List, Tuple, Optional
from config import (
    PZ1_ZR_MAX_VOLUME_M3, PZ1_MAX_LEVEL_M, PZ1_NOMINAL_FLOW_M3_H,
    PZ1_PUMP_POWER_KW, PZ1_NOMINAL_CURRENT_A,
    PNB1_ZR_MAX_VOLUME_M3, PNB1_MAX_LEVEL_M, PNB1_NOMINAL_FLOW_M3_H,
    PNB1_PUMP_POWER_KW, PNB1_NOMINAL_CURRENT_A,
    ORZEPOWICE_SAFE_INFLOW_M3_H, ELECTRICITY_TARIFF_PLN_KWH
)
from schemas import TankState, PumpState, ValveState, PipeState, IncidentRecord

class RybnikHydraulicEngine:
    def __init__(self):
        # Initial volumes in retention tanks (m3)
        self.pz1_vol = 95.0    # ~30% in ZR 311.4 m3
        self.pnb1_vol = 14.5   # ~30% in ZR 48.2 m3
        self.wwtp_intake = 720.0 # m3/h baseline flow to Orzepowice WWTP (out of 1145 m3/h safe limit)

        # Mode: AUTO or MANUAL
        self.mode = "AUTO"

        # Controllable Discharge Gates / Valves
        self.valves: Dict[str, float] = {
            "Z_PZ1": 100.0,   # PZ-1 discharge into Kolektor B (0 - 100%)
            "Z_PNB1": 100.0,  # PNB-1 discharge via ks 500 into Kolektor B
            "Z_RET_PZ1": 20.0 # Internal storm retention throttle (controls retention vs discharge)
        }

        # Pumps according to PWiK schematic
        # PZ-1: 2 x 21 kW, 42 A, nominal sum Q = 115 m3/h
        # PNB-1: 2 x 11 kW, 22 A, nominal sum Q = 47.5 m3/h (awaria 1 pompy 05.06.2024!)
        self.pumps: Dict[str, dict] = {
            "P1_PZ1": {"status": "RUNNING", "current": 41.5, "eff": 92.0, "nominal_q": 60.0, "tripped": False},
            "P2_PZ1": {"status": "STOPPED", "current": 0.0, "eff": 90.0, "nominal_q": 55.0, "tripped": False},
            "P1_PNB1": {"status": "RUNNING", "current": 21.0, "eff": 88.0, "nominal_q": 24.0, "tripped": False},
            "P2_PNB1": {"status": "STOPPED", "current": 0.0, "eff": 87.0, "nominal_q": 23.5, "tripped": False},
        }

        # Financial accumulator
        self.cost_accumulated_pln = 0.0
        self.total_retention_buffered_m3 = 0.0
        self.total_diverted_to_buffer_m3 = 0.0

    def step(self, dt_seconds: float, rain_mm_h: float, external_storm_inflow: Optional[float] = None) -> Tuple[Dict, Dict, Dict, Dict, List[IncidentRecord]]:
        """
        Calculates one timestep for PWiK Rybnik:
        PZ-1 (Zamysłów) & PNB-1 (Niewiadom) -> Kolektor B -> Oczyszczalnia Orzepowice.
        """
        new_alarms: List[IncidentRecord] = []

        # 1. Inflows: Dry weather diurnal flow + Storm Infiltration
        # PZ1 nominal dry flow is ~65 m3/h, spikes up to 250 m3/h in storms
        base_dry_pz1 = 58.0
        base_dry_pnb1 = 22.0

        if external_storm_inflow is not None:
            # Scaled for Rybnik PZ-1
            pz1_inflow = (external_storm_inflow / 350.0) * base_dry_pz1 + (rain_mm_h * 4.5)
        else:
            pz1_inflow = base_dry_pz1 + (rain_mm_h * 5.2)

        pnb1_inflow = base_dry_pnb1 + (rain_mm_h * 2.1)

        # 2. AUTO Mode Pump Automation
        # When PZ1 volume rises above 50% ZR (155 m3), automatically start Pump 2!
        pz1_pct_est = (self.pz1_vol / PZ1_ZR_MAX_VOLUME_M3) * 100.0
        pnb1_pct_est = (self.pnb1_vol / PNB1_ZR_MAX_VOLUME_M3) * 100.0

        p1_pz1 = self.pumps["P1_PZ1"]
        p2_pz1 = self.pumps["P2_PZ1"]
        p1_pnb1 = self.pumps["P1_PNB1"]
        p2_pnb1 = self.pumps["P2_PNB1"]

        if self.mode == "AUTO":
            # PZ-1 pump sequencing
            if (pz1_pct_est > 45.0 or pz1_inflow > 60.0) and not p2_pz1["tripped"]:
                p2_pz1["status"] = "RUNNING"
                p2_pz1["current"] = 42.0
            elif pz1_pct_est < 25.0 and pz1_inflow < 50.0 and not p2_pz1["tripped"]:
                p2_pz1["status"] = "STOPPED"
                p2_pz1["current"] = 0.0

            # PNB-1 pump sequencing
            if (pnb1_pct_est > 50.0 or pnb1_inflow > 25.0) and not p2_pnb1["tripped"]:
                p2_pnb1["status"] = "RUNNING"
                p2_pnb1["current"] = 21.5
            elif pnb1_pct_est < 30.0 and pnb1_inflow < 20.0 and not p2_pnb1["tripped"]:
                p2_pnb1["status"] = "STOPPED"
                p2_pnb1["current"] = 0.0

        # Calculate actual pumping discharge
        q_pump_pz1 = 0.0
        power_kw_pz1 = 0.0
        for pid in ["P1_PZ1", "P2_PZ1"]:
            p = self.pumps[pid]
            if p["status"] == "RUNNING":
                q_pump_pz1 += p["nominal_q"] * (p["eff"] / 100.0)
                power_kw_pz1 += PZ1_PUMP_POWER_KW

        q_pump_pnb1 = 0.0
        power_kw_pnb1 = 0.0
        for pid in ["P1_PNB1", "P2_PNB1"]:
            p = self.pumps[pid]
            if p["status"] == "RUNNING":
                q_pump_pnb1 += p["nominal_q"] * (p["eff"] / 100.0)
                power_kw_pnb1 += PNB1_PUMP_POWER_KW

        # 3. Throttle by gate valve to Kolektor B
        q_out_pz1 = q_pump_pz1 * (self.valves["Z_PZ1"] / 100.0)
        q_out_pnb1 = q_pump_pnb1 * (self.valves["Z_PNB1"] / 100.0)

        # 4. Mass Balance Step
        dt_hours = dt_seconds / 3600.0

        # PZ-1 Retention Reservoir: dV/dt = Inflow - Outflow
        dv_pz1 = (pz1_inflow - q_out_pz1) * dt_hours
        self.pz1_vol = min(PZ1_ZR_MAX_VOLUME_M3, max(15.0, self.pz1_vol + dv_pz1))

        # PNB-1 Retention Reservoir
        dv_pnb1 = (pnb1_inflow - q_out_pnb1) * dt_hours
        self.pnb1_vol = min(PNB1_ZR_MAX_VOLUME_M3, max(5.0, self.pnb1_vol + dv_pnb1))

        # Total inflow entering Kolektor B and Oczyszczalnia Orzepowice
        total_kolektor_b_flow = q_out_pz1 + q_out_pnb1 + 550.0  # base other gravity collectors
        self.wwtp_intake = total_kolektor_b_flow

        # Accumulate energy costs
        total_power_kw = power_kw_pz1 + power_kw_pnb1
        self.cost_accumulated_pln += (total_power_kw * dt_hours) * ELECTRICITY_TARIFF_PLN_KWH

        # 5. Calculate Status and TTC (Time-To-Critical)
        pz1_pct = (self.pz1_vol / PZ1_ZR_MAX_VOLUME_M3) * 100.0
        pnb1_pct = (self.pnb1_vol / PNB1_ZR_MAX_VOLUME_M3) * 100.0

        net_pz1 = pz1_inflow - q_out_pz1
        ttc_pz1 = 999.0
        if net_pz1 > 1.0:
            ttc_pz1 = ((PZ1_ZR_MAX_VOLUME_M3 - self.pz1_vol) / net_pz1) * 60.0

        status_pz1 = "SAFE"
        if ttc_pz1 < 7.0 or pz1_pct >= 90.0:
            status_pz1 = "CRITICAL"
        elif ttc_pz1 < 15.0 or pz1_pct >= 75.0:
            status_pz1 = "WARNING"

        net_pnb1 = pnb1_inflow - q_out_pnb1
        ttc_pnb1 = 999.0
        if net_pnb1 > 1.0:
            ttc_pnb1 = ((PNB1_ZR_MAX_VOLUME_M3 - self.pnb1_vol) / net_pnb1) * 60.0

        status_pnb1 = "SAFE"
        if ttc_pnb1 < 7.0 or pnb1_pct >= 90.0:
            status_pnb1 = "CRITICAL"
        elif ttc_pnb1 < 15.0 or pnb1_pct >= 75.0:
            status_pnb1 = "WARNING"

        tanks = {
            "R1": TankState(
                id="PZ1",
                name="Przepompownia PZ-1 (Zamysłów, ul. Pełczyńskiego)",
                volume_m3=round(self.pz1_vol, 1),
                max_volume_m3=PZ1_ZR_MAX_VOLUME_M3,
                level_m=round((self.pz1_vol / PZ1_ZR_MAX_VOLUME_M3) * PZ1_MAX_LEVEL_M, 2),
                max_level_m=PZ1_MAX_LEVEL_M,
                pct_full=round(pz1_pct, 1),
                status=status_pz1,
                ttc_minutes=round(ttc_pz1, 1) if ttc_pz1 < 900.0 else None,
                inflow_m3_h=round(pz1_inflow, 1),
                outflow_m3_h=round(q_out_pz1, 1),
            ),
            "R2": TankState(
                id="PNB1",
                name="Przepompownia PNB-1 (Niewiadom, ul. Nakłończyka)",
                volume_m3=round(self.pnb1_vol, 1),
                max_volume_m3=PNB1_ZR_MAX_VOLUME_M3,
                level_m=round((self.pnb1_vol / PNB1_ZR_MAX_VOLUME_M3) * PNB1_MAX_LEVEL_M, 2),
                max_level_m=PNB1_MAX_LEVEL_M,
                pct_full=round(pnb1_pct, 1),
                status=status_pnb1,
                ttc_minutes=round(ttc_pnb1, 1) if ttc_pnb1 < 900.0 else None,
                inflow_m3_h=round(pnb1_inflow, 1),
                outflow_m3_h=round(q_out_pnb1, 1),
            ),
            "R3": TankState(
                id="WWTP",
                name="Oczyszczalnia Ścieków Rybnik Orzepowice (ul. Rudzka)",
                volume_m3=round(self.wwtp_intake * 24.0, 0),
                max_volume_m3=27500.0,
                level_m=round((self.wwtp_intake / ORZEPOWICE_SAFE_INFLOW_M3_H) * 5.0, 2),
                max_level_m=5.0,
                pct_full=round((self.wwtp_intake / ORZEPOWICE_SAFE_INFLOW_M3_H) * 100.0, 1),
                status="SAFE" if self.wwtp_intake < 1000.0 else "WARNING",
                ttc_minutes=None,
                inflow_m3_h=round(self.wwtp_intake, 1),
                outflow_m3_h=round(self.wwtp_intake, 1),
            )
        }

        pumps_dict = {
            "P1_R1": PumpState(
                id="P1_PZ1",
                name="Pompa P1 (PZ-1, 21 kW)",
                station_id="PZ1",
                status=self.pumps["P1_PZ1"]["status"],
                current_A=round(self.pumps["P1_PZ1"]["current"], 1),
                flow_m3_h=round(self.pumps["P1_PZ1"]["nominal_q"] * (self.pumps["P1_PZ1"]["eff"] / 100.0) if self.pumps["P1_PZ1"]["status"] == "RUNNING" else 0.0, 1),
                efficiency_pct=round(self.pumps["P1_PZ1"]["eff"], 1),
                power_kw=PZ1_PUMP_POWER_KW if self.pumps["P1_PZ1"]["status"] == "RUNNING" else 0.0,
                vibration_mm_s=2.3 if self.pumps["P1_PZ1"]["status"] == "RUNNING" else 0.0,
            ),
            "P2_R1": PumpState(
                id="P2_PZ1",
                name="Pompa P2 (PZ-1, 21 kW)",
                station_id="PZ1",
                status=self.pumps["P2_PZ1"]["status"],
                current_A=round(self.pumps["P2_PZ1"]["current"], 1),
                flow_m3_h=round(self.pumps["P2_PZ1"]["nominal_q"] * (self.pumps["P2_PZ1"]["eff"] / 100.0) if self.pumps["P2_PZ1"]["status"] == "RUNNING" else 0.0, 1),
                efficiency_pct=round(self.pumps["P2_PZ1"]["eff"], 1),
                power_kw=PZ1_PUMP_POWER_KW if self.pumps["P2_PZ1"]["status"] == "RUNNING" else 0.0,
                vibration_mm_s=2.5 if self.pumps["P2_PZ1"]["status"] == "RUNNING" else 0.0,
            ),
            "P1_R3": PumpState(
                id="P1_PNB1",
                name="Pompa P1 (PNB-1, 11 kW)",
                station_id="PNB1",
                status=self.pumps["P1_PNB1"]["status"],
                current_A=round(self.pumps["P1_PNB1"]["current"], 1),
                flow_m3_h=round(self.pumps["P1_PNB1"]["nominal_q"] * (self.pumps["P1_PNB1"]["eff"] / 100.0) if self.pumps["P1_PNB1"]["status"] == "RUNNING" else 0.0, 1),
                efficiency_pct=round(self.pumps["P1_PNB1"]["eff"], 1),
                power_kw=PNB1_PUMP_POWER_KW if self.pumps["P1_PNB1"]["status"] == "RUNNING" else 0.0,
                vibration_mm_s=1.8 if self.pumps["P1_PNB1"]["status"] == "RUNNING" else 0.0,
            )
        }

        valves_dict = {
            "Z12": ValveState(
                id="Z_PZ1",
                name="Zasuwa Tłoczna PZ-1 -> Kolektor B",
                from_node="PZ1",
                to_node="Kolektor_B",
                aperture_pct=round(self.valves["Z_PZ1"], 1),
                flow_m3_h=round(q_out_pz1, 1),
                max_flow_m3_h=PZ1_NOMINAL_FLOW_M3_H,
                mode=self.mode,
            ),
            "Z13": ValveState(
                id="Z_PNB1",
                name="Zasuwa Tłoczna PNB-1 -> Kolektor B",
                from_node="PNB1",
                to_node="Kolektor_B",
                aperture_pct=round(self.valves["Z_PNB1"], 1),
                flow_m3_h=round(q_out_pnb1, 1),
                max_flow_m3_h=PNB1_NOMINAL_FLOW_M3_H,
                mode=self.mode,
            ),
            "Z24": ValveState(
                id="Z_RET",
                name="Zasuwa Retencji Zbiornikowej PZ-1",
                from_node="PZ1_ZR",
                to_node="PZ1_PUMPS",
                aperture_pct=round(self.valves["Z_RET_PZ1"], 1),
                flow_m3_h=round(q_out_pz1 * 0.4, 1),
                max_flow_m3_h=120.0,
                mode=self.mode,
            ),
        }

        pipes_dict = {
            "PIPE_PZ1_KOLB": PipeState(
                id="PIPE_PZ1_KOLB",
                from_node="PZ-1",
                to_node="Kolektor B",
                flow_m3_h=round(q_out_pz1, 1),
                capacity_m3_h=PZ1_NOMINAL_FLOW_M3_H,
                utilization_pct=round((q_out_pz1 / PZ1_NOMINAL_FLOW_M3_H) * 100.0, 1),
            ),
            "PIPE_PNB1_KOLB": PipeState(
                id="PIPE_PNB1_KOLB",
                from_node="PNB-1",
                to_node="Kolektor B",
                flow_m3_h=round(q_out_pnb1, 1),
                capacity_m3_h=PNB1_NOMINAL_FLOW_M3_H,
                utilization_pct=round((q_out_pnb1 / PNB1_NOMINAL_FLOW_M3_H) * 100.0, 1),
            ),
            "PIPE_KOLB_WWTP": PipeState(
                id="PIPE_KOLB_WWTP",
                from_node="Kolektor B",
                to_node="Oczyszczalnia Orzepowice",
                flow_m3_h=round(self.wwtp_intake, 1),
                capacity_m3_h=ORZEPOWICE_SAFE_INFLOW_M3_H,
                utilization_pct=round((self.wwtp_intake / ORZEPOWICE_SAFE_INFLOW_M3_H) * 100.0, 1),
            ),
        }

        return tanks, pumps_dict, valves_dict, pipes_dict, new_alarms

    def set_valve(self, valve_id: str, aperture_pct: float):
        if valve_id in self.valves:
            self.valves[valve_id] = max(0.0, min(100.0, aperture_pct))
        elif valve_id in ["Z12", "Z_PZ1"]:
            self.valves["Z_PZ1"] = max(0.0, min(100.0, aperture_pct))
        elif valve_id in ["Z13", "Z_PNB1"]:
            self.valves["Z_PNB1"] = max(0.0, min(100.0, aperture_pct))

    def set_pump(self, pump_id: str, action: str):
        target_id = "P1_PZ1" if pump_id in ["P1_PZ1", "P1_R1"] else ("P2_PZ1" if pump_id in ["P2_PZ1", "P2_R1"] else pump_id)
        if target_id in self.pumps:
            p = self.pumps[target_id]
            if action == "trip":
                p["status"] = "FAULT"
                p["tripped"] = True
                p["current"] = 0.0
            elif action == "start":
                p["status"] = "RUNNING"
                p["tripped"] = False
                p["current"] = 42.0
            elif action == "stop":
                p["status"] = "STOPPED"
                p["tripped"] = False
                p["current"] = 0.0

hydraulic_engine = RybnikHydraulicEngine()
