from pymongo import MongoClient
import os
import sys
client = MongoClient('mongodb://localhost:27017/')
db = client['adaptive_scheduler']
count = db['focus_sessions'].count_documents({})
print(f"Total focus sessions in DB: {count}")
for session in db['focus_sessions'].find().limit(5):
    print(session)
