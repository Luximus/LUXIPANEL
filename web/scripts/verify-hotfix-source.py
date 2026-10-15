#!/usr/bin/env python3
"""Trusted main pre-check, before checking out any hotfix candidate code."""
import os
import re
from pathlib import Path
from importlib.util import spec_from_file_location, module_from_spec
spec = spec_from_file_location("prepare", Path(__file__).with_name("prepare-release.py"))
prepare = module_from_spec(spec); spec.loader.exec_module(prepare)
branch, sha = os.environ["HOTFIX_BRANCH"], os.environ["HOTFIX_SHA"]
if not re.fullmatch(r"hotfix/\d+\.\d+\.\d+", branch) or not re.fullmatch(r"[a-f0-9]{40}", sha): raise ValueError("Invalid hotfix source")
if prepare.api("/git/ref/heads/" + branch)["object"]["sha"] != sha: raise ValueError("Hotfix source changed before checks")
