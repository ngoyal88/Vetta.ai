import asyncio
import httpx
from typing import Dict, List
from models.interview import CodeExecutionResult, TestCase
from config import get_settings
from utils.logger import get_logger

logger = get_logger("CodeExecutionService")
settings = get_settings()

# Judge0 status.id -> error_type for resilience/UI (3=Accepted, 4=WrongAnswer, 5=TimeLimit, 6=Compilation, 7+=Runtime)
JUDGE0_STATUS = {
    1: "in_queue",
    2: "processing",
    3: "accepted",
    4: "wrong_answer",
    5: "time_limit_exceeded",
    6: "compilation_error",
    7: "runtime_error",
    8: "runtime_error",
    9: "runtime_error",
    10: "runtime_error",
    11: "runtime_error",
    12: "runtime_error",
}


def _normalize_output(s: str) -> str:
    """Normalize output for comparison: line endings, strip per line, collapse repeated spaces."""
    if not (s or "").strip():
        return ""
    s = (s or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    lines = []
    for line in s.split("\n"):
        # collapse multiple spaces/tabs to single space per line (DSA-friendly)
        line = " ".join((line or "").split())
        lines.append(line)
    while lines and lines[-1] == "":
        lines.pop()
    while lines and lines[0] == "":
        lines.pop(0)
    return "\n".join(lines)


def _outputs_match(stdout: str, expected: str) -> bool:
    """Compare program output to expected using normalized strings."""
    return _normalize_output(stdout) == _normalize_output(expected)


class CodeExecutionService:
    def __init__(self):
        self.base_url = f"https://{settings.judge0_host}"
        self.headers = {
            "X-RapidAPI-Key": settings.judge0_api_key,
            "X-RapidAPI-Host": settings.judge0_host,
            "Content-Type": "application/json"
        }
    
    async def execute_code(
        self,
        code: str,
        language_id: int,
        test_cases: List[TestCase]
    ) -> CodeExecutionResult:
        """Execute code against multiple test cases. One retry if any result is judge0_unavailable."""
        results = []
        passed_count = 0
        for test_case in test_cases:
            result = await self._run_single_test(code, language_id, test_case)
            results.append(result)
            if result.get("passed", False):
                passed_count += 1

        if any(r.get("error_type") == "judge0_unavailable" for r in results):
            logger.info("Judge0 unavailable; retrying once after 2s")
            await asyncio.sleep(2)
            results = []
            passed_count = 0
            for test_case in test_cases:
                result = await self._run_single_test(code, language_id, test_case)
                results.append(result)
                if result.get("passed", False):
                    passed_count += 1

        return CodeExecutionResult(
            passed_tests=passed_count,
            total_tests=len(results),
            execution_time=sum(r.get("time", 0) for r in results),
            memory_used=max(r.get("memory", 0) for r in results),
            passed=passed_count == len(results),
            test_results=results,
        )
    
    async def _run_single_test(
        self,
        code: str,
        language_id: int,
        test_case: TestCase
    ) -> Dict:
        """Run code against single test case. Returns dict with passed, error_type, error_message, output, expected, input, status, time, memory."""
        base_out = {
            "passed": False,
            "error_type": None,
            "error_message": None,
            "output": "",
            "expected": getattr(test_case, "expected_output", "") or "",
            "input": getattr(test_case, "input", "") or "",
            "status": "",
            "time": 0,
            "memory": 0,
        }
        if not settings.judge0_api_key:
            base_out["error_type"] = "judge0_unavailable"
            base_out["error_message"] = "Judge0 API not configured"
            return base_out

        try:
            payload = {
                "source_code": code,
                "language_id": language_id,
                "stdin": test_case.input,
                "expected_output": (test_case.expected_output or "").strip(),
            }
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/submissions?base64_encoded=false&wait=true",
                    json=payload,
                    headers=self.headers,
                )
        except httpx.TimeoutException as e:
            logger.warning("Judge0 timeout: %s", e)
            base_out["error_type"] = "judge0_timeout"
            base_out["error_message"] = "Execution timed out"
            return base_out
        except Exception as e:
            logger.error("Judge0 request error: %s", e, exc_info=True)
            base_out["error_type"] = "judge0_unavailable"
            base_out["error_message"] = str(e)
            return base_out

        if response.status_code not in (200, 201):
            body = (response.text or response.reason_phrase or str(response.status_code))[:500]
            logger.error("Judge0 error: status=%s body=%s", response.status_code, body)
            base_out["error_type"] = "judge0_unavailable"
            base_out["error_message"] = f"Execution failed ({response.status_code}): {body}"
            return base_out

        try:
            result = response.json()
        except Exception as e:
            base_out["error_type"] = "judge0_unavailable"
            base_out["error_message"] = str(e)
            return base_out

        if "token" in result and "stdout" not in result:
            base_out["error_type"] = "judge0_unavailable"
            base_out["error_message"] = "Execution not ready (use wait=true)"
            return base_out

        status_obj = result.get("status") or {}
        status_id = status_obj.get("id")
        status_desc = status_obj.get("description", "Unknown")
        base_out["status"] = status_desc
        base_out["time"] = float(result.get("time") or 0)
        base_out["memory"] = float(result.get("memory") or 0)
        base_out["output"] = (result.get("stdout") or "").strip()
        base_out["expected"] = (test_case.expected_output or "").strip()

        error_type = JUDGE0_STATUS.get(status_id, "wrong_answer")
        if status_id == 3:
            base_out["passed"] = _outputs_match(base_out["output"], base_out["expected"])
            base_out["error_type"] = None
            base_out["error_message"] = None
        elif status_id == 5:
            base_out["error_type"] = "time_limit_exceeded"
            base_out["error_message"] = status_desc or "Time limit exceeded"
        elif status_id == 6:
            base_out["error_type"] = "compilation_error"
            base_out["error_message"] = (result.get("compile_output") or result.get("stderr") or status_desc or "Compilation failed").strip()[:2000]
        elif status_id in (7, 8, 9, 10, 11, 12):
            base_out["error_type"] = "runtime_error"
            base_out["error_message"] = (result.get("stderr") or status_desc or "Runtime error").strip()[:2000]
        else:
            base_out["error_type"] = "wrong_answer"
            base_out["error_message"] = status_desc if status_id != 4 else "Output does not match expected"

        if test_case.is_hidden:
            base_out["hidden"] = True
        return base_out
    
    def get_language_id(self, language: str) -> int:
        """Map language name to Judge0 ID"""
        language_map = {
            'python': 71,
            'javascript': 63,
            'java': 62,
            'cpp': 54,
            'c': 50,
            'go': 60,
            'rust': 73
        }
        return language_map.get(language.lower(), 71)  # Default to Python

