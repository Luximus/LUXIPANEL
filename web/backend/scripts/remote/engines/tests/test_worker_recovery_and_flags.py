"""Tests for worker.py:

1. _sudo_argv_allowed — per-binary flag allowlist (§3.5).
2. First delivery and orphan recovery: no replay of an already attempted write.
3. Exception handling and acknowledgments: a bad recipe is failed and cleaned
   up, and the worker continues draining its queue.

These tests are pure-Python: no Redis, no real subprocess. They import worker
directly and stub the redis arg with a MagicMock where needed.
"""
from __future__ import annotations

import os
import sys
import unittest
from unittest.mock import MagicMock, patch

# Make `worker` and `common` importable.
_HERE = os.path.dirname(os.path.abspath(__file__))
_ENGINES_DIR = os.path.dirname(_HERE)
sys.path.insert(0, _ENGINES_DIR)

import common  # noqa: E402  (sys.path tweak above)
import worker  # noqa: E402  (sys.path tweak above)


# --------------------------------------------------------------------------
# 1. _sudo_argv_allowed — per-binary flag allowlist
# --------------------------------------------------------------------------
class SudoArgvAllowedTests(unittest.TestCase):
    """Each case from the spec, plus a few adversarial ones to lock the
    `--`-sentinel + `--long-option=value` rejection behaviour."""

    # ----- allowed -----
    def test_nginx_t_allowed(self):
        self.assertTrue(worker._sudo_argv_allowed(["nginx", "-t"]))

    def test_useradd_m_d_allowed(self):
        argv = ["useradd", "-m", "-d", "/home/foo", "-s", "/bin/bash", "foo"]
        self.assertTrue(worker._sudo_argv_allowed(argv))

    def test_gpasswd_a_allowed(self):
        self.assertTrue(worker._sudo_argv_allowed(["gpasswd", "-a", "foo", "sudo"]))

    def test_usermod_a_G_sudo_allowed(self):
        argv = ["usermod", "-a", "-G", "sudo", "foo"]
        self.assertTrue(worker._sudo_argv_allowed(argv))

    def test_chown_R_root_root_allowed(self):
        argv = ["chown", "-R", "root:root", "/etc/foo"]
        self.assertTrue(worker._sudo_argv_allowed(argv))

    def test_cp_a_src_dst_allowed(self):
        self.assertTrue(worker._sudo_argv_allowed(["cp", "-a", "src", "dst"]))

    def test_systemctl_with_dashdash_allowed(self):
        # `--` IS listed for systemctl so it can be used to terminate options.
        argv = ["systemctl", "--", "start", "nginx"]
        self.assertTrue(worker._sudo_argv_allowed(argv))

    def test_chpasswd_no_flags_allowed(self):
        # chpasswd reads stdin; empty allowlist is still "binary ok".
        self.assertTrue(worker._sudo_argv_allowed(["chpasswd"]))

    # ----- rejected -----
    def test_nginx_garbage_rejected(self):
        self.assertFalse(worker._sudo_argv_allowed(["nginx", "--garbage"]))

    def test_useradd_evil_rejected(self):
        self.assertFalse(worker._sudo_argv_allowed(["useradd", "--evil"]))

    def test_sudo_bash_rejected(self):
        self.assertFalse(worker._sudo_argv_allowed(["bash", "-c", "rm -rf /"]))

    def test_unknown_binary_rejected(self):
        # `tee` / `awk` / `sed` are intentionally NOT in the sudo allowlist.
        self.assertFalse(worker._sudo_argv_allowed(["tee", "/etc/sudoers"]))
        self.assertFalse(worker._sudo_argv_allowed(["awk", "{system(\"sh\")}"]))
        self.assertFalse(worker._sudo_argv_allowed(["sed", "-i", "x", "/etc/shadow"]))

    def test_cp_long_option_equals_rejected(self):
        # --reference=RW style must NOT be silently accepted: cp is in the
        # allowlist but `--reference` isn't a listed flag.
        self.assertFalse(
            worker._sudo_argv_allowed(["cp", "--reference=RW", "src", "dst"])
        )

    def test_dashdash_rejected_for_most_binaries(self):
        # `--` is a security sentinel: only allowed where the binary lists it.
        self.assertFalse(worker._sudo_argv_allowed(["cp", "--", "src", "dst"]))
        self.assertFalse(worker._sudo_argv_allowed(["nginx", "--"]))

    def test_short_flag_not_listed_rejected(self):
        # `-Z` is not a known nginx flag.
        self.assertFalse(worker._sudo_argv_allowed(["nginx", "-Z"]))

    def test_empty_argv_rejected(self):
        self.assertFalse(worker._sudo_argv_allowed([]))

    def test_non_string_arg_rejected(self):
        self.assertFalse(worker._sudo_argv_allowed(["useradd", "-u", 1000, "foo"]))


