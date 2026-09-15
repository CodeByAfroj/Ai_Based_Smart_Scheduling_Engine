# 🚀 TaskPulse Backend

The backend for TaskPulse is built using Python, FastAPI, and MongoDB. It handles the core logic for the AI scheduling engine, multi-LLM routing, and constraint programming via Google OR-Tools.

## 🛠️ Prerequisites
- Python 3.10+
- MongoDB database (local or MongoDB Atlas)

## ⚙️ Environment Variables Setup
Create a `.env` file in the root of the `backend/` directory and configure the necessary keys. 

**Template (`.env`):**
```env
# Database
MONGO_URI=mongodb+srv://<user>:<password>@cluster0.../?appName=Cluster0

# Authentication & Security
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
JWT_SECRET=super_secret_key_change_in_production

# Email Service (SMTP)
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587

# AI & LLM Providers
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
OLLAMA_API_KEY=your_ollama_key
OLLAMA_MODEL=gemma4:31b
OLLAMA_BASE_URL=https://api.ollama.com
```

## 🚀 Running the Server Locally

1. **Create and activate a virtual environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On macOS/Linux
   # .\venv\Scripts\activate # On Windows
   ```
2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
3. **Start the FastAPI server:**
   ```bash
   uvicorn app.main:app --reload
   ```
   The backend will be available at `http://127.0.0.1:8000`. You can view the interactive API documentation automatically at `http://127.0.0.1:8000/docs`.

## 🧪 Testing and Benchmarks

Run the unit tests via pytest:
```bash
PYTHONPATH=. pytest tests/
```

To run the Taillard Job-Shop Scheduling benchmark script:
```bash
python3 benchmark/benchmark.py
```
