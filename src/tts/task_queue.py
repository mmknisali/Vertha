import asyncio
import logging
from collections import deque
from datetime import datetime
import json

from task_engine import TaskEngine, get_task_engine, Step
from tool_executor import get_tool_executor

logger = logging.getLogger('vertha-task-queue')

NARRATIONS = {
    "web_search": "Done. Now searching the web...",
    "pin_memory": "Noted sir. Now continuing...",
    "search_memory": "Done checking memory. Now...",
    "weather": "Weather retrieved. Next...",
    "spotify_play": "Music started. Now...",
    "spotify_pause": "Music paused. Now...",
    "spotify_volume": "Volume adjusted. Now...",
    "add_event": "Calendar updated. Now sending email...",
    "send_email": "Email sent. All done, sir.",
    "bash_exec": "Executing command...",
    "file_read": "Reading file...",
    "file_write": "Writing file...",
    "file_delete": "Deleting file...",
    "file_list": "Listing directory...",
}

BASE_NARRATIONS = {
    "Done. Now searching the web...": "Done. Searching the web...",
    "Done. Now updating your calendar...": "Done. Updating your calendar...",
    "Done. Now sending the email...": "Done. Sending the email...",
    "Done. Now playing music...": "Done. Playing music...",
    "Noted sir. Now continuing...": "Noted sir, continuing...",
    "Done checking memory. Now...": "Memory checked, continuing...",
    "All done, sir.": "All done, sir.",
    "Executing command...": "Executing command...",
    "Reading file...": "File read.",
    "Writing file...": "File written.",
    "Deleting file...": "File deleted.",
    "Listing directory...": "Directory listed.",
}


class TaskQueue:
    def __init__(self):
        self.queue = deque()
        self.current_task = None
        self.is_running = False
        self.task_engine = get_task_engine()
        self.tool_executor = get_tool_executor()

    def parse_multi_step(self, response: dict) -> list:
        tool_calls = [
            block for block in response.get("content", [])
            if block.get("type") == "tool_use"
        ]
        return tool_calls

    async def execute_sequence(
        self,
        tool_calls: list,
        on_step_complete,
    ):
        self.is_running = True
        results = []

        for i, tool_call in enumerate(tool_calls):
            self.current_task = tool_call.get("name")
            remaining = len(tool_calls) - i - 1

            tool_name = tool_call.get("name", "unknown")
            tool_input = tool_call.get("input", {})

            result = {"name": tool_name, "input": tool_input, "success": True}

            exec_result = await self.tool_executor.execute(tool_name, tool_input)
            result["execution"] = exec_result
            result["success"] = exec_result.get("success", False)

            if not exec_result.get("success", False):
                result["error"] = exec_result.get("error", "Unknown error")

            results.append(result)

            narration = self._get_narration(tool_name, remaining)
            if remaining > 0:
                await on_step_complete(
                    step=i + 1,
                    tool=tool_name,
                    status="done" if result["success"] else "error",
                    narration=narration,
                    remaining=remaining,
                    result=result,
                )
                await asyncio.sleep(0.3)
            else:
                await on_step_complete(
                    step=i + 1,
                    tool=tool_name,
                    status="done" if result["success"] else "error",
                    narration="All done, sir." if result["success"] else f"Error: {result.get('error', 'Failed')}",
                    remaining=0,
                    result=result,
                )

        self.is_running = False
        self.current_task = None
        return results

    async def execute_task_plan(
        self,
        task_plan: dict,
        on_step_complete,
        on_task_complete,
    ):
        self.is_running = True
        steps = task_plan.get("steps", [])
        rollback = task_plan.get("rollback", "")

        for step_data in steps:
            n = step_data.get("n")
            tool_name = step_data.get("tool", "bash_exec")
            label = step_data.get("label", "")
            tool_input = step_data.get("input", {})

            await on_step_complete(
                step=n,
                tool=tool_name,
                status="running",
                narration=f"Step {n}: {label}",
                remaining=len(steps) - n,
            )

            max_attempts = 3
            step_success = False

            for attempt in range(max_attempts):
                exec_result = await self.tool_executor.execute(tool_name, tool_input)

                if exec_result.get("success", False):
                    step_success = True
                    await on_step_complete(
                        step=n,
                        tool=tool_name,
                        status="done",
                        narration=f"Step {n} complete",
                        remaining=len(steps) - n,
                        result=exec_result,
                    )
                    break
                else:
                    if attempt < max_attempts - 1:
                        logger.warning(f"Step {n} attempt {attempt + 1} failed, retrying...")
                        await asyncio.sleep(1 * (attempt + 1))
                    else:
                        logger.error(f"Step {n} failed after {max_attempts} attempts")

                        if rollback and attempt == max_attempts - 1:
                            await self._execute_rollback(rollback, on_step_complete)

                        await on_step_complete(
                            step=n,
                            tool=tool_name,
                            status="error",
                            narration=f"Step {n} failed: {exec_result.get('error', 'Unknown')}",
                            remaining=len(steps) - n,
                            result=exec_result,
                        )

        self.is_running = False

        await on_task_complete(
            status="success",
            summary=f"Completed {len(steps)} steps",
        )

    async def _execute_rollback(self, rollback: str, on_step_complete):
        logger.info(f"Executing rollback: {rollback[:100]}")
        exec_result = await self.tool_executor.execute("bash_exec", {"command": rollback})
        await on_step_complete(
            step=0,
            tool="rollback",
            status="done" if exec_result.get("success") else "error",
            narration="Rollback executed" if exec_result.get("success") else "Rollback failed",
            remaining=0,
            result=exec_result,
        )

    def _get_narration(self, tool_name: str, remaining: int) -> str:
        if remaining == 0:
            return "All done, sir."
        base = NARRATIONS.get(tool_name)
        if base:
            return base
        return f"Done with {tool_name}. Now..."


_task_queue = TaskQueue()


def get_task_queue() -> TaskQueue:
    return _task_queue
