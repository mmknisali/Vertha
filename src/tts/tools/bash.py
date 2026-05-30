import asyncio
import logging
import subprocess
from typing import Any

logger = logging.getLogger('vertha-tools-bash')

BLOCKED_COMMANDS = [
    "rm -rf /",
    "sudo rm -rf",
    "mkfs",
    "dd if=",
    ":(){ :|:& };:",
    "> /dev/sd",
    "mv / /*",
    "chmod -R 000 /",
]


class BashTool:
    def __init__(self, cwd: str = None, timeout: int = 30):
        self.cwd = cwd
        self.timeout = timeout

    async def execute(self, command: str, timeout: int = None, cwd: str = None) -> dict[str, Any]:
        timeout = timeout or self.timeout
        cwd = cwd or self.cwd

        for blocked in BLOCKED_COMMANDS:
            if blocked in command:
                logger.warning(f"Blocked command detected: {command[:100]}")
                return {
                    "success": False,
                    "exit_code": -1,
                    "stdout": "",
                    "stderr": "Command blocked for safety",
                    "duration": 0,
                }

        try:
            start = asyncio.get_event_loop().time()

            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=cwd,
            )

            try:
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    proc.communicate(), timeout=timeout
                )
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
                duration = asyncio.get_event_loop().time() - start
                return {
                    "success": False,
                    "exit_code": -1,
                    "stdout": "",
                    "stderr": f"Command timed out after {timeout} seconds",
                    "duration": duration,
                }

            duration = asyncio.get_event_loop().time() - start
            stdout = stdout_bytes.decode('utf-8', errors='replace')
            stderr = stderr_bytes.decode('utf-8', errors='replace')

            return {
                "success": proc.returncode == 0,
                "exit_code": proc.returncode,
                "stdout": stdout[:2000],
                "stderr": stderr[:1000],
                "duration": round(duration, 2),
            }

        except Exception as e:
            duration = asyncio.get_event_loop().time() - start
            logger.error(f"BashTool error: {e}")
            return {
                "success": False,
                "exit_code": -1,
                "stdout": "",
                "stderr": str(e),
                "duration": duration,
            }

    def sync_execute(self, command: str, timeout: int = None, cwd: str = None) -> dict[str, Any]:
        timeout = timeout or self.timeout
        cwd = cwd or self.cwd

        for blocked in BLOCKED_COMMANDS:
            if blocked in command:
                return {
                    "success": False,
                    "exit_code": -1,
                    "stdout": "",
                    "stderr": "Command blocked for safety",
                    "duration": 0,
                }

        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=cwd,
            )
            return {
                "success": result.returncode == 0,
                "exit_code": result.returncode,
                "stdout": result.stdout[:2000],
                "stderr": result.stderr[:1000],
                "duration": 0,
            }
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "exit_code": -1,
                "stdout": "",
                "stderr": f"Command timed out after {timeout} seconds",
                "duration": timeout,
            }
        except Exception as e:
            return {
                "success": False,
                "exit_code": -1,
                "stdout": "",
                "stderr": str(e),
                "duration": 0,
            }