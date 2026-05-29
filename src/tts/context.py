import re
import logging

logger = logging.getLogger('vertha-context')

AMBIGUOUS_PATTERNS = [
    "it", "that", "this", "there", "they", "them",
    "do that again", "same thing", "what about",
    "how about", "and also", "what time", "how long",
    "when is", "where is", "again", "more", "also"
]

TIME_KEYWORDS = [
    "today", "tomorrow", "yesterday", "next week", "monday",
    "tuesday", "wednesday", "thursday", "friday", "saturday",
    "sunday", "morning", "afternoon", "evening", "night",
    "hour", "hours", "minute", "minutes", "second", "seconds"
]

LOCATION_KEYWORDS = [
    "istanbul", "ankara", "izmir", "gaziantep", "city",
    "airport", "home", "office", "street", "park",
    "restaurant", "cafe", "shop", "store", "mall"
]

TOOL_KEYWORDS = {
    "weather": ["weather", "temperature", "rain", "sunny", "forecast"],
    "spotify": ["spotify", "music", "play", "pause", "song", "podcast"],
    "calendar": ["calendar", "event", "meeting", "schedule", "appointment"],
    "search": ["search", "google", "web", "look up", "find"],
    "memory": ["remember", "recall", "what did i say", "past conversation"],
    "code": ["code", "compile", "run", "execute", "script", "python"],
    "file": ["file", "read", "write", "open", "folder", "directory"],
    "email": ["email", "mail", "send", "message"],
    "weather_query": ["weather in", "weather for", "weather here"],
}


class ContextResolver:
    def __init__(self):
        self.recent_entities = {
            "last_topic": None,
            "last_tool": None,
            "last_location": None,
            "last_query": None,
            "last_time_ref": None,
        }

    def _is_ambiguous(self, message: str) -> bool:
        msg_lower = message.lower()
        for pattern in AMBIGUOUS_PATTERNS:
            if pattern in msg_lower:
                return True
        return False

    def _extract_topic(self, message: str) -> str | None:
        msg_lower = message.lower()
        for tool, keywords in TOOL_KEYWORDS.items():
            for keyword in keywords:
                if keyword in msg_lower:
                    return tool
        return None

    def _extract_location(self, message: str) -> str | None:
        msg_lower = message.lower()
        for loc in LOCATION_KEYWORDS:
            if loc in msg_lower:
                return loc
        return None

    def _extract_time_ref(self, message: str) -> str | None:
        msg_lower = message.lower()
        for time_kw in TIME_KEYWORDS:
            if time_kw in msg_lower:
                return time_kw
        return None

    def _build_context_suffix(self) -> str:
        parts = []
        if self.recent_entities.get("last_topic"):
            parts.append(f"topic: {self.recent_entities['last_topic']}")
        if self.recent_entities.get("last_tool"):
            parts.append(f"last action: {self.recent_entities['last_tool']}")
        if self.recent_entities.get("last_location"):
            parts.append(f"location mentioned: {self.recent_entities['last_location']}")
        if self.recent_entities.get("last_query"):
            parts.append(f"last search query: {self.recent_entities['last_query']}")
        if self.recent_entities.get("last_time_ref"):
            parts.append(f"time reference: {self.recent_entities['last_time_ref']}")
        return ", ".join(parts) if parts else ""

    def resolve(self, message: str, history: list[dict]) -> str:
        if not self._is_ambiguous(message):
            return message

        context_suffix = self._build_context_suffix()
        if context_suffix:
            return f"{message} (context: {context_suffix})"
        return message

    def update(self, message: str, tool_called: str | None = None):
        if tool_called:
            self.recent_entities["last_tool"] = tool_called

        topic = self._extract_topic(message)
        if topic:
            self.recent_entities["last_topic"] = topic

        location = self._extract_location(message)
        if location:
            self.recent_entities["last_location"] = location

        time_ref = self._extract_time_ref(message)
        if time_ref:
            self.recent_entities["last_time_ref"] = time_ref

        if "search" in message.lower() or "google" in message.lower():
            query_match = re.search(r'"([^"]+)"', message)
            if query_match:
                self.recent_entities["last_query"] = query_match.group(1)


_context_resolver = ContextResolver()


def get_resolver() -> ContextResolver:
    return _context_resolver


def resolve_message(message: str, history: list[dict]) -> str:
    return _context_resolver.resolve(message, history)


def update_context(message: str, tool_called: str | None = None):
    _context_resolver.update(message, tool_called)
