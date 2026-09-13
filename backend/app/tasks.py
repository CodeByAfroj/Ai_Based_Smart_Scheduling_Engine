from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime
from zoneinfo import ZoneInfo
import uuid

IST = ZoneInfo("Asia/Kolkata")
def now_ist(): return datetime.now(IST)
from pydantic import BaseModel
from .database import get_database
from .auth import JWT_SECRET
from .profile import get_current_user_id

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

class TaskUpdate(BaseModel):
    name: Optional[str] = None
    duration_minutes: Optional[int] = None
    earliest_start: Optional[datetime] = None
    deadline: Optional[datetime] = None
    priority: Optional[int] = None
    status: Optional[str] = None # "pending", "scheduled", "completed"

def get_task_collection():
    return get_database()["tasks"]

@router.get("/")
async def list_tasks(user_id: str = Depends(get_current_user_id)):
    collection = get_task_collection()
    cursor = collection.find({"user_id": user_id})
    tasks = await cursor.to_list(length=100)
    for t in tasks:
        t["id"] = t.pop("_id")
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
    task_doc["id"] = task_doc.pop("_id")
    return {"message": "Task created", "task": task_doc}

@router.put("/{task_id}")
async def update_task(task_id: str, data: TaskUpdate, user_id: str = Depends(get_current_user_id)):
    collection = get_task_collection()
    update_data = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    if not update_data:
        return {"message": "No fields to update"}
    
    update_data["updated_at"] = now_ist()
    result = await collection.update_one(
        {"_id": task_id, "user_id": user_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task updated"}

@router.delete("/{task_id}")
async def delete_task(task_id: str, user_id: str = Depends(get_current_user_id)):
    collection = get_task_collection()
    result = await collection.delete_one({"_id": task_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted"}
