import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["taskpulse"]
    tasks = await db["tasks"].find({}).to_list(10)
    for t in tasks:
        print(f"Task: {t.get('name')}, Status: {t.get('status')}, Deadline: {t.get('deadline')}, Scheduled_end: {t.get('scheduled_end')}")

asyncio.run(main())
