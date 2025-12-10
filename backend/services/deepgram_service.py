# backend/services/deepgram_service.py
"""
Deepgram Speech-to-Text Service
Handles real-time audio transcription via WebSocket
"""
import asyncio
from typing import Optional, Callable
from deepgram import DeepgramClient, DeepgramClientOptions, LiveTranscriptionEvents, LiveOptions
from utils.logger import get_logger
from config import get_settings

logger = get_logger("DeepgramService")
settings = get_settings()


class DeepgramSTTService:
    """Real-time Speech-to-Text using Deepgram"""
    
    def __init__(self, on_transcript: Callable[[str, bool], None]):
        """
        Initialize Deepgram service
        
        Args:
            on_transcript: Callback function(text: str, is_final: bool)
        """
        self.on_transcript = on_transcript
        self.connection = None
        self.is_connected = False
        
        if not settings.deepgram_api_key:
            raise ValueError("Deepgram API key not configured")
        
        # Initialize Deepgram client
        config = DeepgramClientOptions(
            options={"keepalive": "true"}
        )
        self.client = DeepgramClient(settings.deepgram_api_key, config)
    
    async def connect(self):
        """Establish WebSocket connection to Deepgram"""
        try:
            # Configure transcription options
            options = LiveOptions(
                model="nova-2",
                language="en",
                smart_format=True,
                interim_results=True,
                utterance_end_ms=1000,
                vad_events=True,
                endpointing=300,
                punctuate=True,
                diarize=False
            )
            
            # Create connection
            self.connection = self.client.listen.websocket.v("1")
            
            # Register event handlers
            self.connection.on(LiveTranscriptionEvents.Open, self._on_open)
            self.connection.on(LiveTranscriptionEvents.Transcript, self._on_transcript)
            self.connection.on(LiveTranscriptionEvents.Error, self._on_error)
            self.connection.on(LiveTranscriptionEvents.Close, self._on_close)
            self.connection.on(LiveTranscriptionEvents.UtteranceEnd, self._on_utterance_end)
            
            # Start connection
            if self.connection.start(options):
                logger.info("✅ Deepgram connection established")
                self.is_connected = True
                return True
            else:
                logger.error("Failed to start Deepgram connection")
                return False
                
        except Exception as e:
            logger.error(f"Deepgram connection error: {e}", exc_info=True)
            return False
    
    async def send_audio(self, audio_data: bytes):
        """
        Send audio chunk to Deepgram for transcription
        
        Args:
            audio_data: Raw audio bytes (16kHz, 16-bit PCM, mono)
        """
        if not self.is_connected or not self.connection:
            logger.warning("Cannot send audio: not connected")
            return
        
        try:
            self.connection.send(audio_data)
        except Exception as e:
            logger.error(f"Error sending audio: {e}")
    
    async def close(self):
        """Close Deepgram connection"""
        if self.connection:
            try:
                self.connection.finish()
                logger.info("Deepgram connection closed")
            except Exception as e:
                logger.error(f"Error closing connection: {e}")
            finally:
                self.is_connected = False
                self.connection = None
    
    # Event Handlers
    
    def _on_open(self, *args, **kwargs):
        """Called when connection opens"""
        logger.info("🎤 Deepgram WebSocket opened")
    
    def _on_transcript(self, *args, **kwargs):
        """Called when transcript is received"""
        try:
            result = kwargs.get("result")
            if not result:
                return
            
            transcript_text = result.channel.alternatives[0].transcript
            is_final = result.is_final
            
            if transcript_text.strip():
                logger.debug(f"Transcript ({'final' if is_final else 'interim'}): {transcript_text}")
                
                # Call callback
                if self.on_transcript:
                    self.on_transcript(transcript_text, is_final)
                    
        except Exception as e:
            logger.error(f"Transcript processing error: {e}", exc_info=True)
    
    def _on_error(self, *args, **kwargs):
        """Called on error"""
        error = kwargs.get("error")
        logger.error(f"Deepgram error: {error}")
    
    def _on_close(self, *args, **kwargs):
        """Called when connection closes"""
        logger.info("Deepgram connection closed")
        self.is_connected = False
    
    def _on_utterance_end(self, *args, **kwargs):
        """Called when user stops speaking"""
        logger.debug("Utterance ended (user stopped speaking)")


class AudioBuffer:
    """Buffer for managing audio chunks"""
    
    def __init__(self, chunk_size: int = 4096):
        self.chunk_size = chunk_size
        self.buffer = bytearray()
        self.lock = asyncio.Lock()
    
    async def add(self, data: bytes):
        """Add audio data to buffer"""
        async with self.lock:
            self.buffer.extend(data)
    
    async def get_chunk(self) -> Optional[bytes]:
        """Get next chunk if available"""
        async with self.lock:
            if len(self.buffer) >= self.chunk_size:
                chunk = bytes(self.buffer[:self.chunk_size])
                self.buffer = self.buffer[self.chunk_size:]
                return chunk
        return None
    
    async def flush(self) -> bytes:
        """Get all remaining data"""
        async with self.lock:
            data = bytes(self.buffer)
            self.buffer.clear()
            return data