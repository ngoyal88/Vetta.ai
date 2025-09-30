from fastapi import Request, HTTPException, status
from config import settings

async def verify_api_token(request: Request):
    token = request.headers.get("Authorization")
    if not token or token != f"Bearer {settings.api_token}":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid or missing API token"
        )
