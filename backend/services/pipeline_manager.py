"""
Pipeline Manager - Spawns and manages interview pipeline processes
"""

import asyncio
import subprocess
import signal
from typing import Dict, Optional
from utils.logger import get_logger

logger = get_logger("PipelineManager")


class PipelineManager:
    """Manages multiple concurrent interview pipeline processes"""
    
    def __init__(self):
        self.active_pipelines: Dict[str, subprocess.Popen] = {}
    
    def start_pipeline(self, session_id: str) -> bool:
        """Start a new pipeline process for a session"""
        
        if session_id in self.active_pipelines:
            logger.warning(f"Pipeline already running for session {session_id}")
            return False
        
        try:
            # Spawn pipeline as subprocess
            process = subprocess.Popen(
                ["python", "services/pipecat_pipeline.py", session_id],  # ✅ Fixed
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            self.active_pipelines[session_id] = process
            logger.info(f"✅ Started pipeline for session {session_id} (PID: {process.pid})")
            return True
            
        except Exception as e:
            logger.error(f"Failed to start pipeline: {e}", exc_info=True)
            return False
    
    def stop_pipeline(self, session_id: str) -> bool:
        """Stop a running pipeline"""
        
        process = self.active_pipelines.get(session_id)
        if not process:
            logger.warning(f"No active pipeline for session {session_id}")
            return False
        
        try:
            process.terminate()
            process.wait(timeout=5)
            del self.active_pipelines[session_id]
            logger.info(f"✅ Stopped pipeline for session {session_id}")
            return True
            
        except subprocess.TimeoutExpired:
            logger.warning(f"Force killing pipeline {session_id}")
            process.kill()
            del self.active_pipelines[session_id]
            return True
        except Exception as e:
            logger.error(f"Failed to stop pipeline: {e}", exc_info=True)
            return False
    
    def get_status(self, session_id: str) -> Optional[str]:
        """Get pipeline status"""
        
        process = self.active_pipelines.get(session_id)
        if not process:
            return None
        
        if process.poll() is None:
            return "running"
        else:
            return "stopped"
    
    def cleanup_all(self):
        """Stop all pipelines (called on server shutdown)"""
        
        logger.info("Cleaning up all pipelines...")
        for session_id in list(self.active_pipelines.keys()):
            self.stop_pipeline(session_id)


# Global singleton
pipeline_manager = PipelineManager()