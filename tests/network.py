"""The guard that fails a test which reaches for the network (FND-4, #9, N9).

A test that quietly calls the real Gemini API spends the team's quota, needs a key in CI, and goes
red when Google has a bad day. The provider is meant to be faked, and a missed patch is easy to
write and hard to notice - the test still passes, just slowly.

So outbound connections are blocked during the whole suite. Loopback stays open because the test
database is a real PostgreSQL server on localhost in CI.

The failure names the host, so a missed patch reads as "tests/fake_ai.py was not used here" rather
than as a timeout five minutes later.
"""

import socket

# Everything the tests legitimately talk to. Anything else is a bug in the test. Only loopback:
# 0.0.0.0 is deliberately absent, because nothing a test connects to should need it.
ALLOWED_HOSTS = {"localhost", "127.0.0.1", "::1"}

_real_connect = socket.socket.connect
_real_connect_ex = socket.socket.connect_ex


class NetworkUsedInTests(AssertionError):
    """A test tried to open a connection to the outside world."""


def _host_of(address) -> str:
    # AF_INET gives (host, port); AF_INET6 gives (host, port, flow, scope); AF_UNIX gives a path.
    if isinstance(address, tuple) and address:
        return str(address[0])
    return ""


def _check(address) -> None:
    host = _host_of(address)
    if host and host not in ALLOWED_HOSTS:
        raise NetworkUsedInTests(
            f"a test tried to connect to {host}. Tests must not use the network: fake the provider "
            f"with tests.fake_ai.FakeAiProvider, or patch the function that makes the request. "
            f"If this host is genuinely needed, add it to tests/network.py ALLOWED_HOSTS and say why."
        )


def install() -> None:
    """Block outbound connections for the rest of the process."""

    def guarded_connect(self, address):
        _check(address)
        return _real_connect(self, address)

    def guarded_connect_ex(self, address):
        _check(address)
        return _real_connect_ex(self, address)

    socket.socket.connect = guarded_connect
    socket.socket.connect_ex = guarded_connect_ex


def uninstall() -> None:
    """Put the real socket back. Only the runner needs this."""
    socket.socket.connect = _real_connect
    socket.socket.connect_ex = _real_connect_ex
