import io
import csv
from contextlib import asynccontextmanager
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, Response, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from typing import Optional, Literal, List

from schemas import (
    TelemetrySnapshot, SimulationControlRequest,
    ValveControlRequest, PumpControlRequest,
    EnergyAnalyticsResponse, DualModelComparisonResponse
)
from hydraulic_engine import hydraulic_engine
from simulator import simulator
from etl_service import etl_service, InflowAnalysisResponse, RawVsCleanedStats
from config import CORS_ORIGINS


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: spawn simulator background task
    task = asyncio.create_task(simulator.run_loop())
    yield
    # Shutdown
    task.cancel()

app = FastAPI(
    title="HydroPulse Water SCADA Digital Twin & Anomaly API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/status")
def get_status():
    return {
        "status": "online",
        "service": "HydroPulse Water SCADA Twin",
        "active_clients": len(simulator.active_connections),
        "mode": hydraulic_engine.mode,
        "paused": simulator.is_paused,
    }

@app.get("/api/telemetry/latest", response_model=TelemetrySnapshot)
def get_latest_telemetry():
    return simulator.get_snapshot()

@app.post("/api/simulation/control")
def control_simulation(req: SimulationControlRequest):
    return simulator.handle_control(req)

@app.post("/api/valves/set")
def set_valve(req: ValveControlRequest):
    hydraulic_engine.set_valve(req.valve_id, req.aperture_pct)
    return {"status": "ok", "valve_id": req.valve_id, "aperture_pct": req.aperture_pct}

@app.post("/api/pumps/set")
def set_pump(req: PumpControlRequest):
    hydraulic_engine.set_pump(req.pump_id, req.action)
    return {"status": "ok", "pump_id": req.pump_id, "action": req.action}

@app.get("/api/energy/analytics", response_model=EnergyAnalyticsResponse)
def get_energy_analytics(
    station: Literal["PZ1", "PNB1", "ZMP"] = Query("PZ1"),
    tariff: Literal["C11", "C12A"] = Query("C12A"),
    preset: Optional[str] = Query(None, description="Preset identifier or active benchmark dataset")
):
    return etl_service.get_energy_analytics(station=station, tariff=tariff, preset=preset)

@app.post("/api/energy/upload", response_model=EnergyAnalyticsResponse)
async def upload_energy_dataset(
    files: Optional[List[UploadFile]] = File(None),
    file: Optional[UploadFile] = File(None),
    station: Literal["PZ1", "PNB1", "ZMP"] = Query("PZ1"),
    tariff: Literal["C11", "C12A"] = Query("C12A"),
    clean_data: bool = Query(True)
):
    upload_list = []
    if files:
        upload_list.extend(files)
    if file:
        upload_list.append(file)
    if not upload_list:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Brak przesłanych plików.")

    file_tuples = []
    for f in upload_list:
        content = await f.read()
        fname = f.filename or "upload.csv"
        file_tuples.append((fname, content))

    etl_service.evaluate_uploaded_dataset(files=file_tuples, clean_data=clean_data, model_type="blended")
    return etl_service.get_energy_analytics(station=station, tariff=tariff)

@app.get("/api/inflow-analysis", response_model=InflowAnalysisResponse)
def get_inflow_analysis(
    station: Literal["PZ1", "PNB1"] = Query("PZ1"),
    preset: Optional[str] = Query(None, description="Preset identifier e.g. rybnik_2025_2026_test, pz1_historical, pnb1_historical"),
    sensitivity: float = Query(1.2, ge=1.0, le=2.0),
    clean_data: bool = Query(True, description="Enable automated SCADA sensor calibration masking"),
    model_type: Optional[Literal["statistical_dwf", "ml_ensemble", "blended"]] = Query("blended", description="Forecasting model to use")
):
    if preset:
        return etl_service.evaluate_uploaded_dataset(
            preset=preset,
            sensitivity=sensitivity,
            clean_data=clean_data,
            model_type=model_type or "blended"
        )
    return etl_service.get_inflow_analysis(
        station=station,
        sensitivity=sensitivity,
        clean_data=clean_data,
        model_type=model_type or "blended"
    )

