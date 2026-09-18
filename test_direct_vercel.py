import os
import sys
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("backend/.env")

MONGO_URI = os.getenv("MONGO_URI")

async def test_direct_push():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client["scheduling_engine"]
    
    # Get the user's push subscription
    user = await db["users"].find_one({"email": "noreplybyusers@gmail.com"})
    if not user:
        print("User not found.")
        return
        
    push_sub = user.get("settings", {}).get("push_subscription")
    if not push_sub:
        print("Push subscription not found in database! The phone never subscribed.")
        return
        
    print("Found push subscription in database.")
    
    # Send directly to Vercel
    import requests
    url = "https://ai-based-smart-scheduling-engine.vercel.app/api/push"
    
    print("Hitting Vercel API directly...")
    res = requests.post(
        url,
        json={"title": "Direct Vercel Database Test", "pushSubscription": push_sub},
        headers={"upstash-signature": "bypass-signature-check"}
    )
    
    print("Vercel Response Code:", res.status_code)
    print("Vercel Response Body:", res.text)

if __name__ == "__main__":
    asyncio.run(test_direct_push())
