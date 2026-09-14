# 🚀 TaskPulse - AI-Based Smart Scheduling & Recommendation Engine

TaskPulse is an autonomous, context-aware smart scheduling system that transforms simple task management into intelligent, time-blocked productivity schedules. It combines Google OR-Tools CP-SAT constraint programming, circadian rhythm biometrics, real-time activity sensors, and zero-dataset multi-criteria task recommendations.

---

## 🌟 Visual Showcase & Architecture

### 1. System Architecture & Context Loop
![System Architecture](frontend/public/1.jpeg)

### 2. Task Management & IST Timeline Scheduling
![Timeline & Task Management](frontend/public/2.jpeg)

### 3. CP-SAT Constraint Engine & Focus Windows
![CP-SAT Solver Model](frontend/public/3.jpeg)

### 4. Activity Classification & Motion Sensor Loop
![Activity Classifier Model](frontend/public/4.jpeg)

### 5. On-Device Sensor Inference Demo
![Sensor Demo](frontend/public/5.jpeg)

### 6. Benchmark Performance & Optimization Metrics
![Benchmark Results](frontend/public/6.jpeg)

---

## 💡 Key Features

### 1. 🤖 Zero-Dataset Personalized AI Recommendation Engine
Unlike heavy ML systems requiring external datasets, TaskPulse computes a real-time **Multi-Criteria Utility Score** using personal profile parameters:
- **Biometrics & Chronotype**: Morning Lark, Intermediate, Night Owl.
- **Circadian Rhythm**: Wake-up Time, Sleep Time, and Core Working Hours.
- **Role Affinity**: Role-specific task batching (Software Engineer, Product Manager, Executive).
- **Cognitive Match**: High focus tasks prioritized during peak energy windows; light admin tasks suggested during energy dips.

### 2. 🔒 Dual Task Modes
- **🤖 AI Flexible Task**: Autonomous solver dynamically assigns non-overlapping time blocks before deadlines.
- **🔒 Fixed Event / Meeting**: Hard-locked to exact start times, protected from rescheduling.

### 3. ⏰ IST Wall-Clock Time Standardization
- All datetimes across FastAPI, MongoDB Atlas BSON, and React UI are strictly normalized to **Asia/Kolkata (UTC+05:30)**.

### 4. 🌙 Dynamic Quiet / Sleep Hours
- All non-active hours outside core working window (`workEnd` to `workStart`) are automatically enforced as hard quiet/rest constraints in the CP-SAT solver.

### 5. 📱 Sensor-Based Real-Time Activity Detection
- Mobile motion sensor data (accelerometer + gyroscope) passed to browser ONNX runtime to classify user state (walking, sitting, driving) and trigger autonomous schedule updates (`/auto-shift`).

---

## 🛠 Tech Stack

- **Backend**: Python 3.13, FastAPI, OR-Tools (CP-SAT Solver), Motor / PyMongo, PyJWT, Pydantic.
- **Frontend**: React, Vite, Lucide Icons, Vanilla CSS Design System.
- **Machine Learning & Sensors**: ONNX Runtime Web, Random Forest Activity Classifier.

---

## 🚦 Getting Started

### 1. Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload   # Runs on http://127.0.0.1:8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev               # Runs on http://localhost:5173
```

Visit `http://localhost:5173` to access the application dashboard.