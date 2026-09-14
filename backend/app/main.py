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
from .engine import SchedulerEngine, SolverConfig
from .activity import router as activity_router
from .nlp_routes import router as nlp_router
from .recommendations import router as recommendations_router
from fastapi import Depends
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")

def now_ist():
    return datetime.now(IST)
from .engine import SchedulerEngine, apply_busy_signal

from .background import start_background_jobs

# Default solver config - can be overridden per request
DEFAULT_SOLVER_CONFIG = SolverConfig(
    time_limit_sec=5.0,
    num_workers=8,
    log_search_progress=False,
    objective_weights={
        "preferred_before": 1.0,
        "preferred_after": 1.0,
        "earliness": 0.1,
        "priority_weight": 1.0
    },
    enable_warm_start=True,
    return_partial_on_timeout=True
)

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
app.include_router(recommendations_router)


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
    # Fetch user profile settings for working hours & peak/quiet hours
    from .database import get_user_collection
    user = None
    try:
        coll = get_user_collection()
        if coll is not None:
            user = await coll.find_one({"google_id": user_id})
    except Exception:
        user = None
    settings = (user or {}).get("settings", {})
    
    def parse_time(time_str, default_hour, default_min=0):
        if not time_str: return default_hour, default_min
        try:
            dt = datetime.strptime(time_str.strip(), "%I:%M %p")
            return dt.hour, dt.minute
        except Exception:
            return default_hour, default_min

    work_start_h, work_start_m = parse_time(settings.get("work_start"), 9, 0)
    work_end_h, work_end_m = parse_time(settings.get("work_end"), 21, 0)
    peak_start_h, peak_start_m = parse_time(settings.get("peak_start"), 9, 0)
    peak_end_h, peak_end_m = parse_time(settings.get("peak_end"), 13, 0)

    from .models import WorkingHours
    wh = WorkingHours(
        start_hour=work_start_h,
        end_hour=work_end_h,
        peak_start_hour=peak_start_h,
        peak_end_hour=peak_end_h,
        quiet_start_hour=work_end_h,
        quiet_end_hour=work_start_h
    )

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
                fixed=t.get("fixed", False),
                preferred_start_after=t.get("preferred_start_after"),
                preferred_start_before=t.get("preferred_start_before"),
                resource_id=t.get("resource_id", "default"),
                predecessors=t.get("predecessors", [])
            ))

    request.working_hours = wh
    if not request.reference_time:
        request.reference_time = now_ist()
    engine = SchedulerEngine(request, config=DEFAULT_SOLVER_CONFIG)
    engine.build_model()
    
    t0 = time.time()
    status, scheduled_tasks, solve_time_ms = engine.solve()
    t1 = time.time()
    
    if solve_time_ms == 0:
        solve_time_ms = (t1 - t0) * 1000

    # Save scheduled times back to DB
    if status in ["OPTIMAL", "FEASIBLE", "PARTIAL"]:
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
        message="Optimization finished." if status in ["OPTIMAL", "FEASIBLE"] else ("Partial schedule returned." if status == "PARTIAL" else "Failed to find a feasible schedule.")
    )

@app.post("/reschedule", response_model=ScheduleResponse)
async def reschedule(request: ScheduleRequest, user_id: str = Depends(get_current_user_id)):
    """
    Re-computes the schedule using warm-start from previous solution.
    """
    # Fetch previous schedule from DB for warm-start
    from .models import ScheduledTask as STModel
    cursor = get_database()["tasks"].find({"user_id": user_id, "status": "scheduled", "scheduled_start": {"$ne": None}})
    db_tasks = await cursor.to_list(length=100)
    
    previous_schedule = []
    for t in db_tasks:
        if t.get("scheduled_start") and t.get("scheduled_end"):
            previous_schedule.append(STModel(
                task_id=t["_id"],
                start=t["scheduled_start"],
                end=t["scheduled_end"]
            ))
    
    # Fetch user profile settings for working hours & peak/quiet hours
    from .database import get_user_collection
    user = None
    try:
        coll = get_user_collection()
        if coll is not None:
            user = await coll.find_one({"google_id": user_id})
    except Exception:
        user = None
    settings = (user or {}).get("settings", {})
    
    def parse_time(time_str, default_hour, default_min=0):
        if not time_str: return default_hour, default_min
        try:
            dt = datetime.strptime(time_str.strip(), "%I:%M %p")
            return dt.hour, dt.minute
        except Exception:
            return default_hour, default_min

    work_start_h, work_start_m = parse_time(settings.get("work_start"), 9, 0)
    work_end_h, work_end_m = parse_time(settings.get("work_end"), 21, 0)
    peak_start_h, peak_start_m = parse_time(settings.get("peak_start"), 9, 0)
    peak_end_h, peak_end_m = parse_time(settings.get("peak_end"), 13, 0)

    from .models import WorkingHours
    wh = WorkingHours(
        start_hour=work_start_h,
        end_hour=work_end_h,
        peak_start_hour=peak_start_h,
        peak_end_hour=peak_end_h,
        quiet_start_hour=work_end_h,
        quiet_end_hour=work_start_h
    )

    request.working_hours = wh
    if not request.reference_time:
        request.reference_time = now_ist()

    # Fetch tasks from DB if none are provided in the request
    if not request.tasks:
        from .models import Task
        cursor = get_database()["tasks"].find({"user_id": user_id, "status": {"$in": ["pending", "scheduled"]}})
        db_tasks = await cursor.to_list(length=100)
        request.tasks = []
        for t in db_tasks:
            request.tasks.append(Task(
                id=t["_id"],
                name=t["name"],
                duration_minutes=t["duration_minutes"],
                earliest_start=t["earliest_start"],
                deadline=t["deadline"],
                priority=t.get("priority", 1),
                fixed=t.get("fixed", False),
                preferred_start_after=t.get("preferred_start_after"),
                preferred_start_before=t.get("preferred_start_before"),
                resource_id=t.get("resource_id", "default"),
                predecessors=t.get("predecessors", [])
            ))

    engine = SchedulerEngine(request, config=DEFAULT_SOLVER_CONFIG)
    if previous_schedule:
        engine.set_warm_start_hints(previous_schedule)
    engine.build_model()
    
    t0 = time.time()
    status, scheduled_tasks, solve_time_ms = engine.solve()
    t1 = time.time()
    
    if solve_time_ms == 0:
        solve_time_ms = (t1 - t0) * 1000

    if status in ["OPTIMAL", "FEASIBLE", "PARTIAL"]:
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
        message="Reschedule finished." if status in ["OPTIMAL", "FEASIBLE"] else ("Partial schedule returned." if status == "PARTIAL" else "Failed to find a feasible schedule.")
    )

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
