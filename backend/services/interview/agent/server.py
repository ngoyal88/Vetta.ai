"""LiveKit AgentServer bootstrap."""
from __future__ import annotations

from config import get_settings
from livekit.agents import AgentServer, JobProcess
from livekit.plugins import silero

settings = get_settings()

server = AgentServer(
    ws_url=settings.livekit_url,
    api_key=settings.livekit_api_key,
    api_secret=settings.livekit_api_secret,
    initialize_process_timeout=60.0,
)


def _prewarm(proc: JobProcess) -> None:
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = _prewarm
