"""
Natural Language Processing Module for TaskPulse Assistant
Handles parsing of user commands and questions about tasks/schedule
"""
import re
import datetime
from typing import Dict, Any, Optional, List, Tuple
from zoneinfo import ZoneInfo

try:
    import spacy
    # Load the English model
    nlp = spacy.load("en_core_web_sm")
except OSError:
    # If model not found, we'll use a blank pipeline and rely on rule-based extraction
    nlp = spacy.blank("en")
    print("Warning: spaCy model not found. Using rule-based extraction only.")

IST = ZoneInfo("Asia/Kolkata")

def parse_task_from_text(text: str) -> Dict[str, Any]:
    """
    Parse natural language text to extract task parameters.
    
    Args:
        text: User input like "Schedule a team meeting tomorrow at 2pm for 1 hour"
        
    Returns:
        Dictionary with task parameters: name, earliest_start, deadline, duration_minutes, priority
    """
    # Initialize default values
    result = {
        "name": "",
        "earliest_start": None,
        "deadline": None,
        "duration_minutes": 30,  # default
        "priority": 1,           # default low
        "fixed": False
    }
    
    # Convert to lowercase for easier matching
    text_lower = text.lower().strip()
    
    # Extract task name - look for patterns like "task to do X", "schedule X", etc.
    name_patterns = [
        r"(?:schedule|add|create)\s+(?:a\s+|an\s+)?(?:task\s+)?(?:for\s+|to\s+)?([^,.!?]+?)(?:\s+at|\s+on|\s+in|\s+for|\s+$)",
        r"(?:i\s+want\s+to\s+do\s+|i\s+need\s+to\s+)(.+?)(?:\s+at|\s+on|\s+for|\s+$)",
        r"^(.+?)(?:\s+at|\s+on|\s+in|\s+for|\s+$)"
    ]
    
    for pattern in name_patterns:
        match = re.search(pattern, text_lower)
        if match:
            name = match.group(1).strip()
            # Clean up common words
            name = re.sub(r'^(a|an|the)\s+', '', name)
            if name and len(name) > 1:
                result["name"] = name
                break
    
    # If no name found via patterns, use first meaningful chunk
    if not result["name"]:
        # Remove time/date indicators and take what's left
        cleaned = re.sub(r'\b(?:at|on|in|for|tomorrow|today|next|last|am|pm)\b.*', '', text_lower)
        cleaned = re.sub(r'\s+\d+[\:\-]\d+.*', '', cleaned)
        cleaned = cleaned.strip()
        if cleaned and len(cleaned) > 2:
            result["name"] = cleaned.title()
    
    # Extract time patterns
    time_patterns = [
        r'(\d{1,2})\s*:\s*(\d{2})\s*(am|pm)',  # 2:30 pm
        r'(\d{1,2})\s*(am|pm)',                 # 2pm
        r'(\d{1,2})\s*:\s*(\d{2})',             # 14:30 (24-hour)
    ]
    
    for pattern in time_patterns:
        matches = re.findall(pattern, text_lower)
        if matches:
            # Take the first time mentioned
            match = matches[0]
            if len(match) == 3:  # HH:MM AM/PM
                hour, minute, meridiem = match
                hour = int(hour)
                minute = int(minute)
                if meridiem == 'pm' and hour != 12:
                    hour += 12
                elif meridiem == 'am' and hour == 12:
                    hour = 0
                result["time_specified"] = (hour, minute)
            elif len(match) == 2:  # Either HH AM/PM or HH:MM
                if match[1] in ['am', 'pm']:  # HH AM/PM
                    hour = int(match[0])
                    meridiem = match[1]
                    if meridiem == 'pm' and hour != 12:
                        hour += 12
                    elif meridiem == 'am' and hour == 12:
                        hour = 0
                    result["time_specified"] = (hour, 0)
                else:  # HH:MM 24-hour
                    hour, minute = int(match[0]), int(match[1])
                    result["time_specified"] = (hour, minute)
            break
    
    # Extract date patterns
    today = datetime.datetime.now(IST)
    date_patterns = [
        (r'\btomorrow\b', today + datetime.timedelta(days=1)),
        (r'\btoday\b', today),
        (r'\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b', 
         lambda m: _get_next_weekday(m.group(1), today)),
        (r'\blast\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b',
         lambda m: _get_last_weekday(m.group(1), today)),
        (r'\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b',  # MM/DD/YYYY or DD/MM/YYYY
         lambda m: _parse_date_from_match(m, today)),
    ]
    
    for pattern, date_value in date_patterns:
        match = re.search(pattern, text_lower)
        if match:
            if callable(date_value):
                try:
                    result["date_specified"] = date_value(match)
                except:
                    pass
            else:
                result["date_specified"] = date_value
            break
    
    # Extract duration patterns
    duration_patterns = [
        r'(\d+)\s*(?:hour|hr)s?',           # 2 hours
        r'(\d+)\s*(?:minute|min)s?',        # 30 minutes
        r'(\d+)\s*h',                       # 2h
        r'(\d+)\s*m',                       # 30m
    ]
    
    for pattern in duration_patterns:
        match = re.search(pattern, text_lower)
        if match:
            value = int(match.group(1))
            if 'hour' in pattern or 'h' in pattern:
                result["duration_minutes"] = value * 60
            else:
                result["duration_minutes"] = value
            break
    
    # Extract priority indicators
    if any(word in text_lower for word in ['critical', 'high priority', 'urgent', 'important']):
        result["priority"] = 4  # High
    elif any(word in text_lower for word in ['medium', 'normal']):
        result["priority"] = 2  # Medium
    elif any(word in text_lower for word in ['low', 'low priority']):
        result["priority"] = 1  # Low
    
    # Combine date and time if both specified
    if result.get("date_specified") and result.get("time_specified"):
        date_part = result["date_specified"]
        time_part = result["time_specified"]
        # Create datetime in IST
        dt = datetime.datetime(
            date_part.year, date_part.month, date_part.day,
            time_part[0], time_part[1],
            tzinfo=IST
        )
        result["earliest_start"] = dt
        # Default deadline to start time + duration
        result["deadline"] = dt + datetime.timedelta(minutes=result["duration_minutes"])
    elif result.get("date_specified"):
        # Only date specified - set to start of day
        date_part = result["date_specified"]
        dt = datetime.datetime(date_part.year, date_part.month, date_part.day, 9, 0, tzinfo=IST)  # Default 9 AM
        result["earliest_start"] = dt
        result["deadline"] = dt + datetime.timedelta(minutes=result["duration_minutes"])
    elif result.get("time_specified"):
        # Only time specified - assume today
        time_part = result["time_specified"]
        today_midnight = datetime.datetime(
            today.year, today.month, today.day, 0, 0, tzinfo=IST
        )
        dt = today_midnight.replace(hour=time_part[0], minute=time_part[1])
        # If time has passed, assume tomorrow
        if dt < today:
            dt += datetime.timedelta(days=1)
        result["earliest_start"] = dt
        result["deadline"] = dt + datetime.timedelta(minutes=result["duration_minutes"])
    
    # Clean up temporary fields
    result.pop("time_specified", None)
    result.pop("date_specified", None)
    
    return result

