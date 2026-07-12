import logging
from datetime import datetime

logger = logging.getLogger('vertha-proactive')

MORNING_HOUR = 8
NIGHT_HOUR = 23
SUGGESTION_COOLDOWN_SECS = 300


class ProactiveEngine:
    def __init__(self):
        self.last_suggestion_time = None
        self.suggestion_cooldown = SUGGESTION_COOLDOWN_SECS
        self.morning_done = False
        self.night_done = False

    def check(self, context: dict) -> str | None:
        now = datetime.now()

        if self.last_suggestion_time:
            elapsed = (now - self.last_suggestion_time).total_seconds()
            if elapsed < self.suggestion_cooldown:
                return None

        suggestions = []

        hour = now.hour
        if hour != MORNING_HOUR:
            self.morning_done = False
        if hour != NIGHT_HOUR:
            self.night_done = False

        if hour == MORNING_HOUR and not self.morning_done and not context.get("morning_done"):
            suggestions.append(
                "Good morning, sir. Say 'good morning' whenever you're ready for your briefing."
            )
            self.morning_done = True

        if hour == NIGHT_HOUR and not self.night_done and not context.get("night_done"):
            suggestions.append("It's getting late, sir. Shall I set up for the night?")
            self.night_done = True

        upcoming_mins = context.get("upcoming_event_in_minutes")
        if upcoming_mins is not None:
            mins = int(upcoming_mins)
            if mins <= 15:
                event = context.get("upcoming_event_name", "event")
                suggestions.append(f"Sir, you have '{event}' in {mins} minutes.")

        coding_mins = context.get("coding_session_minutes", 0)
        if coding_mins > 90:
            suggestions.append("You've been at it for a while, sir. Perhaps a short break?")

        if suggestions:
            self.last_suggestion_time = now
            return suggestions[0]

        return None

    def reset_morning(self):
        self.morning_done = False

    def reset_night(self):
        self.night_done = False


_proactive_engine = ProactiveEngine()


def get_proactive_engine() -> ProactiveEngine:
    return _proactive_engine


async def check_proactive(context: dict) -> str | None:
    return _proactive_engine.check(context)
