import asyncio
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from .database import get_database, get_user_collection
from .notifications import dispatch_web_push, send_email_sync

IST = ZoneInfo("Asia/Kolkata")

def now_ist():
    return datetime.now(IST)

async def dispatch_notification_from_background(user_id: str, email: str, title: str, message: str):
    """
    Utility to dispatch notifications from background loops where FastAPI's 
    BackgroundTasks context is not available.
    """
    await dispatch_web_push(user_id, message, title)
    if email:
        # Run synchronous SMTP send in a thread so it doesn't block the asyncio loop
        asyncio.create_task(asyncio.to_thread(send_email_sync, email, title, message))

async def deadline_warnings_loop():
    """
    Runs every 5 minutes.
    Finds tasks scheduled to happen (or end) within the next 60 minutes
    that have not yet triggered a deadline warning.
    """
    while True:
        try:
            db = get_database()
            now = now_ist()
            next_hour = now + timedelta(minutes=60)
            
            # Find tasks where deadline is within 60 mins and hasn't been alerted
            cursor = db["tasks"].find({
                "status": "scheduled",
                "deadline": {"$gte": now, "$lte": next_hour},
                "deadline_alerted": {"$ne": True}
            })
            
            tasks = await cursor.to_list(length=100)
            user_collection = get_user_collection()
            
            for t in tasks:
                user_id = t.get("user_id")
                user = await user_collection.find_one({"google_id": user_id})
                if not user:
                    continue
                
                email = user.get("email", "")
                title = "Upcoming Deadline"
                message = f"Task '{t['name']}' is due within the next hour!"
                
                await dispatch_notification_from_background(user_id, email, title, message)
                
                # Mark as alerted
                await db["tasks"].update_one(
                    {"_id": t["_id"]},
                    {"$set": {"deadline_alerted": True}}
                )
                
        except Exception as e:
            print(f"Error in deadline_warnings_loop: {e}")
            
        # Wait 5 minutes before checking again
        await asyncio.sleep(300)

async def daily_summary_loop():
    """
    Runs every 1 hour.
    At 8:00 AM UTC (or equivalent local time if configured), it sends a summary
    of the day's scheduled tasks if one hasn't been sent yet today.
    """
    while True:
        try:
            now = now_ist()
            
            # Send summary between 8 AM and 9 AM IST
            if now.hour == 8:
                db = get_database()
                user_collection = get_user_collection()
                
                start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
                end_of_day = start_of_day + timedelta(days=1)
                
                users = await user_collection.find().to_list(length=100)
                for user in users:
                    user_id = user.get("google_id")
                    email = user.get("email")
                    
                    # Check if we already sent a summary for this user today
                    last_summary_date = user.get("last_summary_date")
                    if last_summary_date == start_of_day.strftime("%Y-%m-%d"):
                        continue
                        
                    # Find user's tasks scheduled for today
                    cursor = db["tasks"].find({
                        "user_id": user_id,
                        "status": "scheduled",
                        "scheduled_start": {"$gte": start_of_day, "$lt": end_of_day}
                    })
                    tasks = await cursor.to_list(length=100)
                    
                    if tasks:
                        title = "Your Daily Schedule Summary"
                        task_list = "<br>".join([f"- {t['name']} (at {t.get('scheduled_start').strftime('%H:%M')})" for t in tasks if t.get('scheduled_start')])
                        message = f"You have {len(tasks)} tasks scheduled today:<br><br>{task_list}"
                        
                        await dispatch_notification_from_background(user_id, email, title, message)
                        
                        # Record that we sent it today
                        await user_collection.update_one(
                            {"_id": user["_id"]},
                            {"$set": {"last_summary_date": start_of_day.strftime("%Y-%m-%d")}}
                        )
                        
        except Exception as e:
            print(f"Error in daily_summary_loop: {e}")
            
        # Wait 1 hour
        await asyncio.sleep(3600)

def start_background_jobs(app):
    """
    Called from main.py's lifespan manager to spin up background loops.
    """
    asyncio.create_task(deadline_warnings_loop())
    asyncio.create_task(daily_summary_loop())
    print("Background jobs started.")
