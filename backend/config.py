import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
DATA_DIR = ROOT_DIR / "Dane"

if not DATA_DIR.exists():
    DATA_DIR = Path("/Users/user/Documents/WaterHakaton/Dane")

RUDA_DIR = DATA_DIR / "Ruda Sląska"
if not RUDA_DIR.exists():
    for p in DATA_DIR.glob("*Ruda*"):
        RUDA_DIR = p
        break

RYBNIK_DIR = DATA_DIR / "Rybnik"
CHORZOW_DIR = DATA_DIR / "Chorzów" / "Dane do konkursu"
if not CHORZOW_DIR.exists():
    for p in DATA_DIR.glob("*Chorz*"):
        cand = p / "Dane do konkursu"
        if cand.exists():
            CHORZOW_DIR = cand
            break

CACHE_DIR = BASE_DIR / "cache"
CACHE_DIR.mkdir(exist_ok=True)

# Business Constants (Official Hackathon Guidelines)
ELECTRICITY_TARIFF_PLN_KWH = 1.0  # Fixed 1 zł/kWh agreed by PWiK mentor
DENSITY_WATER = 1000.0  # kg/m3
GRAVITY = 9.81  # m/s2

# =========================================================================
# Official PWiK Rybnik Network Parameters (from Blok Schematic ul. Pod Lasem 62)
# =========================================================================

# Destination: Oczyszczalnia Ścieków Rybnik Orzepowice (ul. Rudzka)
ORZEPOWICE_MAX_CAPACITY_M3_DAY = 27500.0
ORZEPOWICE_SAFE_INFLOW_M3_H = 1145.8  # 27500 / 24

# Station PZ-1: Zamysłów, ul. Pełczyńskiego
PZ1_ZR_MAX_VOLUME_M3 = 311.40  # ZR = 311.40 m3
PZ1_MAX_LEVEL_M = 4.2
PZ1_NOMINAL_FLOW_M3_H = 115.0  # Q = 115.0 m3/h
PZ1_PUMP_POWER_KW = 21.0       # N = 2x21 kW
PZ1_NOMINAL_CURRENT_A = 42.0   # I = 42 A

# Station PNB-1: Niewiadom, ul. Nakłończyka
PNB1_ZR_MAX_VOLUME_M3 = 48.20  # ZR = 48.20 m3
PNB1_MAX_LEVEL_M = 3.0
PNB1_NOMINAL_FLOW_M3_H = 47.5  # Q = 47.5 m3/h
PNB1_PUMP_POWER_KW = 11.0
PNB1_NOMINAL_CURRENT_A = 22.0

# Upstream Feeder Stations in Cascade
PZ2_ZR_VOLUME_M3 = 124.35      # Zamysłów ul. Dolna: Q = 330 m3/h
PNB4_ZR_VOLUME_M3 = 345.40     # Niedobczyce ul. Górnośląska: Q = 390 m3/h

# WebSocket broadcast frequency (Hz)
SIMULATION_TICK_HZ = 2.0
