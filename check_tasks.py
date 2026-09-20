import asyncio
import os
import json
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("backend/.env")

MONGO_URI = os.getenv("MONGO_URI")

async def check_db():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client["scheduling_engine"]
    
    # Get recent tasks
    cursor = db["tasks"].find().sort("_id", -1).limit(2)
    tasks = await cursor.to_list(length=2)
    for t in tasks:
        print("Task Name:", t.get("name"))
        print("Earliest Start:", t.get("earliest_start"))
        print("Deadline:", t.get("deadline"))
        print("---")

if __name__ == "__main__":
    asyncio.run(check_db())
