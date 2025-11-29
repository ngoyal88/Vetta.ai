# ========================================
# services/tts_service.py - Kokoro Implementation
# ========================================

import io
import base64
import soundfile as sf
from kokoro import KPipeline
import torch
from utils.logger import get_logger

logger = get_logger("KokoroTTS")

class TTSService:
    def __init__(self):
        try:
            # 'a' = American English. Downloads model on first run (~300MB)
            self.pipeline = KPipeline(lang_code='a') 
            self.voice = 'af_heart' # Options: af_heart, af_bella, am_michael
            logger.info(f"✅ Kokoro TTS initialized with voice: {self.voice}")
        except Exception as e:
            logger.error(f"Failed to load Kokoro: {e}")
            self.pipeline = None

    async def speak(self, text: str) -> str:
        if not text or not self.pipeline: return None
        try:
            # Generate audio
            generator = self.pipeline(text, voice=self.voice, speed=1.0, split_pattern=r'\n+')
            all_audio = []
            for _, _, audio_chunk in generator:
                all_audio.extend(audio_chunk)

            if not all_audio: return None

            # Convert to WAV
            buffer = io.BytesIO()
            sf.write(buffer, all_audio, 24000, format='WAV') 
            buffer.seek(0)
            return base64.b64encode(buffer.read()).decode('utf-8')
        except Exception as e:
            logger.error(f"TTS Error: {e}", exc_info=True)
            return None