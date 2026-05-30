import base64
import logging
import os
import shutil
from pathlib import Path
from typing import Any

logger = logging.getLogger('vertha-tools-file-ops')

BLOCKED_PATHS = ["/", "/home", "/var", "/etc", "/bin", "/sbin", "/usr"]


class FileOpsTool:
    def __init__(self, cwd: str = None):
        self.cwd = cwd or os.path.expanduser("~")

    def _is_blocked(self, path: str) -> bool:
        p = Path(path).expanduser().resolve()
        for blocked in BLOCKED_PATHS:
            if str(p) == blocked or str(p).startswith(blocked + "/"):
                return True
        return False

    async def read(self, path: str, binary: bool = False) -> dict[str, Any]:
        if self._is_blocked(path):
            return {"success": False, "error": f"Cannot read system path: {path}"}

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
                    "lines": len(content.splitlines()),
                }
        except PermissionError:
            return {"success": False, "error": f"Permission denied: {path}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def write(self, path: str, content: str, encoding: str = "utf-8", create_dirs: bool = True) -> dict[str, Any]:
        if self._is_blocked(path):
            return {"success": False, "error": f"Cannot write to system path: {path}"}

        try:
            p = Path(path).expanduser()
            if create_dirs:
                p.parent.mkdir(parents=True, exist_ok=True)

            if encoding == "base64":
                data = base64.b64decode(content)
                p.write_bytes(data)
            else:
                if isinstance(content, bytes):
                    content = content.decode('utf-8', errors='replace')
                p.write_text(content, encoding=encoding)

            logger.info(f"File written: {path}, size={len(content)}")
            return {"success": True, "path": str(p), "size": len(content)}

        except PermissionError:
            return {"success": False, "error": f"Permission denied: {path}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def delete(self, path: str, force: bool = False) -> dict[str, Any]:
        if self._is_blocked(path):
            return {"success": False, "error": f"Cannot delete system path: {path}"}

        try:
            p = Path(path).expanduser()
            if not p.exists():
                return {"success": False, "error": f"File not found: {path}"}

            if p.is_dir():
                if not force:
                    return {"success": False, "error": "Use force=true for directories"}
                shutil.rmtree(p)
            else:
                p.unlink()

            logger.info(f"Deleted: {path}")
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
            if not p.is_dir():
                return {"success": False, "error": f"Not a directory: {path}"}

            items = []
            for item in p.iterdir():
                try:
                    stat = item.stat()
                    items.append({
                        "name": item.name,
                        "type": "dir" if item.is_dir() else "file",
                        "size": stat.st_size if item.is_file() else 0,
                        "modified": stat.st_mtime,
                    })
                except PermissionError:
                    items.append({"name": item.name, "type": "unknown", "size": 0, "modified": 0})

            items.sort(key=lambda x: (x["type"] == "file", x["name"]))
            return {"success": True, "path": str(p), "items": items, "count": len(items)}

        except PermissionError:
            return {"success": False, "error": f"Permission denied: {path}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def exists(self, path: str) -> dict[str, Any]:
        p = Path(path).expanduser()
        return {
            "success": True,
            "exists": p.exists(),
            "is_file": p.is_file() if p.exists() else False,
            "is_dir": p.is_dir() if p.exists() else False,
        }

    async def mkdir(self, path: str, parents: bool = True) -> dict[str, Any]:
        if self._is_blocked(path):
            return {"success": False, "error": f"Cannot create directory in system path: {path}"}

        try:
            p = Path(path).expanduser()
            p.mkdir(parents=parents, exist_ok=True)
            return {"success": True, "path": str(p)}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def copy(self, src: str, dst: str, overwrite: bool = False) -> dict[str, Any]:
        if self._is_blocked(src) or self._is_blocked(dst):
            return {"success": False, "error": "Cannot copy from/to system paths"}

        try:
            s = Path(src).expanduser()
            d = Path(dst).expanduser()

            if not s.exists():
                return {"success": False, "error": f"Source not found: {src}"}
            if d.exists() and not overwrite:
                return {"success": False, "error": f"Destination exists: {dst}"}

            if s.is_dir():
                if d.exists():
                    shutil.rmtree(d)
                shutil.copytree(s, d)
            else:
                if d.is_dir():
                    d = d / s.name
                shutil.copy2(s, d)

            return {"success": True, "src": str(s), "dst": str(d)}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def move(self, src: str, dst: str, overwrite: bool = False) -> dict[str, Any]:
        if self._is_blocked(src) or self._is_blocked(dst):
            return {"success": False, "error": "Cannot move from/to system paths"}

        try:
            s = Path(src).expanduser()
            d = Path(dst).expanduser()

            if not s.exists():
                return {"success": False, "error": f"Source not found: {src}"}
            if d.exists() and not overwrite:
                return {"success": False, "error": f"Destination exists: {dst}"}

            if d.is_dir():
                d = d / s.name

            shutil.move(str(s), str(d))
            return {"success": True, "src": str(s), "dst": str(d)}
        except Exception as e:
            return {"success": False, "error": str(e)}