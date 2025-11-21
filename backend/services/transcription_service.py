# ========================================
# 6. services/transcription_service.py - Speech to text
# ========================================

from utils.logger import get_logger

logger = get_logger("TranscriptionService")

try:
    import speech_recognition as sr
    SPEECH_RECOGNITION_AVAILABLE = True
except ImportError:
    SPEECH_RECOGNITION_AVAILABLE = False
    logger.warning("speech_recognition not installed")


class TranscriptionService:
    def __init__(self):
        if SPEECH_RECOGNITION_AVAILABLE:
            self.recognizer = sr.Recognizer()
            logger.info("Speech recognition initialized")
        else:
            self.recognizer = None
            logger.warning("Speech recognition not available")
    
    async def transcribe_audio(self, audio_bytes: bytes) -> str:
        """Transcribe audio to text"""
        if not self.recognizer:
            return "[Speech recognition not configured]"
        
        try:
            # Convert bytes to AudioData
            import io
            import wave
            
            # This is a placeholder - actual implementation depends on audio format
            # You might need to use Google Cloud Speech API or similar
            
            audio_file = io.BytesIO(audio_bytes)
            
            with sr.AudioFile(audio_file) as source:
                audio_data = self.recognizer.record(source)
                text = self.recognizer.recognize_google(audio_data)
                return text
                
        except Exception as e:
            logger.error(f"Transcription error: {e}", exc_info=True)
            return f"[Transcription failed: {str(e)}]"
