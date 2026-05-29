import uuid
from pc_control import TOOL_TIERS, PermissionTier


class PermissionMiddleware:
    def __init__(self):
        self.pending_confirmations = {}

    async def check(
        self,
        tool_name: str,
        tool_input: dict,
        session_id: str,
        dangerous_enabled: bool = False
    ) -> dict:
        tier = TOOL_TIERS.get(tool_name, PermissionTier.DANGEROUS)

        if tier == PermissionTier.SAFE:
            return {"allowed": True}

        if tier == PermissionTier.DANGEROUS and not dangerous_enabled:
            return {
                "allowed": False,
                "requires_confirmation": False,
                "error": "Dangerous tier is disabled in settings."
            }

        confirm_id = str(uuid.uuid4())[:8]
        self.pending_confirmations[confirm_id] = {
            "tool": tool_name,
            "input": tool_input,
            "session_id": session_id
        }

        tier_name = "dangerous" if tier == PermissionTier.DANGEROUS else "moderate"

        return {
            "allowed": False,
            "requires_confirmation": True,
            "confirm_id": confirm_id,
            "tier": tier_name,
            "message": f"Shall I {self._describe(tool_name, tool_input)}, sir?"
        }

    def _describe(self, tool: str, input: dict) -> str:
        descriptions = {
            "open_app": f"open {input.get('name', '')}",
            "get_windows": "list open windows",
            "focus_window": f"focus window: {input.get('title', '')}",
            "move_window": f"move window to {input.get('x', '')},{input.get('y', '')}",
            "get_system_info": "get system information",
            "get_focused_window": "get focused window title",
            "get_screen_resolution": "get screen resolution",
            "type_text": f"type \"{input.get('text', '')}\"",
            "press_key": f"press {input.get('key', '')}",
            "click": f"click at {input.get('x', '')},{input.get('y', '')}",
            "scroll": f"scroll at {input.get('x', '')},{input.get('y', '')}",
            "set_volume": f"set volume to {input.get('level', '')}%",
            "lock_screen": "lock your screen",
            "screenshot": "take a screenshot",
            "run_command": f"run: {input.get('command', '')}",
            "kill_process": f"kill {input.get('name', '')}",
            "delete_file": f"delete {input.get('path', '')}",
            "modify_system_settings": f"modify system setting: {input.get('setting', '')}",
            "install_package": f"install package: {input.get('package', '')}",
        }
        return descriptions.get(tool, tool)

    async def confirm(self, confirm_id: str) -> dict:
        pending = self.pending_confirmations.pop(confirm_id, None)
        if not pending:
            return {"error": "Confirmation expired or not found"}
        return {"allowed": True, **pending}

    async def cancel(self, confirm_id: str) -> dict:
        pending = self.pending_confirmations.pop(confirm_id, None)
        if not pending:
            return {"error": "Confirmation expired or not found"}
        return {"cancelled": True, "tool": pending.get("tool")}

    def get_pending(self, confirm_id: str) -> dict:
        return self.pending_confirmations.get(confirm_id)
