from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import Response
from routes import resume, webrtc_offer_answer,test_session,interview
"""from utils.logger import setup_logging, get_logger"""
from config import settings  # Importing structured settings

# Initialize logging before anything else
"""setup_logging()
log = get_logger(__name__)"""

# Create FastAPI instance
app = FastAPI(title="AI Interviewer API", version="1.0.0")

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update in production to specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(resume.router)
app.include_router(test_session.router)
app.include_router(interview.router)
app.include_router(webrtc_offer_answer.router, prefix="/webrtc")

# Future routers (commented for now)
"""
app.include_router(llm.router)
app.include_router(interview.router)
app.include_router(health.router)
app.include_router(code_runner.router)
"""

# Add Content Security Policy headers for WebSocket connections
@app.middleware("http")
async def add_csp_headers(request, call_next):
    response: Response = await call_next(request)
    response.headers["Content-Security-Policy"] = (
        "connect-src 'self' ws://localhost:8000 http://localhost:8000"
    )
    return response

# Health check endpoint
@app.get("/health")
async def health_check():
    """
    Simple health check endpoint.
    """
    return {
        "status": "healthy",
        "resume_parser": "OpenResume (Free)",
        "features": ["PDF parsing", "DOCX parsing", "Skills extraction", "Experience extraction"]
    }

# Root endpoint with API information
@app.get("/")
async def root():
    """
    Root endpoint providing basic information about the API.
    """
    return {
        "message": "AI Mock Interview Backend is running ✅",
        "resume_parser": "OpenResume - Free & Open Source",
        "endpoints": {
            "upload_resume": "/upload_resume",
            "health": "/health",
            "docs": "/docs"
        },
        "features": [
            "Free resume parsing (no API costs)",
            "AI-powered interviews",
            "Code execution",
            "Text-to-speech"
        ]
    }

# Example upload endpoint (commented out for now, can be expanded later)
"""
@app.post("/upload_resume")
async def upload_resume(file: UploadFile = File(...)):
    try:
        log.info(f"Received resume file: {file.filename}")
        file_bytes = await file.read()
        parsed_data = parse_resume(file_bytes, file.filename)
        return {"parsed_data": parsed_data}
    except Exception as e:
        log.error(f"Error in resume upload: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
"""

# Run the app using Uvicorn when executed directly
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
