from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from zoneinfo import ZoneInfo
import jwt
import os
from .database import get_database, get_user_collection
from .nlp import call_ollama_llm, call_llm_with_failover, call_background_llm_with_failover

router = APIRouter(prefix="/recommendations", tags=["recommendations"])
security = HTTPBearer()
JWT_SECRET = os.getenv("JWT_SECRET", "super_secret_key")
IST = ZoneInfo("Asia/Kolkata")

def now_ist():
    return datetime.now(IST)

async def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        return payload.get("sub")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def parse_time_str(time_str: str, default_h: int = 9, default_m: int = 0) -> tuple:
    if not time_str:
        return default_h, default_m
    try:
        dt = datetime.strptime(time_str.strip(), "%I:%M %p")
        return dt.hour, dt.minute
    except Exception:
        return default_h, default_m

class TaskRecommendation(BaseModel):
    task_id: str
    name: str
    duration_minutes: int
    priority: int
    score: float
    reason_badge: str
    reason_detail: str
    recommended_time_slot: str

class RecommendationResponse(BaseModel):
    user_status: str
    current_energy_level: str # Peak, Moderate, Low / Rest
    recommended_next_task: Optional[TaskRecommendation] = None
    all_ranked_recommendations: List[TaskRecommendation] = []
    break_recommended: bool = False
    message: str

