"""
NLP API Endpoints for TaskPulse Assistant
"""
from fastapi import APIRouter, Depends, HTTPException
from .nlp import parse_task_from_text, answer_user_question
from .profile import get_current_user_id
from .database import get_database
from .models import Task
from bson import ObjectId
from datetime import datetime

router = APIRouter(prefix="/nlp", tags=["nlp"])

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
        
        # Convert datetime objects to ISO strings for JSON serialization
        if task_params.get("earliest_start"):
            task_params["earliest_start"] = task_params["earliest_start"].isoformat()
        if task_params.get("deadline"):
            task_params["deadline"] = task_params["deadline"].isoformat()
            
        return task_params
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse task: {str(e)}")

@router.post("/query")
async def query_endpoint(
    request: dict,
    user_id: str = Depends(get_current_user_id)
):
    """
    Answer natural language questions about user's tasks and profile.
    """
    question = request.get("question", "")
    if not question.strip():
        raise HTTPException(status_code=400, detail="Question is required")
    
    try:
        # Get user's tasks from database
        db = get_database()
        tasks_cursor = db["tasks"].find({"user_id": user_id})
        tasks = await tasks_cursor.to_list(length=100)
        
        # Convert ObjectId to string and datetime to ISO for JSON serialization
        for task in tasks:
            task["_id"] = str(task["_id"])
            if task.get("created_at"):
                task["created_at"] = task["created_at"].isoformat()
            if task.get("updated_at"):
                task["updated_at"] = task["updated_at"].isoformat()
            if task.get("scheduled_start"):
                task["scheduled_start"] = task["scheduled_start"].isoformat()
            if task.get("scheduled_end"):
                task["scheduled_end"] = task["scheduled_end"].isoformat()
        
        # Get user's profile
        profile = await db["users"].find_one({"google_id": user_id})
        if profile:
            profile["_id"] = str(profile["_id"])
        
        # Answer the question
        result = answer_user_question(question, tasks, profile or {})
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process query: {str(e)}")