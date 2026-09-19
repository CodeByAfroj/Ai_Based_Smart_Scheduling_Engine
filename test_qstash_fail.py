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
    user = await db["users"].find_one({"email": "noreplybyusers@gmail.com"})
    push_sub = user.get("settings", {}).get("push_subscription")
    
    # Simulate st_item.start (Naive UTC time like from AI solver)
    start = datetime.datetime.utcnow() + datetime.timedelta(minutes=2)
    
    try:
        schedule_push_via_qstash(user["google_id"], "Test Task", start, push_sub)
        print("Success calling QStash!")
    except Exception as e:
        print("FAILED TO CALL QSTASH:", e)

asyncio.run(test())
