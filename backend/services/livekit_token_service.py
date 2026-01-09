from livekit import api
import datetime
from config import get_settings
from utils.logger import get_logger

logger = get_logger("LiveKitTokenService")
settings = get_settings()


class LiveKitTokenService:
    """Generate LiveKit access tokens for clients"""
    
    def __init__(self):
        if not settings.livekit_api_key or not settings.livekit_api_secret:
            raise ValueError("LiveKit API key and secret must be configured")
    
    def create_token(
        self,
        identity: str,
        room_name: str,
        metadata: dict = None
    ) -> str:
        """
        Create a LiveKit access token
        
        Args:
            identity: Unique identifier for the participant (e.g., user_id)
            room_name: Name of the room to join (e.g., session_id)
            metadata: Optional metadata to attach to the participant
            
        Returns:
            JWT token string
        """
        try:
            token = api.AccessToken(
                settings.livekit_api_key,
                settings.livekit_api_secret,
            )

            # Build token using fluent API
            token = (
                token
                .with_identity(identity)
                .with_name(identity)
                .with_grants(
                    api.VideoGrants(
                        room_join=True,
                        room=room_name,
                        can_publish=True,
                        can_subscribe=True,
                        can_publish_data=True,
                    )
                )
                .with_ttl(datetime.timedelta(hours=1))
            )

            # Add metadata if provided
            if metadata:
                token = token.with_metadata(str(metadata))

            jwt_token = token.to_jwt()
            logger.info(f"✅ Created token for {identity} in room {room_name}")
            
            return jwt_token
            
        except Exception as e:
            logger.error(f"Failed to create LiveKit token: {e}", exc_info=True)
            raise
    
    def create_agent_token(self, room_name: str) -> str:
        """
        Create a token for the AI agent
        
        Args:
            room_name: Room name to join
            
        Returns:
            JWT token string
        """
        return self.create_token(
            identity=f"agent_{room_name}",
            room_name=room_name,
            metadata={"role": "interviewer"}
        )