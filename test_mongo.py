import asyncio, pprint
from motor.motor_asyncio import AsyncIOMotorClient
async def main():
    db = AsyncIOMotorClient("mongodb://localhost:27017")["scheduling_engine"]
    tasks = await db["tasks"].find().to_list(100)
    print(f"Total tasks: {len(tasks)}")
    for t in tasks:
        print(f"ID: {t['_id']}, Status: {t['status']}, Name: {t['name']}")
asyncio.run(main())
