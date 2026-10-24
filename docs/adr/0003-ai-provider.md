# 0003 AI provider: Gemini, server-side, behind one module

**Status:** Proposed, amended by [0010](0010-stack-python-django.md) · **Issue:** #5 · **Traces to:** M2 section 6, G6, N9, T6

## Context

The tutor needs a hosted model. The key must never reach the browser, CI must never spend quota (N9, T6), and
the app must still run with no key at all (G6).

## Decision

- **Gemini via the official `@google/genai` SDK** (Apache-2.0, checked on npm 2026-10-19), called only from
  `packages/api`.
- One interface, `AiProvider`, in `packages/core`. One implementation, `GeminiProvider`. Tests use
  `FakeAiProvider` (FND-4). Nothing else imports the SDK.
- `GEMINI_API_KEY` and `GEMINI_MODEL` are server-only environment variables, never `NEXT_PUBLIC_`.
- **No key → no-key mode:** tutor pages show the setup notice (G6) and the provider is never constructed.
- The model ID is configuration, not code. Before TUT work starts, the ID in `.env.example` is checked against
  Google's model list and the date of that check is recorded here.

## Alternatives

- **Calling the REST API directly**: more code to maintain for the same result.
- **Provider-agnostic SDKs (Vercel AI SDK, LangChain)**: an extra layer we do not need for one provider; the
  `AiProvider` interface already gives us the seam.

## Consequences

- Swapping providers means one new class behind `AiProvider`.
- A guard in the test harness fails any test that tries to reach the provider host (FND-4).
