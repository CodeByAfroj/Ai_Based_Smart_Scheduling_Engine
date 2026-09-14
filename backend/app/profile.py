from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from zoneinfo import ZoneInfo
from .database import get_user_collection

IST = ZoneInfo("Asia/Kolkata")
def now_ist(): return datetime.now(IST)
import jwt
import os

router = APIRouter(prefix="/profile", tags=["profile"])
security = HTTPBearer()
JWT_SECRET = os.getenv("JWT_SECRET", "super_secret_key")


async def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        return payload.get("sub")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


class ProfileUpdate(BaseModel):
    age: Optional[int] = None
    profession: Optional[str] = ""
    work_style: Optional[str] = ""
    timezone: Optional[str] = "UTC+05:30 (IST)"
    work_start: Optional[str] = "09:30 AM"
    work_end: Optional[str] = "06:30 PM"
    buffer_enabled: Optional[bool] = True
    push_notifications: Optional[bool] = True
    desktop_notifications: Optional[bool] = True
    email_summary: Optional[bool] = False
    notification_preference: Optional[str] = "text_and_sound"
    quiet_hours_start: Optional[str] = "10:00 PM"
    quiet_hours_end: Optional[str] = "07:30 AM"
    categories: Optional[List[str]] = []
    is_complete: Optional[bool] = False


@router.get("/me")
async def get_profile(user_id: str = Depends(get_current_user_id)):
    collection = get_user_collection()
    user = await collection.find_one({"google_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    profile_data = user.get("profile", {})
    settings = user.get("settings", {})

    # Merge google profile info + settings into one profile object
    merged = {
        "name": profile_data.get("name", "") or user.get("name", ""),
        "email": user.get("email", ""),
        "picture": user.get("picture", ""),
        "age": settings.get("age"),
        "profession": settings.get("profession", ""),
        "work_style": settings.get("work_style", ""),
        "timezone": settings.get("timezone", ""),
        "work_start": settings.get("work_start", ""),
        "work_end": settings.get("work_end", ""),
        "buffer_enabled": settings.get("buffer_enabled", True),
        "push_notifications": settings.get("push_notifications", True),
        "desktop_notifications": settings.get("desktop_notifications", True),
        "email_summary": settings.get("email_summary", False),
        "notification_preference": settings.get("notification_preference", "text_and_sound"),
        "quiet_hours_start": settings.get("quiet_hours_start", "10:00 PM"),
        "quiet_hours_end": settings.get("quiet_hours_end", "07:30 AM"),
        "categories": settings.get("categories", []),
    }

    is_complete = bool(settings.get("is_complete", False))
    return {**merged, "is_complete": is_complete}


@router.put("/update")
async def update_profile(data: ProfileUpdate, user_id: str = Depends(get_current_user_id)):
    collection = get_user_collection()
    result = await collection.update_one(
        {"google_id": user_id},
        {"$set": {
            "settings": data.model_dump(),
            "updated_at": now_ist()
        }},
        upsert=True
    )
    if result.matched_count == 0 and result.upserted_id is None:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "Profile updated successfully"}
