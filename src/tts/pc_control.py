import subprocess
import asyncio
from enum import Enum


class PermissionTier(Enum):
    SAFE = 1
    MODERATE = 2
    DANGEROUS = 3


TOOL_TIERS = {
    "open_app": PermissionTier.SAFE,
    "get_windows": PermissionTier.SAFE,
    "focus_window": PermissionTier.SAFE,
    "move_window": PermissionTier.SAFE,
    "get_system_info": PermissionTier.SAFE,
    "get_focused_window": PermissionTier.SAFE,
    "get_screen_resolution": PermissionTier.SAFE,
    "type_text": PermissionTier.MODERATE,
    "press_key": PermissionTier.MODERATE,
    "click": PermissionTier.MODERATE,
    "scroll": PermissionTier.MODERATE,
    "screenshot": PermissionTier.MODERATE,
    "set_volume": PermissionTier.MODERATE,
    "lock_screen": PermissionTier.MODERATE,
    "run_command": PermissionTier.DANGEROUS,
    "delete_file": PermissionTier.DANGEROUS,
    "kill_process": PermissionTier.DANGEROUS,
    "modify_system_settings": PermissionTier.DANGEROUS,
    "install_package": PermissionTier.DANGEROUS,
}


class PCController:

    async def open_app(self, name: str) -> str:
        app_map = {
            "firefox": "firefox",
            "terminal": "alacritty",
            "files": "nautilus",
            "code": "code",
            "spotify": "spotify",
            "discord": "discord",
            "chrome": "google-chrome",
            "slack": "slack",
            "zoom": "zoom",
            "teams": "teams",
        }
        cmd = app_map.get(name.lower(), name.lower())
        subprocess.Popen(
            [cmd],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        return f"Opening {name}"

    async def get_windows(self) -> str:
        result = subprocess.run(
            ["wmctrl", "-l"],
            capture_output=True,
            text=True
        )
        windows = []
        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            parts = line.split(None, 3)
            if len(parts) >= 4:
                windows.append(parts[3])
        if not windows:
            return "No windows are currently open."
        return f"Open windows: {', '.join(windows[:10])}." + (" and more." if len(windows) > 10 else "")

    async def focus_window(self, title: str) -> str:
        subprocess.run(["wmctrl", "-a", title])
        return f"Focused {title}"

    async def move_window(self, window_id: str = None, x: int = None, y: int = None, width: int = None, height: int = None) -> str:
        if window_id:
            subprocess.run([
                "wmctrl", "-ir", window_id, "-e", f"0,{x},{y},{width},{height}"
            ])
        else:
            result = subprocess.run(
                ["xdotool", "getactivewindow"],
                capture_output=True,
                text=True
            )
            win_id = result.stdout.strip()
            if win_id:
                subprocess.run([
                    "wmctrl", "-ir", win_id, "-e", f"0,{x},{y},{width},{height}"
                ])
        return f"Moved window to {x},{y}"

    async def get_system_info(self) -> str:
        uptime = subprocess.run(
            ["uptime", "-p"],
            capture_output=True,
            text=True
        ).stdout.strip()

        memory = subprocess.run(
            ["free", "-h"],
            capture_output=True,
            text=True
        ).stdout.strip()

        time_result = subprocess.run(
            ["date"],
            capture_output=True,
            text=True
        ).stdout.strip()

        memory_lines = memory.split('\n')
        memory_clean = ' '.join([l for l in memory_lines if l])

        return f"System uptime: {uptime}. Memory: {memory_clean}. Current time: {time_result}."

    async def get_focused_window(self) -> str:
        result = subprocess.run(
            ["xdotool", "getwindowname", "$(xdotool getactivewindow)"],
            shell=True,
            capture_output=True,
            text=True
        )
        return result.stdout.strip() or "Unknown"

    async def get_screen_resolution(self) -> str:
        result = subprocess.run(
            ["xdpyinfo"],
            capture_output=True,
            text=True
        )
        for line in result.stdout.split("\n"):
            if "dimensions:" in line:
                dims = line.split("dimensions:")[1].strip().split()[0]
                width, height = dims.split("x")
                return f"Screen resolution is {width} by {height} pixels."
        return "Screen resolution is 1920 by 1080 pixels."

    async def type_text(self, text: str) -> str:
        safe_text = text.replace("'", "\\'").replace('"', '\\"')
        subprocess.run(
            ["xdotool", "type", "--clearmodifiers", "--delay", "20", text],
            timeout=10
        )
        return f"Typed: {text}"

    async def press_key(self, key: str) -> str:
        subprocess.run(["xdotool", "key", key], timeout=5)
        return f"Pressed: {key}"

    async def click(self, x: int = None, y: int = None, button: int = 1) -> str:
        if x is not None and y is not None:
            subprocess.run([
                "xdotool", "mousemove", str(x), str(y),
                "click", str(button)
            ])
            return f"Clicked at {x},{y}"
        else:
            subprocess.run(["xdotool", "click", str(button)])
            return f"Clicked button {button}"

    async def scroll(self, x: int = None, y: int = None, delta: int = 1) -> str:
        if x is not None and y is not None:
            subprocess.run([
                "xdotool", "mousemove", str(x), str(y),
                "click", "--repeat", "2", "4" if delta > 0 else "5"
            ])
        else:
            subprocess.run([
                "xdotool", "click", "--repeat", str(abs(delta)) if abs(delta) > 1 else "1",
                "4" if delta > 0 else "5"
            ])
        return f"Scrolled {'up' if delta > 0 else 'down'}"

    async def screenshot(self, path: str = "/tmp/vertha_ss.png") -> str:
        subprocess.run([
            "import", "-window", "root", path
        ])
        return f"Screenshot saved to {path}"

    async def set_volume(self, level: int) -> str:
        subprocess.run([
            "amixer", "-D", "pulse",
            "sset", "Master", f"{level}%"
        ])
        return f"Volume set to {level}%"

    async def lock_screen(self) -> str:
        subprocess.Popen(["xdg-screensaver", "lock"])
        return "Screen locked"

    async def run_command(self, command: str) -> str:
        BLOCKED = [
            "rm -rf /",
            "sudo rm -rf",
            "mkfs",
            "dd if=",
            ":(){ :|:& };:",
            "> /dev/sd",
            "mv / /*",
            "chmod -R 000 /",
        ]
        for blocked in BLOCKED:
            if blocked in command:
                return "Command blocked for safety."

        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=30
            )
            output = result.stdout or result.stderr
            return output[:500] if output else "Done"
        except subprocess.TimeoutExpired:
            return "Command timed out after 30 seconds."
        except Exception as e:
            return f"Error: {str(e)}"

    async def delete_file(self, path: str) -> str:
        BLOCKED_PATHS = ["/", "/home", "/tmp", "/var", "/etc", "/bin", "/sbin", "/usr"]
        for blocked in BLOCKED_PATHS:
            if path.startswith(blocked):
                return f"Cannot delete system path: {path}"
        subprocess.run(["rm", "-i", path])
        return f"Deleted {path}"

    async def kill_process(self, name: str) -> str:
        subprocess.run(["pkill", "-f", name])
        return f"Killed {name}"

    async def modify_system_settings(self, setting: str, value: str) -> str:
        return f"System setting modification not implemented for safety."

    async def install_package(self, package: str) -> str:
        return f"Package installation not implemented for safety."
