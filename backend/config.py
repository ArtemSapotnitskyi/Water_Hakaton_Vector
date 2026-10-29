import os
from pathlib import Path

try:
    from dotenv import load_dotenv
    # Load .env from workspace root first, then backend directory
    _backend_dir = Path(__file__).resolve().parent
    load_dotenv(_backend_dir.parent / ".env")
    load_dotenv(_backend_dir / ".env")
except ImportError:
    pass

# Paths
BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent

# Security & Secrets (Loaded via environment variables or .env)
SCADA_API_KEY = os.getenv("SCADA_API_KEY", "hydropulse-scada-rybnik-prod-key-2026-sec-9a4f8e")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "rybnik-water-twin-super-secret-jwt-token-2026-auth-81c2")
ENVIRONMENT = os.getenv("ENVIRONMENT", "production")
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))
CORS_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000"
    ).split(",")
    if o.strip()
]

# Configurable Data Directory
_env_data_dir = os.getenv("DATA_DIR")
if _env_data_dir and Path(_env_data_dir).exists():
    DATA_DIR = Path(_env_data_dir)
else:
    DATA_DIR = ROOT_DIR / "Dane"
    if not DATA_DIR.exists():
        fallback_candidates = [
            Path("/Users/user/Documents/WaterHakaton/Dane"),
            ROOT_DIR / "data",
        ]
        for fb in fallback_candidates:
            if fb.exists():
                DATA_DIR = fb
                break

RUDA_DIR = DATA_DIR / "Ruda Sląska"
if not RUDA_DIR.exists():
    for p in DATA_DIR.glob("*Ruda*"):
        RUDA_DIR = p
        break

RYBNIK_DIR = DATA_DIR / "Rybnik"
KONKURS_DIR = DATA_DIR / "Konkurs"
if not KONKURS_DIR.exists():
    for p in DATA_DIR.glob("*Konkurs*"):
        KONKURS_DIR = p
        break

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
ELECTRICITY_TARIFF_PLN_KWH = float(os.getenv("ELECTRICITY_TARIFF_PLN_KWH", "1.0"))
DENSITY_WATER = 1000.0  # kg/m3
GRAVITY = 9.81  # m/s2

# Specific Energy Consumption (SEU) [kWh/m3]
# Derived from PWiK Rybnik hydraulic telemetry & Tauron billing records
PZ1_SEU_KWH_M3 = float(os.getenv("PZ1_SEU_KWH_M3", "0.08"))       # Zamysłów PZ-1 (high flow Q=115 m3/h, large pumps)
PNB1_SEU_KWH_M3 = float(os.getenv("PNB1_SEU_KWH_M3", "0.31"))      # Niewiadom PNB-1 (smaller flow Q=47.5 m3/h, higher lift)
DEFAULT_SEU_KWH_M3 = float(os.getenv("DEFAULT_SEU_KWH_M3", "0.24"))   # Standard municipal wastewater network fallback

STATION_SEU_MAP = {
    "PZ1": PZ1_SEU_KWH_M3,
    "PNB1": PNB1_SEU_KWH_M3,
}

# PZ-1 March 2024 Calibration Anomaly Window
PZ1_ANOMALY_START = "2024-03-01 00:00:00"
PZ1_ANOMALY_END = "2024-03-21 23:59:59"

# PNB-1 05.06.2024 Single Pump Trip Window
PNB1_TRIP_DATE = "2024-06-05"
PNB1_TRIP_TIME_RANGE = "14:00 - 22:00"

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

# DWF Diurnal and Monthly Parameters
DWF_MONTH_FACTORS = {
    1: 1.00,  # Jan: Base winter heating / steady domestic
    2: 1.00,  # Feb: Normal winter
    3: 1.02,  # Mar: Early spring stabilization
    4: 0.98,  # Apr: Spring transition
    5: 1.03,  # May: Increased garden / residential activity
    6: 0.95,  # Jun: Early summer holiday departures
    7: 0.90,  # Jul: Summer vacation depopulation
    8: 0.75,  # Aug: Peak vacation drop (confirmed in Tauron billing: 706 kWh dip)
    9: 0.96,  # Sep: School resumption
    10: 1.01, # Oct: Autumn baseline
    11: 1.00, # Nov: Early winter
    12: 0.98, # Dec: Holiday shutdown
}

PZ1_NOMINAL_DWF_PROFILE = [
    32.0, 28.0, 25.0, 24.0, 27.0, 38.0, 62.0, 78.0, 75.0, 68.0, 65.0, 64.0,
    65.0, 67.0, 69.0, 71.0, 76.0, 82.0, 88.0, 85.0, 78.0, 68.0, 52.0, 40.0
]

PNB1_NOMINAL_DWF_PROFILE = [
    12.0, 10.0, 8.5, 8.0, 9.5, 14.0, 24.0, 30.0, 28.0, 25.0, 24.0, 23.0,
    24.0, 25.0, 26.0, 27.0, 29.0, 32.0, 34.0, 32.0, 28.0, 24.0, 18.0, 14.0
]

PZ1_MNF_NOMINAL_M3_H = 24.0
PNB1_MNF_NOMINAL_M3_H = 8.0

