import os, asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv("backend/.env")
MONGO_URI = os.getenv("MONGO_URI")
async def check_db():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client["scheduling_engine"]
    user = await db["users"].find_one({"google_id": "100418553133939475452"})
    if user:
        print("User Email:", user.get("email"))
        print("Has Push Sub:", "push_subscription" in user.get("settings", {}))
asyncio.run(check_db())
