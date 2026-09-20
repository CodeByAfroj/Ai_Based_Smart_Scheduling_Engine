import os
import sys
import asyncio
from datetime import datetime, timezone, timedelta
sys.path.append(os.path.abspath('backend'))
from dotenv import load_dotenv

load_dotenv("backend/.env")

from app.notifications import schedule_push_via_qstash
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = os.getenv("MONGO_URI")

async def full_integration_test():
    print("1. Connecting to Production Database...")
    client = AsyncIOMotorClient(MONGO_URI)
    db = client["scheduling_engine"]
    
    # Fetch the user's active push subscription
    user = await db["users"].find_one({"email": "noreplybyusers@gmail.com"})
    if not user:
        print("FAIL: Could not find user in database.")
        return
        
    push_sub = user.get("settings", {}).get("push_subscription")
    if not push_sub:
        print("FAIL: User does not have a push subscription in the database.")
        return
        
    print("2. Success! Found Push Subscription for user.")
    
    print("3. Triggering the Backend AI Scheduling Logic...")
    # Schedule it 1 second into the future so QStash fires immediately
    target_time = datetime.now(timezone.utc) + timedelta(seconds=1)
    
    try:
        schedule_push_via_qstash("noreplybyusers@gmail.com", "test_task_id", "Agent Integration Test", target_time, push_sub)
        print("4. Success! Backend successfully handed off the payload to QStash.")
        print("5. QStash is now sending the webhook to Vercel.")
        print("6. If Vercel processes it correctly, your phone will ring right NOW!")
    except Exception as e:
        print(f"FAIL: Backend crashed while sending to QStash: {e}")

if __name__ == "__main__":
    asyncio.run(full_integration_test())
