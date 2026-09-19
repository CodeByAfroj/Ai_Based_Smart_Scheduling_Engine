import datetime
from datetime import timezone
# mock db time
scheduled_time_from_db = datetime.datetime.now()
target = scheduled_time_from_db.astimezone(timezone.utc)
now = datetime.datetime.now(timezone.utc)
print((target - now).total_seconds())
