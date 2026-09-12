import os
import json
import joblib
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from activity_classifier.features import compute_features

router = APIRouter()

# Global cache for the model and mapping
_model = None
_label_mapping = None

class SensorReading(BaseModel):
    timestamp: float
    accel_x: float
    accel_y: float
    accel_z: float
    gyro_x: Optional[float] = 0.0
    gyro_y: Optional[float] = 0.0
    gyro_z: Optional[float] = 0.0

class ClassifyRequest(BaseModel):
    window_duration_sec: float
    readings: List[SensorReading]

class ClassifyResponse(BaseModel):
    activity: str
    busy: bool
    confidence: float

def get_model():
    global _model
    if _model is None:
        model_path = os.path.join(os.path.dirname(__file__), '..', 'activity_classifier', 'model', 'activity_rf.joblib')
        if not os.path.exists(model_path):
            raise RuntimeError("Model file not found. Train the model first.")
        _model = joblib.load(model_path)
    return _model

def get_label_mapping():
    global _label_mapping
    if _label_mapping is None:
        mapping_path = os.path.join(os.path.dirname(__file__), '..', 'activity_classifier', 'model', 'label_mapping.json')
        if not os.path.exists(mapping_path):
            raise RuntimeError("Label mapping file not found.")
        with open(mapping_path, 'r') as f:
            _label_mapping = json.load(f)
    return _label_mapping

@router.post("/classify-activity", response_model=ClassifyResponse)
def classify_activity(request: ClassifyRequest):
    if not request.readings:
        raise HTTPException(status_code=400, detail="No readings provided")
        
    # Convert readings to a numpy array (N, 6)
    # Ensure order matches training: accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z
    data = []
    for r in request.readings:
        data.append([r.accel_x, r.accel_y, r.accel_z, r.gyro_x, r.gyro_y, r.gyro_z])
    
    window_data = np.array(data)
    
    # Calculate approximate sample rate
    if len(request.readings) > 1:
        time_diff = request.readings[-1].timestamp - request.readings[0].timestamp
        # Convert timestamp to seconds if it's in ms
        if time_diff > 1000:
            time_diff = time_diff / 1000.0
            
        sample_rate = len(request.readings) / max(time_diff, 0.001)
    else:
        sample_rate = 50.0 # fallback default

    # Extract features
    try:
        features = compute_features(window_data, sample_rate=sample_rate)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Feature extraction failed: {str(e)}")

    if len(features) == 0:
        raise HTTPException(status_code=400, detail="Could not compute features from window")

    # Load model and mapping
    try:
        model = get_model()
        mapping = get_label_mapping()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Inference
    try:
        # Reshape for single prediction
        features_2d = features.reshape(1, -1)
        
        # Predict class index or label
        prediction = model.predict(features_2d)[0]
        
        # Predict probabilities to get confidence
        proba = model.predict_proba(features_2d)[0]
        confidence = float(np.max(proba))
        
        # Determine if busy based on mapping
        busy = mapping.get(str(prediction), "free") == "busy"
        
        return ClassifyResponse(
            activity=str(prediction),
            busy=busy,
            confidence=confidence
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")
