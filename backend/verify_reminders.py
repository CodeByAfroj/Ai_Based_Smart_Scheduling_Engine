import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")

async def run():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client["scheduling_engine"]
    cursor = db["tasks"].find({"reminders": {"$exists": True, "$ne": []}})
    tasks = await cursor.to_list(length=100)
    print(f"Found {len(tasks)} tasks with reminders.")
    for t in tasks:
        print(f"- Task '{t.get('name')}': status={t.get('status')}, reminders={t.get('reminders')}, start={t.get('scheduled_start')}, alerted={t.get('alerted_reminders', [])}")

asyncio.run(run())
