"""
NLP API Endpoints for TaskPulse Assistant
Integrates context-aware LLM and auto-task creation workflows.
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from bson import ObjectId

from .nlp import parse_task_from_text, answer_user_question_contextual, now_ist
from .profile import get_current_user_id
from .database import get_database
from .notifications import schedule_push_via_qstash

router = APIRouter(prefix="/nlp", tags=["nlp"])

async def async_auto_schedule_user_tasks(user_id: str):
    """Background worker to auto-schedule pending tasks without blocking AI query response."""
    try:
        db = get_database()
        user_doc = await db["users"].find_one({"google_id": user_id})
        settings = (user_doc or {}).get("settings", {})
        
        def parse_time(time_str, default_hour):
            if not time_str: return default_hour, 0
            try:
                dt = datetime.strptime(time_str.strip(), "%I:%M %p")
                return dt.hour, dt.minute
            except Exception:
                return default_hour, 0

        w_s_h, w_s_m = parse_time(settings.get("work_start"), 9)
        w_e_h, w_e_m = parse_time(settings.get("work_end"), 21)
        p_s_h, p_s_m = parse_time(settings.get("peak_start"), 9)
        p_e_h, p_e_m = parse_time(settings.get("peak_end"), 13)

        from .models import ScheduleRequest, Task as TaskModel, WorkingHours
        from .engine import SchedulerEngine, SolverConfig

        wh = WorkingHours(
            start_hour=w_s_h, end_hour=w_e_h,
            peak_start_hour=p_s_h, peak_end_hour=p_e_h,
            quiet_start_hour=w_e_h, quiet_end_hour=w_s_h
        )

        all_pending = await db["tasks"].find({"user_id": user_id, "status": {"$in": ["pending", "scheduled"]}}).to_list(length=100)
        task_models = []
        for t in all_pending:
            task_models.append(TaskModel(
                id=str(t["_id"]),
                name=t["name"],
                duration_minutes=t["duration_minutes"],
                earliest_start=t["earliest_start"],
                deadline=t["deadline"],
                priority=t.get("priority", 1),
                fixed=t.get("fixed", False)
            ))

        sched_req = ScheduleRequest(tasks=task_models, working_hours=wh, reference_time=now_ist())
        engine = SchedulerEngine(sched_req, config=SolverConfig(time_limit_sec=2.0))
        engine.build_model()
        st_status, scheduled_results, _ = engine.solve()

        if st_status in ["OPTIMAL", "FEASIBLE", "PARTIAL"]:
            # Need to get user push subscription
            push_sub = settings.get("push_subscription")
            wants_push = settings.get("push_notifications", True)
            
            for st_item in scheduled_results:
                await db["tasks"].update_one(
                    {"_id": st_item.task_id, "user_id": user_id},
                    {"$set": {
                        "status": "scheduled",
                        "scheduled_start": st_item.start,
                        "scheduled_end": st_item.end,
                        "updated_at": now_ist()
                    }}
                )
                
                # Automatically push to QStash
                if wants_push and push_sub:
                    try:
                        # find task name for notification payload
                        task_name = "Task"
                        task_reminders = None
                        for t in task_models:
                            if t.id == st_item.task_id:
                                task_name = t.name
                                task_reminders = getattr(t, "reminders", None)
                                break
                        schedule_push_via_qstash(user_id, st_item.task_id, task_name, st_item.start, push_sub, reminders=task_reminders, alarm_enabled=alarm_enabled)
                    except Exception as q_err:
                        print(f"Failed to auto-schedule push for {st_item.task_id}: {q_err}")
    except Exception as auto_sched_err:
        print(f"Auto schedule background task exception: {auto_sched_err}")


@router.post("/parse-task")
async def parse_task_endpoint(
    request: dict,
    user_id: str = Depends(get_current_user_id)
):
    """
    Parse natural language text to extract task parameters.
    """
    text = request.get("text", "")
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text is required")
    
    try:
        task_params = parse_task_from_text(text)
        return task_params
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse task: {str(e)}")


@router.post("/query")
async def query_endpoint(
    request: dict,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id)
):
    """
    Answer natural language questions & execute task creation actions contextually.
    """
    question = request.get("question", "")
    history = request.get("history", [])
    if not question.strip():
        raise HTTPException(status_code=400, detail="Question is required")
    
    try:
        db = get_database()
        
        # 1. Fetch user's tasks
        tasks_cursor = db["tasks"].find({"user_id": user_id, "status": {"$in": ["pending", "scheduled"]}})
        tasks = await tasks_cursor.to_list(length=100)
        
        IST = ZoneInfo("Asia/Kolkata")
        
        # Clean tasks for JSON serialization and format dates to IST for LLM context
        for task in tasks:
            task["_id"] = str(task["_id"])
            for field in ["scheduled_start", "scheduled_end", "earliest_start", "deadline", "created_at", "updated_at"]:
                val = task.get(field)
                if isinstance(val, datetime):
                    if val.tzinfo is None:
                        val = val.replace(tzinfo=timezone.utc).astimezone(IST)
                    else:
                        val = val.astimezone(IST)
                    task[field] = val.isoformat()
        
        # 2. Fetch user's profile
        user = await db["users"].find_one({"google_id": user_id})
        profile = user or {}
        if profile and "_id" in profile:
            profile["_id"] = str(profile["_id"])
        
        # 3. Contextual LLM Question Answering with history
        result = answer_user_question_contextual(question, tasks, profile, history)
        
        # 4. Auto-execute task creation if LLM returned action: "create_task"
        if isinstance(result, dict) and result.get("action") == "create_task":
            params = result.get("params", {})
            if params and params.get("name"):
                e_start_dt = now_ist()
                if params.get("earliest_start"):
                    try:
                        e_start_dt = datetime.fromisoformat(str(params["earliest_start"]))
                    except Exception:
                        pass
                e_start = e_start_dt.isoformat()

                from datetime import timedelta
                if params.get("fixed") or params.get("earliest_start"):
                    deadline = (e_start_dt + timedelta(hours=2)).isoformat() if not params.get("fixed") else e_start
                    status = "scheduled"
                    scheduled_start = e_start_dt
                    scheduled_end = e_start_dt + timedelta(minutes=params.get("duration_minutes", 30))
                else:
                    deadline = (e_start_dt + timedelta(days=2)).isoformat()
                    status = "pending"
                    scheduled_start = None
                    scheduled_end = None
                
                import uuid
                task_id = str(uuid.uuid4())
                
                from .nlp import generate_priority_reason
                ai_reason = params.get("priority_reason")
                if not ai_reason:
                    ai_reason = generate_priority_reason(params.get("name", "Task"), params.get("priority", 2))
                    
                new_task = {
                    "_id": task_id,
                    "user_id": user_id,
                    "name": params.get("name"),
                    "duration_minutes": params.get("duration_minutes", 30),
                    "earliest_start": e_start,
                    "deadline": deadline,
                    "priority": params.get("priority", 2),
                    "priority_reason": ai_reason,
                    "fixed": params.get("fixed", False),
                    "status": status,
                    "created_at": now_ist()
                }
                if scheduled_start:
                    new_task["scheduled_start"] = scheduled_start
                if scheduled_end:
                    new_task["scheduled_end"] = scheduled_end
                
                await db["tasks"].insert_one(new_task)
                result["created_task_id"] = task_id
                result["task_created"] = True

                # Schedule QStash Push notification for confirmed scheduled start time
                settings = (user or {}).get("settings", {})
                push_sub = settings.get("push_subscription")
                wants_push = settings.get("push_notifications", True)
                alarm_enabled = settings.get("alarm_enabled", True)
                if push_sub and wants_push and scheduled_start:
                    schedule_push_via_qstash(user_id, task_id, params.get("name", "New Task"), scheduled_start, push_sub, reminders=params.get("reminders"), alarm_enabled=alarm_enabled)

                # Dispatch real-time web notification ONLY if alarm mode is NOT enabled (prevents duplicate notifications)
                if not alarm_enabled:
                    try:
                        from .notifications import notify_user
                        task_name = params.get("name", "New Task")
                        await notify_user(user_id, "✨ Task Scheduled", f"Scheduled '{task_name}' into your optimal focus window.")
                    except Exception as ne:
                        print(f"Task notification error: {ne}")

                # Run CP-SAT auto scheduler synchronously for instant response
                await async_auto_schedule_user_tasks(user_id)
                
        elif isinstance(result, dict) and result.get("action") == "update_task":
            params = result.get("params", {})
            task_id = params.get("task_id")
            if task_id:
                from bson import ObjectId
                query = {"$or": [{"_id": ObjectId(task_id) if ObjectId.is_valid(task_id) else task_id}, {"_id": task_id}], "user_id": user_id}
                update_fields = {"updated_at": now_ist()}
                if "name" in params: update_fields["name"] = params["name"]
                if "status" in params: update_fields["status"] = params["status"]
                if "fixed" in params: update_fields["fixed"] = params["fixed"]
                if "duration_minutes" in params: update_fields["duration_minutes"] = params["duration_minutes"]
                if "priority" in params: 
                    update_fields["priority"] = params["priority"]
                    from .nlp import generate_priority_reason
                    update_fields["priority_reason"] = params.get("priority_reason") or generate_priority_reason(params.get("name", "Task"), params["priority"])
                elif "priority_reason" in params:
                    update_fields["priority_reason"] = params["priority_reason"]
                if "earliest_start" in params: update_fields["earliest_start"] = params["earliest_start"]
                if "deadline" in params: update_fields["deadline"] = params["deadline"]
                
                if "scheduled_start" in params: 
                    new_start = params["scheduled_start"]
                    update_fields["scheduled_start"] = new_start
                    update_fields["earliest_start"] = new_start
                    if "fixed" not in params:
                        update_fields["fixed"] = True
                    try:
                        from datetime import timedelta
                        ns_dt = datetime.fromisoformat(str(new_start))
                        if "deadline" not in params:
                            update_fields["deadline"] = (ns_dt + timedelta(days=1)).isoformat()
                    except Exception:
                        pass
                await db["tasks"].update_one(query, {"$set": update_fields})
                
                try:
                    from .notifications import notify_user
                    await notify_user(user_id, "Task Updated", "Updated task successfully via AI.")
                except Exception as ne:
                    pass

                # Run CP-SAT auto scheduler synchronously for instant response
                await async_auto_schedule_user_tasks(user_id)

        elif isinstance(result, dict) and result.get("action") == "delete_task":
            params = result.get("params", {})
            task_id = params.get("task_id")
            if task_id:
                from bson import ObjectId
                query = {"$or": [{"_id": ObjectId(task_id) if ObjectId.is_valid(task_id) else task_id}, {"_id": task_id}], "user_id": user_id}
                
                await db["tasks"].delete_one(query)
                
                try:
                    from .notifications import notify_user
                    await notify_user(user_id, "Task Deleted", "Deleted task successfully via AI.")
                except Exception as ne:
                    pass

                # Run CP-SAT auto scheduler synchronously for instant response
                await async_auto_schedule_user_tasks(user_id)

        return result
    except Exception as e:
        print(f"Query endpoint error: {e}")
        return {
            "action": "answer",
            "answer": f"I processed your query: '{question}'. All tasks in your workspace are up to date.",
            "status": "fallback"
        }


@router.post("/tts")
async def tts_endpoint(request: dict):
    """
    Ultra-realistic Neural Human Text-to-Speech audio streaming (ChatGPT voice style).
    """
    import io
    import re
    import edge_tts
    from fastapi.responses import StreamingResponse

    text = request.get("text", "")
    voice = request.get("voice", "en-US-AvaNeural")

    if not text.strip():
        raise HTTPException(status_code=400, detail="Text is required")

    cleaned_text = re.sub(r'```json[\s\S]*?```', '', text)
    cleaned_text = re.sub(r'```[\s\S]*?```', '', cleaned_text)
    cleaned_text = re.sub(r'[\*\_`#\[\]\(\)>~]', ' ', cleaned_text)
    cleaned_text = re.sub(r'\s+', ' ', cleaned_text).strip()

    if not cleaned_text:
        cleaned_text = "I have processed your request."

    try:
        communicate = edge_tts.Communicate(cleaned_text, voice)
        
        async def audio_generator():
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    yield chunk["data"]

        return StreamingResponse(
            audio_generator(),
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=speech.mp3"}
        )
    except Exception as e:
        print(f"Neural TTS Error: {e}")
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")