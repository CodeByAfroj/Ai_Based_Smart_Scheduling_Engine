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
    work_start: Optional[str] = "09:00 AM"
    work_end: Optional[str] = "07:00 PM"
    chronotype: Optional[str] = "morning" # morning, afternoon, night
    peak_start: Optional[str] = "09:00 AM"
    peak_end: Optional[str] = "01:00 PM"
    wake_up_time: Optional[str] = "07:00 AM"
    sleep_time: Optional[str] = "11:00 PM"
    break_interval: Optional[int] = 50 # minutes continuous focus
    weekend_preference: Optional[str] = "strict_rest" # strict_rest or flex_work
    buffer_enabled: Optional[bool] = True
    push_notifications: Optional[bool] = True
    desktop_notifications: Optional[bool] = True
    email_summary: Optional[bool] = False
    notification_preference: Optional[str] = "text_and_sound"
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
        "work_start": settings.get("work_start", "09:00 AM"),
        "work_end": settings.get("work_end", "07:00 PM"),
        "chronotype": settings.get("chronotype", "morning"),
        "peak_start": settings.get("peak_start", "09:00 AM"),
        "peak_end": settings.get("peak_end", "01:00 PM"),
        "quiet_hours_start": settings.get("work_end", "07:00 PM"),
        "quiet_hours_end": settings.get("work_start", "09:00 AM"),
        "wake_up_time": settings.get("wake_up_time", "07:00 AM"),
        "sleep_time": settings.get("sleep_time", "11:00 PM"),
        "break_interval": settings.get("break_interval", 50),
        "weekend_preference": settings.get("weekend_preference", "strict_rest"),
        "buffer_enabled": settings.get("buffer_enabled", True),
        "push_notifications": settings.get("push_notifications", True),
        "desktop_notifications": settings.get("desktop_notifications", True),
        "email_summary": settings.get("email_summary", False),
        "notification_preference": settings.get("notification_preference", "text_and_sound"),
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
