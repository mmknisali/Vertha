import logging

logger = logging.getLogger('vertha-conversation')

FRUSTRATED_WORDS = ["not working", "broken", "stupid", "useless", "fuck", "shit", "wrong", "annoying", "terrible", "horrible"]
HAPPY_WORDS = ["thanks", "great", "awesome", "perfect", "nice", "love it", "brilliant", "amazing", "excellent", "wonderful"]
TIRED_WORDS = ["tired", "exhausted", "sleepy", "going to sleep", "good night", "knock out", "beat"]

MAX_MESSAGES = 20

EMOTION_SUFFIXES = {
    "frustrated": "\n\n[ADJUSTMENT: The user seems frustrated. Be extra calm, concise, and solutions-focused. No filler phrases. Do not apologize excessively.]",
    "happy": "\n\n[ADJUSTMENT: The user is in a good mood. Match their energy slightly — be a touch warmer than usual.]",
    "tired": "\n\n[ADJUSTMENT: The user seems tired. Keep responses very short, calm, and quiet. No lengthy explanations. Get to the point.]",
    "neutral": "",
}


class ConversationManager:
    def __init__(self):
        self.state = "idle"
        self.turn_count = 0
        self.last_emotion = "neutral"
        self.topics_discussed = []

    @staticmethod
    def detect_emotion(message: str) -> str:
        msg = message.lower()
        if any(w in msg for w in FRUSTRATED_WORDS):
            return "frustrated"
        if any(w in msg for w in HAPPY_WORDS):
            return "happy"
        if any(w in msg for w in TIRED_WORDS):
            return "tired"
        return "neutral"

    def build_messages(
        self,
        history: list[dict],
        new_message: str,
        memory_context: str,
        resolved_message: str,
        emotion: str | None = None,
    ) -> list[dict]:
        effective_emotion = emotion or self.last_emotion
        messages = []

        if memory_context:
            messages.append({
                "role": "user",
                "content": f"[MEMORY CONTEXT]\n{memory_context}"
            })
            messages.append({
                "role": "assistant",
                "content": "Understood, I have that context."
            })

        trimmed_history = self._trim_history(history)
        messages.extend(trimmed_history)

        messages.append({
            "role": "user",
            "content": resolved_message
        })

        return messages

    def _trim_history(self, history: list[dict]) -> list[dict]:
        if len(history) <= MAX_MESSAGES:
            return history
        return history[:2] + history[-(MAX_MESSAGES - 2):]

    def increment_turn(self):
        self.turn_count += 1

    def set_emotion(self, emotion: str):
        self.last_emotion = emotion


_conversation_manager = ConversationManager()


def get_conversation_manager() -> ConversationManager:
    return _conversation_manager


def detect_emotion(message: str) -> str:
    return ConversationManager.detect_emotion(message)


def build_messages(
    history: list[dict],
    new_message: str,
    memory_context: str,
    resolved_message: str,
    emotion: str | None = None,
) -> list[dict]:
    return _conversation_manager.build_messages(history, new_message, memory_context, resolved_message, emotion)
