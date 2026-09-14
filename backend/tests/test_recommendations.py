import pytest
from fastapi.testclient import TestClient
from app.main import app

def test_recommendation_endpoint_structure():
    client = TestClient(app)
    # Testing unauthenticated response
    response = client.get("/recommendations/next-task")
    assert response.status_code == 401
