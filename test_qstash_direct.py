import os, sys, datetime, asyncio
sys.path.append(os.path.abspath('backend'))
from dotenv import load_dotenv
load_dotenv("backend/.env")
from motor.motor_asyncio import AsyncIOMotorClient
MONGO_URI = os.getenv("MONGO_URI")

from app.notifications import schedule_push_via_qstash
from datetime import timezone

async def test():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client["scheduling_engine"]
    # Get the latest task
    task = await db["tasks"].find_one({"name": "🙂‍↔️"})
    user = await db["users"].find_one({"email": "noreplybyusers@gmail.com"})
    
    push_sub = user.get("settings", {}).get("push_subscription")
    start = task.get("scheduled_start")
    print(f"Task start from DB: {start} (type: {type(start)})")
    
    # Try to schedule it again right now to see if it throws an error!
    now = datetime.datetime.now(timezone.utc)
    target = start.astimezone(timezone.utc)
    delay_seconds = int((target - now).total_seconds())
    print(f"Calculated delay: {delay_seconds} seconds")
    
    try:
        schedule_push_via_qstash("noreplybyusers@gmail.com", str(task.get("_id", "test_id")) if task else "test_id", "🙂‍↔️ Test", start, push_sub)
        print("Success calling QStash!")
    except Exception as e:
        print("FAILED TO CALL QSTASH:", e)

asyncio.run(test())
