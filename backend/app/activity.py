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
    # Note: Web API gives accel in m/s^2 and gyro in deg/s. 
    # The UCI HAR model expects accel in 'g' and gyro in rad/s.
    import math
    data = []
    for r in request.readings:
        # Convert accel from m/s^2 to g
        ax = r.accel_x / 9.80665
        ay = r.accel_y / 9.80665
        az = r.accel_z / 9.80665
        # Convert gyro from deg/s to rad/s
        gx = r.gyro_x * (math.pi / 180.0)
        gy = r.gyro_y * (math.pi / 180.0)
        gz = r.gyro_z * (math.pi / 180.0)
        data.append([ax, ay, az, gx, gy, gz])
    
    window_data = np.array(data, dtype=np.float32)
    
    # --- Normalization ---
    # The UCI-HAR model was trained on pre-normalized signals. Apply per-channel
    # z-score normalization to bring the raw browser data into a similar range.
    mean = window_data.mean(axis=0, keepdims=True)
    std = window_data.std(axis=0, keepdims=True) + 1e-8  # avoid div-by-zero
    window_data = (window_data - mean) / std
    
    # The PyTorch 1D CNN expects shape (Batch, Channels, Length) -> (1, 6, 128)
    expected_length = 128
    if window_data.shape[0] > expected_length:
        window_data = window_data[:expected_length, :]
    elif window_data.shape[0] < expected_length:
        # Pad with the last observed value instead of zeros to avoid discontinuity
        last_val = window_data[-1, :]
        padding = np.tile(last_val, (expected_length - window_data.shape[0], 1)).astype(np.float32)
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
        
        # --- Uncertainty check: reject low-confidence or high-entropy predictions ---
        CONFIDENCE_THRESHOLD = 0.60
        # Entropy-based check: uniform dist = max entropy = log(n_classes)
        entropy = float(-np.sum(probabilities * np.log(probabilities + 1e-12)))
        max_entropy = float(np.log(len(probabilities)))
        is_uncertain = confidence < CONFIDENCE_THRESHOLD or (entropy / max_entropy) > 0.60
        
        if is_uncertain:
            print(f" -> Uncertain prediction (conf={confidence:.2f}, entropy_ratio={entropy/max_entropy:.2f}) — returning 'unknown'")
            return ClassifyResponse(activity='unknown', busy=False, confidence=confidence)
        
        prediction_label = mapping.get(str(pred_idx), "unknown")
        
        # Determine if busy based on label (e.g. walking, running -> busy, sitting -> free)
        # Assuming label names from standard UCI HAR
        busy_labels = ['walking', 'walking_upstairs', 'walking_downstairs']
        busy = prediction_label in busy_labels and confidence >= 0.85
        
        print(f" -> Predicted Activity: {prediction_label} (Idx: {pred_idx}) | Confidence: {confidence:.2f} | Busy: {busy}")
        
        return ClassifyResponse(
            activity=prediction_label,
            busy=busy,
            confidence=confidence
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")
