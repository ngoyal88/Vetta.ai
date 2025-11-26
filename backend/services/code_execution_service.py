# ========================================
# 5. services/code_execution_service.py - Judge0 integration
# ========================================

import httpx
from typing import Dict, List
from models.interview import CodeExecutionResult, TestCase
from config import get_settings
from utils.logger import get_logger

logger = get_logger("CodeExecutionService")
settings = get_settings()


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
        
        for i, test_case in enumerate(test_cases):
            if test_case.is_hidden and i < 2:  # Run first 2 visible tests only
                continue
            
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
                
                if response.status_code == 201:
                    result = response.json()
                    
                    stdout = result.get('stdout', '').strip()
                    expected = test_case.expected_output.strip()
                    
                    return {
                        'passed': stdout == expected,
                        'output': stdout,
                        'expected': expected,
                        'time': float(result.get('time', 0)),
                        'memory': float(result.get('memory', 0)),
                        'status': result.get('status', {}).get('description', 'Unknown')
                    }
                else:
                    logger.error(f"Judge0 error: {response.status_code}")
                    return {'passed': False, 'error': 'Execution failed'}
                    
        except Exception as e:
            logger.error(f"Code execution error: {e}", exc_info=True)
            return {'passed': False, 'error': str(e)}
    
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
