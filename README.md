# HydroPulse | SCADA Digital Twin & Water Anomaly Dashboard

Profesjonalny cyfrowy bliźniak i panel dyspozytorski dla przedsiębiorstwa wodociągowo-kanalizacyjnego (PWiK) stworzony na potrzeby hackathonu analizy danych z przepompowni ścieków.

---

## 🎯 Główne Moduły Systemu

1. **Cyfrowy Bliźniak (SCADA) – Zlewnia Oczyszczalni Barbara (Ruda Śląska):**
   * Dynamiczny model hydrauliczny bilansu masowego $dV/dt = Q_{in} - Q_{out}$.
   * Wskaźnik wczesnego ostrzegania **TTC** (*Time To Critical Overflow*).
   * Automatyczny i ręczny перерозподіл strumieni przez zasuwę **Z12** do zbiornika buforowego **R2 (8000 m³)**.
   * Odtworzenie historycznego rekordu nawałnicy z **13.07.2024 (szczyt 194.8 mm/h)**.
   * Diagnostyka pomp $P_1$ i $P_2$ oraz wstrzykiwanie awarii w czasie rzeczywistym.

2. **Analiza Infiltracji i Wód Przypadkowych (Rybnik PZ-1 / PNB-1):**
   * Wyznaczenie bazowego dobowego profilu ścieków bytowych (**DWF**).
   * Precyzyjny podział na ściek bytowy oraz **wody przypadkowe (m³)**.
   * Filtrowanie anomalii pomiarowych (zacięcie licznika PZ1 w marcu 2024).
   * **Oficjalna tabela oceny konkursowej dla Jury**: Dzień, przedział godzin, objętość wód obcych, nadmiar energii (kWh), koszty strat (PLN).
   * Eksport gotowego raportu do formatu CSV (`/api/export/jury-report`).

3. **Efektywność Energetyczna i Taryfy:**
   * Korelacja intensywności opadów ze skokami poboru energii elektrycznej.
   * Przelicznik kosztów na podstawie stałej stawki mentora: **1.00 PLN / kWh**.
   * Analiza stref taryfowych C12A (Szczyt vs Poza Szczytem).

4. **Dziennik Zdarzeń i Kwitowanie Alarmów (ACK):**
   * Pełny rejestr audytowy działań automatyki oraz manualnych dyspozycji operatora.
   * **Blokujące okno modalne potwierdzenia alarmu krytycznego**: wymóg przyjęcia procedury awaryjnej przy $TTC < 7$ min lub awarii zasilania pompy.

---

## 🚀 Szybki Start

### Jedno polecenie dla całości:
```bash
./start_all.sh
```
Aplikacja uruchomi się pod adresem: [http://localhost:5173](http://localhost:5173).

### Lub osobno:
* **Backend (FastAPI):**
  ```bash
  cd backend
  source venv/bin/activate
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
  ```
* **Frontend (React + Vite + Tailwind):**
  ```bash
  cd frontend
  npm run dev
  ```

---

## 🎨 Design System
Interfejs został zaprojektowany w stylu **Clean Corporate SaaS** (zainspirowany nowoczesnymi panelami dyspozytorskimi Linear/Margin):
* Zaokrąglone karty `rounded-3xl` na miękkim, jasnym tle `#eceff2`.
* Paski kolumnowe z diagonalnym paskowaniem (`stripe-green`, `stripe-blue`, `stripe-rose`).
* Intuicyjny boczny pasek nawigacji, przełącznik trybów `AUTO / MANUAL`, mnożniki prędkości symulacji `1x-10x` oraz wsparcie dla języka polskiego i angielskiego.
