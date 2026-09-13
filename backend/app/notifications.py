import asyncio
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import APIRouter, Depends, BackgroundTasks, Request
from fastapi import APIRouter, Depends, BackgroundTasks, Request, HTTPException
from sse_starlette.sse import EventSourceResponse
from .profile import get_current_user_id, JWT_SECRET
import jwt

router = APIRouter(prefix="/notifications", tags=["notifications"])

# Global dictionary to hold event queues for each connected user
connected_clients = {}

def add_client(user_id: str, q: asyncio.Queue):
    if user_id not in connected_clients:
        connected_clients[user_id] = []
    connected_clients[user_id].append(q)

def remove_client(user_id: str, q: asyncio.Queue):
    if user_id in connected_clients:
        connected_clients[user_id].remove(q)
        if not connected_clients[user_id]:
            del connected_clients[user_id]

async def dispatch_web_push(user_id: str, message: str, title: str = "TaskPulse Alert"):
    if user_id in connected_clients:
        for q in connected_clients[user_id]:
            await q.put({"title": title, "message": message})

def send_email_sync(to_email: str, subject: str, body: str):
    """
    Synchronous function to send email via SMTP.
    If no credentials are provided in the environment, it acts as a mock/simulator.
    """
    smtp_server = os.getenv("SMTP_SERVER")
    smtp_port = os.getenv("SMTP_PORT", 587)
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    
    # MOCK BEHAVIOR
    if not smtp_server or not smtp_user or not smtp_pass:
        print("\n" + "="*50)
        print("📧 [SIMULATED EMAIL DISPATCH]")
        print(f"TO: {to_email}")
        print(f"SUBJECT: {subject}")
        print("-" * 50)
        print(body)
        print("="*50 + "\n")
        return

    # REAL BEHAVIOR
    try:
        msg = MIMEMultipart()
        msg['From'] = smtp_user
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'html'))
        
        server = smtplib.SMTP(smtp_server, int(smtp_port))
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.send_message(msg)
        server.quit()
        print(f"Email successfully sent to {to_email}")
    except Exception as e:
        print(f"Failed to send email to {to_email}: {str(e)}")

async def notify_user(user_id: str, user_email: str, title: str, message: str, bg_tasks: BackgroundTasks):
    """
    Helper function to dispatch both web and email notifications concurrently
    """
    # 1. Dispatch Web Push instantly via SSE
    await dispatch_web_push(user_id, message, title)
    
    # 2. Dispatch Email via Background Task
    if user_email:
        bg_tasks.add_task(send_email_sync, user_email, title, message)

@router.get("/stream")
async def notification_stream(request: Request, token: str):
    """
    SSE Endpoint for real-time web push notifications.
    Frontend connects to this via EventSource.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id: raise ValueError("No sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    q = asyncio.Queue()
    add_client(user_id, q)
    
    async def event_generator():
        try:
            while True:
                # Disconnect if client goes away
                if await request.is_disconnected():
                    break
                # Wait for next notification
                data = await q.get()
                yield {
                    "event": "notification",
                    "data": str(data)
                }
        finally:
            remove_client(user_id, q)
            
    return EventSourceResponse(event_generator())

# Example endpoint to trigger a manual test notification
@router.post("/test")
async def test_notification(
    bg_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
):
    from .database import get_user_collection
    collection = get_user_collection()
    user = await collection.find_one({"google_id": user_id})
    email = user.get("email") if user else ""
    
    title = "System Test"
    message = "This is a test notification from the TaskPulse scheduling engine!"
    
    await notify_user(user_id, email, title, message, bg_tasks)
    return {"message": "Test notification dispatched"}
