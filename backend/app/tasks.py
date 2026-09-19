from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import uuid

IST = ZoneInfo("Asia/Kolkata")
def now_ist(): return datetime.now(IST)
from pydantic import BaseModel
from .database import get_database, get_user_collection
from .auth import JWT_SECRET
from .profile import get_current_user_id
from .notifications import schedule_push_via_qstash

router = APIRouter(prefix="/tasks", tags=["tasks"])

class TaskCreate(BaseModel):
    name: str
    duration_minutes: int
    earliest_start: datetime
    deadline: datetime
    priority: int = 1
    fixed: bool = False
    preferred_start_after: Optional[datetime] = None
    preferred_start_before: Optional[datetime] = None
    resource_id: Optional[str] = "default"
    predecessors: Optional[List[str]] = []
    reminders: Optional[List[int]] = []

class TaskUpdate(BaseModel):
    name: Optional[str] = None
    duration_minutes: Optional[int] = None
    earliest_start: Optional[datetime] = None
    deadline: Optional[datetime] = None
    priority: Optional[int] = None
    status: Optional[str] = None # "pending", "scheduled", "completed"
    reminders: Optional[List[int]] = None

def get_task_collection():
    return get_database()["tasks"]

@router.get("/")
async def list_tasks(user_id: str = Depends(get_current_user_id)):
    collection = get_task_collection()
    cursor = collection.find({"user_id": user_id})
    tasks = await cursor.to_list(length=100)
    for t in tasks:
        t["id"] = str(t.pop("_id"))
        # Format naive UTC datetimes or string datetimes from MongoDB into IST ISO strings with +05:30 offset
        for field in ["scheduled_start", "scheduled_end", "earliest_start", "deadline", "created_at", "updated_at"]:
            val = t.get(field)
            if isinstance(val, datetime):
                # If naive (as Motor returns BSON Date), attach UTC then convert to IST
                if val.tzinfo is None:
                    val = val.replace(tzinfo=timezone.utc).astimezone(IST)
                else:
                    val = val.astimezone(IST)
                t[field] = val.isoformat()
    return {"tasks": tasks}

@router.post("/")
async def create_task(data: TaskCreate, user_id: str = Depends(get_current_user_id)):
    collection = get_task_collection()
    task_id = str(uuid.uuid4())
    task_doc = data.model_dump()
    task_doc["_id"] = task_id
    task_doc["user_id"] = user_id
    task_doc["status"] = "pending"
    task_doc["created_at"] = now_ist()
    await collection.insert_one(task_doc)
    task_doc["id"] = str(task_doc.pop("_id"))
    
    for field in ["scheduled_start", "scheduled_end", "earliest_start", "deadline", "created_at", "updated_at"]:
        val = task_doc.get(field)
        if isinstance(val, datetime):
            if val.tzinfo is None:
                val = val.replace(tzinfo=timezone.utc).astimezone(IST)
            else:
                val = val.astimezone(IST)
    # Schedule push notification via QStash if user has push subscription
    user = await get_user_collection().find_one({"google_id": user_id})
    if user and task_doc.get("status") not in ["completed", "missed"]:
        settings = user.get("settings", {})
        push_sub = settings.get("push_subscription")
        wants_push = settings.get("push_notifications", True)
        target_time = task_doc.get("scheduled_start") or task_doc.get("earliest_start")
        reminders_list = task_doc.get("reminders") or data.reminders
        if push_sub and wants_push and target_time:
            schedule_push_via_qstash(user_id, data.name, target_time, push_sub, reminders=reminders_list)

    return {"message": "Task created", "task": task_doc}

from bson import ObjectId

@router.put("/{task_id}")
async def update_task(task_id: str, data: TaskUpdate, user_id: str = Depends(get_current_user_id)):
    collection = get_task_collection()
    update_data = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    if not update_data:
        return {"message": "No fields to update"}
    
    update_data["updated_at"] = now_ist()
    query = {"$or": [{"_id": task_id}, {"_id": ObjectId(task_id)}], "user_id": user_id} if ObjectId.is_valid(task_id) else {"_id": task_id, "user_id": user_id}
    result = await collection.update_one(query, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
        
    # Fetch updated task document
    updated_doc = await collection.find_one(query)
    if updated_doc:
        updated_doc["id"] = str(updated_doc.pop("_id"))
        for field in ["scheduled_start", "scheduled_end", "earliest_start", "deadline", "created_at", "updated_at"]:
            val = updated_doc.get(field)
            if isinstance(val, datetime):
                if val.tzinfo is None:
                    val = val.replace(tzinfo=timezone.utc).astimezone(IST)
                else:
                    val = val.astimezone(IST)
                updated_doc[field] = val.isoformat()

    # Schedule push notification ONLY for pending/scheduled tasks
    user = await get_user_collection().find_one({"google_id": user_id})
    if updated_doc and user and updated_doc.get("status") not in ["completed", "missed"]:
        settings = user.get("settings", {})
        push_sub = settings.get("push_subscription")
        wants_push = settings.get("push_notifications", True)
        target_time = updated_doc.get("scheduled_start") or updated_doc.get("earliest_start")
        reminders_list = updated_doc.get("reminders")
        if push_sub and wants_push and target_time:
            task_name = updated_doc.get("name", "Task")
            schedule_push_via_qstash(user_id, task_name, target_time, push_sub, reminders=reminders_list)

    return {"message": "Task updated", "task": updated_doc}

@router.delete("/{task_id}")
async def delete_task(task_id: str, user_id: str = Depends(get_current_user_id)):
    collection = get_task_collection()
    query = {"$or": [{"_id": task_id}, {"_id": ObjectId(task_id)}], "user_id": user_id} if ObjectId.is_valid(task_id) else {"_id": task_id, "user_id": user_id}
    result = await collection.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted"}
