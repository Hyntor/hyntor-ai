"""A scripted stand-in for the AI provider (FND-4, #9, N9).

The real provider is never called in tests: it costs quota, needs a secret, and fails for reasons
that have nothing to do with our code. `FakeAiProvider` answers from a script and records every
call, so a test can assert on what we sent as well as on what the page did with the reply.

Scripting a hostile reply is the point of it. TUT-5's injection tests need a provider that *obeys*
the injected instruction, to prove our own guard still caps the output:

    provider = FakeAiProvider(replies=["Here is the full worked solution."])
"""

from dataclasses import dataclass, field


class ProviderError(Exception):
    """What a provider failure looks like to the code above it."""


@dataclass
class Call:
    """One request, kept so a test can assert on what was actually sent."""

    prompt: str
    system_instruction: str = ""
    options: dict = field(default_factory=dict)


class FakeAiProvider:
    """Replies from a script, in order, and remembers everything it was asked.

    replies: handed out one per call. A string is sent as-is; an exception instance is raised, so
             a single script can cover a timeout partway through a conversation.
    default: what to say once the script runs out. None means running out is a test failure, which
             is usually what you want - a surprise extra call is a bug worth seeing.
    """

    def __init__(self, replies=None, *, default=None):
        self.replies = list(replies or [])
        self.default = default
        self.calls: list[Call] = []

    @property
    def call_count(self) -> int:
        return len(self.calls)

    @property
    def was_called(self) -> bool:
        """Several rules are about *not* calling the provider: an empty library (D7), a failed
        extraction, a user over their cap (TUT-9). Those tests assert on this."""
        return bool(self.calls)

    @property
    def last_prompt(self) -> str:
        if not self.calls:
            raise AssertionError("the provider was never called")
        return self.calls[-1].prompt

    def as_reply_for(self):
        """This fake as a `reply_for(session, history)` callable, the shape tutor/provider.py has.

        The provider module (TUT-1, #25) is not written yet, so the tutor calls a plain function
        rather than an object. Rather than keep a second fake for that shape, this wraps the same
        one: the script and the recorded calls work exactly as they do for generate().

        The last student message becomes the prompt, and the conversation so far is kept on the
        call as options['history'], so a test can assert on what the tutor was given:

            provider = FakeAiProvider(default='ok')
            with mock.patch('tutor.api.provider.reply_for', provider.as_reply_for()):
                ...
            self.assertEqual(provider.calls[0].options['history'], [...])
        """

        def reply_for(session, history):
            prompt = history[-1]["content"] if history else ""
            return self.generate(prompt, session=session, history=history)

        return reply_for

    def generate(self, prompt: str, *, system_instruction: str = "", **options) -> str:
        self.calls.append(Call(prompt=prompt, system_instruction=system_instruction, options=options))

        if self.replies:
            reply = self.replies.pop(0)
        elif self.default is not None:
            reply = self.default
        else:
            raise AssertionError(
                f"the provider was called {len(self.calls)} time(s) but the script had "
                f"{len(self.calls) - 1}. Add a reply, or pass default= if the count does not matter."
            )

        if isinstance(reply, BaseException):
            raise reply
        return reply
