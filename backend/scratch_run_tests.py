"""
scratch_run_tests.py — Runs Django test suite and writes results to test_output.log
"""
import os
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")

import django
django.setup()

from django.test.runner import DiscoverRunner

with open("test_output.log", "w") as f:
    sys.stdout = f
    sys.stderr = f
    runner = DiscoverRunner(verbosity=2)
    failures = runner.run_tests(["service_requests.tests.test_work_extensions"])
    print(f"\nTest Failures Count: {failures}")
