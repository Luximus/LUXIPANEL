"""Shared per-collection lock and two collector slots, including timer runs."""
import fcntl
import os
import re
import subprocess
import sys
import time

# Leave time to publish failure metadata before dispatcher's outer 120s limit.
BUDGET_SECONDS = 110

def run(module, collection, command):
    if not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", module) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", collection):
        return 2
    deadline = time.monotonic() + BUDGET_SECONDS
    directory = os.path.join(os.environ.get("LUXIPANEL_CONFIG_DIR", "/etc/luxipanel"), "cache-engine")
    os.makedirs(directory, mode=0o700, exist_ok=True)
    with open(os.path.join(directory, f".collect-{module}-{collection}.lock"), "a") as entry:
        while time.monotonic() < deadline:
            try:
                fcntl.flock(entry, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                time.sleep(.05)
        else:
            return 124
        while time.monotonic() < deadline:
            for index in range(2):
                slot = open(os.path.join(directory, f".collect-slot-{index}.lock"), "a")
                try:
                    fcntl.flock(slot, fcntl.LOCK_EX | fcntl.LOCK_NB)
                except BlockingIOError:
                    slot.close()
                    continue
                try:
                    try:
                        result = subprocess.run(command, timeout=max(.01, deadline-time.monotonic()), check=False).returncode
                    except (subprocess.TimeoutExpired, OSError):
                        result = 124
                    if result:
                        from live_view import mark_stale
                        mark_stale(module, collection)
                    return result
                finally:
                    slot.close()
            time.sleep(.05)
    return 124

if __name__ == "__main__":
    sys.exit(run(sys.argv[1], sys.argv[2], sys.argv[3:]))
