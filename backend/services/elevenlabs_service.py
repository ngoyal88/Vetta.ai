# backend/services/elevenlabs_service.py
"""
ElevenLabs Text-to-Speech Service
Converts AI responses to natural speech
"""
import asyncio
from typing import Optional, AsyncGenerator
from elevenlabs import VoiceSettings
from elevenlabs.client import ElevenLabs
from utils.logger import get_logger
from config import get_settings

logger = get_logger("ElevenLabsService")
settings = get_settings()


class ElevenLabsTTSService:
    """Text-to-Speech using ElevenLabs"""
    
    # Voice IDs (professional voices)
    VOICES = {
        "rachel": "21m00Tcm4TlvDq8ikWAM",  # Professional female
        "adam": "pNInz6obpgDQGcFmaJgB",    # Professional male
        "antoni": "ErXwobaYiN019PkySvjV",  # Well-rounded male
        "bella": "EXAVITQu4vr4xnSDxMaL",   # Soft female
        "josh": "TxGEqnHWrfWFTfGW9XjX"     # Deep male
    }
    
    def __init__(self, voice_id: Optional[str] = None):
        """
        Initialize ElevenLabs service
        
        Args:
            voice_id: Voice ID to use (defaults to Adam)
        """
        if not settings.elevenlabs_api_key:
            raise ValueError("ElevenLabs API key not configured")
        
        self.client = ElevenLabs(api_key=settings.elevenlabs_api_key)
        self.voice_id = voice_id or self.VOICES["adam"]
        
        # Voice settings for natural speech
        self.voice_settings = VoiceSettings(
            stability=0.7,          # Balance consistency
            similarity_boost=0.8,   # Match voice characteristics
            style=0.5,              # Natural expressiveness
            use_speaker_boost=True  # Enhance clarity
        )
        
        logger.info(f"✅ ElevenLabs TTS initialized with voice: {self.voice_id}")
    
    async def text_to_speech(self, text: str) -> bytes:
        """
        Convert text to speech audio
        
        Args:
            text: Text to convert
            
        Returns:
            Audio data as bytes (MP3 format)
        """
        if not text.strip():
            logger.warning("Empty text provided for TTS")
            return b""
        
        try:
            logger.info(f"🗣️ Generating speech: {text[:50]}...")
            
            # Generate speech
            audio_generator = self.client.generate(
                text=text,
                voice=self.voice_id,
                model="eleven_turbo_v2",  # Fast, high-quality model
                voice_settings=self.voice_settings,
                output_format="mp3_44100_128"  # Good quality, reasonable size
            )
            
            # Collect audio chunks
            audio_chunks = []
            for chunk in audio_generator:
                if chunk:
                    audio_chunks.append(chunk)
            
            audio_data = b"".join(audio_chunks)
            logger.info(f"✅ Generated {len(audio_data)} bytes of audio")
            
            return audio_data
            
        except Exception as e:
            logger.error(f"TTS generation error: {e}", exc_info=True)
            return b""
    
    async def text_to_speech_stream(self, text: str) -> AsyncGenerator[bytes, None]:
        """
        Stream text to speech audio in chunks
        
        Args:
            text: Text to convert
            
        Yields:
            Audio chunks as they're generated
        """
        if not text.strip():
            return
        
        try:
            logger.info(f"🗣️ Streaming speech: {text[:50]}...")
            
            # Generate speech with streaming
            audio_generator = self.client.generate(
                text=text,
                voice=self.voice_id,
                model="eleven_turbo_v2",
                voice_settings=self.voice_settings,
                output_format="mp3_44100_128",
                stream=True
            )
            
            # Yield chunks as they arrive
            for chunk in audio_generator:
                if chunk:
                    yield chunk
            
            logger.info("✅ Streaming complete")
            
        except Exception as e:
            logger.error(f"TTS streaming error: {e}", exc_info=True)
    
    async def text_to_speech_with_ssml(self, text: str, ssml_tags: dict = None) -> bytes:
        """
        Convert text with SSML formatting for better control
        
        Args:
            text: Text to convert
            ssml_tags: Optional SSML formatting tags
            
        Returns:
            Audio data as bytes
        """
        # ElevenLabs doesn't directly support SSML, but we can add pauses
        # and emphasis through text formatting
        
        formatted_text = text
        
        if ssml_tags:
            # Add pauses where specified
            if "pause" in ssml_tags:
                formatted_text = formatted_text.replace(
                    ssml_tags["pause"]["before"],
                    f"... {ssml_tags['pause']['before']}"
                )
        
        return await self.text_to_speech(formatted_text)
    
    def set_voice(self, voice_name: str):
        """
        Change the voice
        
        Args:
            voice_name: One of: rachel, adam, antoni, bella, josh
        """
        if voice_name in self.VOICES:
            self.voice_id = self.VOICES[voice_name]
            logger.info(f"Voice changed to: {voice_name}")
        else:
            logger.warning(f"Unknown voice: {voice_name}")
    
    async def get_available_voices(self) -> list:
        """Get list of available voices"""
        try:
            voices = self.client.voices.get_all()
            return [
                {
                    "voice_id": voice.voice_id,
                    "name": voice.name,
                    "category": voice.category
                }
                for voice in voices.voices
            ]
        except Exception as e:
            logger.error(f"Error fetching voices: {e}")
            return []


class TTSCache:
    """Simple cache for TTS responses"""
    
    def __init__(self, max_size: int = 50):
        self.cache = {}
        self.max_size = max_size
        self.access_order = []
    
    def get(self, text: str) -> Optional[bytes]:
        """Get cached audio"""
        if text in self.cache:
            # Update access order (LRU)
            self.access_order.remove(text)
            self.access_order.append(text)
            return self.cache[text]
        return None
    
    def put(self, text: str, audio: bytes):
        """Cache audio"""
        if len(self.cache) >= self.max_size:
            # Remove least recently used
            oldest = self.access_order.pop(0)
            del self.cache[oldest]
        
        self.cache[text] = audio
        self.access_order.append(text)
    
    def clear(self):
        """Clear cache"""
        self.cache.clear()
        self.access_order.clear()