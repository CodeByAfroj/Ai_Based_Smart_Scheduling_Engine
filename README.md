# Adaptive Scheduling Engine with Activity Classification

## Problem
Users need a scheduling system that dynamically adapts to their real‑world context. Traditional static schedulers cannot react when a user becomes unexpectedly busy (e.g., impromptu meetings, travel). This leads to missed deadlines, inefficiency, and manual rescheduling overhead.

## Solution
We provide an **Adaptive Scheduling Engine** that combines:
1. **Constraint‑Programming Scheduler** (Google OR‑Tools CP‑SAT) to compute optimal task schedules given durations, time windows, priorities, and fixed events.
2. **Activity Classification** pipeline that runs on mobile devices, using accelerometer and gyroscope data to detect user activities (walking, sitting, driving, etc.) and infer a busy/free status.
3. **Feedback Loop**: When the classifier detects a busy state, the backend automatically inserts a temporary busy block and triggers a reschedule, pushing affected tasks forward while respecting constraints.

The system is split into:
- **Backend** (`backend/`): FastAPI server exposing scheduling and activity‑classification endpoints.
- **Frontend** (`frontend/`): React/Vite SPA for managing tasks and viewing schedules, plus a standalone sensor demo.
- **Public Assets** (`frontend/public/`): Images, demo page, and JavaScript files that illustrate the architecture and enable sensor‑based activity detection.

## Methods

### 1. Constraint‑Programming Scheduler
- **Model**: CP‑SAT model encodes each task as an interval variable with:
  - `duration_minutes`
  - `earliest_start` and `deadline` (time windows)
  - Optional `fixed` flag (pre‑assigned time)
  - `priority` (used for soft constraints or objective weighting)
- **Objective**: Minimize weighted sum of tardiness and maximize priority‑aligned scheduling; feasibility is prioritized.
- **Solver**: OR‑Tools CP‑SAT with a configurable time limit (default 5 s).
- **Output**: Assigned start/end times for each task and solver status (OPTIMAL, FEASIBLE, INFEASIBLE).

### 2. Activity Classification
- **Data**: Sliding windows of raw accelerometer (x, y, z) and gyroscope (x, y, z) signals.
- **Model**: Random Forest classifier trained on labeled sensor data.
- **Conversion**: Trained model exported to ONNX format for browser‑based inference via `onnxruntime-web`.
- **Inference**: Frontend accesses device motion events, feeds windows to the ONNX model, and receives activity probabilities.
- **Busy Mapping**: Activities such as “walking”, “running”, “in_vehicle” are mapped to `busy = true`; others (e.g., “sitting”, “standing”) map to `free`.

### 3. Integration & Automation
- **Backend Endpoint** `/auto-shift`: Called when the frontend detects a busy state; adds a 30‑minute busy block and triggers a full reschedule.
- **Frontend Logic** (`features.js`, `sensor.js`, `fallback.js`):
  - Detects sensor availability.
  - Starts sensor collection or falls back to manual toggle UI.
  - Sends updates to `/auto-shift` via `fetch`.
- **Demo Page**: `activity_demo.html` lets users test the classifier locally on a mobile device or desktop.

## Images in `frontend/public/`

| File | Description |
|------|-------------|
| `WhatsApp Image 2026-09-14 at 12.30.42.jpeg` | System architecture diagram showing backend, frontend, sensor data flow, and scheduler loop. |
| `WhatsApp Image 2026-09-14 at 12.30.43.jpeg` | Screenshot of the task management UI (React/Tailwind) displaying scheduled tasks in a timeline view. |
| `WhatsApp Image 2026-09-14 at 12.30.44 (1).jpeg` | Example of the activity classifier confusion matrix from benchmark runs. |
| `WhatsApp Image 2026-09-14 at 12.30.44.jpeg` | Diagram of the CP‑SAT model variables and constraints (tasks, fixed events, working hours). |
| `WhatsApp Image 2026-09-14 at 12.30.45 (1).jpeg` | Screenshot of the sensor demo page (`activity_demo.html`) running on a mobile device, displaying real‑time activity detection. |
| `WhatsApp Image 2026-09-14 at 12.30.45.jpeg` | Benchmark results table comparing solver gaps on Taillard instances (ta01‑ta05). |
| `demo.jpeg` | High‑level flowchart of the end‑to‑end adaptive scheduling pipeline. |
| `activity_demo.html` | Stand‑alone demo for testing the ONNX‑based activity classifier using device motion sensors or manual overrides. |
| `features.js` / `sensor.js` / `fallback.js` | Frontend JavaScript that initializes sensor logic, processes motion events, and communicates with the backend. |
| `favicon.svg`, `icons.svg` | UI assets (favicon and icon set) used by the React application. |

## Getting Started

### Platform-Specific Setup

#### macOS
- Ensure you have Python 3.10+ installed (via `brew install python` or from python.org)
- Ensure Node.js is installed (via `brew install node`)
- Then follow the backend and frontend steps below.

#### Windows
- Ensure you have Python 3.10+ installed (from python.org, check "Add to PATH")
- Ensure Node.js is installed (from nodejs.org)
- Then follow the backend and frontend steps below.

#### Linux
- Ensure you have Python 3.10+ installed (via your package manager, e.g., `sudo apt-get install python3`)
- Ensure Node.js is installed (via your package manager, e.g., `sudo apt-get install nodejs npm`)
- Then follow the backend and frontend steps below.

### Backend (All Platforms)
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload   # serves at http://127.0.0.1:8000
```
See `backend/README.md` for details on running benchmarks, tests, and the activity‑classification training script.

### Frontend (All Platforms)
```bash
cd frontend
npm install
npm run dev               # serves at http://localhost:5173
```
Visit `http://localhost:5173/activity_demo.html` to try the sensor‑based activity demo.

## License
This project is provided as‑is; see individual component licenses where applicable.

--- 
*README generated to summarize problem, solution, methods, and provided assets.*