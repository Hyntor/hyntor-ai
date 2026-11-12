# Tests

Run everything the way CI does:

    python manage.py test --verbosity 2

One app, one file, one test:

    python manage.py test accounts
    python manage.py test accounts.tests.test_passwords
    python manage.py test accounts.tests.test_passwords.ValidatePasswordTests.test_empty_password_is_refused

With coverage, including the floor that CI enforces:

    coverage run manage.py test
    coverage report --fail-under=85

## The rule we hold ourselves to

**No test is submitted that its owner cannot explain.** A test nobody understands is deleted before
the deadline rather than kept for the coverage number. Each member owns the tests for the code they
write, and has to be able to explain both in the oral defense.

## Where a test goes

Beside the code it tests, in that app's `tests/` package: `accounts/tests/test_login_view.py`,
`tutor/tests/test_handoff.py`. A file is named after the thing it tests, not after the ticket.

This directory holds only the shared harness and its own tests.

## The harness

    from tests import clients, factories
    from tests.fake_ai import FakeAiProvider

**`factories.py`** builds rows and fills in everything you did not ask about, so a test names only
the value it is actually about:

    course = factories.a_course()
    material = factories.a_material(course, chunks=3)       # indexed, three ordered chunks
    big = factories.a_material(byte_size=26_214_401)        # the 25 MB + 1 case, and nothing else

**`clients.py`** gives a signed-in `django.test.Client` per role, with the user on `client.user`:

    clients.signed_out()            clients.member(course)
    clients.learner()               clients.maintainer(course)
    clients.unverified_learner()    clients.outsider(course)
    clients.admin()

**`fake_ai.py`** is the provider stand-in. The real one is never called: it costs quota, needs a
secret, and fails for reasons that are not our code (N9).

    provider = FakeAiProvider(replies=["Try drawing the free-body diagram first."])
    ...
    self.assertEqual(provider.call_count, 1)
    self.assertIn("free-body", provider.last_prompt)

**`network.py`** fails any test that opens a connection to anything but loopback. It is installed by
`tests/runner.py` for the whole suite, so a missed patch fails loudly instead of quietly calling
Google. If a test hits it, fake the provider or patch the function that makes the request.

## How to write a boundary test

Find the comparison in the code and write the two cases either side of it, plus the smallest input.
A rule of "at least 10 characters" is a `<` or a `<=`, and only one of those is right:

    def test_a_password_one_below_the_minimum_is_refused(self): ...
    def test_password_at_the_minimum_length_is_accepted(self): ...
    def test_empty_password_is_refused(self): ...

The same shape works for sizes (25 MB, 25 MB + 1, 0 bytes), counts (cap - 1, cap, cap + 1) and time
(one second before expiry, one second after).

## How to write an adversarial test

Do not ask what the rule says. Ask what an attacker would send, and what the layer underneath does
differently from Python. That question is where the useful cases come from:

- **Someone else's data.** Another user's session, another university's course, a material from a
  course you are not in. Each must be refused, and must create nothing.
- **Input that is not text.** Null bytes, Unicode look-alikes, accented letters that normalize
  differently, 10,000 characters, HTML and SQL in a display name.
- **Input aimed at us.** A file or message carrying "ignore previous instructions". The guard is
  our code, never the prompt, so assert the output is still capped.
- **Fields nobody offered.** Post `platform_role=admin` to signup and check it is ignored.
- **Failure that must stay quiet.** A corrupt hash, a truncated PDF, a provider timeout: each
  returns a refusal, not a 500.

Assert that nothing was created, not only that the status code was right. A refusal that still
writes a row is a bug the status code will not show you.

## Writing tests with AI

Three passes, because the first one is never enough:

1. Ask for tests and you get the happy path. Correct, nearly worthless.
2. Ask for the **boundary**: "the rule is at least 10 characters - write the tests that distinguish
   `<` from `<=`, and include the smallest possible input."
3. Ask about the **implementation underneath**: "what could an attacker send to this function, and
   what does the C library do differently from Python?" That pass found a real bug - a corrupted
   hash raised `InvalidHashError`, which the original `except` missed, so a damaged row would have
   been a 500 on the login page.

Record your prompts in the AI usage log (#33, #49) as you go, not at the end.
