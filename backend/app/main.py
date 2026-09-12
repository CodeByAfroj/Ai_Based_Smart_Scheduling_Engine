from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import time
from .models import ScheduleRequest, ScheduleResponse
from .engine import SchedulerEngine
from .activity import router as activity_router

app = FastAPI(title="Adaptive Scheduling Engine")
app.include_router(activity_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/schedule", response_model=ScheduleResponse)
def schedule(request: ScheduleRequest):
    """
    Computes a schedule based on the given tasks, deadlines, and fixed events.
    Returns the solver status and assigned start/end times.
    """
    engine = SchedulerEngine(request)
    engine.build_model()
    
    t0 = time.time()
    status, scheduled_tasks, solve_time_ms = engine.solve()
    t1 = time.time()
    
    # Just in case wall time is less reliable
    if solve_time_ms == 0:
        solve_time_ms = (t1 - t0) * 1000

    return ScheduleResponse(
        status=status,
        solve_time_ms=solve_time_ms,
        tasks=scheduled_tasks,
        message="Optimization finished." if status in ["OPTIMAL", "FEASIBLE"] else "Failed to find a feasible schedule."
    )

@app.post("/reschedule", response_model=ScheduleResponse)
def reschedule(request: ScheduleRequest):
    """
    Re-computes the schedule from scratch.
    (Future optimization: support warm-starting with previous solution)
    """
    return schedule(request)
