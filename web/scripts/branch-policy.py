#!/usr/bin/env python3
"""Shared branch policy. Individual contribution branches belong in forks."""
import re

PERMANENT = ("main", "developer", "web", "desktop", "mobile", "modules")
TEMPORARY = "lxp/release-next"
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
    if target != base:
        raise ValueError(f"Contribution belongs in {target}, not {base}")


def protection(branch):
    checks = {"main": ["release-checks"], "modules": ["static-review", "branch-scope"],
              "web": ["branch-scope", "client-checks"], "desktop": ["branch-scope", "client-checks"],
              "mobile": ["branch-scope", "client-checks"]}
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
                            "exclude": ["refs/heads/" + name for name in (*PERMANENT, TEMPORARY)]}},
            "rules": [{"type": "creation"}], "bypass_actors": []}
