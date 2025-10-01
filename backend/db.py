"""
Redis connection helper (asyncio).
"""
import redis.asyncio as redis
from functools import lru_cache
from config import get_settings

@lru_cache
def get_redis() -> redis.Redis:
    cfg = get_settings()
    return redis.Redis(
        host=cfg.redis_host,
        port=cfg.redis_port,
        db=cfg.redis_db,
        decode_responses=True,   # store strings not bytes
        health_check_interval=30
    )