@router.get("/next-task", response_model=RecommendationResponse)
async def get_next_task_recommendation(user_id: str = Depends(get_current_user_id)):
    """
    Computes real-time personalized task recommendations using profile biometrics & multi-criteria utility scoring.
    """
    db = get_database()
    coll = get_user_collection()
    
    # 1. Fetch user profile
    user = await coll.find_one({"google_id": user_id}) if coll is not None else None
    settings = (user or {}).get("settings", {})
    
    chronotype = settings.get("chronotype", "morning")
    profession = settings.get("profession", "General Professional")
    work_style = settings.get("work_style", "Balanced")
    
    w_start_h, w_start_m = parse_time_str(settings.get("work_start"), 9, 30)
    w_end_h, w_end_m = parse_time_str(settings.get("work_end"), 18, 30)
    p_start_h, p_start_m = parse_time_str(settings.get("peak_start"), 9, 0)
    p_end_h, p_end_m = parse_time_str(settings.get("peak_end"), 13, 0)
    
    curr = now_ist()
    curr_hour = curr.hour + curr.minute / 60.0
    
    # Determine Current Energy Level
    p_start_val = p_start_h + p_start_m / 60.0
    p_end_val = p_end_h + p_end_m / 60.0
    w_start_val = w_start_h + w_start_m / 60.0
    w_end_val = w_end_h + w_end_m / 60.0
    
    is_work_time = w_start_val <= curr_hour < w_end_val
    is_peak_time = p_start_val <= curr_hour < p_end_val
    
    if is_peak_time:
        energy_level = "⚡ Peak Focus Window"
    elif is_work_time:
        if 13.0 <= curr_hour <= 15.0:
            energy_level = "☕ Post-Lunch Moderate Slot"
        else:
            energy_level = "🟢 Active Working Window"
    else:
        energy_level = "🌙 Quiet / Rest Hours"

    # 2. Fetch tasks
    cursor = db["tasks"].find({"user_id": user_id, "status": {"$in": ["pending", "scheduled"]}})
    db_tasks = await cursor.to_list(length=100)

    # 2.5 Check if there is an active FIXED task happening right now
    active_fixed = None
    from datetime import timedelta
    for t in db_tasks:
        if t.get("fixed"):
            start_str = t.get("earliest_start") or t.get("scheduled_start")
            if start_str:
                try:
                    s_dt = datetime.fromisoformat(str(start_str))
                    if s_dt.tzinfo is None:
                        s_dt = s_dt.replace(tzinfo=IST)
                    e_dt = s_dt + timedelta(minutes=t.get("duration_minutes", 60))
                    if s_dt <= curr <= e_dt:
                        active_fixed = t
                        break
                except Exception:
                    pass
    
    # If there is an active fixed task, it bypasses sleep override and becomes the top recommendation
    if active_fixed:
        t_id = str(active_fixed["_id"])
        top_task = TaskRecommendation(
            task_id=t_id,
            name=active_fixed.get("name", "Fixed Task"),
            duration_minutes=active_fixed.get("duration_minutes", 30),
            priority=active_fixed.get("priority", 1),
            score=1000.0,
            reason_badge="🔒 Active Fixed Meeting",
            reason_detail="This fixed event is happening right now. It takes priority over flexible scheduling.",
            recommended_time_slot="Right Now"
        )
        return RecommendationResponse(
            user_status="Active Event",
            current_energy_level=energy_level,
            recommended_next_task=top_task,
            all_ranked_recommendations=[top_task],
            break_recommended=False,
            message="You have a scheduled fixed event currently taking place."
        )

    # SLEEP OVERRIDE: If outside working and peak hours, check for pending fixed tasks first.
    # Fixed tasks ALWAYS get recommended regardless of time of day — they are time-bound commitments.
    if not is_work_time and not is_peak_time:
        # Check for any pending/scheduled fixed tasks before defaulting to sleep
        pending_fixed = [t for t in db_tasks if t.get("fixed") and t.get("status") in ("pending", "scheduled")]
        if pending_fixed:
            # Sort by priority (descending) then by earliest_start (ascending/most urgent first)
            pending_fixed.sort(key=lambda t: (-t.get("priority", 1), str(t.get("earliest_start", ""))))
            best_fixed = pending_fixed[0]
            f_id = str(best_fixed["_id"])
            fixed_rec = TaskRecommendation(
                task_id=f_id,
                name=best_fixed.get("name", "Fixed Task"),
                duration_minutes=best_fixed.get("duration_minutes", 30),
                priority=best_fixed.get("priority", 1),
                score=900.0,
                reason_badge="🔒 Pending Fixed Task",
                reason_detail=f"You have a fixed task \"{best_fixed.get('name', 'Task')}\" that needs attention. Fixed commitments take priority over rest periods.",
                recommended_time_slot="Needs Attention"
            )
            all_fixed_recs = []
            for ft in pending_fixed:
                ft_id = str(ft["_id"])
                all_fixed_recs.append(TaskRecommendation(
                    task_id=ft_id,
                    name=ft.get("name", "Fixed Task"),
                    duration_minutes=ft.get("duration_minutes", 30),
                    priority=ft.get("priority", 1),
                    score=900.0 - len(all_fixed_recs),
                    reason_badge="🔒 Fixed Task",
                    reason_detail=f"Fixed task requiring attention.",
                    recommended_time_slot="Needs Attention"
                ))
            return RecommendationResponse(
                user_status="Fixed Tasks Pending",
                current_energy_level=energy_level,
                recommended_next_task=fixed_rec,
                all_ranked_recommendations=all_fixed_recs,
                break_recommended=False,
                message=f"You have {len(pending_fixed)} fixed task(s) pending. Fixed commitments override rest periods."
            )

        # No fixed tasks pending — show sleep recommendation
        prompt = f"The user is a {profession}. It is their designated sleep/rest time. Generate a short 1-2 sentence personalized message advising them to stop their current activity (tailor the action to their specific profession - e.g. a student should close their books, an engineer should step away from the screen) and get some rest. Briefly state the health or cognitive benefit for their specific role. Be firm but warm. No quotes or introductory text."
        sleep_msg = call_background_llm_with_failover([{"role": "user", "content": prompt}], timeout=25.0)
        
        sleep_task = TaskRecommendation(
            task_id="sleep_override",
            name="Rest & Recharge",
            duration_minutes=480, # 8 hours
            priority=1,
            score=100.0,
            reason_badge="🌙 Rest/Sleep Required",
            reason_detail=sleep_msg or f"It's outside your working hours. As a {profession}, it's crucial to step away and get some rest to maintain long-term productivity.",
            recommended_time_slot="Right Now"
        )
        
        return RecommendationResponse(
            user_status="Rest Time",
            current_energy_level="🌙 Quiet / Rest Hours",
            recommended_next_task=sleep_task,
            all_ranked_recommendations=[],
            break_recommended=True,
            message="It is currently your rest window."
        )

    # Filter only AI Flexible tasks for dynamic AI recommendations
    flexible_tasks = [t for t in db_tasks if not t.get("fixed", False)]
    
    # If no flexible tasks exist, fall back to all tasks but handle fixed display properly
    candidate_tasks = flexible_tasks if flexible_tasks else db_tasks

    if not candidate_tasks:
        return RecommendationResponse(
            user_status="No candidate flexible tasks found",
            current_energy_level=energy_level,
            recommended_next_task=None,
            all_ranked_recommendations=[],
            break_recommended=False,
            message="Your flexible schedule is clear! Create an AI Flexible Task to get personalized recommendations."
        )
        
    ranked_list = []
    
    for t in candidate_tasks:
        task_id = str(t["_id"])
        name = t.get("name", "Untitled Task")
        duration = t.get("duration_minutes", 30)
        priority = t.get("priority", 2) # 1: Critical, 2: High, 3: Medium, 4: Low
        fixed = t.get("fixed", False)
        scheduled_start = t.get("scheduled_start")
        
        # Heuristic Scoring Calculation
        # Base Score starts from priority (1 highest priority = 100 base pts, 4 lowest = 25 pts)
        prio_score = (5 - priority) * 25.0
        
        # Energy Alignment Score
        energy_score = 0.0
        badge = "🔒 Fixed Meeting" if fixed else "🎯 Recommended Task"
        detail = f"Locked meeting at {scheduled_start}" if fixed else f"Optimized for your {work_style} work style."
        
        is_deep_work = any(kw in name.lower() for kw in ["code", "design", "arch", "study", "deep", "review", "sprint", "project", "build", "write"])
        is_light_task = any(kw in name.lower() for kw in ["email", "call", "sync", "admin", "chat", "clean", "meeting", "update", "quick"])
        
        if fixed:
            energy_score = 0.0
        elif is_peak_time and is_deep_work:
            energy_score += 40.0
            badge = "⚡ Peak Focus Slot"
            detail = f"Your {chronotype} energy window is active. Ideal for high-cognition tasks like '{name}'."
        elif is_peak_time and not is_deep_work:
            energy_score += 15.0
            badge = "🔥 High Energy Window"
            detail = f"High focus time. Great opportunity to finish '{name}'."
        elif not is_peak_time and is_light_task:
            energy_score += 35.0
            badge = "☕ Perfect Light Task"
            detail = f"Outside peak focus hours—ideal slot for light administrative work."
        elif not is_work_time:
            energy_score -= 30.0
            badge = "🌙 Rest Hours Recommendation"
            detail = "Scheduled during your non-active wind-down window."
            
        # Role & Profession Affinity
        role_score = 0.0
        if not fixed:
            if "Engineer" in profession and is_deep_work:
                role_score += 15.0
            elif "Manager" in profession and is_light_task:
                role_score += 15.0
            
        final_score = prio_score + energy_score + role_score
        
        if fixed and scheduled_start:
            try:
                # Format fixed start time nicely
                s_dt = datetime.fromisoformat(str(scheduled_start))
                time_slot = f"Locked at {s_dt.strftime('%I:%M %p')}"
            except Exception:
                time_slot = f"Locked at {scheduled_start}"
        else:
            time_slot = "Now" if is_work_time else f"Tomorrow at {settings.get('work_start', '09:30 AM')}"
        
        ranked_list.append(TaskRecommendation(
            task_id=task_id,
            name=name,
            duration_minutes=duration,
            priority=priority,
            score=round(final_score, 1),
            reason_badge=badge,
            reason_detail=detail,
            recommended_time_slot=time_slot
        ))
        
    # Sort tasks descending by calculated utility score
    ranked_list.sort(key=lambda x: x.score, reverse=True)
    
    top_task = ranked_list[0] if ranked_list else None
    
    # LLM PERSONALIZATION: Generate contextual reasoning for the top task
    if top_task and is_work_time:
        prompt = f"The user is a {profession} ({chronotype}, {work_style} work style). The AI scheduling engine has recommended they do the task '{top_task.name}' for {top_task.duration_minutes} minutes right now. Generate a highly personalized, encouraging 1-2 sentence reason why doing this task right now is great for them, focusing on benefits. Keep it punchy. No quotes or introductory text."
        custom_reason = call_ollama_llm([{"role": "user", "content": prompt}], timeout=25.0)
        if custom_reason:
            top_task.reason_detail = custom_reason.strip().replace('"', '')
    
    return RecommendationResponse(
        user_status="Optimal Focus Match Identified",
        current_energy_level=energy_level,
        recommended_next_task=top_task,
        all_ranked_recommendations=ranked_list,
        break_recommended=False,
        message=f"AI analyzed your biometrics ({chronotype}, {profession}) and identified the optimal next task."
    )
