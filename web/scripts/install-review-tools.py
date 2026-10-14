#!/usr/bin/env python3
"""Pinned trusted analyzers for hosted CI, installed without repository credentials."""
import hashlib, io, os, subprocess, tarfile, urllib.request
from pathlib import Path
root = Path(os.environ["RUNNER_TEMP"]) / "lxp-tools"
root.mkdir(parents=True, exist_ok=True)
subprocess.run(["python3", "-m", "venv", str(root / "venv")], check=True)
subprocess.run([str(root / "venv/bin/pip"), "install", "semgrep==1.180.0"], check=True)
url = "https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz"
blob = urllib.request.urlopen(url, timeout=60).read()
if hashlib.sha256(blob).hexdigest() != "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb":
    raise RuntimeError("Gitleaks checksum mismatch")
with tarfile.open(fileobj=io.BytesIO(blob)) as archive:
    data = archive.extractfile("gitleaks").read()
(root / "gitleaks").write_bytes(data); (root / "gitleaks").chmod(0o755)
with open(os.environ["GITHUB_PATH"], "a") as out:
    out.write(str(root) + "\n" + str(root / "venv/bin") + "\n")