def _get_next_weekday(weekday_name: str, today: datetime.datetime) -> datetime.datetime:
    """Get the date of the next occurrence of a weekday"""
    weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    target_weekday = weekdays.index(weekday_name.lower())
    current_weekday = today.weekday()  # Monday is 0
    days_ahead = target_weekday - current_weekday
    if days_ahead <= 0:  # Target day already happened this week
        days_ahead += 7
    return today + datetime.timedelta(days=days_ahead)

def _get_last_weekday(weekday_name: str, today: datetime.datetime) -> datetime.datetime:
    """Get the date of the last occurrence of a weekday"""
    weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    target_weekday = weekdays.index(weekday_name.lower())
    current_weekday = today.weekday()  # Monday is 0
    days_behind = current_weekday - target_weekday
    if days_behind <= 0:  # Target day hasn't happened yet this week
        days_behind += 7
    return today - datetime.timedelta(days=days_behind)

def _parse_date_from_match(match: re.Match, today: datetime.datetime) -> datetime.datetime:
    """Parse date from regex match groups"""
    # This is simplified - assumes MM/DD/YYYY format for now
    # In production, you'd want to handle multiple formats and locales
    try:
        month, day, year = match.groups()
        month, day, year = int(month), int(day), int(year)
        if year < 100:
            year += 2000 if year < 50 else 1900
        return datetime.datetime(year, month, day, tzinfo=IST)
    except ValueError:
        # Fallback to tomorrow if parsing fails
        return today + datetime.timedelta(days=1)

