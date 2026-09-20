import os
import sys
sys.path.append(os.path.abspath('backend'))
from dotenv import load_dotenv

load_dotenv("backend/.env")

from app.notifications import schedule_push_via_qstash
from datetime import datetime, timezone, timedelta

# Dummy push sub
push_sub = {
    "endpoint": "https://fcm.googleapis.com/fcm/send/fake",
    "keys": {
        "p256dh": "fake",
        "auth": "fake"
    }
}

target_time = datetime.now(timezone.utc) + timedelta(minutes=1)
schedule_push_via_qstash("test_user", "test_task_id", "Test Task", target_time, push_sub)
print("Successfully scheduled push in QStash.")
