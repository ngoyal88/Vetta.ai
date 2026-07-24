# 🎯 Vetta.ai - AI-Powered Mock Interview Platform

<div align="center">

![Vetta.ai Badge](https://img.shields.io/badge/Vetta.ai-AI%20Interviews-00bcd4?style=for-the-badge)
[![React](https://img.shields.io/badge/React-19.1.0-61DAFB?style=flat&logo=react)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110.0-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat&logo=python)](https://www.python.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Master technical interviews with real-time AI voice interactions, live coding challenges, and instant feedback**
</div>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Key Features](#-features)
- [Technology Stack](#-technology-stack)
- [Architecture](#-architecture)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage Guide](#-usage-guide)
- [API Documentation](#-api-documentation)
- [Project Structure](#-project-structure)
---

## 🌟 Overview

**Vetta.ai** is an advanced AI-powered mock interview platform designed to help software developers and engineers prepare for technical interviews. The platform features real-time voice conversations with an AI interviewer (LiveKit + Deepgram STT + Edge TTS), optional live coding challenges, and comprehensive feedback via the platform LLM (Groq default; Gemini optional).

> **Runtime note:** The primary interview transport is the **LiveKit agent** (`backend/run_livekit_agent.py`). WebSocket routes in `websocket_routes.py` are deprecated and not mounted. Post-session feedback and REST `/interview/complete` share `completion_guard.py` for idempotent completion.

### What Makes Vetta.ai Unique?

- 🎤 **Real-Time Voice Interaction**: Natural conversations using Deepgram STT and ElevenLabs TTS
- 💻 **Live Coding Environment**: Integrated Monaco Editor with Judge0 code execution
- 🧠 **Smart AI Interviewer**: Context-aware questions using Gemini 2.0 Flash
- 📄 **Resume-Based Questions**: Upload your resume for personalized interview questions
- 🎯 **Multiple Interview Types**: DSA, Frontend, Backend, System Design, Behavioral, and Custom Roles
- ⚡ **Instant Feedback**: Comprehensive analysis with actionable improvement suggestions
- 🔄 **Real-Time WebSocket**: Low-latency bi-directional communication
- 🎨 **Modern UI/UX**: Beautiful, responsive interface built with React and Tailwind CSS

---

## ✨ Features

### 🎙️ Voice-Powered Interviews

- **Natural Speech Recognition**: Powered by Deepgram Nova-2 for accurate real-time transcription
- **Human-Like AI Voice**: ElevenLabs TTS with professional voice synthesis
- **Echo Prevention**: Advanced audio processing to prevent feedback loops
- **Voice Activity Detection (VAD)**: Auto-stops recording after silence
- **Interruption Support**: Interrupt AI responses naturally

### 💻 Coding Challenges

- **Live Code Editor**: Monaco Editor (VS Code engine) with syntax highlighting
- **Multi-Language Support**: Python, JavaScript, C++, C, Java, Go, Rust
- **Real-Time Execution**: Judge0 API for instant code testing
- **Test Case Validation**: Run code against multiple test cases
- **Detailed Feedback**: Execution time, memory usage, and pass/fail results

### 🤖 AI Intelligence

- **Context-Aware Questions**: Gemini AI generates relevant follow-up questions
- **Resume Analysis**: Parses PDF/DOCX/TXT resumes to create personalized questions
- **Adaptive Difficulty**: Adjusts question complexity based on performance
- **Comprehensive Feedback**: Detailed analysis of technical skills and communication

### 🎯 Interview Types

1. **DSA (Data Structures & Algorithms)**: Coding problems with test cases
2. **Frontend Development**: React, JavaScript, HTML, CSS, performance
3. **Backend Development**: APIs, databases, scalability, system design
4. **Core Computer Science**: OS, Networks, DBMS, algorithms
5. **Behavioral**: STAR method, teamwork, problem-solving scenarios
6. **Resume-Based**: Questions tailored to your experience
7. **Custom Role**: Specify any role (e.g., DevOps Engineer, ML Engineer)

### 🔒 Security & Authentication

- **Firebase Authentication**: Secure user management with email/password
- **API Token Protection**: All backend routes protected with bearer tokens
- **Session Management**: Redis-based session storage with expiration
- **Firestore Integration**: User profiles and interview history

---

## 🛠️ Technology Stack

### Frontend

| Technology | Purpose | Version |
|------------|---------|---------|
| **React** | UI Framework | 19.1.0 |
| **Tailwind CSS** | Styling | 3.4.17 |
| **Framer Motion** | Animations | 12.23.24 |
| **Monaco Editor** | Code Editor | 4.7.0 |
| **React Router** | Navigation | 7.6.2 |
| **Axios** | HTTP Client | 1.10.0 |
| **React Hot Toast** | Notifications | 2.6.0 |
| **Lucide React** | Icons | 0.525.0 |

### Backend

| Technology | Purpose | Version |
|------------|---------|---------|
| **FastAPI** | Web Framework | 0.110.0 |
| **Python** | Language | 3.11+ |
| **Pydantic** | Data Validation | 2.10.0 |
| **Uvicorn** | ASGI Server | 0.27.0 |
| **WebSockets** | Real-Time Communication | 12.0 |
| **Redis** | Session Storage | 5.0.2 |
| **Firebase Admin** | Authentication & Database | Latest |

### AI & Speech Services

| Service | Purpose | Configuration |
|---------|---------|---------------|
| **Google Gemini AI** | Question Generation & Feedback | gemini-2.0-flash-live |
| **Deepgram** | Speech-to-Text | Nova-2 model |
| **ElevenLabs** | Text-to-Speech | Turbo v2 model |
| **Judge0** | Code Execution | RapidAPI |

### Infrastructure

- **Docker**: Containerization for easy deployment
- **Docker Compose**: Multi-container orchestration
- **Redis**: In-memory data store for sessions
- **Firebase Firestore**: NoSQL database for user data

---

## 🏗️ Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (React)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   UI Layer   │  │ Audio Utils  │  │  WebSocket   │      │
│  │   - Pages    │  │  - Recorder  │  │    Client    │      │
│  │   - Comps    │  │  - Player    │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                         WebSocket │ HTTP
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Backend (FastAPI)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Routes     │  │   Services   │  │    Utils     │      │
│  │  - Interview │  │  - Gemini    │  │  - Redis     │      │
│  │  - Resume    │  │  - Deepgram  │  │  - Logger    │      │
│  │  - WebSocket │  │  - ElevenLabs│  │  - Auth      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
            ┌───────▼──────┐    ┌──────▼───────┐
            │    Redis     │    │   Firebase   │
            │  (Sessions)  │    │ (Users/Auth) │
            └──────────────┘    └──────────────┘
                    │
        ┌───────────┼───────────┬─────────────┐
        │           │           │             │
   ┌────▼────┐ ┌───▼────┐ ┌────▼─────┐ ┌────▼────┐
   │ Gemini  │ │Deepgram│ │ElevenLabs│ │ Judge0  │
   │   AI    │ │  (STT) │ │  (TTS)   │ │ (Code)  │
   └─────────┘ └────────┘ └──────────┘ └─────────┘
```

### WebSocket Communication Flow

```
Client                  Backend                 External Services
  │                        │                            │
  ├─── Connect WS ────────>│                            │
  │<─── Connected ─────────┤                            │
  │                        │                            │
  ├─── Start Interview ───>│                            │
  │                        ├─── Generate Q ──────────>  │ Gemini AI
  │                        │<─── Question ──────────────┤
  │                        ├─── Text to Speech ──────>  │ ElevenLabs
  │                        │<─── Audio ─────────────────┤
  │<─── Question + Audio ──┤                            │
  │                        │                            │
  ├─── Audio Stream ──────>│                            │
  │                        ├─── Transcribe ──────────>  │ Deepgram
  │                        │<─── Transcript ────────────┤
  │<─── Live Transcript ───┤                            │
  │                        │                            │
  ├─── Code Submit ───────>│                            │
  │                        ├─── Execute ───────────────>│ Judge0
  │                        │<─── Results ───────────────┤
  │<─── Test Results ──────┤                            │
  │                        │                            │
  ├─── End Interview ─────>│                            │
  │                        ├─── Generate Feedback ────> │ Gemini AI
  │                        │<─── Feedback ──────────────┤
  │<─── Final Feedback ────┤                            │
  │                        │                            │
```

---

## 📦 Installation

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.11+
- **Docker** and Docker Compose (optional but recommended)
- **Redis** 7+ (or use Docker)
- **Firebase Project** with Firestore enabled
- API Keys for:
  - Google Gemini AI
  - Deepgram
  - ElevenLabs
  - Judge0 (RapidAPI)

### Method 1: Docker Compose (Recommended)

1. **Clone the repository**:
```bash
git clone https://github.com/ngoyal88/vetta-ai.git
cd vetta-ai
```

2. **Create environment file**:
```bash
cp .env.example .env
```

3. **Configure `.env`** (see [Configuration](#-configuration) section)

4. **Add Firebase credentials**:
```bash
# Place your serviceAccount.json in backend/
cp path/to/serviceAccount.json backend/
```

5. **Start all services**:
```bash
docker-compose up -d
```

  - View backend logs: `docker logs vetta-backend`
  - View frontend logs: `docker logs vetta-frontend`
  - View redis logs: `docker logs vetta-redis`

6. **Access the application**:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Method 2: Manual Setup

#### Backend Setup

1. **Navigate to backend**:
```bash
cd backend
```

2. **Create virtual environment**:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies**:
```bash
pip install -r requirements.txt
```

4. **Create `.env` file** in `backend/` directory

5. **Start Redis** (if not using Docker):
```bash
redis-server
```

6. **Run the backend**:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend Setup

1. **Navigate to frontend** (new terminal):
```bash
cd frontend
```

2. **Install dependencies**:
```bash
npm install
```

3. **Create `.env` file** in `frontend/` directory:
```env
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000/ws
REACT_APP_API_TOKEN=your-api-token-here
```

4. **Create `firebase.js`** in `frontend/src/`:
```javascript
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

5. **Start the frontend**:
```bash
npm start
```

6. **Access**: http://localhost:3000

---

## ⚙️ Configuration

### Environment Variables (`.env`)

```env
# ==================== LLM Configuration ====================
llm_api_key=your_gemini_api_key_here
llm_model=gemini-2.0-flash-live
llm_temperature=0.7
llm_max_tokens=6000

# ==================== Speech Services ====================
# Speech-to-Text
deepgram_api_key=your_deepgram_api_key_here

# Text-to-Speech
elevenlabs_api_key=your_elevenlabs_api_key_here

# ==================== Code Execution ====================
judge0_api_key=your_judge0_rapidapi_key_here
judge0_host=judge0-ce.p.rapidapi.com

# ==================== Database ====================
redis_host=localhost
redis_port=6379
redis_db=0
redis_password=your_redis_password_here

# ==================== Firebase ====================
firebase_project_id=your_firebase_project_id
firebase_credentials_path=serviceAccount.json

# ==================== Security ====================
api_token=your_secure_api_token_here
jwt_secret_key=your_jwt_secret_key_here
jwt_algorithm=HS256

# ==================== CORS ====================
allowed_origins=http://localhost:3000,http://localhost:5173

# ==================== Interview Settings ====================
max_interview_duration_minutes=60
max_questions_per_interview=15
dsa_time_limit_minutes=45

# ==================== Logging ====================
log_level=INFO
log_format=console
```

### Getting API Keys

#### 1. Google Gemini AI
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy to `llm_api_key`

#### 2. Deepgram
1. Sign up at [Deepgram](https://deepgram.com/)
2. Get API key from dashboard
3. Copy to `deepgram_api_key`

#### 3. ElevenLabs
1. Sign up at [ElevenLabs](https://elevenlabs.io/)
2. Get API key from profile
3. Copy to `elevenlabs_api_key`

#### 4. Judge0 (RapidAPI)
1. Sign up at [RapidAPI](https://rapidapi.com/)
2. Subscribe to [Judge0 CE](https://rapidapi.com/judge0-official/api/judge0-ce)
3. Copy API key to `judge0_api_key`

#### 5. Firebase
1. Create project at [Firebase Console](https://console.firebase.com/)
2. Enable Authentication (Email/Password)
3. Enable Firestore Database
4. Download `serviceAccount.json` from Project Settings → Service Accounts
5. Place in `backend/` directory
6. Copy web app config for frontend

---

## 📚 Usage Guide

### 1. User Registration

```bash
# Navigate to http://localhost:3000/signup
- Enter name, email, phone, password
- Verify email (check inbox)
- Sign in at /signin
```

### 2. Starting an Interview

1. **Upload Resume** (Optional but recommended):
   - Navigate to Dashboard
   - Click "Upload Resume"
   - Select PDF, DOCX, or TXT file
   - Wait for parsing

2. **Configure Interview**:
   - Choose interview type (DSA, Frontend, etc.)
   - Select difficulty (Easy, Medium, Hard)
   - For custom role: Enter specific role name

3. **Start Interview**:
   - Click "Start Interview"
   - Allow microphone access when prompted
   - Wait for connection

### 3. During the Interview

#### Voice Interaction
- **Hold to Talk**: Press and hold the microphone button
- **Release to Stop**: Release button when done speaking
- **Live Transcription**: See your words transcribed in real-time
- **AI Response**: Listen to AI interviewer's follow-up questions

#### Coding Challenges (DSA)
- **Read Problem**: Review problem description and constraints
- **Write Code**: Use Monaco Editor with syntax highlighting
- **Select Language**: Choose from Python, JavaScript, C++, etc.
- **Run & Submit**: Execute code against test cases
- **View Results**: See pass/fail status and execution metrics

#### Controls
- **Skip Question**: Move to next question
- **Toggle Mic**: Mute/unmute microphone
- **End Interview**: Complete interview and get feedback

### 4. Receiving Feedback

After completing the interview, you'll receive:
- **Overall Performance Score**
- **Technical Skills Assessment**
- **Communication Evaluation**
- **Key Strengths** (3-5 points)
- **Areas for Improvement** (3-5 actionable items)
- **Final Recommendation** (Hire/Strong Maybe/Needs Improvement)

---

## 📡 API Documentation

### REST API Endpoints

#### Resume

```http
POST /resume/upload
Content-Type: multipart/form-data
Authorization: Bearer {token}

Request:
  file: (binary)

Response:
{
  "data": {
    "name": {"raw": "John Doe", "first": "John", "last": "Doe"},
    "emails": ["john@example.com"],
    "skills": [{"name": "Python"}, {"name": "React"}],
    "workExperience": [...],
    "education": [...],
    "projects": [...]
  },
  "meta": {"identifier": "custom_parser_v2"}
}
```

#### Interview

```http
POST /interview/start
Content-Type: application/json
Authorization: Bearer {token}

Request:
{
  "user_id": "user123",
  "interview_type": "role_targeted",
  "difficulty": "medium",
  "target_role": "Senior Backend Engineer",
  "job_description": "...",
  "interview_focus": "mixed"
}

Response:
{
  "session_id": "uuid-here",
  "question": {...},
  "interview_type": "role_targeted",
  "difficulty": "medium"
}
```

```http
POST /interview/submit-code
Content-Type: application/json
Authorization: Bearer {token}

Request:
{
  "session_id": "uuid",
  "question_id": "q1",
  "language": "python",
  "code": "def solution():\n    return 42"
}

Response:
{
  "passed": true,
  "tests_passed": 3,
  "total_tests": 3,
  "result": {
    "execution_time": 0.05,
    "memory_used": 1024,
    "test_results": [...]
  }
}
```

### WebSocket API

```javascript
// Connect
const ws = new WebSocket('ws://localhost:8000/ws/interview/{sessionId}');

// Client → Server Messages
ws.send(JSON.stringify({ type: 'start' }));
ws.send(JSON.stringify({ type: 'start_recording' }));
ws.send(JSON.stringify({ type: 'stop_recording' }));
ws.send(audioBytes); // Binary audio data
ws.send(JSON.stringify({ type: 'interrupt' }));
ws.send(JSON.stringify({ type: 'skip_question' }));
ws.send(JSON.stringify({ type: 'end_interview' }));

// Server → Client Messages
{
  "type": "question",
  "question": {...},
  "phase": "behavioral",
  "audio": "base64_encoded_audio"
}

{
  "type": "transcript",
  "text": "User's speech...",
  "is_final": true
}

{
  "type": "status",
  "status": "listening" | "processing" | "speaking"
}

{
  "type": "feedback",
  "feedback": {...}
}
```

---

## 📂 Project Structure

```
interview-ai/
├── backend/                      # FastAPI Backend
│   ├── main.py                   # Application entry point
│   ├── config.py                 # Configuration management
│   ├── firebase_config.py        # Firebase initialization
│   ├── requirements.txt          # Python dependencies
│   ├── Dockerfile               # Backend container
│   │
│   ├── models/                   # Pydantic models
│   │   ├── interview.py         # Interview data models
│   │   ├── request.py           # API request models
│   │   └── resume.py            # Resume parsing models
│   │
│   ├── routes/                   # API routes
│   │   ├── interview_session.py # Interview CRUD operations
│   │   ├── resume.py            # Resume upload/parsing
│   │   └── websocket_routes.py  # WebSocket endpoints
│   │
│   ├── services/                 # Business logic
│   │   ├── code_execution_service.py    # Judge0 integration
│   │   ├── deepgram_service.py          # Speech-to-Text
│   │   ├── elevenlabs_service.py        # Text-to-Speech
│   │   ├── gemini_service.py            # AI question generation
│   │   ├── interview_service.py         # Interview orchestration
│   │   ├── interview_websocket.py       # WebSocket handler
│   │   └── resume_parser.py             # Resume parsing logic
│   │
│   └── utils/                    # Utilities
│       ├── auth.py              # Authentication helpers
│       ├── logger.py            # Logging configuration
│       └── redis_client.py      # Redis connection
│
├── frontend/                     # React Frontend
│   ├── public/                  # Static assets
│   ├── src/
│   │   ├── App.jsx              # Main app component
│   │   ├── index.js             # Entry point
│   │   ├── index.css            # Global styles
│   │   ├── firebase.js          # Firebase config
│   │   │
│   │   ├── components/          # React components
│   │   │   ├── AIAvatar.jsx            # AI interviewer visualization
│   │   │   ├── CandidateWebcam.jsx     # User webcam
│   │   │   ├── CodeEditor.jsx          # Monaco editor wrapper
│   │   │   ├── DSAQuestionDisplay.jsx  # Coding problem UI
│   │   │   ├── Navbar.jsx              # Navigation bar
│   │   │   ├── PrivateRoute.jsx        # Auth guard
│   │   │   └── ResumeUpload.jsx        # Resume uploader
│   │   │
│   │   ├── context/             # React context
│   │   │   └── AuthContext.jsx         # Authentication state
│   │   │
│   │   ├── hooks/               # Custom hooks
│   │   │   ├── useInterviewWebSocket.js # WebSocket logic
│   │   │   └── useUserProfile.js        # User data hook
│   │   │
│   │   ├── pages/               # Page components
│   │   │   ├── Home.jsx                # Landing page
│   │   │   ├── SignIn.jsx              # Login page
│   │   │   ├── SignUp.jsx              # Registration page
│   │   │   ├── Dashboard.jsx           # Main dashboard
│   │   │   └── InterviewRoom.jsx       # Interview interface
│   │   │
│   │   ├── services/            # API services
│   │   │   └── api.js                  # HTTP client
│   │   │
│   │   └── utils/               # Utility functions
│   │       └── audioUtils.js           # Audio recording/playback
│   │
│   ├── package.json             # NPM dependencies
│   ├── tailwind.config.js       # Tailwind configuration
│   └── Dockerfile              # Frontend container
│
├── docker-compose.yml           # Multi-container orchestration
├── .env                         # Environment variables
├── .gitignore                  # Git ignore rules
└── README.md                    # This file
```
