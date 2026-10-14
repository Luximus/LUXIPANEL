"""Tests for the 2026-07-21 write-behind trust-boundary hardening (worker.py):

  A1  — HMAC fail-closed: _verify_job_hmac rejects unsigned/missigned jobs when
        required, and no longer flips LPWQ_REQUIRE_HMAC to False on a missing key.
  A1' — root-writeFile stages under TMP_DIR (0700) via O_CREAT|O_EXCL|O_NOFOLLOW
        with mode 0600 (no world-readable window, no symlink race).
  A2' — the mode allowlist no longer accepts world-writable 0o666/0o777.

Pure-Python (no Redis, no real sudo). We stub run_priv so the root path never
shells out; we only assert the staging fd flags and cleanup.
"""
from __future__ import annotations

import hashlib
import hmac as _hmac
import json
import os
import stat
import sys
import tempfile
import unittest
from unittest.mock import MagicMock, patch

_HERE = os.path.dirname(os.path.abspath(__file__))
_ENGINES_DIR = os.path.dirname(_HERE)
sys.path.insert(0, _ENGINES_DIR)

import common  # noqa: E402
import worker  # noqa: E402


# --------------------------------------------------------------------------
# A2' — mode allowlist prunes world-writable modes
# --------------------------------------------------------------------------
class ModeAllowlistTests(unittest.TestCase):
    def test_world_writable_pruned(self):
        self.assertNotIn(0o666, worker.ALLOWED_MODES)
        self.assertNotIn(0o777, worker.ALLOWED_MODES)

    def test_common_modes_still_allowed(self):
        for m in (0o600, 0o640, 0o644, 0o750, 0o755):
            self.assertIn(m, worker.ALLOWED_MODES)

    def test_setuid_setgid_sticky_never_allowed(self):
        for m in (0o4755, 0o2755, 0o1777):
            self.assertNotIn(m, worker.ALLOWED_MODES)

    def test_apply_write_file_rejects_666_step(self):
        # A writeFile step asking for 0o666 must be refused before any disk I/O.
        step = {"type": "writeFile", "path": "/var/lib/luxipanel/x",
                "b64gz": common.b64gz("data"), "mode": "0666", "root": False}
        ok, err = worker._apply_write_file(step, None)
        self.assertFalse(ok)
        self.assertIn("mode", err)


