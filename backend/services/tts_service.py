# ========================================
# services/tts_service.py
# Free High-Quality TTS using Microsoft Edge API
# ========================================

import edge_tts
import base64
import io
from utils.logger import get_logger

logger = get_logger("TTSService")

class TTSService:
    def __init__(self):
        # Professional Voices (Free):
        # Male: "en-US-ChristopherNeural", "en-US-GuyNeural", "en-US-EricNeural"
        # Female: "en-US-AriaNeural", "en-US-JennyNeural", "en-US-MichelleNeural"
        self.voice = "en-US-ChristopherNeural" 
        logger.info(f"✅ TTS Service initialized with voice: {self.voice}")

    async def speak(self, text: str) -> str:
        """
        Converts text to audio using Edge-TTS and returns Base64 string.
        """
        if not text:
            return None

        try:
            communicate = edge_tts.Communicate(text, self.voice)
            
            # Stream audio into memory buffer
            audio_stream = io.BytesIO()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_stream.write(chunk["data"])
            
            # Get full byte content
            audio_bytes = audio_stream.getvalue()
            
            # Convert to Base64 for the frontend to play
            audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
            
            return audio_b64

        except Exception as e:
            logger.error(f"TTS generation error: {e}")
            return None