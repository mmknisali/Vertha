import asyncio
import sys
from pathlib import Path

import pytest

_src_tts = str(Path(__file__).parent.parent.parent / 'src' / 'tts')
if _src_tts not in sys.path:
    sys.path.insert(0, _src_tts)

import call_agent  # noqa: E402
from call_agent import CallAgent, CallRecord, CallRequest, CallStatus, provider_from_env  # noqa: E402

# A fictional number from the 555-01xx range reserved for examples.
EXAMPLE_NUMBER = '+15555550100'
OTHER_NUMBER = '+15555550199'


def request(**overrides):
    fields = dict(
        to_number=EXAMPLE_NUMBER,
        callee_name='Example Clinic',
        purpose='Move Thursday appointment',
        script='Hi, this is the owner\'s assistant. Can we move Thursday to Friday?',
        max_seconds=120,
    )
    fields.update(overrides)
    return CallRequest(**fields)


class FakeProvider:
    name = 'fake'

    def __init__(self):
        self.calls = []

    async def place_call(self, req):
        self.calls.append(req)
        return CallRecord(CallStatus.PLACED, 'accepted', provider_call_id='fake-1')


class BrokenProvider:
    name = 'broken'

    async def place_call(self, req):
        raise RuntimeError('provider unavailable')


def run(coro):
    return asyncio.run(coro)


class TestValidation:
    def test_number_must_be_international(self):
        rec = run(CallAgent(None, {'0555'}).request_call(request(to_number='0555 555 0100')))
        assert rec.status == CallStatus.REJECTED
        assert 'international' in rec.reason

    def test_unknown_callee_needs_owner_approval(self):
        rec = run(CallAgent(FakeProvider(), {OTHER_NUMBER}).request_call(request()))
        assert rec.status == CallStatus.REJECTED
        assert 'contact list' in rec.reason

    def test_owner_approval_lets_a_one_off_call_through(self):
        provider = FakeProvider()
        rec = run(CallAgent(provider, set()).request_call(request(approved_by_owner=True)))
        assert rec.status == CallStatus.PLACED
        assert len(provider.calls) == 1

    def test_missing_script_and_purpose_are_rejected(self):
        agent = CallAgent(FakeProvider(), {EXAMPLE_NUMBER})
        rec = run(agent.request_call(request(script='   ', purpose='')))
        assert rec.status == CallStatus.REJECTED
        assert 'purpose' in rec.reason and 'script' in rec.reason

    def test_time_limit_is_capped(self):
        agent = CallAgent(FakeProvider(), {EXAMPLE_NUMBER})
        rec = run(agent.request_call(request(max_seconds=call_agent.MAX_CALL_SECONDS + 1)))
        assert rec.status == CallStatus.REJECTED
        assert 'time limit' in rec.reason


class TestDispatch:
    def test_no_provider_means_no_call_and_says_so(self):
        rec = run(CallAgent(None, {EXAMPLE_NUMBER}).request_call(request()))
        assert rec.status == CallStatus.NOT_CONFIGURED
        assert 'no call was placed' in rec.reason

    def test_allowlisted_call_reaches_the_provider(self):
        provider = FakeProvider()
        rec = run(CallAgent(provider, {EXAMPLE_NUMBER}).request_call(request()))
        assert rec.status == CallStatus.PLACED
        assert rec.provider_call_id == 'fake-1'
        assert provider.calls[0].to_number == EXAMPLE_NUMBER

    def test_provider_error_is_recorded_not_raised(self):
        rec = run(CallAgent(BrokenProvider(), {EXAMPLE_NUMBER}).request_call(request()))
        assert rec.status == CallStatus.FAILED
        assert rec.reason == 'provider unavailable'

    def test_a_rejected_request_never_reaches_the_provider(self):
        provider = FakeProvider()
        run(CallAgent(provider, set()).request_call(request()))
        assert provider.calls == []


class TestProviderFromEnv:
    def test_no_settings_means_no_provider(self):
        assert provider_from_env({}) is None

    def test_name_without_key_still_means_no_provider(self):
        assert provider_from_env({'VERTHA_CALL_PROVIDER': 'someone'}) is None

    def test_named_but_unwired_provider_fails_loudly(self):
        env = {'VERTHA_CALL_PROVIDER': 'someone', 'VERTHA_CALL_PROVIDER_API_KEY': 'placeholder'}
        with pytest.raises(NotImplementedError):
            provider_from_env(env)
