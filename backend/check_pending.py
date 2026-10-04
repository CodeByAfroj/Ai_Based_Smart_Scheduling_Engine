from app.database import get_database
import asyncio

async def main():
    db = get_database()
    cursor = db["tasks"].find({"status": {"$in": ["pending", "scheduled"]}})
    tasks = await cursor.to_list(length=100)
    for t in tasks:
        print(f"ID: {t['_id']}, Name: {t.get('name')}, Status: {t.get('status')}, Fixed: {t.get('fixed')}, Start: {t.get('scheduled_start')}, End: {t.get('scheduled_end')}")

asyncio.run(main())
