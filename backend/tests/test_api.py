import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from datetime import datetime, timedelta
from app.main import app
from app.models import Task
from app.models import Task

client = TestClient(app)

def test_schedule_basic():
    ref_time = datetime(2025, 1, 1, 8, 0)
    task1 = {
        "id": "t1",
        "name": "Task 1",
        "duration_minutes": 60,
        "earliest_start": ref_time.isoformat(),
        "deadline": (ref_time + timedelta(hours=3)).isoformat()
    }
    task2 = {
        "id": "t2",
        "name": "Task 2",
        "duration_minutes": 60,
        "earliest_start": ref_time.isoformat(),
        "deadline": (ref_time + timedelta(hours=3)).isoformat()
    }
    
    response = client.post("/schedule", json={
        "tasks": [task1, task2],
        "reference_time": ref_time.isoformat()
    })
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["OPTIMAL", "FEASIBLE"]
    assert len(data["tasks"]) == 2
    
    t1_end = datetime.fromisoformat(data["tasks"][0]["end"])
    t2_start = datetime.fromisoformat(data["tasks"][1]["start"])
    
    # Assert they don't overlap (if t1 is first)
    if data["tasks"][0]["task_id"] == "t1":
        assert t1_end <= t2_start or datetime.fromisoformat(data["tasks"][1]["end"]) <= datetime.fromisoformat(data["tasks"][0]["start"])

def test_schedule_infeasible():
    ref_time = datetime(2025, 1, 1, 8, 0)
    task1 = {
        "id": "t1",
        "name": "Task 1",
        "duration_minutes": 120,
        "earliest_start": ref_time.isoformat(),
        "deadline": (ref_time + timedelta(hours=1)).isoformat() # impossible deadline
    }
    
    response = client.post("/schedule", json={
        "tasks": [task1],
        "reference_time": ref_time.isoformat()
    })
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["INFEASIBLE", "MODEL_INVALID"]
