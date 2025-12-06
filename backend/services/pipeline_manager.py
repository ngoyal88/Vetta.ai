# services/pipeline_manager.py
import subprocess
import sys
import os
from typing import Dict, Optional
from utils.logger import get_logger

logger = get_logger("PipelineManager")

class PipelineManager:
    """Manages multiple concurrent interview pipeline subprocesses."""

    def __init__(self):
        self.active_pipelines: Dict[str, subprocess.Popen] = {}

    def _resolve_pipecat_script(self) -> Optional[str]:
        """Try multiple likely locations for pipecat_pipeline.py and return the first existing absolute path."""
        candidates = [
            os.path.join(os.getcwd(), "services", "pipecat_pipeline.py"),
            os.path.join(os.getcwd(), "services", "pipecat_pipeline", "pipecat_pipeline.py"),
            os.path.join(os.path.dirname(__file__), "pipecat_pipeline.py"),
            os.path.join(os.path.dirname(__file__), "..", "services", "pipecat_pipeline.py"),
        ]
        for p in candidates:
            p_abs = os.path.abspath(p)
            if os.path.exists(p_abs):
                return p_abs
        return None

    def start_pipeline(self, session_id: str) -> bool:
        """Start a new pipeline process for a session."""
        if session_id in self.active_pipelines:
            proc = self.active_pipelines[session_id]
            if proc and proc.poll() is None:
                logger.warning(f"Pipeline already running for session {session_id}")
                return False
            else:
                # cleaned up dead process reference
                self.active_pipelines.pop(session_id, None)

        script_path = self._resolve_pipecat_script()
        if not script_path:
            logger.error("Could not locate services/pipecat_pipeline.py; cannot start pipeline.")
            return False

        try:
            python_executable = sys.executable or "python3"

            env = os.environ.copy()
            # ensure our working dir includes project root so imports resolve
            cwd = os.path.dirname(script_path)

            # Start process without pipes so it inherits the parent's stdout/stderr (visible in your supervisor)
            process = subprocess.Popen(
                [python_executable, script_path, session_id],
                cwd=cwd,
                env=env
            )

            self.active_pipelines[session_id] = process
            logger.info(f"Started pipeline for session {session_id} (PID: {process.pid})")
            return True

        except Exception as e:
            logger.error(f"Failed to start pipeline: {e}", exc_info=True)
            return False

    def stop_pipeline(self, session_id: str) -> bool:
        proc = self.active_pipelines.get(session_id)
        if not proc:
            logger.warning(f"No active pipeline for session {session_id}")
            return False
        try:
            logger.info(f"Stopping pipeline {session_id} (PID: {proc.pid})...")
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                logger.warning("Process did not exit, killing...")
                proc.kill()
            self.active_pipelines.pop(session_id, None)
            logger.info(f"Stopped pipeline {session_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to stop pipeline {session_id}: {e}", exc_info=True)
            return False

    def get_status(self, session_id: str) -> str:
        proc = self.active_pipelines.get(session_id)
        if not proc:
            return "stopped"
        return "running" if proc.poll() is None else "stopped"

    def cleanup_all(self):
        logger.info("Cleaning up all pipelines...")
        for sid in list(self.active_pipelines.keys()):
            self.stop_pipeline(sid)

pipeline_manager = PipelineManager()
