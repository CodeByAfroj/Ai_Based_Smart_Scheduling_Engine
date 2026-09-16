import os
import json
import numpy as np
import onnxruntime as ort
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

# Global cache for the model and mapping
_ort_session = None
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

def get_ort_session():
    global _ort_session
    if _ort_session is None:
        model_path = os.path.join(os.path.dirname(__file__), '..', 'activity_classifier', 'model', 'activity_dl.onnx')
        if not os.path.exists(model_path):
            raise RuntimeError(f"ONNX model file not found at {model_path}. Train the DL model first.")
        _ort_session = ort.InferenceSession(model_path)
    return _ort_session

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
        
    print(f"\n[Activity Tracker] Received {len(request.readings)} sensor events for a {request.window_duration_sec}s window.")
    
    # Convert readings to a numpy array (N, 6)
    data = []
    for r in request.readings:
        data.append([r.accel_x, r.accel_y, r.accel_z, r.gyro_x, r.gyro_y, r.gyro_z])
    
    window_data = np.array(data, dtype=np.float32)
    
    # The PyTorch 1D CNN expects shape (Batch, Channels, Length) -> (1, 6, 128)
    expected_length = 128
    if window_data.shape[0] > expected_length:
        window_data = window_data[:expected_length, :]
    elif window_data.shape[0] < expected_length:
        padding = np.zeros((expected_length - window_data.shape[0], 6), dtype=np.float32)
        window_data = np.vstack((window_data, padding))
    
    # Transpose from (128, 6) to (6, 128)
    # Transpose from (N, 6) to (6, N)
    window_data = np.transpose(window_data, (1, 0))
    # Add batch dimension
    input_tensor = np.expand_dims(window_data, axis=0)
    
    try:
        session = get_ort_session()
        mapping = get_label_mapping()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Inference using ONNX Runtime
    try:
        input_name = session.get_inputs()[0].name
        
        # Run inference
        outputs = session.run(None, {input_name: input_tensor})
        logits = outputs[0][0] # Shape: (num_classes,)
        
        # Convert logits to probabilities using softmax
        exp_logits = np.exp(logits - np.max(logits))
        probabilities = exp_logits / exp_logits.sum()
        
        pred_idx = np.argmax(probabilities)
        confidence = float(probabilities[pred_idx])
        
        prediction_label = mapping.get(str(pred_idx), "unknown")
        
        # Determine if busy based on label (e.g. walking, running -> busy, sitting -> free)
        # Assuming label names from standard UCI HAR
        busy_labels = ['walking', 'walking_upstairs', 'walking_downstairs']
        busy = prediction_label in busy_labels
        
        print(f" -> Predicted Activity: {prediction_label} (Idx: {pred_idx}) | Confidence: {confidence:.2f} | Busy: {busy}")
        
        return ClassifyResponse(
            activity=prediction_label,
            busy=busy,
            confidence=confidence
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")
