from datetime import datetime, timedelta
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def create_test_task():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["scheduling_app"]
    
    # Get any user
    user = await db["users"].find_one()
    if not user:
        print("No user found")
        return
        
    now = datetime.utcnow()
    # Create task that was scheduled to end 1 minute ago
    task = {
        "user_id": user["google_id"],
        "name": "ALARM_TEST_TASK_123",
        "duration_minutes": 30,
        "status": "scheduled",
        "scheduled_start": (now - timedelta(minutes=31)).isoformat() + "Z",
        "scheduled_end": (now - timedelta(minutes=1)).isoformat() + "Z",
        "deadline": (now + timedelta(days=1)).isoformat() + "Z",
    }
    
    await db["tasks"].insert_one(task)
    print("Test task created successfully")

asyncio.run(create_test_task())
