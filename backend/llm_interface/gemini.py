# backend/llm_interface/gemini.py
import os
import time
import json
import concurrent.futures
from typing import Any, Dict, Optional
from utils.logger import get_logger

log = get_logger(__name__)

# Try importing google generativeai SDK
try:
    import google.generativeai as genai
except Exception:
    genai = None
    log.warning("google.generativeai SDK not installed or failed to import.")

LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "gemini-1.5-flash")
DEFAULT_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.25"))

if genai and LLM_API_KEY:
    try:
        genai.configure(api_key=LLM_API_KEY)
        log.info("Gemini SDK configured.")
    except Exception as e:
        log.error(f"Failed to configure Gemini SDK: {e}", exc_info=True)


def _call_sync_generate(prompt: str, temperature: float = DEFAULT_TEMPERATURE, max_output_tokens: int = 600) -> Dict[str, Any]:
    """
    Synchronous call to Gemini. This will be run in a thread pool by the async wrapper.
    Tries modern and fallback SDK call patterns and returns dict {text, raw}.
    """
    if not genai:
        raise RuntimeError("Gemini SDK not available")

    # Try new-style generate_content (SDK versions vary)
    try:
        model = genai.GenerativeModel(model_name=LLM_MODEL)
        resp = model.generate_content(prompt, temperature=temperature, max_output_tokens=max_output_tokens)
        # response shapes vary; try multiple accesses
        text = getattr(resp, "text", None) or (resp.output[0].content if getattr(resp, "output", None) else None)
        if text is None and hasattr(resp, "candidates"):
            text = resp.candidates[0].output if resp.candidates else None
        return {"text": text, "raw": resp}
    except Exception:
        log.debug("generate_content failed; trying genai.generate()", exc_info=True)

    # Fallback to older generate API
    try:
        resp = genai.generate(model=LLM_MODEL, prompt=prompt, temperature=temperature, max_output_tokens=max_output_tokens)
        text = getattr(resp, "text", None) or (resp["candidates"][0]["output"] if "candidates" in resp else None)
        return {"text": text, "raw": resp}
    except Exception as e:
        log.error("Gemini generation failed in both codepaths", exc_info=True)
        raise


async def generate_from_gemini(prompt: str, temperature: float = DEFAULT_TEMPERATURE,
                              max_output_tokens: int = 600, retries: int = 2, backoff: float = 1.0) -> Dict[str, Any]:
    """
    Async wrapper: runs the sync call in a threadpool to avoid blocking event loop.
    Retries on transient errors.
    """
    import asyncio
    loop = asyncio.get_running_loop()
    attempt = 0
    while True:
        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                return await loop.run_in_executor(pool, _call_sync_generate, prompt, temperature, max_output_tokens)
        except Exception as e:
            attempt += 1
            log.warning(f"Gemini generate attempt {attempt} failed: {e}")
            if attempt > retries:
                log.error("Gemini exhausted retries", exc_info=True)
                raise
            time.sleep(backoff)
            backoff *= 2.0
