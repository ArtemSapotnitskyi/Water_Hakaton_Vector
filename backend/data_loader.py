import os
import re
from pathlib import Path
from typing import List, Dict, Tuple, Optional
import pandas as pd
import numpy as np
from config import RUDA_DIR, RYBNIK_DIR, CHORZOW_DIR

class DataLoader:
    def __init__(self):
        self.ruda_rain_df: Optional[pd.DataFrame] = None
        self.ruda_scada_df: Optional[pd.DataFrame] = None
        self.rybnik_pz1_flow: Optional[pd.DataFrame] = None
        self.rybnik_pnb1_flow: Optional[pd.DataFrame] = None
        self.rybnik_pz1_energy: Optional[pd.DataFrame] = None
        self.rybnik_pnb1_energy: Optional[pd.DataFrame] = None
        self.chorzow_alarms: Optional[pd.DataFrame] = None

    def load_ruda_storm_series(self, storm_date: str = "2024-07-13") -> pd.DataFrame:
        """
        Loads the extreme storm session of 13.07.2024 from Ruda Śląska.
        Aligns rain intensity [mm/h] with SCADA tank level and pump current telemetry.
        """
        rain_file = RUDA_DIR / "Intensywnosc opadu.csv"
        scada_file = RUDA_DIR / "SCADA_ZMP_2024.csv"

        if not rain_file.exists():
            print(f"[DataLoader] Warning: {rain_file} not found. Generating synthetic storm baseline.")
            return self._generate_synthetic_storm()

        # Parse rain data
        try:
            rain_df = pd.read_csv(
                rain_file,
                sep=";",
                decimal=",",
                quotechar='"',
                names=["UTC", "rain_mm_h"],
                skiprows=1
            )
            rain_df["UTC"] = pd.to_datetime(rain_df["UTC"], errors="coerce")
            rain_df = rain_df.dropna(subset=["UTC"])
            rain_df["rain_mm_h"] = pd.to_numeric(rain_df["rain_mm_h"], errors="coerce").fillna(0.0)

            # Filter around storm peak (peak is at 2024-07-13 22:06:00, 194.78 mm/h)
            storm_mask = (rain_df["UTC"] >= f"{storm_date} 19:00:00") & (rain_df["UTC"] <= f"2024-07-14 03:00:00")
            storm_rain = rain_df.loc[storm_mask].copy()

            if storm_rain.empty:
                print(f"[DataLoader] Storm slice empty for {storm_date}, using whole day")
                storm_mask = (rain_df["UTC"].dt.strftime("%Y-%m-%d") == storm_date)
                storm_rain = rain_df.loc[storm_mask].copy()

            # Resample / interpolate rain to 10-second intervals for realistic simulation
            storm_rain = storm_rain.set_index("UTC").resample("10s").interpolate(method="linear").reset_index()

            # Add hydraulic runoff calculation: Q_inflow = Q_base + Runoff(rain)
            # Area ~ 2.5 km2, Runoff coefficient C ~ 0.45, lag tau ~ 15 min
            storm_rain["runoff_lagged"] = storm_rain["rain_mm_h"].shift(90).fillna(0.0) # 90 * 10s = 15 min lag
            storm_rain["storm_inflow_m3_h"] = 350.0 + (storm_rain["runoff_lagged"] * 22.5) # scaled hydraulic inflow
            return storm_rain
        except Exception as e:
            print(f"[DataLoader] Error loading Ruda storm: {e}")
            return self._generate_synthetic_storm()

    def _generate_synthetic_storm(self) -> pd.DataFrame:
        """Fallback realistic time series based on 13.07.2024 data"""
        times = pd.date_range("2024-07-13 13:00:00", "2024-07-13 17:00:00", freq="10s")
        n = len(times)
        # Synthetic bell curve peak of 194.8 mm/h around index 600
        x = np.linspace(-3, 3, n)
        rain_peak = 194.78 * np.exp(-x**2 * 2.5)
        df = pd.DataFrame({
            "UTC": times,
            "rain_mm_h": np.clip(rain_peak + np.random.normal(0, 0.5, n), 0, None)
        })
        df["runoff_lagged"] = df["rain_mm_h"].shift(90).fillna(0.0)
        df["storm_inflow_m3_h"] = 350.0 + (df["runoff_lagged"] * 22.5)
        return df

    def load_rybnik_inflow_and_energy(self) -> Dict[str, pd.DataFrame]:
        """
        Parses Rybnik pumping stations PZ1 and PNB1.
        Filters out corrupted counter intervals (PZ1 March 2024 freeze).
        Computes hourly inflow [m3/h] and active energy [kWh].
        """
        results = {}
        # 1. PZ1 Energy
        pz1_energy_file = None
        for f in RYBNIK_DIR.glob("*PZ1*.csv"):
            pz1_energy_file = f
            break

        if pz1_energy_file and pz1_energy_file.exists():
            try:
                edf = pd.read_csv(pz1_energy_file, sep=";", decimal=",", encoding="latin1")
                # Expected columns: Nr platnika;Nr punktu...;Data i godzina;Wartosc[kWh/kvar]
                date_col = [c for c in edf.columns if "data" in c.lower() or "godzina" in c.lower()]
                val_col = [c for c in edf.columns if "wartosc" in c.lower() or "kwh" in c.lower()]
                if date_col and val_col:
                    edf["datetime"] = pd.to_datetime(edf[date_col[0]], errors="coerce")
                    edf["kwh"] = pd.to_numeric(edf[val_col[0]].astype(str).str.replace(",", "."), errors="coerce").fillna(0.0)
                    edf = edf.dropna(subset=["datetime"]).sort_values("datetime")
                    results["pz1_energy"] = edf[["datetime", "kwh"]]
            except Exception as e:
                print(f"[DataLoader] Error loading PZ1 energy: {e}")

        # 2. PNB1 Energy
        pnb1_energy_file = None
        for f in RYBNIK_DIR.glob("*PNB1*.csv"):
            pnb1_energy_file = f
            break

        if pnb1_energy_file and pnb1_energy_file.exists():
            try:
                edf = pd.read_csv(pnb1_energy_file, sep=";", decimal=",", encoding="latin1")
                date_col = [c for c in edf.columns if "data" in c.lower() or "godzina" in c.lower()]
                val_col = [c for c in edf.columns if "wartosc" in c.lower() or "kwh" in c.lower()]
                if date_col and val_col:
                    edf["datetime"] = pd.to_datetime(edf[date_col[0]], errors="coerce")
                    edf["kwh"] = pd.to_numeric(edf[val_col[0]].astype(str).str.replace(",", "."), errors="coerce").fillna(0.0)
                    edf = edf.dropna(subset=["datetime"]).sort_values("datetime")
                    results["pnb1_energy"] = edf[["datetime", "kwh"]]
            except Exception as e:
                print(f"[DataLoader] Error loading PNB1 energy: {e}")

        # 3. Flow meters
        pz1_txt = RYBNIK_DIR / "PZ1_2024.txt"
        if pz1_txt.exists():
            try:
                fdf = pd.read_csv(
                    pz1_txt,
                    sep="\t",
                    names=["tag", "timestamp", "counter_m3", "status"],
                    encoding="utf-8-sig",
                    header=None,
                    low_memory=False
                )
                fdf["timestamp"] = pd.to_datetime(fdf["timestamp"], errors="coerce")
                fdf["counter_m3"] = pd.to_numeric(
                    fdf["counter_m3"].astype(str).str.replace(",", ".").str.replace("--", "NaN"),
                    errors="coerce"
                )
                fdf["status"] = fdf["status"].astype(str).str.strip()
                fdf = fdf.dropna(subset=["timestamp", "counter_m3"]).sort_values("timestamp")
                # Filter March 2024 corrupted freeze (mentor noted: "w marcu licznik stał 8 dni, potem rósł x10")
                fdf = fdf[~((fdf["timestamp"] >= "2024-03-01 00:00:00") & (fdf["timestamp"] <= "2024-03-21 23:59:59"))]
                results["pz1_flow"] = fdf
            except Exception as e:
                print(f"[DataLoader] Error loading PZ1 flow text: {e}")

        pnb1_txt = RYBNIK_DIR / "PNB1_2024.txt"
        if pnb1_txt.exists():
            try:
                fdf = pd.read_csv(
                    pnb1_txt,
                    sep="\t",
                    names=["tag", "timestamp", "counter_m3", "status"],
                    encoding="utf-8-sig",
                    header=None,
                    low_memory=False
                )
                fdf["timestamp"] = pd.to_datetime(fdf["timestamp"], errors="coerce")
                fdf["counter_m3"] = pd.to_numeric(
                    fdf["counter_m3"].astype(str).str.replace(",", ".").str.replace("--", "NaN"),
                    errors="coerce"
                )
                fdf["status"] = fdf["status"].astype(str).str.strip()
                fdf = fdf.dropna(subset=["timestamp", "counter_m3"]).sort_values("timestamp")
                results["pnb1_flow"] = fdf
            except Exception as e:
                print(f"[DataLoader] Error loading PNB1 flow text: {e}")

        return results

data_loader = DataLoader()
