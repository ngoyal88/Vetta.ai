"""Firebase Admin SDK initialisation and Firestore client."""
import base64
import json
import logging
import os

import firebase_admin
from firebase_admin import credentials, firestore

_log = logging.getLogger(__name__)


def _get_credentials() -> credentials.Certificate:
    """Load service-account credentials from env or local file.

    Resolution order:
    1. FIREBASE_CREDENTIALS_BASE64 environment variable (production / Render).
    2. serviceAccount.json in the working directory.
    3. backend/serviceAccount.json (Docker path).
    """
    encoded = os.getenv("FIREBASE_CREDENTIALS_BASE64")
    if encoded:
        try:
            cred_dict = json.loads(base64.b64decode(encoded).decode("utf-8"))
            return credentials.Certificate(cred_dict)
        except Exception as exc:
            _log.error("Failed to decode FIREBASE_CREDENTIALS_BASE64: %s", exc)

    for path in ("serviceAccount.json", "backend/serviceAccount.json"):
        if os.path.exists(path):
            return credentials.Certificate(path)

    raise ValueError(
        "No Firebase credentials found. "
        "Set FIREBASE_CREDENTIALS_BASE64 or provide serviceAccount.json."
    )


if not firebase_admin._apps:
    firebase_admin.initialize_app(_get_credentials())

db = firestore.client()
