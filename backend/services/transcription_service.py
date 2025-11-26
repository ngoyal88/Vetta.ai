# ========================================
# services/transcription_service.py
# Local Whisper Implementation (CPU Optimized)
# ========================================

import io
import os
import numpy as np
from faster_whisper import WhisperModel
from utils.logger import get_logger

logger = get_logger("TranscriptionService")

class TranscriptionService:
    def __init__(self):
        try:
            # "base.en" is a great balance: fast on CPU, accurate for English
            model_size = "base.en" 
            
            # compute_type="int8" speeds up CPU inference significantly
            self.model = WhisperModel(model_size, device="cpu", compute_type="int8")
            logger.info(f"✅ Whisper model '{model_size}' loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            self.model = None

    async def transcribe_audio_bytes(self, audio_bytes: bytes) -> str:
        """
        Transcribes audio bytes using local Whisper.
        Args:
            audio_bytes: Raw audio data (usually WAV or compatible PCM)
        """
        if not self.model:
            return ""

        try:
            # Create a file-like object in memory
            audio_file = io.BytesIO(audio_bytes)
            
            # Transcribe
            # beam_size=1 is fastest. Increase to 5 for higher accuracy (slower)
            segments, info = self.model.transcribe(audio_file, beam_size=1)

            # Combine segments into a single string
            text = " ".join([segment.text for segment in segments]).strip()
            
            if text:
                logger.info(f"Whisper heard: '{text}'")
            
            return text

        except Exception as e:
            logger.error(f"Whisper transcription error: {e}")
            return ""