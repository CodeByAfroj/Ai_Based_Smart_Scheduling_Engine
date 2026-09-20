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
    
    # Get the user's push subscription
    user = await db["users"].find_one({"email": "noreplybyusers@gmail.com"})
    if not user:
        print("User not found.")
        return
        
    push_sub = user.get("settings", {}).get("push_subscription")
    print(json.dumps(push_sub, indent=2))

if __name__ == "__main__":
    asyncio.run(check_db())
