"""Call agent: scaffold for placing phone calls for the owner.

This module is an interface and a set of safety checks. It does not place a
call. No phone provider is chosen here and no key is set. Until the owner sets
VERTHA_CALL_PROVIDER and VERTHA_CALL_PROVIDER_API_KEY and a provider is wired
in, every request comes back NOT_CONFIGURED without touching the network.

Checks that run before any provider sees a request:
- the number is in E.164 form (a plus sign and digits, for example +15555550100)
- the callee is on the owner's allowlist, or the owner approved this exact call
- a callee name, a purpose and a script (what to say) are given
- the call has a time limit, capped at MAX_CALL_SECONDS
"""
import os
import re
from dataclasses import dataclass
from enum import Enum
from typing import Protocol

E164 = re.compile(r'^\+[1-9]\d{6,14}$')
MAX_CALL_SECONDS = 600
PROVIDER_ENV = 'VERTHA_CALL_PROVIDER'
PROVIDER_KEY_ENV = 'VERTHA_CALL_PROVIDER_API_KEY'


class CallStatus(str, Enum):
    REJECTED = 'rejected'          # a check failed; nothing was sent anywhere
    NOT_CONFIGURED = 'not_configured'  # valid request, but no provider is set up
    PLACED = 'placed'              # the provider accepted the call
    FAILED = 'failed'              # the provider raised an error


@dataclass(frozen=True)
class CallRequest:
    to_number: str
    callee_name: str
    purpose: str
    script: str
    max_seconds: int = 180
    approved_by_owner: bool = False


@dataclass(frozen=True)
class CallRecord:
    status: CallStatus
    reason: str
    provider_call_id: str | None = None


class CallProvider(Protocol):
    """What a phone provider must offer. Implement this when one is chosen."""

    name: str

    async def place_call(self, request: CallRequest) -> CallRecord:
        ...


def validate(request: CallRequest, allowlist: set[str]) -> list[str]:
    """Every reason this request must not go out. An empty list means it may."""
    problems = []
    if not E164.match(request.to_number or ''):
        problems.append('the number is not in international form, like +15555550100')
    elif request.to_number not in allowlist and not request.approved_by_owner:
        problems.append('that number is not on the owner\'s contact list and the owner has not approved this call')
    if not (request.callee_name or '').strip():
        problems.append('the call needs the name of who is being called')
    if not (request.purpose or '').strip():
        problems.append('the call needs a purpose')
    if not (request.script or '').strip():
        problems.append('the call needs a script: what to say')
    if not 1 <= int(request.max_seconds) <= MAX_CALL_SECONDS:
        problems.append(f'the time limit must be between 1 and {MAX_CALL_SECONDS} seconds')
    return problems


class CallAgent:
    def __init__(self, provider: CallProvider | None, allowlist: set[str] | None = None):
        self.provider = provider
        self.allowlist = set(allowlist or ())

    async def request_call(self, request: CallRequest) -> CallRecord:
        problems = validate(request, self.allowlist)
        if problems:
            return CallRecord(CallStatus.REJECTED, '; '.join(problems))
        if self.provider is None:
            return CallRecord(
                CallStatus.NOT_CONFIGURED,
                'No phone provider is set up yet, so no call was placed.',
            )
        try:
            return await self.provider.place_call(request)
        except Exception as error:  # the provider's own words stay in the record
            return CallRecord(CallStatus.FAILED, str(error))


def provider_from_env(env=None) -> CallProvider | None:
    """Return the configured provider, or None while the owner has set none up.

    Naming a provider and giving its key is not enough on its own: the provider
    class has to be wired in here first, so this raises rather than guessing.
    """
    env = os.environ if env is None else env
    name = env.get(PROVIDER_ENV, '').strip()
    key = env.get(PROVIDER_KEY_ENV, '').strip()
    if not name or not key:
        return None
    raise NotImplementedError(f'Call provider "{name}" is named but not wired into call_agent.py yet.')
