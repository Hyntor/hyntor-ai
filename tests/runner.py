"""The test runner, so the network guard covers every test (FND-4, #9).

Set as TEST_RUNNER in hyntor/settings.py. A mixin or a base class would only guard the tests that
remembered to use it, which is the same gap the guard exists to close.
"""

from django.test.runner import DiscoverRunner

from tests import network


class HyntorTestRunner(DiscoverRunner):
    """Django's runner, plus the no-network rule."""

    def setup_test_environment(self, **kwargs):
        super().setup_test_environment(**kwargs)
        network.install()

    def teardown_test_environment(self, **kwargs):
        network.uninstall()
        super().teardown_test_environment(**kwargs)
