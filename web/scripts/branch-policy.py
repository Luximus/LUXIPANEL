#!/usr/bin/env python3
"""Shared branch policy. Individual contribution branches belong in forks."""
import re

PERMANENT = ("main", "developer", "modules")
BOOTSTRAP = "lxp/release-next"
BASELINE = "automation/modules-baseline"
TEMPORARY = BOOTSTRAP  # Migration compatibility; retired after PR #4 is merged.

def candidate_version(branch):
    match = re.fullmatch(r"(?:release|hotfix)/(\d+\.\d+\.\d+)", branch)
    return match[1] if match else None
CLIENTS = ("web", "desktop", "mobile")


def target_for(files):
    if not files:
        raise ValueError("Empty contribution")
    modules = [name for name in files if name.startswith("web/modules/")]
    if modules:
        ids = {name.split("/")[2] for name in modules}
        if len(modules) != len(files) or len(ids) != 1 or not re.fullmatch(r"[a-z][a-z0-9-]{2,38}", next(iter(ids))):
            raise ValueError("Split module and core changes into separate contributions")
        return "modules"
    # Release tooling is shared even though its historical location is web/.
    areas = {name.split("/")[0] for name in files}
    if len(areas) == 1 and next(iter(areas)) in CLIENTS and not any(name.startswith("web/scripts/") for name in files):
        return next(iter(areas))
    return "developer"


def assert_scope(base, files):
    target = target_for(files)
    if base == "developer" and target != "modules":
        return
    if base == "modules" and target == "modules":
        return
    raise ValueError("Core/client contributions target developer; module contributions target modules")


def protection(branch):
    checks = {"main": ["release-checks"], "modules": ["static-review", "branch-scope"]}
    return {
        "required_status_checks": {"strict": True, "contexts": checks[branch]} if branch in checks else None,
        "enforce_admins": True,
        # Developer accepts trusted, tested promotions; integration CI runs afterwards.
        "required_pull_request_reviews": None if branch == "developer" else {
            "dismiss_stale_reviews": True, "require_code_owner_reviews": branch == "main",
            "required_approving_review_count": 1 if branch == "main" else 0},
        "restrictions": None, "allow_force_pushes": False, "allow_deletions": False,
    }


def creation_ruleset():
    return {"name": "Canonical branches only", "target": "branch", "enforcement": "active",
            "conditions": {"ref_name": {"include": ["~ALL"],
                            "exclude": ["refs/heads/" + name for name in (*PERMANENT, BOOTSTRAP, BASELINE)] + ["refs/heads/release/*", "refs/heads/hotfix/*"]}},
            "rules": [{"type": "creation"}], "bypass_actors": []}
