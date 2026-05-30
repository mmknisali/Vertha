import asyncio
import logging
import subprocess
import os
import base64
from pathlib import Path
from typing import Any

logger = logging.getLogger('vertha-tool-executor')

BLOCKED_PATHS = ["/", "/home", "/var", "/etc", "/bin", "/sbin", "/usr"]
BLOCKED_COMMANDS = [
    "rm -rf /",
    "sudo rm -rf",
    "mkfs",
    "dd if=",
    ":(){ :|:& };:",
    "> /dev/sd",
    "mv / /*",
    "chmod -R 000 /",
    "chmod -R 777 /",
]


class BashExecutor:
    def __init__(self, cwd: str = None, timeout: int = 30):
        self.cwd = cwd or os.path.expanduser("~")
        self.timeout = timeout

    async def execute(self, command: str, timeout: int = None) -> dict[str, Any]:
        timeout = timeout or self.timeout

        for blocked in BLOCKED_COMMANDS:
            if blocked in command:
                logger.warning(f"Blocked command: {command[:100]}")
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
                cwd=self.cwd,
            )

            try:
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    proc.communicate(), timeout=timeout
                )
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
                duration = asyncio.get_event_loop().time() - start
                logger.warning(f"Command timed out after {timeout}s: {command[:100]}")
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

            logger.info(f"Bash exec: exit={proc.returncode}, duration={duration:.2f}s, cmd={command[:80]}")

            return {
                "success": proc.returncode == 0,
                "exit_code": proc.returncode,
                "stdout": stdout[:2000],
                "stderr": stderr[:1000],
                "duration": duration,
            }

        except Exception as e:
            duration = asyncio.get_event_loop().time() - start
            logger.error(f"Bash exec error: {e}")
            return {
                "success": False,
                "exit_code": -1,
                "stdout": "",
                "stderr": str(e),
                "duration": duration,
            }


class FileOpsExecutor:
    def __init__(self, cwd: str = None):
        self.cwd = cwd or os.path.expanduser("~")

    async def read(self, path: str, binary: bool = False) -> dict[str, Any]:
        try:
            p = Path(path).expanduser()
            if not p.exists():
                return {"success": False, "error": f"File not found: {path}"}

            if binary:
                data = p.read_bytes()
                return {
                    "success": True,
                    "content": base64.b64encode(data).decode('utf-8'),
                    "encoding": "base64",
                    "size": len(data),
                }
            else:
                content = p.read_text(encoding='utf-8', errors='replace')
                return {
                    "success": True,
                    "content": content,
                    "encoding": "utf-8",
                    "size": len(content),
                }
        except PermissionError:
            return {"success": False, "error": f"Permission denied: {path}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def write(self, path: str, content: str, encoding: str = "utf-8") -> dict[str, Any]:
        try:
            p = Path(path).expanduser()
            p.parent.mkdir(parents=True, exist_ok=True)

            if encoding == "base64":
                data = base64.b64decode(content)
                p.write_bytes(data)
            else:
                p.write_text(content, encoding=encoding)

            logger.info(f"File written: {path}")
            return {"success": True, "path": str(p), "size": len(content)}

        except PermissionError:
            return {"success": False, "error": f"Permission denied: {path}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def delete(self, path: str, force: bool = False) -> dict[str, Any]:
        try:
            p = Path(path).expanduser()

            for blocked in BLOCKED_PATHS:
                if str(p) == blocked or str(p).startswith(blocked + "/"):
                    return {"success": False, "error": f"Cannot delete system path: {path}"}

            if p.is_dir():
                if not force:
                    return {"success": False, "error": "Use force=true for directories"}
                import shutil
                shutil.rmtree(p)
            else:
                p.unlink()

            logger.info(f"File deleted: {path}")
            return {"success": True, "path": str(p)}

        except PermissionError:
            return {"success": False, "error": f"Permission denied: {path}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def list_dir(self, path: str = ".") -> dict[str, Any]:
        try:
            p = Path(path).expanduser()
            if not p.exists():
                return {"success": False, "error": f"Directory not found: {path}"}

            items = []
            for item in p.iterdir():
                items.append({
                    "name": item.name,
                    "type": "dir" if item.is_dir() else "file",
                    "size": item.stat().st_size if item.is_file() else 0,
                })

            return {"success": True, "path": str(p), "items": items}

        except PermissionError:
            return {"success": False, "error": f"Permission denied: {path}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def exists(self, path: str) -> dict[str, Any]:
        p = Path(path).expanduser()
        return {"success": True, "exists": p.exists(), "is_file": p.is_file(), "is_dir": p.is_dir()}


class ToolExecutor:
    def __init__(self):
        self.bash = BashExecutor()
        self.file_ops = FileOpsExecutor()
        self._handlers = {
            "bash_exec": self._bash_exec,
            "file_read": self._file_read,
            "file_write": self._file_write,
            "file_delete": self._file_delete,
            "file_list": self._file_list,
            "file_exists": self._file_exists,
        }

    async def execute(self, tool_name: str, input_data: dict) -> dict[str, Any]:
        handler = self._handlers.get(tool_name)
        if not handler:
            return {"success": False, "error": f"Unknown tool: {tool_name}"}

        try:
            return await handler(input_data)
        except Exception as e:
            logger.error(f"Tool execution error: {tool_name} - {e}")
            return {"success": False, "error": str(e)}

    async def _bash_exec(self, input_data: dict) -> dict[str, Any]:
        command = input_data.get("command", "")
        cwd = input_data.get("cwd")
        timeout = input_data.get("timeout", 30)

        if not command:
            return {"success": False, "error": "No command provided"}

        executor = BashExecutor(cwd=cwd, timeout=timeout)
        return await executor.execute(command, timeout=timeout)

    async def _file_read(self, input_data: dict) -> dict[str, Any]:
        path = input_data.get("path", "")
        if not path:
            return {"success": False, "error": "No path provided"}
        return await self.file_ops.read(path, binary=input_data.get("binary", False))

    async def _file_write(self, input_data: dict) -> dict[str, Any]:
        path = input_data.get("path", "")
        content = input_data.get("content", "")
        if not path:
            return {"success": False, "error": "No path provided"}
        return await self.file_ops.write(path, content, encoding=input_data.get("encoding", "utf-8"))

    async def _file_delete(self, input_data: dict) -> dict[str, Any]:
        path = input_data.get("path", "")
        if not path:
            return {"success": False, "error": "No path provided"}
        return await self.file_ops.delete(path, force=input_data.get("force", False))

    async def _file_list(self, input_data: dict) -> dict[str, Any]:
        path = input_data.get("path", ".")
        return await self.file_ops.list_dir(path)

    async def _file_exists(self, input_data: dict) -> dict[str, Any]:
        path = input_data.get("path", "")
        if not path:
            return {"success": False, "error": "No path provided"}
        return await self.file_ops.exists(path)


_tool_executor: ToolExecutor | None = None


def get_tool_executor() -> ToolExecutor:
    global _tool_executor
    if _tool_executor is None:
        _tool_executor = ToolExecutor()
    return _tool_executor