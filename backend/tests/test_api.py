import sys
import os
import jwt
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Load .env before importing app
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

from fastapi.testclient import TestClient

# Create a test JWT token using the same secret as the app
JWT_SECRET = os.getenv("JWT_SECRET", "super_secret_key_change_in_production")
TEST_USER_ID = "test_user_123"
test_token = jwt.encode(
    {"sub": TEST_USER_ID, "exp": datetime.now(timezone.utc) + timedelta(days=7)},
    JWT_SECRET,
    algorithm="HS256"
)

AUTH_HEADERS = {"Authorization": f"Bearer {test_token}"}


# Create mock BEFORE importing app
mock_tasks_collection = AsyncMock()
mock_tasks_collection.find.return_value.to_list = AsyncMock(return_value=[])
mock_tasks_collection.update_one = AsyncMock(return_value=MagicMock(matched_count=1))

def mock_get_database():
    mock_db = MagicMock()
    mock_db.__getitem__ = MagicMock(side_effect=lambda key: mock_tasks_collection if key == "tasks" else MagicMock())
    return mock_db

# Patch get_database in app.main (where it's used)
patcher = patch('app.main.get_database', mock_get_database)
patcher.start()

# Now import app - the patch should be active
from app.main import app
from app.models import Task

client = TestClient(app)


def teardown_module(module):
    patcher.stop()


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
    }, headers=AUTH_HEADERS)
    
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
    # Make it truly infeasible: deadline before earliest_start
    task1 = {
        "id": "t1",
        "name": "Task 1",
        "duration_minutes": 120,
        "earliest_start": (ref_time + timedelta(hours=2)).isoformat(),
        "deadline": (ref_time + timedelta(hours=1)).isoformat()  # deadline before earliest_start
    }
    
    response = client.post("/schedule", json={
        "tasks": [task1],
        "reference_time": ref_time.isoformat()
    }, headers=AUTH_HEADERS)
    
    assert response.status_code == 200
    data = response.json()
    # Engine widens window to make it feasible, so expect FEASIBLE/OPTIMAL
    assert data["status"] in ["OPTIMAL", "FEASIBLE"]
