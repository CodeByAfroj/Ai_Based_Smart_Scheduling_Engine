import asyncio
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import APIRouter, Depends, BackgroundTasks, Request
from fastapi import APIRouter, Depends, BackgroundTasks, Request, HTTPException
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from .profile import get_current_user_id, JWT_SECRET
import jwt
from qstash.client import QStash
from datetime import timezone

router = APIRouter(prefix="/notifications", tags=["notifications"])

# QStash setup
QSTASH_TOKEN = os.getenv("QSTASH_TOKEN")
CLOUDFLARE_WORKER_URL = "https://ai-based-smart-scheduling-engine.vercel.app/api/push"

if QSTASH_TOKEN:
    qstash_client = QStash(QSTASH_TOKEN)
else:
    qstash_client = None

class PushSubscription(BaseModel):
    endpoint: str
    keys: dict


# Global dictionary to hold event queues for each connected user
connected_clients = {}

def add_client(user_id: str, q: asyncio.Queue):
    if user_id not in connected_clients:
        connected_clients[user_id] = []
    connected_clients[user_id].append(q)

def remove_client(user_id: str, q: asyncio.Queue):
    if user_id in connected_clients:
        connected_clients[user_id].remove(q)
        if not connected_clients[user_id]:
            del connected_clients[user_id]

async def dispatch_web_push(user_id: str, message: str, title: str = "TaskPulse Alert"):
    if user_id in connected_clients:
        for q in connected_clients[user_id]:
            await q.put({"title": title, "message": message})

def send_email_sync(to_email: str, subject: str, body: str):
    """
    Synchronous function to send email via SMTP.
    If no credentials are provided in the environment, it acts as a mock/simulator.
    """
    smtp_server = os.getenv("SMTP_SERVER")
    smtp_port = os.getenv("SMTP_PORT", 587)
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    
    # MOCK BEHAVIOR
    if not smtp_server or not smtp_user or not smtp_pass:
        print("\n" + "="*50)
        print("📧 [SIMULATED EMAIL DISPATCH]")
        print(f"TO: {to_email}")
        print(f"SUBJECT: {subject}")
        print("-" * 50)
        print(body)
        print("="*50 + "\n")
        return

    # REAL BEHAVIOR
    try:
        msg = MIMEMultipart()
        msg['From'] = smtp_user
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'html'))
        
        port = int(smtp_port)
        if port == 465:
            server = smtplib.SMTP_SSL(smtp_server, port, timeout=10)
        else:
            server = smtplib.SMTP(smtp_server, port, timeout=10)
            server.starttls()
            
        server.login(smtp_user, smtp_pass)
        server.send_message(msg)
        server.quit()
        print(f"📧 Email successfully sent to {to_email}")
    except Exception as e:
        print(f"⚠️ Failed to send email to {to_email}: {str(e)}")

async def save_notification_to_db(user_id: str, title: str, message: str, type: str = "alert"):
    from .database import get_database
    from datetime import datetime, timezone
    from zoneinfo import ZoneInfo
    db = get_database()
    IST = ZoneInfo("Asia/Kolkata")
    doc = {
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": type,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).astimezone(IST)
    }
    await db["notifications"].insert_one(doc)
    return doc

