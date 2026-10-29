# TABELA STATUSÓW AWARII, ZDARZEŃ I FORMUL MATEMATYCZNYCH
**System SCADA & Predictive AI — PWiK Rybnik (Zlewnia PZ-1 i PNB-1)**
*Oficjalna dokumentacja dla Jury Hackathonu: Zasady detekcji, kryteria decyzyjne i aparatura pomiarowa*

---

## 1. Główne Formuły Inżynieryjne (Baza Obliczeń)

Każde zdarzenie w tabeli bilansowane jest w oparciu o normy hydrologiczne **ATV-A 118** oraz **PN-EN 752**:

### 1.1. Baza Sanitarna Ścieków Bytowych (DWF — Dry Weather Flow)
$$DWF(h, m) = Q_{dwf,nom} \cdot p_{dobowy}(h) \cdot f_{miesiąc}(m)$$
* Gdzie $p_{dobowy}(h)$ to znormalizowany profil dobowy (z doliną nocną w godzinach 02:00–04:00 i szczytami 07:00–09:00 oraz 19:00–21:00).
* $f_{miesiąc}(m)$ to współczynnik sezonowy (zgodny z danymi GUS i rozliczeniami zużycia wody pitnej).

### 1.2. Objętość Wód Przypadkowych (Infiltracyjnych i Deszczowych)
$$V_{przypadkowa} = \sum_{t=t_{start}}^{t_{end}} \max\Big(0,\; Q_{zmierzony}(t) - DWF(t)\Big) \cdot \Delta t \quad [\text{m}^3]$$
* Reprezentuje czysty wolumen wód obcych, które nie powinny znaleźć się w kanalizacji sanitarnej.

### 1.3. Nadmiarowa Energia Elektryczna
$$E_{nadmiar} = V_{przypadkowa} \cdot SEU \quad [\text{kWh}]$$
* **$SEU$ (Specific Energy Utility — wskaźnik jednostkowego zużycia energii):**
  * Dla pompowni **PZ-1**: $SEU = 0{,}08\text{ kWh/m}^3$
  * Dla pompowni **PNB-1**: $SEU = 0{,}31\text{ kWh/m}^3$
  * Wartość średnia referencyjna: $SEU = 0{,}24\text{ kWh/m}^3$

### 1.4. Koszt Finansowy Pompowania Wód Obcych (Kara Energetyczna)
$$\text{Koszt}_{\text{PLN}} = E_{nadmiar} \cdot T_{\text{energia}} = E_{nadmiar} \cdot 1{,}00\text{ PLN/kWh}$$
* Zgodnie z wytycznymi konkursowymi taryfa wynosi sztywno **1,00 PLN za 1 kWh**.

---

## 2. Macierz Kwalifikacji Statusów i Typów Awarii

Poniższa tabela przedstawia precyzyjne reguły decyzyjne, za pomocą których algorytm przypisuje status zdarzenia:

| Typ Zdarzenia / Anomalii | Status w Systemie | Warunek Matematyczny i Próg Detekcji | Źródło Walidacji Danych | Działanie Dyspozytora i Automatyki |
| :--- | :--- | :--- | :--- | :--- |
| **Ekstremalny opad nawalny** | `Zweryfikowane (Deszczomierz)` | $$\frac{Q_{szczyt}}{\overline{DWF}} \ge 5{,}0 \quad \text{lub} \quad Q_{szczyt} \ge 500\text{ m}^3/\text{h}$$ | Naziemny deszczomierz wagowy / stacja opadowa PWiK / IMGW | Pełne otwarcie zasuw do komory retencyjnej $1500\text{ m}^3$; kaskadowy start 3 pomp w punkcie BEP; monitoring wskaźnika TTC. |
| **Udar opadowy wód deszczowych** | `Zweryfikowane (Radar)` | $$3{,}8 \le \frac{Q_{szczyt}}{\overline{DWF}} < 5{,}0 \quad \text{oraz} \quad \Delta t \le 24\text{ h}$$ | Radar dopplerowski IMGW (stacja Ramża / Katowice) | Uruchomienie pompy szczytowej P2; przekierowanie nadmiaru do zbiornika buforowego R2. |
| **Długotrwała infiltracja wód gruntowych** | `Do inspekcji CCTV` | $$\Delta t \ge 12\text{ h} \quad \text{oraz} \quad \frac{Q_{szczyt}}{\overline{DWF}} < 4{,}0 \quad (V_{przyp} > 0)$$ | Brak opadu na deszczomierzu; podwyższone zwierciadło wód gruntowych | Wystawienie zlecenia dla wozu inspekcyjnego CCTV; monitoring kamerą DN400; bezwykopowe uszczelnienie rękawem CIPP. |
| **Umiarkowany napływ burzowy** | `W trakcie weryfikacji` | $$1{,}5 \le \frac{Q_{szczyt}}{\overline{DWF}} < 3{,}8 \quad \text{oraz} \quad \Delta t < 12\text{ h}$$ | Bilansowanie przepływów z kaskady stacji nadrzędnych (PZ-2, PZ-4) | Płynna regulacja prędkości obrotowej pomp falownikiem (VFD 45 Hz); dławienie napływu. |
| **Awaria pompy: Zablokowanie wirnika** | `Zlecono serwis mechaniczny` | $$SEU_{chwilowe} = \frac{E(t)}{Q(t)} > 0{,}8\text{ kWh/m}^3 \quad (E \ge 8\text{ kWh},\; Q \ge 2\text{ m}^3/\text{h})$$ | Telemetria prądowa SCADA ($I > 40\text{ A}$) vs przepływomierz | Automatyczne odstawienie pompy P1; przełączenie na pompę rezerwową P2; oczyszczenie wirnika ze splotów włóknin. |
| **Awaria klapy zwrotnej / praca na zasuwie** | `Zgłoszone do dyspozytorni` | $$Q(t) < 1{,}0\text{ m}^3/\text{h} \quad \text{oraz} \quad E(t) \ge 7{,}0\text{ kWh}$$ | Stycznik pracy pompy (`P1_RUN = 1`) przy braku rejestracji przepływu | Zdalny STOP pompy (ochrona przed przegrzaniem i kawitacją); inspekcja klapy zwrotnej na rurociągu tłocznym DN250. |
| **Awaria aparatury / Zamrożenie licznika** | `Zweryfikowane` | $$\Delta Q_{licznik} = 0 \text{ przez } > 6\text{ h (pompa ON) lub } \Delta Q > 5000\text{ m}^3/\text{h}$$ | Sprawdzanie spójności sumatora telemetrii SCADA | Automatyczne nałożenie maski rekonstrukcyjnej DWF; zdalny restart modułu transmisyjnego i rekalibracja. |

