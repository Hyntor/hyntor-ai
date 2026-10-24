"""Tests that the Streamlit tutor refuses anyone without a valid hand-off token.

    python manage.py test tutor.tests.test_tutor_app_gate

This is the security boundary of the whole second service: the tutor has no password of its own and
no other access control, so if this gate is wrong, the team's AI quota is open to the internet.

Streamlit's own harness (AppTest) runs the script headlessly, exactly as the server would when a
browser connects, and lets us read what it rendered. No browser and no network are involved.
"""

import os
import tempfile
import time
import unittest
from pathlib import Path

from django.test import SimpleTestCase

from tutor_chat.handoff import make_token

try:
    from streamlit.testing.v1 import AppTest
except ImportError:  # pragma: no cover - streamlit is a dev/tutor dependency, not a site one
    AppTest = None

APP = str(Path(__file__).resolve().parents[2] / "tutor_chat" / "AI_Chatbot.py")
SECRET = "a-test-handoff-secret"


def valid_token(user_id=7, **kwargs):
    return make_token(SECRET, user_id=user_id, email="learner1@example.edu", display_name="Lee", **kwargs)


@unittest.skipIf(AppTest is None, "streamlit is not installed")
class TutorGateTests(SimpleTestCase):
    def setUp(self):
        # The script writes its memory store on import, so point it at a throwaway file.
        self._memory_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self._memory_dir.cleanup)

        self._saved_env = {
            k: os.environ.get(k) for k in ("HANDOFF_SECRET", "MEMORY_DB_PATH", "GEMINI_API_KEY")
        }
        os.environ["HANDOFF_SECRET"] = SECRET
        os.environ["MEMORY_DB_PATH"] = str(Path(self._memory_dir.name) / "memories.db")
        os.environ["GEMINI_API_KEY"] = "test-key-not-used-offline"
        self.addCleanup(self._restore_env)

    def _restore_env(self):
        for key, value in self._saved_env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value

    def run_app(self, query_params=None):
        app = AppTest.from_file(APP, default_timeout=30)
        app.query_params.update(query_params or {})
        return app.run()

    def assert_refused(self, app):
        """The gate stopped the page: an error is shown and the chat input never rendered."""
        self.assertTrue(app.error, "expected the page to refuse entry")
        self.assertEqual(len(app.chat_input), 0, "the chat was rendered to someone without a token")

    def test_no_token_is_refused(self):
        """Someone who finds the tutor's address and opens it directly."""
        self.assert_refused(self.run_app())

    def test_a_forged_token_is_refused(self):
        forged = make_token("a-different-secret", user_id=1, email="a@b.edu", display_name="A")

        self.assert_refused(self.run_app({"t": forged}))

    def test_an_expired_token_is_refused(self):
        self.assert_refused(self.run_app({"t": valid_token(now=time.time() - 120, ttl_seconds=60)}))

    def test_rubbish_in_the_query_string_is_refused(self):
        self.assert_refused(self.run_app({"t": "../../etc/passwd"}))

    def test_a_valid_token_gets_in(self):
        """The other side of the boundary: a real hand-off must actually work."""
        app = self.run_app({"t": valid_token()})

        self.assertFalse(app.exception, f"the app raised: {app.exception}")
        self.assertEqual(len(app.error), 0, "a valid token was refused")
        self.assertEqual(len(app.chat_input), 1, "the chat input did not render")
        self.assertTrue(any("Lee" in c.value for c in app.caption))

    def test_a_missing_secret_locks_everyone_out(self):
        """Fail closed. A misconfigured service must refuse entry, not wave people through."""
        os.environ["HANDOFF_SECRET"] = ""

        self.assert_refused(self.run_app({"t": valid_token()}))
