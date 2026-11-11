# Call agent (scaffold)

Vertha's call agent is meant to phone people for the owner: a restaurant, a clinic, a friend. This branch lays down the interface and the safety checks only. **It does not place calls.** No phone provider is chosen, no key is set, and nothing in the code dials a number.

## What is here

- `src/tts/call_agent.py`
  - `CallRequest`: who to call (international number), the callee's name, the purpose, the script (what to say), a time limit, and whether the owner approved this exact call.
  - `CallAgent.request_call(request)`: runs the checks, then hands the request to a provider if one is set up. It returns a `CallRecord` with a status: `rejected`, `not_configured`, `placed`, or `failed`.
  - `CallProvider`: the interface a phone provider implements (one method, `place_call`).
  - `provider_from_env()`: reads `VERTHA_CALL_PROVIDER` and `VERTHA_CALL_PROVIDER_API_KEY`. With either missing it returns no provider. With both set it raises until the provider is wired in, so a half-configured setup cannot quietly do nothing.
- `tests/python/test_call_agent.py`: the checks and the dispatch, with a fake provider. No network.

## Rules the agent enforces

1. The number must be in international form (`+` and digits).
2. The callee must be on the owner's contact list, or the owner must approve this exact call.
3. A callee name, a purpose and a script are required.
4. The time limit is capped at 600 seconds.

Rejected requests never reach a provider.

## What the owner adds

1. A phone provider account, and its API key.
2. The provider class in `call_agent.py`, implementing `CallProvider`.
3. The two environment variables in `src/tts/.env.local`:
   ```
   VERTHA_CALL_PROVIDER=<name of the provider you chose>
   VERTHA_CALL_PROVIDER_API_KEY=<your key>
   ```
4. An allowlist of numbers the agent may call without a separate approval.

Calls are not placed until the owner has done all of this and has asked for a specific call.
