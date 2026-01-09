from fastapi import Request, HTTPException, status
from firebase_admin import auth as firebase_auth


async def verify_firebase_token(request: Request) -> str:
    """Validate Firebase ID token and return the UID."""
    auth_header = request.headers.get("Authorization") or ""
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized: Missing bearer token")

    token = parts[1]
    try:
        decoded = firebase_auth.verify_id_token(token)
        uid = decoded.get("uid")
        if not uid:
            raise ValueError("uid missing")
        return uid
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized: Invalid token")