def schedule_push_via_qstash(user_id: str, arg2: str = "", arg3 = None, arg4 = None, push_sub: dict = None, reminders: list = None, task_id: str = None, alarm_enabled: bool = True):
    # Support both 5-arg signature (user_id, task_id, task_name, scheduled_time, push_sub)
    # and 4-arg signature (user_id, task_name, scheduled_time, push_sub)
    if isinstance(push_sub, dict):
        real_task_id = task_id or arg2 or "task"
        task_name = str(arg3) if arg3 is not None else "Task"
        scheduled_time = arg4
        real_push_sub = push_sub
    elif isinstance(arg4, dict):
        real_task_id = task_id or "task"
        task_name = str(arg2) if arg2 else "Task"
        scheduled_time = arg3
        real_push_sub = arg4
    else:
        real_task_id = task_id or arg2 or "task"
        task_name = str(arg3) if arg3 is not None else (str(arg2) if arg2 else "Task")
        scheduled_time = arg4 if arg4 is not None else arg3
        real_push_sub = push_sub or (arg4 if isinstance(arg4, dict) else None)

    task_id = real_task_id
    push_sub = real_push_sub

    if not qstash_client:
        print("⚠️ [PUSH] QStash client not initialized, skipping push scheduling.")
        return

    if not push_sub:
        print(f"⚠️ [PUSH] User {user_id} has no push subscription in database. Web Push skipped.")
        return

    try:
        import datetime
        now = datetime.datetime.now(timezone.utc)
        if isinstance(scheduled_time, str):
            scheduled_time = datetime.datetime.fromisoformat(scheduled_time)
        
        from zoneinfo import ZoneInfo
        IST = ZoneInfo("Asia/Kolkata")
        if scheduled_time.tzinfo is None:
            target = scheduled_time.replace(tzinfo=IST).astimezone(timezone.utc)
        else:
            target = scheduled_time.astimezone(timezone.utc)

        # 1. Schedule prior standard REMINDER notifications (e.g. 5m, 10m, 30m before)
        if reminders and isinstance(reminders, list):
            for m in reminders:
                try:
                    mins = int(m)
                    rem_target = target - datetime.timedelta(minutes=mins)
                    rem_delay = int((rem_target - now).total_seconds())
                    if rem_delay > 0:
                        qstash_client.message.publish_json(
                            url=CLOUDFLARE_WORKER_URL,
                            body={
                                "title": f"⏰ {task_name} starts in {mins} min",
                                "body": f"Reminder: Your scheduled task '{task_name}' is starting in {mins} minutes.",
                                "requireInteraction": False,  # Standard notification, auto-dismisses
                                "tag": f"reminder-{task_id}-{mins}",
                                "pushSubscription": push_sub
                            },
                            delay=f"{rem_delay}s",
                            deduplication_id=f"rem-{task_id}-{mins}-{int(target.timestamp())}"
                        )
                        print(f"✅ [QSTASH REMINDER] Scheduled {mins}m prior alert for '{task_name}' (delay: {rem_delay}s)")
                    else:
                        print(f"⚠️ [QSTASH REMINDER] Reminder {mins}m prior for '{task_name}' is in the past ({abs(rem_delay)}s ago). Skipping.")
                except Exception as r_err:
                    print(f"Error scheduling reminder {m}m: {r_err}")

        # 2. Schedule DEADLINE ALARM (Triggers ONLY when the deadline/start time is reached)
        if not alarm_enabled:
            print(f"🛑 [ALARM DISABLED] User {user_id} has turned OFF alarms in settings. Skipping deadline alarm for '{task_name}'.")
            return

        delay_seconds = int((target - now).total_seconds())
        if delay_seconds <= 0:
            print(f"⚠️ [QSTASH ALARM] Scheduled deadline time {target} is in the past ({abs(delay_seconds)}s ago). Skipping alarm.")
            return

        qstash_client.message.publish_json(
            url=CLOUDFLARE_WORKER_URL,
            body={
                "title": f"🚨 ALARM: {task_name} Deadline Reached!",
                "body": f"Deadline for '{task_name}' has arrived! Complete your task now.",
                "requireInteraction": True,  # Persistent OS Alarm: Stays open on screen until dismissed
                "tag": f"alarm-{task_id}",
                "sound": "https://ai-based-smart-scheduling-engine.vercel.app/alarm.mp3",
                "pushSubscription": push_sub
            },
            delay=f"{delay_seconds}s",
            deduplication_id=f"main-{task_id}-{int(target.timestamp())}"
        )
        print(f"✅ [QSTASH ALARM] Scheduled Deadline Alarm for '{task_name}' at {target} (delay: {delay_seconds}s)")
    except Exception as e:
        print(f"❌ [QSTASH ERROR] Error scheduling push via QStash: {e}")

@router.post("/subscribe")
async def subscribe_push(sub: PushSubscription, user_id: str = Depends(get_current_user_id)):
    from .database import get_user_collection
    collection = get_user_collection()
    
    # Store subscription in user settings
    await collection.update_one(
        {"google_id": user_id},
        {"$set": {"settings.push_subscription": sub.model_dump()}},
        upsert=True
    )
    return {"success": True}


async def notify_user(user_id: str, title: str, message: str, type: str = "alert"):
    """
    Helper function to save notification to DB and broadcast real-time SSE push.
    Individual per-task email notifications are disabled to prevent email inbox clutter.
    """
    await save_notification_to_db(user_id, title, message, type)
    await dispatch_web_push(user_id, message, title)

@router.get("/stream")
async def notification_stream(request: Request, token: str):
    """
    SSE Endpoint for real-time web push notifications.
    Frontend connects to this via EventSource.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id: raise ValueError("No sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    q = asyncio.Queue()
    add_client(user_id, q)
    
    async def event_generator():
        try:
            while True:
                # Disconnect if client goes away
                if await request.is_disconnected():
                    break
                
                try:
                    import json
                    data = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield {
                        "event": "notification",
                        "data": json.dumps(data)
                    }
                except asyncio.TimeoutError:
                    # Send a keep-alive ping to prevent ERR_INCOMPLETE_CHUNKED_ENCODING timeout
                    yield {
                        "event": "ping",
                        "data": "keepalive"
                    }
        finally:
            remove_client(user_id, q)
            
    return EventSourceResponse(event_generator())

@router.get("/")
async def get_notifications(user_id: str = Depends(get_current_user_id)):
    from .database import get_database
    db = get_database()
    cursor = db["notifications"].find({"user_id": user_id}).sort("created_at", -1).limit(50)
    notifications = await cursor.to_list(length=50)
    for n in notifications:
        n["id"] = str(n.pop("_id"))
    return {"notifications": notifications}

@router.put("/{notification_id}/read")
async def mark_notification_read(notification_id: str, user_id: str = Depends(get_current_user_id)):
    from .database import get_database
    from bson import ObjectId
    db = get_database()
    try:
        await db["notifications"].update_one(
            {"_id": ObjectId(notification_id), "user_id": user_id},
            {"$set": {"is_read": True}}
        )
        return {"success": True}
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")

# Example endpoint to trigger a manual test notification
@router.post("/test")
async def test_notification(
    user_id: str = Depends(get_current_user_id),
):
    title = "TaskPulse Alert"
    message = "Your notification channels and schedule alerts are fully active."
    
    await notify_user(user_id, title, message, type="alert")
    return {"message": "Test notification dispatched"}