def answer_user_question(question: str, user_tasks: List[Dict], user_profile: Dict) -> Dict[str, Any]:
    """
    Answer natural language questions about user's tasks and profile.
    
    Args:
        question: User's question like "How many tasks do I have today?"
        user_tasks: List of user's task dictionaries
        user_profile: User's profile dictionary
        
    Returns:
        Dictionary with answer and optional explanation
    """
    question_lower = question.lower().strip()
    
    # Get today's date in IST
    today = datetime.datetime.now(IST)
    today_start = datetime.datetime(today.year, today.month, today.day, 0, 0, 0, tzinfo=IST)
    today_end = today_start + datetime.timedelta(days=1)
    
    # Question: How many tasks do I have today?
    if any(phrase in question_lower for phrase in [
        "how many tasks", "count tasks", "number of tasks"
    ]) and any(phrase in question_lower for phrase in [
        "today", "this day"
    ]):
        today_tasks = [
            t for t in user_tasks 
            if t.get("scheduled_start") and 
            t["scheduled_start"] >= today_start and 
            t["scheduled_start"] < today_end
        ]
        return {
            "answer": f"You have {len(today_tasks)} task(s) scheduled for today.",
            "type": "count",
            "data": len(today_tasks)
        }
    
    # Question: How many critical/high priority tasks do I have?
    if any(phrase in question_lower for phrase in [
        "how many critical", "how many high priority", "count critical"
    ]):
        critical_tasks = [
            t for t in user_tasks 
            if t.get("priority", 1) >= 3  # High priority and above
        ]
        return {
            "answer": f"You have {len(critical_tasks)} critical/high priority task(s).",
            "type": "count",
            "data": len(critical_tasks)
        }
    
    # Question: How many tasks are pending/completed?
    if any(phrase in question_lower for phrase in [
        "how many pending", "count pending", "tasks left"
    ]):
        pending_tasks = [
            t for t in user_tasks 
            if t.get("status") == "pending"
        ]
        return {
            "answer": f"You have {len(pending_tasks)} pending task(s).",
            "type": "count",
            "data": len(pending_tasks)
        }
    
    if any(phrase in question_lower for phrase in [
        "how many completed", "count completed", "tasks finished"
    ]):
        completed_tasks = [
            t for t in user_tasks 
            if t.get("status") == "completed"
        ]
        return {
            "answer": f"You have {len(completed_tasks)} completed task(s).",
            "type": "count",
            "data": len(completed_tasks)
        }
    
    # Question: Is my profile complete?
    if any(phrase in question_lower for phrase in [
        "is my profile complete", "profile complete", "profile status"
    ]):
        # Check if essential profile fields are filled
        essential_fields = ["name", "profession", "work_style", "timezone", "work_start", "work_end"]
        filled_count = sum(1 for field in essential_fields if user_profile.get(field))
        total_fields = len(essential_fields)
        percentage = int((filled_count / total_fields) * 100) if total_fields > 0 else 0
        
        if percentage >= 80:
            status = "mostly complete"
        elif percentage >= 50:
            status = "partially complete"
        else:
            status = "incomplete"
            
        return {
            "answer": f"Your profile is {percentage}% complete ({status}).",
            "type": "profile_status",
            "data": {"percentage": percentage, "status": status}
        }
    
    # Question: What's on my schedule for today/tomorrow?
    if any(phrase in question_lower for phrase in [
        "what's on my schedule", "what do i have", "my schedule for"
    ]) and any(phrase in question_lower for phrase in [
        "today", "this day"
    ]):
        today_tasks = [
            t for t in user_tasks 
            if t.get("scheduled_start") and 
            t["scheduled_start"] >= today_start and 
            t["scheduled_start"] < today_end
        ]
        # Sort by start time
        today_tasks.sort(key=lambda x: x.get("scheduled_start") or datetime.datetime.min.replace(tzinfo=IST))
        
        if not today_tasks:
            return {
                "answer": "You have no tasks scheduled for today.",
                "type": "schedule",
                "data": []
            }
        
        task_list = []
        for task in today_tasks:
            start_time = task["scheduled_start"].strftime("%I:%M %p")
            task_list.append(f"• {start_time} - {task['name']}")
        
        return {
            "answer": f"Here's your schedule for today:\n" + "\n".join(task_list),
            "type": "schedule",
            "data": today_tasks
        }
    
    # Default response for unrecognized questions
    return {
        "answer": "I'm not sure how to answer that yet. Try asking about your task count, schedule, or profile status.",
        "type": "unknown",
        "data": None
    }