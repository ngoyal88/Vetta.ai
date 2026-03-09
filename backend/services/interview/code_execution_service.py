import httpx
from typing import Dict, List
from models.interview import CodeExecutionResult, TestCase
from config import get_settings
from utils.logger import get_logger

logger = get_logger("CodeExecutionService")
settings = get_settings()


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
        """Execute code against multiple test cases"""
        
        results = []
        passed_count = 0
        
        for test_case in test_cases:
            result = await self._run_single_test(code, language_id, test_case)
            results.append(result)

            if result.get('passed', False):
                passed_count += 1
        
        return CodeExecutionResult(
            passed_tests=passed_count,
            total_tests=len(results),
            execution_time=sum(r.get('time', 0) for r in results),
            memory_used=max(r.get('memory', 0) for r in results),
            passed=passed_count == len(results),
            test_results=results
        )
    
    async def _run_single_test(
        self,
        code: str,
        language_id: int,
        test_case: TestCase
    ) -> Dict:
        """Run code against single test case"""
        
        if not settings.judge0_api_key:
            return {
                'passed': False,
                'error': 'Judge0 API not configured',
                'time': 0,
                'memory': 0
            }
        
        try:
            payload = {
                "source_code": code,
                "language_id": language_id,
                "stdin": test_case.input,
                "expected_output": test_case.expected_output.strip()
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/submissions?base64_encoded=false&wait=true",
                    json=payload,
                    headers=self.headers
                )
                
                # Judge0: wait=true returns 200 with full result; wait=false returns 201 with token
                if response.status_code in (200, 201):
                    result = response.json()
                    # If async (201), result may be { token } — we use wait=true so expect full result
                    if 'token' in result and 'stdout' not in result:
                        logger.error("Judge0 returned token; expected wait=true with full result")
                        return {'passed': False, 'error': 'Execution not ready (use wait=true)'}
                    stdout_raw = (result.get('stdout') or '').strip()
                    expected_raw = test_case.expected_output.strip()
                    passed = _outputs_match(stdout_raw, expected_raw)
                    status_desc = (result.get('status') or {}).get('description', 'Unknown')
                    if test_case.is_hidden:
                        return {
                            'passed': passed,
                            'hidden': True,
                            'time': float(result.get('time', 0)),
                            'memory': float(result.get('memory', 0)),
                            'status': status_desc,
                        }
                    return {
                        'passed': passed,
                        'input': test_case.input,
                        'output': stdout_raw,
                        'expected': expected_raw,
                        'time': float(result.get('time', 0)),
                        'memory': float(result.get('memory', 0)),
                        'status': status_desc,
                    }
                else:
                    try:
                        body = response.text[:500] if response.text else response.reason_phrase
                    except Exception:
                        body = str(response.status_code)
                    logger.error("Judge0 error: status=%s body=%s", response.status_code, body)
                    return {'passed': False, 'error': f'Execution failed ({response.status_code}): {body}'}
                    
        except Exception as e:
            logger.error(f"Code execution error: {e}", exc_info=True)
            if test_case.is_hidden:
                return {'passed': False, 'hidden': True, 'error': str(e)}
            return {
                'passed': False,
                'input': getattr(test_case, 'input', ''),
                'expected': getattr(test_case, 'expected_output', ''),
                'output': '',
                'error': str(e),
            }
    
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