# --------------------------------------------------------------------------
# 2. MAX_ATTEMPTS guard + recovery semantics (§1.2)
# --------------------------------------------------------------------------
class MaxAttemptsTests(unittest.TestCase):
    def _process(self, previous_attempts):
        redis=MagicMock()
        job={"module":"users","collection":"system","op":"fixture","steps":[{"type":"fixture"}]}
        applier=MagicMock(return_value=(True,None))
        with patch.object(common,"load_obj_b64",return_value=job), \
             patch.object(worker,"_verify_job_hmac",return_value=True), \
             patch.object(worker,"read_status",return_value={"attempts":previous_attempts}), \
             patch.dict(worker.STEP_APPLIERS,{"fixture":applier}), \
             patch.object(worker,"trigger_refresh",return_value=True), \
             patch.object(worker,"finish") as finish, \
             patch.object(common,"emit_notification"):
            worker.process_job(redis,"fixture-job")
        return applier,finish

    def test_first_delivery_applies_and_confirms_the_view(self):
        applier,finish=self._process(0)
        self.assertEqual(applier.call_count,1)
        self.assertEqual(finish.call_args.args[2],"done")
        self.assertTrue(finish.call_args.kwargs["applied"])
        self.assertTrue(finish.call_args.kwargs["viewReady"])

    def test_recovered_attempt_cannot_repeat_an_applied_step(self):
        applier,finish=self._process(1)
        applier.assert_not_called()
        self.assertEqual(finish.call_args.args[2],"failed")


class AckBeforeFinishTests(unittest.TestCase):
    """Drain a finite queue with the production boot guard satisfied. A bad
    recipe is failed and acknowledged so the next job can still be processed."""
    def _drain(self, job_id, error=None):
        redis=MagicMock()
        redis.ping.return_value=True
        redis.lrange.return_value=[]
        redis.brpoplpush.side_effect=[job_id,None]
        with patch.object(common,"load_conn",return_value=("localhost",6379,"")), \
             patch.object(common,"Redis",return_value=redis), \
             patch.object(worker,"_load_hmac_key",return_value=b"fixture-key"), \
             patch.object(worker,"_STOP",False), \
             patch.object(worker.signal,"signal"), \
             patch.object(worker,"process_job",side_effect=error), \
             patch.object(worker,"write_health"), \
             patch.object(worker,"finish") as finish, \
             patch.object(common,"emit_notification"):
            self.assertEqual(worker.main(["--drain"]),0)
        redis.lrem.assert_called_once_with(common.WQ_PROCESSING,1,job_id)
        redis.delete.assert_called_once_with(common.wq_job_key(job_id))
        self.assertEqual(redis.brpoplpush.call_count,2)
        return finish

    def test_process_job_raises_still_acks(self):
        finish=self._drain("job-xyz",RuntimeError("poison step"))
        self.assertEqual(finish.call_args.args[2],"failed")
        self.assertIn("poison step",finish.call_args.kwargs["error"])

    def test_process_job_succeeds_acks(self):
        self._drain("job-ok").assert_not_called()


if __name__ == "__main__":
    unittest.main()