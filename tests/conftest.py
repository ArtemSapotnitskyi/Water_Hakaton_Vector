import sys
import os
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Ensure backend directory is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from main import app
from etl_service import etl_service
from hydraulic_engine import hydraulic_engine
from simulator import simulator

@pytest.fixture(scope="session")
def client():
    """FastAPI test client instance for E2E HTTP requests."""
    return TestClient(app)

@pytest.fixture(scope="session")
def sample_scada_tab_content():
    """Returns valid tab-delimited SCADA bytes with UTF-8 BOM."""
    lines = [
        "\ufeffQ1sr_PZ1.2\t2024-05-01 00:00:00\t10000.0\tWartość z pomiaru",
        "Q1sr_PZ1.2\t2024-05-01 01:00:00\t10045.0\tWartość z pomiaru",
        "Q1sr_PZ1.2\t2024-05-01 02:00:00\t10075.0\tWartość z pomiaru",
        "Q1sr_PZ1.2\t2024-05-01 03:00:00\t10095.0\tWartość z pomiaru",
        "Q1sr_PZ1.2\t2024-05-01 04:00:00\t10120.0\tWartość z pomiaru",
        "Q1sr_PZ1.2\t2024-05-01 05:00:00\t10165.0\tWartość z pomiaru",
        "Q1sr_PZ1.2\t2024-05-01 06:00:00\t10230.0\tWartość z pomiaru",
        "Q1sr_PZ1.2\t2024-05-01 07:00:00\t10310.0\tWartość z pomiaru",
    ]
    return "\n".join(lines).encode("utf-8")

@pytest.fixture(scope="session")
def sample_tauron_csv_content():
    """Returns semicolon-delimited Tauron hourly energy CSV bytes."""
    header = "Nr platnika;Nr punktu poboru energii;Rodzaj energii;Data i godzina;Strefa;Wartosc[kWh/kvar];Kompletnosc[%]"
    rows = [
        header,
        "12345;590322401100107920;Energia czynna pobrana;2024-05-01 00:00:00;Calodobowa;14,50;100",
        "12345;590322401100107920;Energia czynna pobrana;2024-05-01 01:00:00;Calodobowa;12,20;100",
        "12345;590322401100107920;Energia czynna pobrana;2024-05-01 02:00:00;Calodobowa;11,10;100",
        "12345;590322401100107920;Energia czynna pobrana;2024-05-01 03:00:00;Calodobowa;10,80;100",
        "12345;590322401100107920;Energia czynna pobrana;2024-05-01 04:00:00;Calodobowa;13,40;100",
        "12345;590322401100107920;Energia czynna pobrana;2024-05-01 05:00:00;Calodobowa;19,60;100",
    ]
    return "\n".join(rows).encode("latin1")

@pytest.fixture(scope="session")
def sample_corrupted_march_content():
    """Generates synthetic SCADA data showing 8-day freeze at 17 m³ followed by surge."""
    rows = []
    # 8 days frozen at 17.0 m3 with error codes
    for day in range(1, 9):
        for h in [0, 6, 12, 18]:
            rows.append(f"Q1sr_PZ1.2\t2024-03-{day:02d} {h:02d}:00:00\t17.0\tWartość nieznana Błąd obliczenia")
    # Subsequent runaway growth
    val = 17.0
    for day in range(9, 22):
        for h in [0, 6, 12, 18]:
            val += 250.0  # runaway increment
            rows.append(f"Q1sr_PZ1.2\t2024-03-{day:02d} {h:02d}:00:00\t{val:.1f}\tWartość z pomiaru")
    return "\n".join(rows).encode("utf-8")
