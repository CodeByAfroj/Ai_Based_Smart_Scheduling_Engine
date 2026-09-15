# 💻 TaskPulse Frontend

The frontend for TaskPulse is a responsive Single Page Application (SPA) built using React, Vite, TailwindCSS (Vanilla CSS design system), and WebGL/Three.js for the ChatGPT-style Voice Orb.

## 🛠️ Prerequisites
- Node.js 18.x or newer
- npm or yarn

## ⚙️ Environment Variables Setup
Create a `.env` file in the root of the `frontend/` directory and configure the backend URL.

**Template (`.env`):**
```env
# API URL connecting to the backend
VITE_API_BASE_URL=http://localhost:8000
```

## 🚀 Running the Frontend Locally

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Start the development server:**
   ```bash
   npm run dev
   ```
   The frontend will be available at `http://localhost:5173`. Open this URL in your browser to access the TaskPulse dashboard.
