"""Shared test harness (FND-4, #9).

Importable from any app's tests:

    from tests.factories import a_course, a_learner, a_university

The pieces live in separate modules so a test imports only what it uses:

    factories.py  rows to test against, with sensible defaults
    clients.py    a signed-in test client per role
    fake_ai.py    a scripted stand-in for the AI provider
    network.py    the guard that fails a test which reaches for the network

See tests/README.md for how to write a boundary or adversarial test.
"""
