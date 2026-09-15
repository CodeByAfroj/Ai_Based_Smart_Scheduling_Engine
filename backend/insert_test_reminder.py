import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")
IST = ZoneInfo("Asia/Kolkata")

async def run():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client["scheduling_engine"]
    
    # We need a user to notify. Let's find the first user in the db.
    user = await db["users"].find_one()
    if not user:
        print("No user found")
        return
        
    now_ist = datetime.now(IST)
    start_time = now_ist + timedelta(minutes=2)
    end_time = start_time + timedelta(minutes=30)
    
    # Convert to naive UTC to match Motor's expected insertion behavior
    start_time_utc = start_time.astimezone(timezone.utc).replace(tzinfo=None)
    end_time_utc = end_time.astimezone(timezone.utc).replace(tzinfo=None)
    
    task_id = str(uuid.uuid4())
    task_doc = {
        "_id": task_id,
        "user_id": user["google_id"],
        "name": "Test Reminder Task",
        "duration_minutes": 30,
        "earliest_start": start_time_utc,
        "deadline": end_time_utc,
        "status": "scheduled",
        "scheduled_start": start_time_utc,
        "scheduled_end": end_time_utc,
        "reminders": [1], # remind 1 min before (which is 1 min from now)
        "alerted_reminders": [],
        "created_at": datetime.now(timezone.utc).replace(tzinfo=None)
    }
    
    await db["tasks"].insert_one(task_doc)
    print(f"Inserted test task {task_id} starting at {start_time.strftime('%H:%M:%S')} with 1-min reminder.")

asyncio.run(run())