---

## 3. Szczegółowe Wyjaśnienie Statusów dla Jury

### 1. Status: `Zweryfikowane (Deszczomierz)`
* **Co oznacza:** Wystąpił gwałtowny opad deszczu, który spowodował co najmniej 5-krotne przekroczenie normy sanitarnej ($>500\%$). Zjawisko zostało potwierdzone fizycznym odczytem z lokalnego deszczomierza PWiK w Rybniku.
* **Dlaczego to kluczowe:** Wyklucza fałszywy alarm aparatury. Dyspozytor ma pewność, że woda w sieci to czysty spływ opadowy ze zlewni miejskiej.

### 2. Status: `Zweryfikowane (Radar)`
* **Co oznacza:** Wzrost napływu rzędu 3.8–5.0× DWF skorelowany z przejściem chmury burzowej zarejestrowanej przez radar meteorologiczny IMGW (stacja radarowa Ramża).
* **Dlaczego to kluczowe:** Wykrywa opady o charakterze pasmowym lub punktowym, które mogły ominąć naziemny punkt pomiarowy, ale zalały zlewnię.

### 3. Status: `Do inspekcji CCTV`
* **Co oznacza:** Woda dopływa do pompowni strumieniem o podwyższonym natężeniu przez ponad 12 godzin, mimo że deszcz już dawno ustał.
* **Dlaczego to kluczowe:** Jest to bezpośredni dowód nieszczelności rurociągu (pęknięcia kolektora, nieszczelne studnie, wysoki poziom wód gruntowych po roztopach). System sam generuje zadanie inspekcji telewizyjnej kamerą samojezdną.

### 4. Status: `W trakcie weryfikacji`
* **Co oznacza:** Zdarzenie o umiarkowanej skali ($1.5–3.8\times DWF$), w którym algorytm oczekuje na domknięcie bilansu hydraulicznego ze stacji dopływowych PZ-2 i PZ-4.

### 5. Status: `Zlecono serwis mechaniczny` / `Zgłoszone do dyspozytorni`
* **Co oznacza:** Detekcja czysto sprzętowa — silnik pompy pobiera prąd znamionowy lub wyższy, lecz wydatek hydrauliczny spada drastycznie ($SEU$ rośnie z $0{,}08$ do $>0{,}8\text{ kWh/m}^3$). Wskazuje na nawinięcie się ciał stałych (włókniny, chusteczki nawilżane) na wirnik pompy zatapialnej.

---

## 4. Przykładowa Karta Zdarzenia z Raportu (Jak czytać dane)

* **Data:** 2025-11-03 | **Przedział:** 01:00 - 21:00 (20 godzin)
* **Baza DWF:** $2275\text{ m}^3$ | **Zmierzony:** $6600{,}7\text{ m}^3$
* **Wody Przypadkowe:** $+3870{,}7\text{ m}^3$ ($6600{,}7 - 2275 = 3870{,}7$)
* **Nadmiar energii:** $309{,}7\text{ kWh}$ ($3870{,}7\text{ m}^3 \cdot 0{,}08\text{ kWh/m}^3 = 309{,}66\text{ kWh}$)
* **Koszt:** $309{,}66\text{ zł}$ ($309{,}66\text{ kWh} \cdot 1{,}00\text{ zł/kWh}$)
* **Status:** `Zweryfikowane (Radar)` $\to$ **Uzasadnienie:** Szczyt $4{,}5\times DWF$ ($485{,}1\text{ m}^3/\text{h}$ vs norma $108\text{ m}^3/\text{h}$).
