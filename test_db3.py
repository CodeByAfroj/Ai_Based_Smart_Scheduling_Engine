import os, asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv("backend/.env")
MONGO_URI = os.getenv("MONGO_URI")
async def check_db():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client["scheduling_engine"]
    
    tasks = await db["tasks"].find({"name": "terminatior"}).sort("created_at", -1).limit(1).to_list(1)
    for t in tasks:
        print("Task:", t.get("name"), "Start:", t.get("scheduled_start"), "Created:", t.get("created_at"))
asyncio.run(check_db())
