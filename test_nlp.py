"""
Test script for NLP module
"""
from app.nlp import parse_task_from_text, answer_user_question_contextual
from zoneinfo import ZoneInfo
import datetime

IST = ZoneInfo("Asia/Kolkata")

def test_task_parsing():
    print("Testing task parsing...")
    
    test_cases = [
        "Schedule a team meeting tomorrow at 2pm for 1 hour",
        "I want to do laundry today at 5pm for 30 minutes",
        "Add a critical task: finish project proposal next Monday at 9am for 2 hours",
        "Schedule doctor appointment on 12/15/2026 at 10:30 am for 1 hour",
        "Create a low priority task to call mom",
        "Team meeting at 3pm today"
    ]
    
    for text in test_cases:
        print(f"\nInput: {text}")
        result = parse_task_from_text(text)
        print(f"Output: {result}")

def test_question_answering():
    print("\n\nTesting question answering...")
    
    # Sample tasks data
    sample_tasks = [
        {
            "_id": "1",
            "name": "Team meeting",
            "scheduled_start": datetime.datetime(2026, 9, 15, 14, 0, tzinfo=IST),
            "scheduled_end": datetime.datetime(2026, 9, 15, 15, 0, tzinfo=IST),
            "priority": 2,
            "status": "scheduled"
        },
        {
            "_id": "2",
            "name": "Finish project proposal",
            "scheduled_start": datetime.datetime(2026, 9, 16, 9, 0, tzinfo=IST),
            "scheduled_end": datetime.datetime(2026, 9, 16, 11, 0, tzinfo=IST),
            "priority": 4,
            "status": "pending"
        },
        {
            "_id": "3",
            "name": "Call mom",
            "scheduled_start": datetime.datetime(2026, 9, 14, 16, 0, tzinfo=IST),
            "scheduled_end": datetime.datetime(2026, 9, 14, 16, 15, tzinfo=IST),
            "priority": 1,
            "status": "completed"
        }
    ]
    
    sample_profile = {
        "name": "John Doe",
        "profession": "Software Engineer",
        "work_style": "Balanced",
        "timezone": "UTC+05:30 (IST)",
        "work_start": "09:30 AM",
        "work_end": "06:30 PM",
        "buffer_enabled": True,
        "push_notifications": True,
        "desktop_notifications": True,
        "email_summary": False,
        "notification_preference": "text_and_sound",
        "quiet_hours_start": "10:00 PM",
        "quiet_hours_end": "07:30 AM",
        "categories": ["Engineering", "Deep Work"],
        "is_complete": True
    }
    
    test_questions = [
        "How many tasks do I have today?",
        "How many critical tasks do I have?",
        "How many pending tasks do I have?",
        "How many completed tasks do I have?",
        "Is my profile complete?",
        "What's on my schedule for today?",
        "What do I have tomorrow?"
    ]
    
    for question in test_questions:
        print(f"\nQuestion: {question}")
        result = answer_user_question_contextual(question, sample_tasks, sample_profile)
        print(f"Answer: {result['answer']}")

if __name__ == "__main__":
    test_task_parsing()
    test_question_answering()