# --------------------------------------------------------------------------
# A1' — atomic, race-free root staging
# --------------------------------------------------------------------------
class RootStagingTests(unittest.TestCase):
    def test_uses_o_excl_o_nofollow_and_tmp_dir(self):
        seen = {}
        real_open = os.open

        def spy_open(path, flags, mode=0o777):
            # Only intercept the staging open (under TMP_DIR).
            if isinstance(path, str) and path.startswith(worker.TMP_DIR):
                seen["path"] = path
                seen["flags"] = flags
                seen["mode"] = mode
            return real_open(path, flags, mode)

        with tempfile.TemporaryDirectory() as tmpdir:
            # Point TMP_DIR at a scratch dir so we don't need /etc/luxipanel.
            with patch.object(worker, "TMP_DIR", os.path.join(tmpdir, "cache-engine", "tmp")), \
                 patch.object(worker, "run_priv",
                              return_value=MagicMock(returncode=0, stdout="", stderr="")), \
                 patch("os.open", side_effect=spy_open):
                step = {"type": "writeFile", "path": "/etc/luxipanel/thing",
                        "b64gz": common.b64gz("secret-hash"),
                        "mode": "0640", "root": True}
                ok, err = worker._apply_write_file(step, "passphrase")

        self.assertTrue(ok, msg=f"apply failed: {err}")
        self.assertIn("flags", seen, "staging os.open was never called under TMP_DIR")
        self.assertTrue(seen["flags"] & os.O_EXCL, "O_EXCL missing")
        self.assertTrue(seen["flags"] & os.O_NOFOLLOW, "O_NOFOLLOW missing")
        self.assertTrue(seen["flags"] & os.O_CREAT, "O_CREAT missing")
        self.assertEqual(seen["mode"], 0o600, "staging mode must be 0600")

    def test_staging_dir_is_0700_and_cleaned_up(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tdir = os.path.join(tmpdir, "cache-engine", "tmp")
            with patch.object(worker, "TMP_DIR", tdir), \
                 patch.object(worker, "run_priv",
                              return_value=MagicMock(returncode=0, stdout="", stderr="")):
                step = {"type": "writeFile", "path": "/etc/luxipanel/thing",
                        "b64gz": common.b64gz("data"), "mode": "0600", "root": True}
                ok, _ = worker._apply_write_file(step, "pw")
            self.assertTrue(ok)
            self.assertEqual(stat.S_IMODE(os.stat(tdir).st_mode), 0o700)
            # tmp file was unlinked in the finally block.
            self.assertEqual(os.listdir(tdir), [])


# --------------------------------------------------------------------------
# A1 — HMAC fail-closed
# --------------------------------------------------------------------------
class HmacFailClosedTests(unittest.TestCase):
    def setUp(self):
        # Reset the module cache between cases.
        worker._HMAC_KEY = None

    def tearDown(self):
        worker._HMAC_KEY = None

    def _write_key(self, tmpdir, data=b"deadbeef", mode=0o640):
        path = os.path.join(tmpdir, "lpwq.hmac.key")
        with open(path, "wb") as fh:
            fh.write(data)
        os.chmod(path, mode)
        return path

    def test_required_but_missing_key_rejects(self):
        with patch.object(worker, "_HMAC_REQUIRED", True), \
             patch.object(worker, "HMAC_KEY_PATH", "/nonexistent/lpwq.hmac.key"):
            worker._HMAC_KEY = None
            self.assertFalse(worker._verify_job_hmac({"steps": []}))

    def test_no_auto_flip_to_false(self):
        # The legacy fail-open flipped _HMAC_REQUIRED to False on a missing key.
        # That must NOT happen anymore.
        with patch.object(worker, "_HMAC_REQUIRED", True), \
             patch.object(worker, "HMAC_KEY_PATH", "/nonexistent/lpwq.hmac.key"):
            worker._HMAC_KEY = None
            worker._verify_job_hmac({"steps": []})
            self.assertTrue(worker._HMAC_REQUIRED, "worker silently disabled HMAC")

    def test_valid_signature_accepted(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            key = b"c0ffee"
            path = self._write_key(tmpdir, data=key, mode=0o640)
            payload = {"jobId": "j1", "module": "mail", "steps": [{"type": "sh"}]}
            body = json.dumps(payload, separators=(",", ":"),
                              sort_keys=True, ensure_ascii=False).encode("utf-8")
            sig = _hmac.new(key, body, hashlib.sha256).hexdigest()
            signed = dict(payload, hmac=sig)
            with patch.object(worker, "_HMAC_REQUIRED", True), \
                 patch.object(worker, "HMAC_KEY_PATH", path):
                worker._HMAC_KEY = None
                self.assertTrue(worker._verify_job_hmac(signed))
                # A tampered payload (extra step) must fail.
                tampered = dict(signed)
                tampered["steps"] = [{"type": "sh"}, {"type": "sh"}]
                self.assertFalse(worker._verify_job_hmac(tampered))

    def test_key_with_bad_mode_rejected(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = self._write_key(tmpdir, mode=0o666)  # world-writable
            with patch.object(worker, "HMAC_KEY_PATH", path):
                worker._HMAC_KEY = None
                self.assertIsNone(worker._load_hmac_key())

    def test_disabled_accepts_anything(self):
        with patch.object(worker, "_HMAC_REQUIRED", False):
            self.assertTrue(worker._verify_job_hmac({"no": "sig"}))

    def test_lone_surrogate_rejected_not_crashed(self):
        # A lone surrogate in user data makes json.dumps(...).encode("utf-8")
        # raise UnicodeEncodeError. The worker must reject (return False), not
        # crash — otherwise legit user data (a truncated emoji) is a queue DoS.
        with tempfile.TemporaryDirectory() as tmpdir:
            path = self._write_key(tmpdir, data=b"c0ffee", mode=0o600)
            payload = {"jobId": "j1", "name": "a\ud83db", "hmac": "deadbeef"}
            with patch.object(worker, "_HMAC_REQUIRED", True), \
                 patch.object(worker, "HMAC_KEY_PATH", path):
                worker._HMAC_KEY = None
                self.assertFalse(worker._verify_job_hmac(payload))


if __name__ == "__main__":
    unittest.main()
