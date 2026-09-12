# Adaptive Scheduling Engine

Phase 1 of a deterministic constraint-programming scheduler using Google OR-Tools CP-SAT.

## Requirements
- Python 3.10+
- `pip install -r backend/requirements.txt`

## Running the API Locally
1. Start the FastAPI server:
   ```bash
   cd backend
   fastapi dev app/main.py
   ```
2. The interactive Swagger UI will be available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

### Example cURL request:
```bash
curl -X POST "http://127.0.0.1:8000/schedule" -H "Content-Type: application/json" -d '{
  "reference_time": "2025-01-01T08:00:00",
  "tasks": [
    {
      "id": "task_1",
      "name": "Important Meeting",
      "duration_minutes": 60,
      "earliest_start": "2025-01-01T09:00:00",
      "deadline": "2025-01-01T12:00:00",
      "priority": 1,
      "fixed": false
    }
  ],
  "fixed_events": [],
  "working_hours": {
    "start_hour": 8,
    "end_hour": 22
  }
}'
```

## Benchmarks
This engine was validated against the Taillard Job-Shop Scheduling benchmark (ta01-ta05).
The integration adapts the scheduler to handle multiple resources and job precedence constraints to match the JSP formulation.
To run the benchmark script:
```bash
cd backend
python3 benchmark/benchmark.py
```

### Benchmark Results (5s time limit)
- `ta01`: Gap ~11.21%
- `ta02`: Gap ~13.26%
- `ta03`: Gap ~13.88%
- `ta04`: Gap ~17.53%
- `ta05`: Gap ~18.38%

## Tests
Run the unit tests via pytest:
```bash
cd backend
PYTHONPATH=. pytest tests/
```

## Phase 2: Activity Classifier

This project includes a machine learning pipeline to classify mobile device activities (walking, sitting, driving, etc.) from accelerometer and gyroscope data.

### Training the Model

1. Prepare your dataset in a CSV format (`dataset.csv`) with the following columns: `window_id`, `subject_id`, `activity`, `accel_x`, `accel_y`, `accel_z`, `gyro_x`, `gyro_y`, `gyro_z`.
2. Run the training script, pointing it to the directory containing your dataset:
   ```bash
   python backend/activity_classifier/train.py --data-dir /path/to/dataset/folder
   ```
3. The script will train a Random Forest model, perform cross-validation (respecting `subject_id` boundaries), and print out the accuracy, macro F1 score, and a confusion matrix.
4. The trained model will be saved to `backend/activity_classifier/model/activity_rf.joblib` for server-side inference, and `activity_rf.onnx` for client-side browser inference.

### Testing the Browser Demo

A device-agnostic HTML/JS demo is available to test the sensor classification locally.
1. Run the Vite development server in the `frontend` directory:
   ```bash
   cd frontend
   npm run dev
   ```
2. Navigate to `http://localhost:5173/activity_demo.html` in your browser.
3. If accessed from a mobile device, it will ask for sensor permissions and run ONNX inference locally. On a desktop, it will fallback to a manual toggle UI.
