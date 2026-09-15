import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.models import Task

async def run():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["scheduling_engine"]
    cursor = db["tasks"].find({"status": {"$in": ["pending", "scheduled"]}})
    db_tasks = await cursor.to_list(length=100)
    for t in db_tasks:
        try:
            task = Task(
                id=str(t["_id"]),
                name=t["name"],
                duration_minutes=t["duration_minutes"],
                earliest_start=t["earliest_start"],
                deadline=t["deadline"],
                priority=t.get("priority", 1),
                fixed=t.get("fixed", False),
                preferred_start_after=t.get("preferred_start_after"),
                preferred_start_before=t.get("preferred_start_before"),
                resource_id=t.get("resource_id", "default"),
                predecessors=t.get("predecessors", [])
            )
            print("OK:", t["name"])
        except Exception as e:
            print("ERROR on", t.get("name"), e)

asyncio.run(run())
