import re
import logging

logger = logging.getLogger('vertha-stream-parser')

OPEN_TAG_RE = re.compile(r"<vertha:([a-zA-Z_][\w-]*)\b([^>]*?)(/?)>")
CLOSE_TAG_RE = re.compile(r"</vertha:([a-zA-Z_][\w-]*)\s*>")


class StreamParser:
    MODE_RESPONSE = "response"
    MODE_THINK = "think"
    MODE_BLOCK = "block"

    def __init__(self):
        self.reset()

    def reset(self):
        self._buffer = ""
        self._mode = self.MODE_RESPONSE
        self._open_tags: list[tuple[str, str]] = []
        self._current_block_name = ""
        self._current_block_attrs = ""
        self._current_block_body = ""
        self._think_buf = ""
        self._response_buf = ""

    def feed(self, text: str) -> list[dict]:
        self._buffer += text
        events = []

        while self._buffer:
            if self._mode == self.MODE_RESPONSE:
                event = self._scan_response()
                if event:
                    events.append(event)
                else:
                    break
            elif self._mode == self.MODE_THINK:
                event = self._scan_think()
                if event:
                    events.append(event)
                else:
                    break
            elif self._mode == self.MODE_BLOCK:
                event = self._scan_block()
                if event:
                    events.append(event)
                else:
                    break

        return events

    def _scan_response(self) -> dict | None:
        if not self._buffer:
            return None

        open_match = OPEN_TAG_RE.search(self._buffer)
        close_match = CLOSE_TAG_RE.search(self._buffer)

        if open_match and (not close_match or open_match.start() <= close_match.start()):
            before = self._buffer[:open_match.start()]
            if before:
                self._response_buf += before
                self._buffer = self._buffer[open_match.start():]
                return {"type": "response_delta", "text": before}

            tag_name = open_match.group(1)
            attrs_str = open_match.group(2)
            self_closing = open_match.group(3) == "/"

            if tag_name == "think":
                self._buffer = self._buffer[open_match.end():]
                self._mode = self.MODE_THINK
                self._think_buf = ""
                return {"type": "think_start"}
            elif tag_name in ("task_plan", "task_complete"):
                self._buffer = self._buffer[open_match.end():]
                self._mode = self.MODE_BLOCK
                self._current_block_name = tag_name
                self._current_block_attrs = attrs_str.strip()
                self._current_block_body = ""
                if self_closing:
                    self._open_tags.append((tag_name, "self-closing"))
                    return self._emit_block_event(self_closing=True)
                self._open_tags.append((tag_name, attrs_str))
                return None
            elif tag_name == "step":
                self._buffer = self._buffer[open_match.end():]
                attrs = self._parse_attrs(attrs_str)
                if self_closing:
                    return {"type": "step", "attrs": attrs}
                return {"type": "step", "attrs": attrs}
            else:
                self._buffer = self._buffer[open_match.end():]
                self._open_tags.append((tag_name, attrs_str))
                return None

        if close_match:
            before = self._buffer[:close_match.start()]
            if before:
                self._response_buf += before
            self._buffer = self._buffer[close_match.end():]
            self._mode = self.MODE_RESPONSE
            result = {"type": "response_delta", "text": before}
            self._open_tags.pop()
            return result

        remaining = len(self._buffer)
        if remaining > 0:
            chunk = self._buffer[:remaining]
            self._response_buf += chunk
            self._buffer = ""
            return {"type": "response_delta", "text": chunk}

        return None

    def _scan_think(self) -> dict | None:
        if not self._buffer:
            return None

        close_match = CLOSE_TAG_RE.search(self._buffer)

        if close_match:
            before = self._buffer[:close_match.start()]
            if before:
                self._think_buf += before
            self._buffer = self._buffer[close_match.end():]
            self._mode = self.MODE_RESPONSE
            tag_name = close_match.group(1)
            if tag_name == "think":
                return {"type": "think_end", "text": self._think_buf}
            self._think_buf = ""
            return None

        remaining = len(self._buffer)
        if remaining > 100:
            chunk = self._buffer[:100]
            self._think_buf += chunk
            self._buffer = self._buffer[100:]
            return {"type": "think_delta", "text": chunk}

        self._think_buf += self._buffer
        self._buffer = ""
        return None

    def _scan_block(self) -> dict | None:
        if not self._buffer:
            return None

        open_match = OPEN_TAG_RE.search(self._buffer)
        close_match = CLOSE_TAG_RE.search(self._buffer)

        if close_match and (not open_match or close_match.start() <= open_match.start()):
            before = self._buffer[:close_match.start()]
            self._current_block_body += before
            self._buffer = self._buffer[close_match.end():]

            tag_name = close_match.group(1)

            if tag_name == self._current_block_name and self._open_tags:
                self._open_tags.pop()
                is_self_closing = self._open_tags and self._open_tags[-1][1] == "self-closing"
                if self._open_tags:
                    self._open_tags.pop()

                inner_mode = self.MODE_RESPONSE
                if self._open_tags:
                    inner_mode = self.MODE_BLOCK

                if inner_mode == self.MODE_BLOCK:
                    prev_name = self._open_tags[-1][0] if self._open_tags else ""
                    if prev_name == "think":
                        inner_mode = self.MODE_THINK

                if inner_mode == self.MODE_THINK:
                    self._mode = self.MODE_THINK
                    self._think_buf = ""
                    return {"type": "think_start"}
                elif inner_mode == self.MODE_BLOCK:
                    self._current_block_name = prev_name
                    self._current_block_attrs = ""
                    self._current_block_body = ""
                else:
                    self._mode = self.MODE_RESPONSE

                return self._emit_block_event()
            return None

        if open_match:
            before = self._buffer[:open_match.start()]
            self._current_block_body += before
            self._buffer = self._buffer[open_match.start():]

            tag_name = open_match.group(1)
            attrs_str = open_match.group(2)
            self_closing = open_match.group(3) == "/"

            if tag_name == "think":
                self._think_buf = ""
                self._mode = self.MODE_THINK
                self._buffer = self._buffer[open_match.end():]
                return {"type": "think_start"}
            elif tag_name in ("task_plan", "task_complete"):
                self._current_block_name = tag_name
                self._current_block_attrs = attrs_str.strip()
                self._current_block_body = ""
                if self_closing:
                    self._open_tags.pop()
                    self._open_tags.append((tag_name, "self-closing"))
                    return self._emit_block_event(self_closing=True)
                self._open_tags.append((tag_name, attrs_str))
                return None
            elif tag_name == "step":
                self._buffer = self._buffer[open_match.end():]
                attrs = self._parse_attrs(attrs_str)
                if self_closing:
                    return {"type": "step", "attrs": attrs}
                return {"type": "step", "attrs": attrs}
            else:
                self._open_tags.append((tag_name, attrs_str))
                self._buffer = self._buffer[open_match.end():]
                return None

        remaining = len(self._buffer)
        if remaining > 100:
            chunk = self._buffer[:100]
            self._current_block_body += chunk
            self._buffer = self._buffer[100:]
            return None

        self._current_block_body += self._buffer
        self._buffer = ""
        return None

    def _parse_attrs(self, attrs_str: str) -> dict:
        attrs = {}
        if not attrs_str:
            return attrs

        attr_re = re.compile(r'(\w+)="([^"]*)"')
        for match in attr_re.finditer(attrs_str):
            attrs[match.group(1)] = match.group(2)

        return attrs

    def _emit_block_event(self, self_closing: bool = False) -> dict:
        event = {
            "type": "tag",
            "name": self._current_block_name,
            "attrs": self._parse_attrs(self._current_block_attrs),
            "body": self._current_block_body.strip(),
        }
        if self_closing:
            self._current_block_body = ""
        return event

    def get_response_text(self) -> str:
        return self._response_buf

    def get_think_text(self) -> str:
        return self._think_buf


def strip_tags_for_tts(text: str) -> str:
    text = re.sub(r"<vertha:think>.*?</vertha:think>", "", text, flags=re.DOTALL)
    text = re.sub(r"<vertha:(?:task_plan|task_complete|step)[^>]*>.*?</vertha:(?:task_plan|task_complete|step)>", "", text, flags=re.DOTALL)
    text = re.sub(r"<vertha:(?:step)[^>]*/?>", "", text)
    return text.strip()