# backend/services/deepgram_service.py
"""
Deepgram Speech-to-Text Service (SDK v5 style)
Changes:
1. Use AsyncDeepgramClient + EventType (v5)
2. Align connect/send/close with v2 WebSocket API
3. Robust event parsing for transcript + error
4. Detailed logging and safe fallbacks
"""
import asyncio
import contextlib
from typing import Optional, Callable
from deepgram import AsyncDeepgramClient
from deepgram.core.events import EventType
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
        self._conn_ctx = None
        self._listen_task: Optional[asyncio.Task] = None
        self.is_connected = False
        
        if not settings.deepgram_api_key:
            raise ValueError("Deepgram API key not configured")
        
        # Initialize Deepgram async client
        self.client = AsyncDeepgramClient(api_key=settings.deepgram_api_key)
        logger.info("🎤 Deepgram client initialized")
    
    async def connect(self):
        """Establish WebSocket connection to Deepgram"""
        try:
            logger.info("🔌 Connecting to Deepgram...")
            
            # Create connection (Listen v2) as async context manager and enter it
            self._conn_ctx = self.client.listen.v2.connect(
                model="flux-general-en",
                encoding="linear16",
                # Deepgram SDK signature expects Optional[str]
                sample_rate="16000",
            )
            self.connection = await self._conn_ctx.__aenter__()

            # Register event handlers
            self.connection.on(EventType.OPEN, lambda *_: self._on_open())
            self.connection.on(EventType.CLOSE, lambda *_: self._on_close())
            self.connection.on(EventType.ERROR, self._on_error)
            self.connection.on(EventType.MESSAGE, self._on_message)

            # Start listening in the background; awaiting this blocks until closed.
            self._listen_task = asyncio.create_task(self.connection.start_listening())

            logger.info("✅ Deepgram connection established")
            self.is_connected = True
            await asyncio.sleep(0.2)
            return True
                
        except Exception as e:
            logger.error(f"❌ Deepgram connection error: {e}", exc_info=True)
            return False
    
    async def send_audio(self, audio_data: bytes):
        """
        Send audio chunk to Deepgram for transcription
        
        Args:
            audio_data: Raw audio bytes (16kHz, 16-bit PCM, mono)
        """
        if not self.is_connected or not self.connection:
            logger.warning("⚠️ Cannot send audio: not connected")
            return
        
        try:
            # Log first audio chunk for debugging
            if not hasattr(self, '_first_audio_logged'):
                logger.info(f"📤 Sending first audio chunk: {len(audio_data)} bytes")
                self._first_audio_logged = True
            
            # Deepgram Listen v2 uses send_media(), which ultimately sends raw bytes.
            await self.connection.send_media(audio_data)
            
        except Exception as e:
            logger.error(f"❌ Error sending audio: {e}", exc_info=True)
    
    async def close(self):
        """Close Deepgram connection"""
        if self.connection:
            try:
                if self._listen_task is not None:
                    self._listen_task.cancel()
                    with contextlib.suppress(asyncio.CancelledError):
                        await self._listen_task

                # Attempt graceful finish if available
                try:
                    await self.connection.finish()
                except Exception:
                    pass
                # Exit context manager
                if self._conn_ctx is not None:
                    try:
                        await self._conn_ctx.__aexit__(None, None, None)
                    except Exception:
                        pass
                logger.info("🔌 Deepgram connection closed")
            except Exception as e:
                logger.error(f"Error closing connection: {e}")
            finally:
                self.is_connected = False
                self.connection = None
                self._conn_ctx = None
                self._listen_task = None
    
    # Event Handlers
    
    def _on_open(self, *args, **kwargs):
        """Called when connection opens"""
        logger.info("✅ Deepgram WebSocket opened")
        self.is_connected = True
    
    def _on_message(self, *args, **kwargs):
        """Handle generic message events; extract transcript when present."""
        try:
            msg = args[0] if args else kwargs.get("message")
            if msg is None:
                logger.debug("⚠️ Received empty message")
                return

            # Try to access dict-like payload
            payload = None
            if hasattr(msg, "model_dump"):
                payload = msg.model_dump()
            elif isinstance(msg, dict):
                payload = msg
            else:
                # Fallback: try attr access
                payload = getattr(msg, "data", None) or {}

            # Attempt to extract transcript text
            text = None
            is_final = False

            # Common shapes
            # v1-like: { "channel": { "alternatives": [ { "transcript": "..." } ] }, "is_final": bool }
            channel = (payload or {}).get("channel") if isinstance(payload, dict) else None
            if channel and isinstance(channel, dict):
                alts = channel.get("alternatives") or []
                if alts and isinstance(alts[0], dict):
                    text = (alts[0].get("transcript") or "").strip()
                is_final = bool(payload.get("is_final", False))

            if text:
                logger.info(f"📝 Transcript ({'FINAL' if is_final else 'interim'}): '{text}'")
                if self.on_transcript:
                    self.on_transcript(text, is_final)
            else:
                # Not a transcript event; ignore silently
                pass

        except Exception as e:
            logger.error(f"❌ Message processing error: {e}", exc_info=True)
    
    def _on_error(self, *args, **kwargs):
        """Called on error"""
        error = None
        if args and args[0] is not None:
            error = args[0]
        elif "error" in kwargs:
            error = kwargs.get("error")
        logger.error(f"❌ Deepgram error: {error}")
    
    def _on_close(self, *args, **kwargs):
        """Called when connection closes"""
        logger.info("🔌 Deepgram connection closed")
        self.is_connected = False
    
    # v2 consolidates utterance-related events; optional to implement separately