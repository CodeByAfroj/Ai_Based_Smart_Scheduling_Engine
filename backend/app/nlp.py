"""
Natural Language Processing & Contextual AI Assistant Module for TaskPulse
Features Multi-Tier Failover (Gemini -> Groq -> Ollama -> Fallback Engine)
Handles Rate Limits (HTTP 429) automatically with instant model switching.
"""
import re
import os
import json
import datetime
from typing import Dict, Any, Optional, List
from zoneinfo import ZoneInfo
import httpx

from dotenv import load_dotenv
load_dotenv()

IST = ZoneInfo("Asia/Kolkata")

def now_ist():
    return datetime.datetime.now(IST)

def get_gemini_key():
    return os.getenv("GEMINI_API_KEY", "").strip()

def get_groq_key():
    return os.getenv("GROQ_API_KEY", "").strip()

def get_ollama_key():
    return os.getenv("OLLAMA_API_KEY", "").strip()

def get_ollama_model():
    return os.getenv("OLLAMA_MODEL", "gemma4:31b")

def get_ollama_base_url():
    return os.getenv("OLLAMA_BASE_URL", "https://api.ollama.com").rstrip("/")

import time

_PROVIDER_COOLDOWN = {
    "gemini_until": 0,
    "groq_until": 0
}

def call_gemini_llm(messages: List[Dict[str, str]], timeout: float = 1.8) -> Optional[str]:
    """
    Tier 1: Google Gemini API (gemini-3.5-flash-lite)
    Short-circuits immediately if rate limited (429) or timed out.
    """
    api_key = get_gemini_key()
    if not api_key:
        return None

    # Skip if Gemini was recently rate-limited or timed out
    if time.time() < _PROVIDER_COOLDOWN["gemini_until"]:
        return None

    # Try top fast models max
    for model_name in ["gemini-3.5-flash-lite", "gemini-3.5-flash"]:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
            
            system_instruction = None
            contents = []

            for msg in messages:
                role = msg.get("role")
                content = msg.get("content", "")
                if role == "system":
                    system_instruction = {"parts": [{"text": content}]}
                elif role == "assistant":
                    contents.append({"role": "model", "parts": [{"text": content}]})
                else:
                    contents.append({"role": "user", "parts": [{"text": content}]})

            payload = {"contents": contents}
            if system_instruction:
                payload["systemInstruction"] = system_instruction

            headers = {"Content-Type": "application/json"}

            with httpx.Client(timeout=timeout) as client:
                resp = client.post(url, headers=headers, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            print(f"🤖 [AI Provider] Responded via Google Gemini API ({model_name}).")
                            return parts[0].get("text", "")
                elif resp.status_code in [429, 403, 400]:
                    print(f"⚠️ [AI Fast Switch] Gemini HTTP {resp.status_code} ({model_name}). Cooldowning Gemini for 180s...")
                    _PROVIDER_COOLDOWN["gemini_until"] = time.time() + 180
                    break
        except Exception as e:
            print(f"⚠️ [AI Fast Switch] Gemini timeout/exception ({model_name}). Cooldowning Gemini for 180s...")
            _PROVIDER_COOLDOWN["gemini_until"] = time.time() + 180
            break

    return None


def call_groq_llm(messages: List[Dict[str, str]], timeout: float = 2.5) -> Optional[str]:
    """
    Tier 2: Groq Cloud API (openai/gpt-oss-120b, groq/compound)
    Short-circuits immediately if rate-limited or timed out.
    """
    api_key = get_groq_key()
    if not api_key:
        return None

    if time.time() < _PROVIDER_COOLDOWN["groq_until"]:
        return None

    for model_name in ["openai/gpt-oss-120b", "groq/compound", "openai/gpt-oss-20b"]:
        try:
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": model_name,
                "messages": messages,
                "temperature": 0.3
            }

            with httpx.Client(timeout=timeout) as client:
                resp = client.post(url, headers=headers, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    choices = data.get("choices", [])
                    if choices:
                        print(f"⚡ [AI Provider] Responded via Groq API ({model_name}).")
                        return choices[0].get("message", {}).get("content", "")
                elif resp.status_code in [401, 400, 429, 403]:
                    print(f"⚠️ [AI Fast Switch] Groq HTTP {resp.status_code} ({model_name}). Cooldowning Groq for 180s...")
                    _PROVIDER_COOLDOWN["groq_until"] = time.time() + 180
                    break
        except Exception as e:
            print(f"⚠️ [AI Fast Switch] Groq timeout/exception ({model_name}). Cooldowning Groq for 180s...")
            _PROVIDER_COOLDOWN["groq_until"] = time.time() + 180
            break

    return None


def call_ollama_llm(messages: List[Dict[str, str]], timeout: float = 8.0) -> Optional[str]:
    """
    Tier 3: Ollama API
    """
    api_key = get_ollama_key()
    if not api_key:
        return None

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    try:
        url = f"{get_ollama_base_url()}/v1/chat/completions"
        payload = {
            "model": get_ollama_model(),
            "messages": messages,
            "temperature": 0.3
        }
        with httpx.Client(timeout=timeout) as client:
            resp = client.post(url, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                choices = data.get("choices", [])
                if choices:
                    print("🦙 [AI Provider] Responded via Ollama Cloud API.")
                    return choices[0].get("message", {}).get("content", "")
    except Exception as e:
        print(f"Ollama error: {e}")

    return None

def call_llm_with_failover(messages: List[Dict[str, str]], timeout: float = 5.0) -> Optional[str]:
    """
    Failover Chain: Gemini -> Groq -> Ollama
    Automatically switches if rate limits (429) or errors occur.
    """
    # 1. Try Gemini
    res = call_gemini_llm(messages, timeout=timeout)
    if res:
        return res

    # 2. Try Groq
    res = call_groq_llm(messages, timeout=timeout)
    if res:
        return res

    # 3. Try Ollama
    res = call_ollama_llm(messages, timeout=timeout)
    if res:
        return res

    return None

def answer_user_question_contextual(question: str, user_tasks: List[Dict], user_profile: Dict, history: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
    """
    Human-like contextual AI Assistant with multi-provider failover.
    """
    curr = now_ist()
    curr_str = curr.strftime("%Y-%m-%d %I:%M %p %Z (%A)")

    task_summaries = []
    for t in user_tasks[:30]:
        t_name = t.get("name", "Untitled")
        t_dur = t.get("duration_minutes", 30)
        t_status = t.get("status", "pending")
        t_start = t.get("scheduled_start", "Unscheduled")
        t_fixed = "Fixed Meeting" if t.get("fixed") else "Flexible Task"
        t_pri = t.get("priority", 1)
        task_summaries.append(f"- [{t_status.upper()}] '{t_name}' ({t_dur} mins, Priority {t_pri}, {t_fixed}, Start: {t_start})")

    tasks_str = "\n".join(task_summaries) if task_summaries else "No active tasks currently."

    profile_settings = user_profile.get("settings", {})
    prof_str = (
        f"Profession: {profile_settings.get('profession', 'General User')}, "
        f"Chronotype: {profile_settings.get('chronotype', 'morning')}, "
        f"Work Window: {profile_settings.get('work_start', '09:30 AM')} to {profile_settings.get('work_end', '06:30 PM')}, "
        f"Peak Energy Window: {profile_settings.get('peak_start', '09:00 AM')} to {profile_settings.get('peak_end', '01:00 PM')}"
    )

    system_prompt = f"""You are TaskPulse AI, a versatile, warm, highly intelligent, and empathetic human-like personal AI companion.
You sound completely natural, engaging, friendly, and helpful. You are open to conversing on ANY topic (general knowledge, coding, advice, daily motivation, ideas, or casual conversation) while staying aware of the user's schedule and energy context.

Current Local Time (IST): {curr_str}

User Biometric Profile:
{prof_str}

Current Workspace Tasks & Schedule:
{tasks_str}

RESPONSE INSTRUCTIONS:
1. Speak naturally like a friendly, intelligent human companion. Use clear markdown formatting.
2. CRITICAL TASK CREATION RULE:
   - ONLY output a `create_task` JSON block if the user has specified an EXPLICIT task/meeting name in their message (e.g., "Schedule a 45 min team sync tomorrow at 10 AM with high priority").
   - NEVER output a `create_task` JSON block for vague requests like "schedule a task for me", "add a task", or "make a meeting".
   - If the request is vague or missing details, DO NOT create a task yet. Instead, ask the user warm clarification questions to gather:
     • Task Name / Title
     • Duration & Start Time / Date
     • Priority (Low, Medium, High, Critical)
     • Type: Fixed event at a specific time OR Flexible task
3. If a task creation JSON block is included, place it at the VERY END inside triple backticks:
```json
{{
  "action": "create_task",
  "params": {{
    "name": "Task Name",
    "duration_minutes": 30,
    "earliest_start": "YYYY-MM-DDTHH:MM:SS+05:30",
    "deadline": "YYYY-MM-DDTHH:MM:SS+05:30",
    "priority": 3,
    "fixed": false
  }}
}}
```
4. Maintain a warm, encouraging, positive, and human tone at all times.
"""


    messages = [{"role": "system", "content": system_prompt}]

    if history:
        # Filter out trailing duplicate question if already present in history payload
        filtered_history = [t for t in history if (t.get("content") or t.get("text", "")).strip() != question.strip()]
        for turn in filtered_history[-8:]:
            r = "assistant" if turn.get("role") in ["assistant", "ai"] else "user"
            content = turn.get("content") or turn.get("text", "")
            if content:
                messages.append({"role": r, "content": content})

    messages.append({"role": "user", "content": question})

    llm_output = call_llm_with_failover(messages)

    if llm_output:
        # Check if json task action block is embedded in text
        json_match = re.search(r"```json\s*(\{.*?\})\s*```", llm_output, re.DOTALL)
        if json_match:
            try:
                action_data = json.loads(json_match.group(1))
                clean_answer = re.sub(r"```json\s*\{.*?\}\s*```", "", llm_output, flags=re.DOTALL).strip()
                action_data["answer"] = clean_answer
                return action_data
            except Exception:
                pass

        return {
            "action": "answer",
            "answer": llm_output.strip(),
            "type": "text"
        }

    # Fallback to local rule engine if all APIs are unconfigured or fail
    return answer_user_question_fallback(question, user_tasks, user_profile)

def parse_task_from_text(text: str) -> Dict[str, Any]:
    """
    Parse natural language text to extract task parameters with failover.
    """
    curr = now_ist()
    curr_str = curr.strftime("%Y-%m-%d %I:%M %p %Z (%A)")

    system_prompt = f"""You are a natural language task parser for TaskPulse.
Current Local Time (IST): {curr_str}

Extract task parameters from user input. Return strictly valid JSON ONLY:
{{
  "name": "Task Title",
  "duration_minutes": 30,
  "earliest_start": "YYYY-MM-DDTHH:MM:SS+05:30",
  "deadline": "YYYY-MM-DDTHH:MM:SS+05:30",
  "priority": 2,
  "fixed": false
}}

Priority scale: 1=Low, 2=Medium, 3=High, 5=Critical.
If fixed meeting/event is mentioned, set "fixed": true and deadline = earliest_start.
If no start time mentioned, set earliest_start to current time. Default deadline to earliest_start + 2 days if not specified.
"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": text}
    ]

    llm_output = call_llm_with_failover(messages)

    if llm_output:
        try:
            cleaned = llm_output.strip()
            if cleaned.startswith("```"):
                cleaned = re.sub(r"^```(?:json)?\n?", "", cleaned)
                cleaned = re.sub(r"\n?```$", "", cleaned)
            data = json.loads(cleaned.strip())
            return data
        except Exception as e:
            print(f"Parse task LLM JSON error: {e}")

    return parse_task_from_text_fallback(text)

def answer_user_question_fallback(question: str, user_tasks: List[Dict], user_profile: Dict) -> Dict[str, Any]:
    """
    Fallback deterministic Q&A rule engine.
    """
    question_lower = question.lower().strip()
    today = now_ist()

    if any(p in question_lower for p in ["today", "schedule today", "tasks today"]):
        today_tasks = [t for t in user_tasks if t.get("scheduled_start") and str(t["scheduled_start"]).startswith(today.strftime("%Y-%m-%d"))]
        return {
            "action": "answer",
            "answer": f"You have **{len(today_tasks)} task(s)** scheduled for today.",
            "type": "count",
            "data": len(today_tasks)
        }

    return {
        "action": "answer",
        "answer": f"I reviewed your workspace context. You currently have **{len(user_tasks)} active tasks** scheduled.",
        "type": "summary"
    }

def parse_task_from_text_fallback(text: str) -> Dict[str, Any]:
    """
    Fallback deterministic task rule parser.
    """
    curr = now_ist()
    return {
        "name": text.title(),
        "duration_minutes": 30,
        "earliest_start": curr.isoformat(),
        "deadline": (curr + datetime.timedelta(days=2)).isoformat(),
        "priority": 2,
        "fixed": "meeting" in text.lower() or "fixed" in text.lower()
    }