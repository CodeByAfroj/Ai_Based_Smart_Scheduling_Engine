from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import time
from .models import ScheduleRequest, ScheduleResponse
from .database import connect_to_mongo, close_mongo_connection, get_database
from .auth import router as auth_router
from .profile import router as profile_router, get_current_user_id
from .tasks import router as tasks_router
from .notifications import router as notifications_router
from .engine import SchedulerEngine
from .activity import router as activity_router
from .nlp_routes import router as nlp_router
from fastapi import Depends
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")

def now_ist():
    return datetime.now(IST)
from .engine import SchedulerEngine, apply_busy_signal

from .background import start_background_jobs

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    start_background_jobs(app)
    yield
    await close_mongo_connection()

app = FastAPI(title="Adaptive Scheduling Engine", lifespan=lifespan)
app.include_router(activity_router)
app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(tasks_router)
app.include_router(notifications_router)
app.include_router(nlp_router)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/schedule", response_model=ScheduleResponse)
async def schedule(request: ScheduleRequest, user_id: str = Depends(get_current_user_id)):
    """
    Computes a schedule based on the given tasks, deadlines, and fixed events.
    Returns the solver status and assigned start/end times.
    """
    # Fetch tasks from DB if none are provided in the request
    if not request.tasks:
        from .models import Task
        cursor = get_database()["tasks"].find({"user_id": user_id, "status": {"$in": ["pending", "scheduled"]}})
        db_tasks = await cursor.to_list(length=100)
        request.tasks = []
        for t in db_tasks:
            # Parse DB task into models.Task
            request.tasks.append(Task(
                id=t["_id"],
                name=t["name"],
                duration_minutes=t["duration_minutes"],
                earliest_start=t["earliest_start"],
                deadline=t["deadline"],
                priority=t.get("priority", 1),
                fixed=t.get("fixed", False)
            ))

    engine = SchedulerEngine(request)
    engine.build_model()
    
    t0 = time.time()
    status, scheduled_tasks, solve_time_ms = engine.solve()
    t1 = time.time()
    
    if solve_time_ms == 0:
        solve_time_ms = (t1 - t0) * 1000

    # Save scheduled times back to DB
    if status in ["OPTIMAL", "FEASIBLE"]:
        for st in scheduled_tasks:
            await get_database()["tasks"].update_one(
                {"_id": st.task_id, "user_id": user_id},
                {"$set": {
                    "status": "scheduled",
                    "scheduled_start": st.start,
                    "scheduled_end": st.end,
                    "updated_at": now_ist()
                }}
            )

    return ScheduleResponse(
        status=status,
        solve_time_ms=solve_time_ms,
        tasks=scheduled_tasks,
        message="Optimization finished." if status in ["OPTIMAL", "FEASIBLE"] else "Failed to find a feasible schedule."
    )

@app.post("/reschedule", response_model=ScheduleResponse)
async def reschedule(request: ScheduleRequest, user_id: str = Depends(get_current_user_id)):
    """
    Re-computes the schedule from scratch.
    """
    return await schedule(request, user_id)

@app.post("/auto-shift", response_model=ScheduleResponse)
async def auto_shift(
    bg_tasks: BackgroundTasks, 
    user_id: str = Depends(get_current_user_id)
):
    """
    Triggered when the Activity Tracker detects the user is busy.
    Adds a 30-minute busy block from the current time and reschedules tasks.
    """
    from .models import WorkingHours
    from .database import get_user_collection
    from .notifications import notify_user
    
    request = ScheduleRequest(
        tasks=[],
        fixed_events=[],
        reference_time=now_ist(),
        working_hours=WorkingHours(start_hour=9, end_hour=18)
    )
    
    # Apply a 30-minute busy signal block to force shifting
    apply_busy_signal(request, True, now_ist() + timedelta(minutes=30))
    
    # Send Notification
    collection = get_user_collection()
    user = await collection.find_one({"google_id": user_id})
    email = user.get("email") if user else ""
    
    await notify_user(
        user_id=user_id,
        user_email=email,
        title="Auto-Shift Triggered",
        message="You appear busy. Your schedule has been safely pushed back by 30 minutes to give you time.",
        bg_tasks=bg_tasks
    )
    
    return await schedule(request, user_id)
