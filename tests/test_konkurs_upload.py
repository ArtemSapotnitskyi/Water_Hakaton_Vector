import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_upload_all_konkurs_files_non_pdf():
    konkurs_dir = Path("Dane/Konkurs")
    assert konkurs_dir.exists(), "Dane/Konkurs must exist"

    files_to_upload = []
    for f in sorted(konkurs_dir.iterdir()):
        if f.suffix.lower() != ".pdf" and f.is_file():
            # (form_field_name, (filename, bytes, mime_type))
            mime = "text/csv" if f.suffix.lower() == ".csv" else ("text/plain" if f.suffix.lower() == ".txt" else "application/octet-stream")
            files_to_upload.append(("files", (f.name, f.read_bytes(), mime)))

    assert len(files_to_upload) == 7, f"Expected 7 non-PDF files in Konkurs, got {len(files_to_upload)}"

    response = client.post(
        "/api/benchmark/upload?clean_data=true&model_type=blended",
        files=files_to_upload
    )

    assert response.status_code == 200, f"Upload failed with status {response.status_code}: {response.text}"
    data = response.json()

    assert "total_measured_m3" in data
    assert data["total_measured_m3"] > 0
    assert "total_dwf_m3" in data
    assert "total_accidental_m3" in data
    assert "financial_cost_pln" in data
    assert "metadata" in data
    assert data["metadata"]["quality_score"] > 80
    assert len(data["jury_records"]) > 0
    assert len(data["hourly_trends"]) > 0
    assert data["station"].startswith("Zbiór Wieloplikowy")
