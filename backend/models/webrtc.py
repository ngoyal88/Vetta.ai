from pydantic import BaseModel

class WebRTCOffer(BaseModel):
    session_id: str
    offer: dict  # SDP offer details

class WebRTCAnswer(BaseModel):
    session_id: str
    answer: dict  # SDP answer details
