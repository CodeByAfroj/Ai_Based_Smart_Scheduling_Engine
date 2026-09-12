from fastapi.testclient import TestClient
from app.main import app
from unittest.mock import patch

client = TestClient(app)

@patch('app.activity.get_model')
@patch('app.activity.get_label_mapping')
def test_classify_activity(mock_get_mapping, mock_get_model):
    # Mock the label mapping
    mock_get_mapping.return_value = {
        "walking": "free",
        "driving": "busy"
    }
    
    # Mock the model
    class MockModel:
        def predict(self, features):
            return ["driving"]
        def predict_proba(self, features):
            return [[0.1, 0.9]]
            
    mock_get_model.return_value = MockModel()

    # Valid request
    payload = {
        "window_duration_sec": 2.5,
        "readings": [
            {"timestamp": 1000, "accel_x": 0.1, "accel_y": 0.2, "accel_z": 9.8, "gyro_x": 0.0, "gyro_y": 0.0, "gyro_z": 0.0},
            {"timestamp": 1020, "accel_x": 0.2, "accel_y": 0.3, "accel_z": 9.7, "gyro_x": 0.1, "gyro_y": 0.0, "gyro_z": 0.0}
        ]
    }
    
    response = client.post("/classify-activity", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert data["activity"] == "driving"
    assert data["busy"] is True
    assert data["confidence"] == 0.9

def test_classify_activity_empty():
    payload = {
        "window_duration_sec": 2.5,
        "readings": []
    }
    response = client.post("/classify-activity", json=payload)
    assert response.status_code == 422 # Pydantic validation might catch it, or 400
