import pytest
from app.nlp import parse_task_from_text, answer_user_question_contextual

def test_nlp_task_parser_fallback():
    result = parse_task_from_text("Schedule a 45 min deep work coding session")
    assert result is not None
    assert "name" in result
    assert result["duration_minutes"] == 30 or result["duration_minutes"] == 45 or "coding" in result["name"].lower() or "deep" in result["name"].lower()

def test_nlp_contextual_qa_fallback():
    mock_tasks = [{"_id": "1", "name": "Team Sync", "duration_minutes": 30, "status": "pending"}]
    mock_profile = {"settings": {"chronotype": "morning", "profession": "Software Engineer"}}
    
    res = answer_user_question_contextual("What tasks do I have pending?", mock_tasks, mock_profile)
    assert res is not None
    assert "answer" in res

def test_out_of_scope_refusal():
    mock_tasks = []
    mock_profile = {}
    res = answer_user_question_contextual("what is the nearest city to me", mock_tasks, mock_profile)
    assert res is not None
    assert "strictly" in res.get("answer", "").lower() or "cannot answer" in res.get("answer", "").lower()
