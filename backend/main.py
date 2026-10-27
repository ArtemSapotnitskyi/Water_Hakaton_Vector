import io
import csv
from contextlib import asynccontextmanager
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, Response, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from typing import Optional

from schemas import (
    TelemetrySnapshot, SimulationControlRequest,
    ValveControlRequest, PumpControlRequest,
    InflowAnalysisResponse, EnergyAnalyticsResponse
)
from hydraulic_engine import hydraulic_engine
from simulator import simulator
from etl_service import etl_service

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
    allow_origins=["*"],
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
    station: str = Query("PZ1", enum=["PZ1", "PNB1", "ZMP"]),
    tariff: str = Query("C12A", enum=["C11", "C12A"])
):
    return etl_service.get_energy_analytics(station=station, tariff=tariff)

@app.get("/api/inflow-analysis", response_model=InflowAnalysisResponse)
def get_inflow_analysis(
    station: str = Query("PZ1", enum=["PZ1", "PNB1"]),
    sensitivity: float = Query(1.2, ge=1.0, le=2.0)
):
    return etl_service.get_inflow_analysis(station=station, sensitivity=sensitivity)

@app.get("/api/incidents")
def get_incidents():
    return simulator.incidents

@app.get("/api/export/jury-report")
def export_jury_report(station: str = "PZ1", sensitivity: float = 1.2):
    analysis = etl_service.get_inflow_analysis(station=station, sensitivity=sensitivity)
    
    # Generate CSV stream matching official jury format
    output = io.StringIO()
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
        media_type="text/csv"
    )
    response.headers["Content-Disposition"] = f"attachment; filename=raport_wody_przypadkowe_{station}.csv"
    return response

@app.post("/api/benchmark/evaluate", response_model=InflowAnalysisResponse)
def evaluate_benchmark(preset: str = Query("rybnik_2025_2026_test")):
    return etl_service.evaluate_uploaded_dataset(preset=preset)

@app.post("/api/benchmark/upload", response_model=InflowAnalysisResponse)
async def upload_benchmark(file: UploadFile = File(...)):
    content = await file.read()
    return etl_service.evaluate_uploaded_dataset(file_content=content, filename=file.filename)

@app.get("/api/benchmark/export")
def export_benchmark_report():
    if etl_service.last_benchmark_result is not None:
        analysis = etl_service.last_benchmark_result
    else:
        analysis = etl_service.evaluate_uploaded_dataset(preset="rybnik_2025_2026_test")

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow([
        "Data", "Przedział godzin", "Przepompownia", "Baza DWF [m3]",
        "Przepływ zmierzony [m3]", "Wody przypadkowe [m3]", "Nadmiarowa energia [kWh]",
        "Koszt strat [PLN] (1 zł/kWh)", "Kategoria anomalii", "Status weryfikacji",
        "Priorytet", "Element sieci", "Przyczyna źródłowa", "Zalecenie dyspozytorskie"
    ])
    for item in analysis.jury_records:
        writer.writerow([
            item.date, item.time_range, item.station, item.dwf_baseline_m3,
            item.measured_flow_m3, item.accidental_water_m3, item.excess_energy_kwh,
            item.financial_loss_pln, item.anomaly_type, item.status,
            getattr(item, "severity", "CRITICAL"),
            getattr(item, "equipment_affected", "System pomp i kolektorów"),
            getattr(item, "root_cause", "Udar hydrauliczny wód obcych"),
            getattr(item, "recommended_action", "Weryfikacja telemetrii i retencja")
        ])
    output.seek(0)
    response = StreamingResponse(iter([output.getvalue()]), media_type="text/csv")
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
