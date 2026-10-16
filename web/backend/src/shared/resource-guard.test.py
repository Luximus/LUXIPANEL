import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

RUNNER = Path(__file__).with_name("resource-guard.py")
spec = importlib.util.spec_from_file_location("resource_guard", RUNNER)
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)


class PolicyTests(unittest.TestCase):
    def test_limits_scale_down_and_leave_half_the_ram_outside_the_group(self):
        for mib in (512, 1024, 2048, 8192, 65536):
            p = guard.limits(mib * guard.MIB, 4, "cli")
            self.assertLessEqual(p["groupMax"], mib * guard.MIB // 2)
            self.assertLessEqual(p["max"], p["groupMax"])
            self.assertLessEqual(p["max"], 3584 * guard.MIB)
            self.assertLess(p["high"], p["max"])
            self.assertLessEqual(p["swap"], 512 * guard.MIB)
            self.assertLessEqual(p["cpu"], 200)

    def test_browser_and_internal_override_cannot_raise_the_cap(self):
        p = guard.limits(8192 * guard.MIB, 64, "browser", 8192)
        self.assertEqual(p["max"], 768 * guard.MIB)
        self.assertEqual(guard.limits(8192 * guard.MIB, 2, "cli", 64)["max"], 64 * guard.MIB)

    def test_pressure_and_saturated_group_delay_admission(self):
        p = guard.limits(8192 * guard.MIB, 4, "cli")
        self.assertFalse(guard.admitted({"MemAvailable": 128 * guard.MIB}, p, 0))
        self.assertFalse(guard.admitted({"MemAvailable": 8192 * guard.MIB}, p, p["groupMax"]))
        self.assertTrue(guard.admitted({"MemAvailable": 4096 * guard.MIB}, p, 0))

    def test_unavailable_manager_never_launches_the_requested_command(self):
        output = io.StringIO()
        with patch.object(guard.Path, "exists", return_value=False), patch.object(guard.subprocess, "Popen") as launch, contextlib.redirect_stdout(output):
            self.assertEqual(guard.main({"kind": "cli"}, ["touch", "/should-not-exist"]), 78)
        launch.assert_not_called()
        self.assertEqual(json.loads(output.getvalue())["code"], "RESOURCE_GUARD_UNAVAILABLE")

    def test_invalid_kernel_limits_refuse_to_execute(self):
        # This test process is deliberately outside a workload scope.
        r = subprocess.run([sys.executable, "-c", guard.VERIFY, "{}", "nonexistent.scope", sys.executable, "-c", "print('MUST_NOT_RUN')"], capture_output=True, text=True)
        self.assertEqual(r.returncode, 78)
        self.assertNotIn("MUST_NOT_RUN", r.stdout)


@unittest.skipUnless(os.environ.get("LXP_RESOURCE_INTEGRATION") == "1", "requires a systemd user manager")
class ScopeTests(unittest.TestCase):
    def run_guard(self, command, **options):
        return subprocess.run([sys.executable, str(RUNNER), json.dumps({"kind": "cli", "queueSeconds": 0, **options}), *command], capture_output=True, text=True, timeout=90)

    def test_real_scope_preserves_cwd_environment_and_uid(self):
        code = "import os,json,pathlib; print(json.dumps([os.getuid(),os.getcwd(),os.environ['LXP_GUARD_TEST'],pathlib.Path('/proc/self/cgroup').read_text()]))"
        with patch.dict(os.environ, {"LXP_GUARD_TEST": "á '$()"}):
            r = self.run_guard([sys.executable, "-c", code])
        self.assertEqual(r.returncode, 0, r.stderr + r.stdout)
        uid, cwd, value, cgroup = json.loads(r.stdout)
        self.assertEqual((uid, cwd, value), (os.getuid(), os.getcwd(), "á '$()"))
        self.assertIn("/luxipanel-assistant.slice/luxipanel-task-", cgroup)

    def test_deadline_stops_all_descendants(self):
        with tempfile.TemporaryDirectory() as tmp:
            pidfile = str(Path(tmp) / "child")
            code = "import subprocess,time,pathlib,sys; p=subprocess.Popen(['sleep','60']); pathlib.Path(sys.argv[1]).write_text(str(p.pid)); time.sleep(60)"
            r = self.run_guard([sys.executable, "-c", code, pidfile], runtimeSeconds=1)
            self.assertEqual(r.returncode, 124, r.stdout + r.stderr)
            self.assertIn("RESOURCE_GUARD_INTERRUPTED", r.stdout)
            pid = Path(pidfile).read_text()
            status = Path('/proc') / pid / 'stat'
            self.assertTrue(not status.exists() or status.read_text().split()[2] == 'Z')

    def test_completed_command_cleans_up_background_children(self):
        r = self.run_guard([sys.executable, "-c", "import subprocess; print(subprocess.Popen(['sleep','60'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).pid,flush=True)"])
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        status = Path('/proc') / r.stdout.strip() / 'stat'
        self.assertTrue(not status.exists() or status.read_text().split()[2] == 'Z')

    def test_browser_lock_prevents_overlapping_commands(self):
        with tempfile.TemporaryDirectory() as tmp:
            marker = Path(tmp) / "ready"
            code = "import pathlib,sys,time; pathlib.Path(sys.argv[1]).touch(); time.sleep(3)"
            first = subprocess.Popen([sys.executable, str(RUNNER), '{"kind":"browser","queueSeconds":0}', sys.executable, "-c", code, str(marker)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            try:
                deadline = time.monotonic() + 10
                while not marker.exists() and time.monotonic() < deadline:
                    time.sleep(0.05)
                self.assertTrue(marker.exists())
                r = self.run_guard([sys.executable, "-c", "print('MUST_NOT_RUN')"], kind="browser")
                self.assertEqual(r.returncode, 75, r.stdout + r.stderr)
                self.assertNotIn("MUST_NOT_RUN", r.stdout)
                self.assertIn("RESOURCE_GUARD_BUSY", r.stdout)
            finally:
                first.communicate(timeout=15)
            self.assertEqual(first.returncode, 0)

    def test_oom_is_contained_and_observed_not_guessed(self):
        # At most 16 MiB RAM + 4 MiB swap, never host-wide memory pressure.
        # Raise only this test scope's soft throttle to its unchanged hard cap
        # so the kernel reaches OOM promptly instead of reclaiming for minutes.
        code = "import pathlib,subprocess; unit=pathlib.Path('/proc/self/cgroup').read_text().strip().split('/')[-1]; subprocess.run(['systemctl','--user','set-property','--runtime',unit,'MemoryHigh=16M'],check=True); a=bytearray(64*1024*1024); a[::4096]=b'x'*(len(a)//4096)"
        r = self.run_guard([sys.executable, "-c", code], memoryMaxMiB=16, runtimeSeconds=15)
        self.assertEqual(r.returncode, 137, r.stdout + r.stderr)
        self.assertIn("RESOURCE_GUARD_MEMORY", r.stdout)
        healthy = self.run_guard([sys.executable, "-c", "print('still-alive')"])
        self.assertEqual(healthy.returncode, 0, healthy.stdout + healthy.stderr)
        self.assertIn("still-alive", healthy.stdout)


if __name__ == "__main__":
    unittest.main()
