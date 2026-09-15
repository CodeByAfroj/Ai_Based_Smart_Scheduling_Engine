import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["scheduler_db"]
    tasks = await db["tasks"].find().to_list(100)
    print("Tasks:", [t.get("name") for t in tasks])
    for t in tasks:
        if "reminders" in t:
            print(t["name"], t["reminders"])

asyncio.run(run())
