import os, asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv("backend/.env")
MONGO_URI = os.getenv("MONGO_URI")
async def check_db():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client["scheduling_engine"]
    tasks = await db["tasks"].find({}).sort("created_at", -1).limit(5).to_list(5)
    for t in tasks:
        print("User:", t.get("user_id"), "Task:", t.get("name"), "Start:", t.get("scheduled_start"))
asyncio.run(check_db())
