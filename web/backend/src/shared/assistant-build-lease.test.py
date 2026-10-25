import importlib.util
import multiprocessing
from pathlib import Path
import sys
import tempfile
import time
import unittest

RUNNER = Path(__file__).with_name("assistant-build-lease.py")
spec = importlib.util.spec_from_file_location("assistant_build_lease", RUNNER)
lease = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lease)


class BuildLeaseTests(unittest.TestCase):
    def test_second_build_waits_until_first_finishes(self):
        with tempfile.TemporaryDirectory() as tmp:
            lease.LOCK = Path(tmp) / "build.lock"
            first_started = Path(tmp) / "first"
            second_started = Path(tmp) / "second"
            first = multiprocessing.Process(target=lease.run, args=(
                f"{sys.executable} -c 'import pathlib,time; pathlib.Path(\"{first_started}\").touch(); time.sleep(1.5)'", 4))
            second = multiprocessing.Process(target=lease.run, args=(
                f"{sys.executable} -c 'import pathlib; pathlib.Path(\"{second_started}\").touch()'", 4))
            first.start()
            deadline = time.monotonic() + 3
            while not first_started.exists() and time.monotonic() < deadline:
                time.sleep(0.02)
            self.assertTrue(first_started.exists())
            second.start()
            time.sleep(0.3)
            self.assertFalse(second_started.exists())
            first.join(4)
            second.join(4)
            self.assertEqual(first.exitcode, 0)
            self.assertEqual(second.exitcode, 0)
            self.assertTrue(second_started.exists())


if __name__ == "__main__":
    unittest.main()