@app.get("/api/models/compare", response_model=DualModelComparisonResponse)
def compare_models(
    station: Literal["PZ1", "PNB1"] = Query("PZ1"),
    sensitivity: float = Query(1.2, ge=1.0, le=2.0),
    clean_data: bool = Query(True, description="Enable automated SCADA sensor calibration masking")
):
    return etl_service.get_model_comparison(
        station=station,
        sensitivity=sensitivity,
        clean_data=clean_data
    )


@app.get("/api/incidents")
def get_incidents():
    return simulator.incidents

@app.get("/api/export/jury-report")
def export_jury_report(
    station: str = "PZ1",
    sensitivity: float = 1.2,
    clean_data: bool = Query(True, description="Enable automated SCADA sensor calibration masking")
):
    analysis = etl_service.get_inflow_analysis(station=station, sensitivity=sensitivity, clean_data=clean_data)
    
    # Generate CSV stream matching official jury format
    output = io.StringIO()
    output.write("\ufeff")
    writer = csv.writer(output, delimiter=";")
    writer.writerow([
        "Data",
        "Przedział godzin",
        "Przepompownia",
        "Baza DWF [m3]",
        "Przepływ zmierzony [m3]",
        "Wody przypadkowe [m3]",
        "Nadmiarowa energia [kWh]",
        "Koszt strat [PLN] (1 zł/kWh)",
        "Kategoria anomalii",
        "Status weryfikacji"
    ])

    for item in analysis.jury_records:
        writer.writerow([
            item.date,
            item.time_range,
            item.station,
            item.dwf_baseline_m3,
            item.measured_flow_m3,
            item.accidental_water_m3,
            item.excess_energy_kwh,
            item.financial_loss_pln,
            item.anomaly_type,
            item.status
        ])

    output.seek(0)
    response = StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8"
    )
    response.headers["Content-Disposition"] = f"attachment; filename=raport_wody_przypadkowe_{station}.csv"
    return response

@app.post("/api/benchmark/evaluate", response_model=InflowAnalysisResponse)
def evaluate_benchmark(
    preset: str = Query("rybnik_2025_2026_test"),
    clean_data: bool = Query(True, description="Enable automated SCADA sensor calibration masking"),
    model_type: Optional[Literal["statistical_dwf", "ml_ensemble", "blended"]] = Query("blended")
):
    return etl_service.evaluate_uploaded_dataset(
        preset=preset,
        clean_data=clean_data,
        model_type=model_type or "blended"
    )

@app.post("/api/benchmark/upload", response_model=InflowAnalysisResponse)
async def upload_benchmark(
    files: Optional[List[UploadFile]] = File(None),
    file: Optional[UploadFile] = File(None),
    clean_data: bool = Query(True, description="Enable automated SCADA sensor calibration masking"),
    model_type: Optional[Literal["statistical_dwf", "ml_ensemble", "blended"]] = Query("blended")
):
    upload_list = []
    if files:
        upload_list.extend(files)
    if file:
        upload_list.append(file)

    if not upload_list:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Brak przesłanych plików.")

    file_tuples = []
    for f in upload_list:
        content = await f.read()
        fname = f.filename or "upload.csv"
        if fname.lower().endswith((".exe", ".bin", ".dll", ".so")) or content.startswith(b"\x4D\x5A"):
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail=f"Nieobsługiwany format pliku: {fname}")
        file_tuples.append((fname, content))

    return etl_service.evaluate_uploaded_dataset(
        files=file_tuples,
        clean_data=clean_data,
        model_type=model_type or "blended"
    )



