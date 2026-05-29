import asyncio
import logging
from collections import deque
from datetime import datetime

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
}

BASE_NARRATIONS = {
    "Done. Now searching the web...": "Done. Searching the web...",
    "Done. Now updating your calendar...": "Done. Updating your calendar...",
    "Done. Now sending the email...": "Done. Sending the email...",
    "Done. Now playing music...": "Done. Playing music...",
    "Noted sir. Now continuing...": "Noted sir, continuing...",
    "Done checking memory. Now...": "Memory checked, continuing...",
    "All done, sir.": "All done, sir.",
}


class TaskQueue:
    def __init__(self):
        self.queue = deque()
        self.current_task = None
        self.is_running = False

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
            narration = self._get_narration(tool_name, remaining)

            result = {"name": tool_name, "input": tool_call.get("input", {}), "success": True}
            results.append(result)

            if remaining > 0:
                await on_step_complete(
                    step=i + 1,
                    tool=tool_name,
                    status="done",
                    narration=narration,
                    remaining=remaining
                )
                await asyncio.sleep(0.5)
            else:
                await on_step_complete(
                    step=i + 1,
                    tool=tool_name,
                    status="done",
                    narration="All done, sir.",
                    remaining=0
                )

        self.is_running = False
        self.current_task = None
        return results

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
