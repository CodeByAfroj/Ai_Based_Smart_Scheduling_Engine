# TaskPulse Assistance Feature Implementation

## Overview
This implementation adds a natural language assistant to the TaskPulse scheduling application that allows users to:
1. Create tasks using natural language (e.g., "Schedule a team meeting tomorrow at 2pm for 1 hour")
2. Ask questions about their data (e.g., "How many tasks do I have today?", "Is my profile complete?")
3. Get intelligent responses and task suggestions

## Components Created

### Backend Components
1. **`backend/app/nlp.py`** - Core NLP processing logic:
   - `parse_task_from_text()`: Extracts task parameters from natural language
   - `answer_user_question()`: Answers questions about user's tasks and profile
   - Helper functions for date/time parsing and entity recognition

2. **`backend/app/nlp_routes.py`** - API endpoints:
   - `POST /nlp/parse-task` - Parses task creation requests
   - `POST /nlp/query` - Answers user questions

3. **Updates to `backend/requirements.txt`**:
   - Added `spacy>=3.0.0` for NLP processing

### Frontend Components
1. **`frontend/src/components/ChatInterface.jsx`** - Main chat interface:
   - Message display area with user/bot differentiation
   - Input field with send button
   - Voice input placeholder (can integrate with existing VoiceButton)
   - Task suggestion panel showing parsed task details
   - Auto-filling capability for task forms

2. **`frontend/src/components/ChatButton.jsx`** - Floating action button:
   - Zap icon button that opens/closes the chat interface
   - Positioned fixed at bottom-right corner

### Integration Points
To complete the integration, the following steps are needed:

#### Backend Integration
1. In `backend/app/main.py`:
   - Add import: `from . import nlp_routes`
   - Add route: `app.include_router(nlp_routes.router)`
   - Place this with the other router inclusions (around line 36-40)

2. Install NLP dependencies:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```
   This will install spaCy and download the English model

#### Frontend Integration
1. Import ChatButton in `Layout.jsx` and add it to the layout:
   - Could add to the header actions or as a floating button
   - Example placement: in the desktop header actions area

2. The ChatInterface component is designed to:
   - Accept voice input (can connect to existing VoiceButton)
   - Auto-suggest task form filling when a task is parsed
   - Refresh task list after task creation
   - Handle loading states and error cases

## Usage Examples

### Task Creation
User says/types: "Schedule a team meeting tomorrow at 2pm for 1 hour"
Assistant responds with parsed task details and offers to fill the form
User confirms and task form is pre-filled with:
- Name: "Team meeting"
- Date: Tomorrow's date
- Time: 2:00 PM (14:00)
- Duration: 60 minutes
- Priority: Normal (default)

### Question Answering
User asks: "How many critical tasks do I have today?"
Assistant responds: "You have 2 critical task(s) scheduled for today."
With explanation of which tasks are considered critical (priority >= 3)

User asks: "Is my profile complete?"
Assistant responds: "Your profile is 85% complete (mostly complete)."
With breakdown of which profile fields are missing

## Technical Details

### NLP Approach
The implementation uses a hybrid approach:
- **Rule-based extraction** with regex patterns for reliable date/time/number parsing
- **spaCy** for advanced NLP capabilities (when available)
- **Fallback to blank spaCy pipeline** if model not available
- **ZoneInfo** for proper IST timezone handling

### Date/Time Handling
All times are stored and processed in IST (UTC+5:30)
- Uses `zoneinfo.ZoneInfo("Asia/Kolkata")` for timezone conversions
- Properly handles daylight daylight transitions
- Consistent formatting for display and storage

### Security
- All endpoints require authentication via JWT token
- User data is scoped to the current user only
- Input validation and sanitization
- Error handling prevents information leakage

## Extensibility
The system is designed to be extended:
- Add more intent patterns in `nlp.py`
- Integrate with LLMs for more complex understanding
- Add support for recurring tasks
- Add calendar integration queries
- Add natural language schedule modifications ("Move my 2pm meeting to 3pm")

## Limitations & Future Work
1. **spaCy Model**: Requires downloading the `en_core_web_sm` model (~50MB)
   - Solution: Include in setup instructions or use smaller model
   
2. **Language Support**: Currently English-only
   - Solution: Add multi-language support with language detection

3. **Complex Queries**: Limited to predefined question patterns
   - Solution: Integrate with LLM for open-ended question answering

4. **Voice Integration**: Voice input placeholder needs connection to existing VoiceButton
   - Solution: Connect the ChatInterface's voice button to the existing speech-to-text capabilities

## Files Created
- `backend/app/nlp.py`
- `backend/app/nlp_routes.py`
- `frontend/src/components/ChatInterface.jsx`
- `frontend/src/components/ChatButton.jsx`
- Updated `backend/requirements.txt`
- `backend/app/__init__.py` (ensures package structure)
- Test files: `test_nlp.py`, `test_imports.py`

## Next Steps
1. Install dependencies: `pip install -r backend/requirements.txt`
2. Download spaCy model: `python -m spacy download en_core_web_sm`
3. Integrate routes into main.py
4. Integrate ChatButton into Layout.jsx
5. Connect voice input to existing VoiceButton component
6. Style and customize as needed