@app.get("/api/benchmark/export")
def export_benchmark_report():
    if etl_service.last_benchmark_result is not None:
        analysis = etl_service.last_benchmark_result
    else:
        analysis = etl_service.evaluate_uploaded_dataset(preset="rybnik_2025_2026_test")

    output = io.StringIO()
    output.write("\ufeff")
    writer = csv.writer(output, delimiter=";")
    writer.writerow([
        "Data", "Przedział godzin", "Przepompownia", "Baza DWF [m3]",
        "Przepływ zmierzony [m3]", "Wody przypadkowe [m3]", "Nadmiarowa energia [kWh]",
        "Koszt strat [PLN] (1 zł/kWh)", "Kategoria anomalii", "Status weryfikacji",
        "Priorytet", "Element sieci", "Przyczyna źródłowa", "Zalecenie dyspozytorskie"
    ])
    if len(analysis.jury_records) == 0:
        meas = getattr(analysis, "total_measured_m3", 0.0)
        dwf_tot = getattr(analysis, "total_dwf_m3", 0.0)
        acc_tot = getattr(analysis, "total_accidental_m3", 0.0)
        kwh_tot = getattr(analysis, "total_accidental_energy_kwh", 0.0)
        pln_tot = getattr(analysis, "financial_cost_pln", 0.0)
        d_date = "2024-01-01"
        if analysis.metadata and analysis.metadata.date_range:
            parts = analysis.metadata.date_range.split(" — ")
            if len(parts) > 0 and len(parts[0]) >= 10:
                d_date = parts[0][:10]
        writer.writerow([
            d_date, "00:00 - 23:00", analysis.station, dwf_tot,
            meas, acc_tot, kwh_tot, pln_tot,
            "Brak krytycznych uszkodzeń", "Zweryfikowane",
            "INFO", "System pomp i kolektorów",
            f"Przepływ w normie DWF (suma {meas:.1f} m3, nadmiar {acc_tot:.1f} m3 / {pln_tot:.2f} PLN) — stan stabilny",
            "Bieżący monitoring SCADA"
        ])
    else:
        for item in analysis.jury_records:
            rc = getattr(item, "root_cause", None)
            if not rc or str(rc).strip() == "" or rc == "Udar hydrauliczny wód obcych":
                pct_dwf = ((item.measured_flow_m3 - item.dwf_baseline_m3) / max(item.dwf_baseline_m3, 1.0)) * 100.0
                rc = (
                    f"Przepływ zmierzony {item.measured_flow_m3:.1f} m3 ({pct_dwf:+.1f}% DWF), "
                    f"nadmiar energii {item.excess_energy_kwh:.1f} kWh ({item.financial_loss_pln:.2f} PLN) — {item.anomaly_type}"
                )
            writer.writerow([
                item.date, item.time_range, item.station, item.dwf_baseline_m3,
                item.measured_flow_m3, item.accidental_water_m3, item.excess_energy_kwh,
                item.financial_loss_pln, item.anomaly_type, item.status,
                getattr(item, "severity", "CRITICAL"),
                getattr(item, "equipment_affected", "System pomp i kolektorów"),
                rc,
                getattr(item, "recommended_action", "Weryfikacja telemetrii i retencja")
            ])
    output.seek(0)
    response = StreamingResponse(iter([output.getvalue()]), media_type="text/csv; charset=utf-8")
    clean_name = "raport_jury_rybnik"
    if analysis.metadata and analysis.metadata.filename:
        clean_name = analysis.metadata.filename.replace(" ", "_").replace(".", "_")
    response.headers["Content-Disposition"] = f"attachment; filename=raport_jury_{clean_name}.csv"
    return response

@app.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    await simulator.connect(websocket)
    try:
        while True:
            # Client can send commands via WS as well
            data = await websocket.receive_json()
            if "action" in data:
                req = SimulationControlRequest(**data)
                simulator.handle_control(req)
    except WebSocketDisconnect:
        simulator.disconnect(websocket)
    except Exception:
        simulator.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
