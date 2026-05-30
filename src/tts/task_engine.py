import asyncio
import logging
import re
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Callable, Awaitable

logger = logging.getLogger('vertha-task-engine')

STEP_LINE_RE = re.compile(
    r"\[?\s*0*(?P<n>\d+)\s*\]?[\s.\-:]+(?P<label>.+?)(?:\s+(?:--|—)\s+tool:\s*(?P<tool>\S+))?\s*$"
)


@dataclass
class Step:
    n: int
    label: str
    tool: str = ""
    status: str = "pending"
    result: str = ""
    attempts: int = 0
    error_reason: str = ""

    def to_dict(self) -> dict:
        return {
            "n": self.n,
            "label": self.label,
            "tool": self.tool,
            "status": self.status,
            "result": self.result,
            "attempts": self.attempts,
            "error_reason": self.error_reason,
        }


@dataclass
class TaskPlan:
    task_id: str
    total_steps: int
    goal: str
    checkpoints: list[int] = field(default_factory=list)
    rollback: str = ""
    steps: dict[int, Step] = field(default_factory=dict)
    started_at: datetime = field(default_factory=datetime.now)
    finished_at: datetime = None
    status: str = "running"
    summary: str = ""
    artifacts: list[str] = field(default_factory=list)
    issues: list[str] = field(default_factory=list)

    def progress(self) -> float:
        if self.total_steps == 0:
            return 0.0
        done = sum(1 for s in self.steps.values() if s.status == "done")
        return (done / self.total_steps) * 100

    def elapsed(self) -> float:
        end = self.finished_at or datetime.now()
        return (end - self.started_at).total_seconds()

    def to_dict(self) -> dict:
        return {
            "task_id": self.task_id,
            "total_steps": self.total_steps,
            "goal": self.goal,
            "checkpoints": self.checkpoints,
            "rollback": self.rollback,
            "steps": [self.steps[k].to_dict() for k in sorted(self.steps.keys())],
            "started_at": self.started_at.isoformat(),
            "finished_at": self.finished_at.isoformat() if self.finished_at else None,
            "status": self.status,
            "summary": self.summary,
            "artifacts": self.artifacts,
            "issues": self.issues,
            "progress": self.progress(),
            "elapsed": self.elapsed(),
        }


class TaskEngine:
    def __init__(self, on_event: Callable[[dict], Awaitable[None]] = None):
        self.current: TaskPlan | None = None
        self.history: list[TaskPlan] = []
        self.on_event = on_event
        self._abort_requested = False

    async def _emit(self, event: dict):
        if self.on_event:
            await self.on_event(event)

    def abort(self):
        self._abort_requested = True
        logger.info("Task abort requested")

    async def handle_event(self, event: dict) -> dict:
        event_type = event.get("type")

        if event_type == "task_plan":
            return await self.on_task_plan(event.get("attrs", {}), event.get("body", ""))
        elif event_type == "step":
            return await self.on_step(event.get("attrs", {}))
        elif event_type == "task_complete":
            return await self.on_task_complete(event.get("attrs", {}), event.get("body", ""))

        return {}

    async def on_task_plan(self, attrs: dict, body: str) -> dict:
        task_id = attrs.get("id", f"task_{uuid.uuid4().hex[:8]}")
        total_steps_str = attrs.get("total_steps", "0")
        try:
            total_steps = int(total_steps_str)
        except ValueError:
            total_steps = 0

        self.current = TaskPlan(
            task_id=task_id,
            total_steps=total_steps,
            goal="",
            steps={},
        )

        lines = body.strip().split("\n")
        current_step_n = 0

        for line in lines:
            line = line.strip()
            if not line:
                continue

            if line.upper().startswith("GOAL:"):
                self.current.goal = line[5:].strip()
            elif line.upper().startswith("CHECKPOINTS:"):
                ckpt_str = line[12:].strip()
                self.current.checkpoints = [int(x.strip()) for x in ckpt_str.split(",") if x.strip().isdigit()]
            elif line.upper().startswith("ROLLBACK:"):
                self.current.rollback = line[9:].strip()
            elif line.upper().startswith(("STEPS:", "STEP:")):
                continue
            else:
                match = STEP_LINE_RE.match(line)
                if match:
                    n = int(match.group("n"))
                    label = match.group("label").strip()
                    tool = match.group("tool") or ""
                    self.current.steps[n] = Step(n=n, label=label, tool=tool)
                    current_step_n = n

        logger.info(f"Task plan created: {task_id}, {len(self.current.steps)} steps")

        await self._emit({
            "type": "task_update",
            "kind": "task_plan",
            "plan": self.current.to_dict(),
        })

        return self.current.to_dict()

    async def on_step(self, attrs: dict) -> dict:
        if not self.current:
            return {}

        n_str = attrs.get("n", "0")
        try:
            n = int(n_str)
        except ValueError:
            return {}

        status = attrs.get("status", "pending")

        if n in self.current.steps:
            step = self.current.steps[n]
            old_status = step.status
            step.status = status

            if status == "error":
                step.error_reason = attrs.get("reason", "Unknown error")
                step.attempts += 1

            if "result" in attrs:
                step.result = attrs.get("result", "")

            logger.info(f"Step {n} status: {old_status} -> {status}")
        else:
            label = attrs.get("label", f"Step {n}")
            tool = attrs.get("tool", "")
            self.current.steps[n] = Step(n=n, label=label, tool=tool, status=status)
            if status == "error":
                self.current.steps[n].error_reason = attrs.get("reason", "Unknown error")

        await self._emit({
            "type": "task_update",
            "kind": "step",
            "plan": self.current.to_dict(),
        })

        return self.current.to_dict()

    async def on_task_complete(self, attrs: dict, body: str) -> dict:
        if not self.current:
            return {}

        self.current.status = attrs.get("status", "unknown")
        self.current.finished_at = datetime.now()

        lines = body.strip().split("\n")
        for line in lines:
            line = line.strip()
            if line.upper().startswith("SUMMARY:"):
                self.current.summary = line[8:].strip()
            elif line.upper().startswith("ARTIFACTS:"):
                artifacts_str = line[10:].strip()
                self.current.artifacts = [a.strip() for a in artifacts_str.split(",") if a.strip()]
            elif line.upper().startswith("ISSUES:"):
                issues_str = line[7:].strip()
                self.current.issues = [i.strip() for i in issues_str.split(",") if i.strip()]

        logger.info(f"Task complete: {self.current.task_id}, status={self.current.status}")

        await self._emit({
            "type": "task_update",
            "kind": "task_complete",
            "plan": self.current.to_dict(),
        })

        result = self.current.to_dict()
        self.history.append(self.current)
        self.current = None

        return result

    def get_current(self) -> dict | None:
        if self.current:
            return self.current.to_dict()
        return None


_task_engine: TaskEngine | None = None


def get_task_engine() -> TaskEngine:
    global _task_engine
    if _task_engine is None:
        _task_engine = TaskEngine()
    return _task_engine


def set_task_engine(engine: TaskEngine):
    global _task_engine
    _task_engine = engine