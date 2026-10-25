# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 LUXISOFT
"""Run one assistant build/deploy command at a time on the executing server."""
import fcntl
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

LOCK = Path("/run/lock/luxipanel-assistant-build.lock")


def run(command, wait_seconds=60):
    fd = None
    try:
        try:
            fd = os.open(LOCK, os.O_CREAT | os.O_EXCL | os.O_RDONLY | os.O_NOFOLLOW, 0o644)
            os.fchmod(fd, 0o644)
        except FileExistsError:
            fd = os.open(LOCK, os.O_RDONLY | os.O_NOFOLLOW)
        deadline = time.monotonic() + wait_seconds
        while True:
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() >= deadline:
                    print("Otro build o despliegue está en curso; esta operación no se inició.", file=sys.stderr)
                    return 75
                time.sleep(0.2)
        # The child keeps the lock if the supervisor loses its connection.
        child = subprocess.Popen(["/bin/bash", "-c", command], start_new_session=True, pass_fds=(fd,))

        def stop(_sig, _frame):
            if child.poll() is None:
                os.killpg(child.pid, signal.SIGTERM)

        signal.signal(signal.SIGTERM, stop)
        signal.signal(signal.SIGINT, stop)
        return child.wait()
    except (OSError, ValueError):
        print("No se pudo reservar el turno de build o despliegue; la operación no se inició.", file=sys.stderr)
        return 78
    finally:
        if fd is not None:
            os.close(fd)


if __name__ == "__main__":
    sys.exit(run(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 60))
