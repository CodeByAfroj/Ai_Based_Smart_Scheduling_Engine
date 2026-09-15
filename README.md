# 🚀 TaskPulse - AI-Based Smart Scheduling & Recommendation Engine

TaskPulse is an autonomous, context-aware smart scheduling system that transforms simple task management into intelligent, time-blocked productivity schedules. It combines Google OR-Tools CP-SAT constraint programming, circadian rhythm biometrics, real-time activity sensors, zero-dataset multi-criteria task recommendations, and a context-aware Ollama LLM AI Assistant (`gemma4:31b`).

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

### 1. 🤖 Context-Aware Ollama LLM AI Assistant (`gemma4:31b`)
TaskPulse features a **Contextual Conversational Assistant** powered by your configured Ollama API endpoint (`OLLAMA_API_KEY`, `OLLAMA_MODEL=gemma4:31b`, `OLLAMA_BASE_URL`):
- **Full Context Injection**: Injects real-time IST wall clock time, user chronotype biometrics, and active pending/scheduled tasks.
- **Autonomous Task Creation**: Understands freeform conversational text & voice commands (*"Schedule a 45m deep work session tomorrow after lunch"*) and automatically creates the task with parsed IST ISO deadlines.
- **Contextual Schedule Q&A**: Answers natural queries (*"What should I focus on right now given my energy levels?"*, *"What's my heaviest day this week?"*).
- **Graceful Offline Fallback**: Features a fallback rule engine so system operations never fail even if network connectivity is lost.

---

### 2. ⚡ Zero-Dataset Personalized AI Task Recommendation Engine
Computes real-time **"Next Best Task"** suggestions using a **Deterministic Multi-Criteria Utility Model**:

$$\text{Task Score} = \text{Base Priority Score} + \text{Circadian Energy Alignment} + \text{Role Affinity} - \text{Fatigue Penalty}$$

- Evaluates Morning Lark / Night Owl chronotypes, wake/sleep biometrics, and focus duration limits.
- Matches high-cognition tasks (*Coding, Architecture*) to **Peak Focus Slots** and routine tasks (*Emails, Admin*) to **Post-Lunch Energy Dips**.

---

### 3. 🔒 Dual Task Creation Modes
- **🤖 AI Flexible Task**: Autonomous solver dynamically assigns non-overlapping time blocks before deadlines.
- **🔒 Fixed Event / Meeting**: Hard-locked to exact start times, protected from rescheduling.

---

### 4. ⏰ Strict IST Wall-Clock Standardization
- All datetimes across FastAPI, MongoDB Atlas BSON, and React UI are strictly normalized to **Asia/Kolkata (UTC+05:30)**.

---

### 5. 🌙 Dynamic Quiet / Sleep Hours
- All non-active hours outside core working window (`workEnd` to `workStart`) are automatically enforced as hard quiet/rest constraints in the CP-SAT solver.

---

### 6. 📱 Sensor-Based Real-Time Activity Detection
- Mobile motion sensor data (accelerometer + gyroscope) passed to browser ONNX runtime to classify user state (walking, sitting, driving) and trigger autonomous schedule updates (`/auto-shift`).

---

## 🛠 Tech Stack

- **Backend**: Python 3.13, FastAPI, Ollama LLM (`gemma4:31b`), OR-Tools (CP-SAT Solver), Motor / PyMongo, PyJWT, Pydantic.
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