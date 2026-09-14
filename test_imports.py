"""
Test script to verify imports work
"""
print("Testing imports...")

try:
    from app import nlp
    print("✓ app.nlp imported successfully")
except Exception as e:
    print(f"✗ Failed to import app.nlp: {e}")

try:
    from app.nlp import parse_task_from_text, answer_user_question
    print("✓ parse_task_from_text and answer_user_question imported successfully")
except Exception as e:
    print(f"✗ Failed to import NLP functions: {e}")

try:
    from app.nlp_routes import router
    print("✓ NLP routes imported successfully")
except Exception as e:
    print(f"✗ Failed to import NLP routes: {e}")

print("Import test completed.")