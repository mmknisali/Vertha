import os
import subprocess
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from pc_control import PCController, TOOL_TIERS
from permissions import PermissionMiddleware

router = APIRouter(prefix='/pc', tags=['pc_control'])

controller = PCController()
permission_middleware = PermissionMiddleware()

PC_CONTROL_ENABLED = os.getenv('VERTHA_PC_CONTROL_ENABLED', 'false').lower() == 'true'
DANGEROUS_TIER_ENABLED = os.getenv('VERTHA_DANGEROUS_TIER_ENABLED', 'false').lower() == 'true'


@router.get('/health')
async def pc_health():
    tools = ["xdotool", "wmctrl", "xdpyinfo", "import", "amixer"]
    results = {}
    for tool in tools:
        r = subprocess.run(["which", tool], capture_output=True)
        results[tool] = r.returncode == 0
    all_present = all(results.values())
    return {
        "pc_control_enabled": PC_CONTROL_ENABLED,
        "dangerous_tier_enabled": DANGEROUS_TIER_ENABLED,
        "tools_installed": results,
        "ready": all_present,
    }


class ExecuteRequest(BaseModel):
    tool: str
    input: dict = {}
    session_id: str = ""
    dangerous_tier: bool = False


@router.get('/windows')
async def get_windows():
    if not PC_CONTROL_ENABLED:
        raise HTTPException(status_code=403, detail="PC Control is disabled")
    windows = await controller.get_windows()
    return {"result": windows}


@router.get('/system-info')
async def get_system_info():
    if not PC_CONTROL_ENABLED:
        raise HTTPException(status_code=403, detail="PC Control is disabled")
    info = await controller.get_system_info()
    return {"result": info}


@router.get('/screen-resolution')
async def get_screen_resolution():
    if not PC_CONTROL_ENABLED:
        raise HTTPException(status_code=403, detail="PC Control is disabled")
    resolution = await controller.get_screen_resolution()
    return resolution


@router.get('/focused-window')
async def get_focused_window():
    if not PC_CONTROL_ENABLED:
        raise HTTPException(status_code=403, detail="PC Control is disabled")
    window = await controller.get_focused_window()
    return {"result": window}


@router.post('/execute')
async def execute(req: ExecuteRequest):
    if not PC_CONTROL_ENABLED:
        raise HTTPException(status_code=403, detail="PC Control is disabled")

    tool_name = req.tool
    tool_input = req.input
    session_id = req.session_id

    permission_result = await permission_middleware.check(
        tool_name,
        tool_input,
        session_id,
        dangerous_enabled=req.dangerous_tier
    )

    if permission_result.get("requires_confirmation"):
        return {
            "requires_confirmation": True,
            "confirm_id": permission_result["confirm_id"],
            "tier": permission_result["tier"],
            "message": permission_result["message"]
        }

    if not permission_result.get("allowed"):
        return {
            "allowed": False,
            "error": permission_result.get("error", "Permission denied")
        }

    result = await _execute_tool(tool_name, tool_input)
    return {"allowed": True, "result": result}


async def _execute_tool(tool_name: str, tool_input: dict):
    if hasattr(controller, tool_name):
        method = getattr(controller, tool_name)
        result = await method(**tool_input)
        return result
    return f"Unknown tool: {tool_name}"


@router.post('/confirm/{confirm_id}')
async def confirm_action(confirm_id: str):
    pending = permission_middleware.get_pending(confirm_id)
    if not pending:
        raise HTTPException(status_code=404, detail="Confirmation expired or not found")

    result = await permission_middleware.confirm(confirm_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    tool_name = result["tool"]
    tool_input = result["input"]

    exec_result = await _execute_tool(tool_name, tool_input)
    return {"success": True, "result": exec_result}


@router.delete('/confirm/{confirm_id}')
async def cancel_action(confirm_id: str):
    result = await permission_middleware.cancel(confirm_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return {"cancelled": True, "tool": result.get("tool")}
