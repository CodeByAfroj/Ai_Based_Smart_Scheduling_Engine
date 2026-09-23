from pymongo import MongoClient
import json
client = MongoClient("mongodb://localhost:27017/")
db = client["scheduling_db"]
tasks = list(db["tasks"].find().sort("created_at", -1).limit(5))
for t in tasks:
    t["_id"] = str(t["_id"])
    print(json.dumps(t, default=str))
