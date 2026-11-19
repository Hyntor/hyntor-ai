"""Tests for the retry around the Gemini call.

    python manage.py test tutor.tests.test_gemini_retry

A transient provider failure has to be retried and our own mistakes must not be, so the HTTP status
is what decides. The point of each test is the call count as much as the return value: a retry that
works but sends four requests instead of three is still wrong, and so is a 400 that gets sent twice.

Sleeping is passed in rather than patched, so these tests take no real time.
"""

from django.test import SimpleTestCase

from tutor_chat import gemini
from tutor_chat.gemini import BACKOFF_SECONDS, MAX_ATTEMPTS, RETRYABLE_STATUS


class ProviderError(Exception):
    """Stands in for a google-genai error, which carries the HTTP status on `code`."""

    def __init__(self, code):
        super().__init__(f"HTTP {code}")
        self.code = code


class Caller:
    """A call with a script. An exception in the script is raised, anything else is returned."""

    def __init__(self, *results):
        self.results = list(results)
        self.calls = 0

    def __call__(self):
        self.calls += 1
        result = self.results.pop(0)
        if isinstance(result, Exception):
            raise result
        return result


class RetryTests(SimpleTestCase):
    def setUp(self):
        self.slept = []

    def run_with(self, caller):
        return gemini.generate(caller, sleep=self.slept.append)

    def test_a_working_call_is_made_once_and_does_not_sleep(self):
        caller = Caller("an answer")

        self.assertEqual(self.run_with(caller), "an answer")
        self.assertEqual((caller.calls, self.slept), (1, []))

    def test_a_503_is_retried_and_the_second_attempt_is_returned(self):
        caller = Caller(ProviderError(503), "an answer")

        self.assertEqual(self.run_with(caller), "an answer")
        self.assertEqual((caller.calls, self.slept), (2, [BACKOFF_SECONDS[0]]))

    def test_it_gives_up_after_the_last_attempt(self):
        caller = Caller(*[ProviderError(503)] * MAX_ATTEMPTS)

        with self.assertRaises(ProviderError):
            self.run_with(caller)

        self.assertEqual(caller.calls, MAX_ATTEMPTS)
        self.assertEqual(self.slept, list(BACKOFF_SECONDS))

    def test_the_last_failure_is_the_one_raised(self):
        caller = Caller(ProviderError(503), ProviderError(500), ProviderError(502))

        with self.assertRaises(ProviderError) as caught:
            self.run_with(caller)

        self.assertEqual(caught.exception.code, 502)

    def test_every_retryable_status_is_retried(self):
        for code in sorted(RETRYABLE_STATUS):
            with self.subTest(code=code):
                caller = Caller(ProviderError(code), "an answer")

                self.assertEqual(self.run_with(caller), "an answer")
                self.assertEqual(caller.calls, 2)

    def test_our_own_mistakes_are_raised_at_once(self):
        """A bad key or an unknown model fails identically however often it is sent."""
        for code in (400, 401, 403, 404):
            with self.subTest(code=code):
                self.slept = []
                caller = Caller(ProviderError(code), "never reached")

                with self.assertRaises(ProviderError):
                    self.run_with(caller)

                self.assertEqual((caller.calls, self.slept), (1, []))

    def test_an_error_with_no_status_is_not_retried(self):
        """A bug in our own code is not a provider outage, and must not be sent three times."""
        caller = Caller(TypeError("bug"), "never reached")

        with self.assertRaises(TypeError):
            self.run_with(caller)

        self.assertEqual((caller.calls, self.slept), (1, []))

    def test_a_retryable_status_is_not_confused_with_a_similar_number(self):
        for code in (42, 4290, 5030, 200):
            with self.subTest(code=code):
                self.assertFalse(gemini.is_retryable(ProviderError(code)))

    def test_there_is_one_fewer_wait_than_there_are_attempts(self):
        """Otherwise the last failure would be followed by a pointless wait before giving up."""
        self.assertEqual(len(BACKOFF_SECONDS), MAX_ATTEMPTS - 1)

    def test_the_waits_get_longer(self):
        self.assertEqual(list(BACKOFF_SECONDS), sorted(BACKOFF_SECONDS))
