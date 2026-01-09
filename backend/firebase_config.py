import os
import json
import base64
import firebase_admin
from firebase_admin import credentials, firestore

def get_firebase_credentials():
    """
    Load credentials from:
    1. Base64 environment variable (Production/Render)
    2. Local file (Development)
    """
    # 1. Try Base64 Env Var (Render)
    if os.getenv("FIREBASE_CREDENTIALS_BASE64"):
        try:
            encoded_creds = os.getenv("FIREBASE_CREDENTIALS_BASE64")
            decoded_json = base64.b64decode(encoded_creds).decode("utf-8")
            cred_dict = json.loads(decoded_json)
            return credentials.Certificate(cred_dict)
        except Exception as e:
            print(f"❌ Failed to decode FIREBASE_CREDENTIALS_BASE64: {e}")
    
    # 2. Fallback to local file (Localhost)
    # Check if file exists to prevent crash if missing in prod
    if os.path.exists("serviceAccount.json"):
        return credentials.Certificate("serviceAccount.json")
    
    # 3. Try finding it in the backend folder specifically (Docker pathing fix)
    if os.path.exists("backend/serviceAccount.json"):
        return credentials.Certificate("backend/serviceAccount.json")

    raise ValueError("❌ No Firebase credentials found! Set FIREBASE_CREDENTIALS_BASE64 or provide serviceAccount.json")

# Initialize
if not firebase_admin._apps:
    cred = get_firebase_credentials()
    firebase_admin.initialize_app(cred)

db = firestore.client()