#!/usr/bin/env python3
"""Trusted main orchestration. Candidate programs run only in read-only CI."""
import io
import json
import os
import subprocess
import tempfile
import zipfile
from pathlib import Path
from importlib.util import spec_from_file_location, module_from_spec

def load(name, filename):
    spec = spec_from_file_location(name, Path(__file__).with_name(filename))
    module = module_from_spec(spec); spec.loader.exec_module(module); return module

relay = load("relay", "module-review-relay.py")
prepare = relay.prepare
policy = load("policy", "branch-policy.py")
REPO, TEMP = prepare.REPOSITORY, policy.TEMPORARY


def git(*args, cwd=None):
    return subprocess.check_output(["git", "-c", "core.hooksPath=/dev/null", *args], cwd=cwd, text=True).strip()


def ancestor(old, new, cwd=None):
    return subprocess.run(["git", "merge-base", "--is-ancestor", old, new], cwd=cwd).returncode == 0


def ref(branch):
    if branch not in (*policy.PERMANENT, TEMP): raise ValueError("Unsupported canonical branch")
    return prepare.api("/git/ref/heads/" + branch)["object"]["sha"]


def dispatch(workflow, branch):
    prepare.api("/actions/workflows/" + workflow + "/dispatches", "POST", {"ref": branch})


def commit(cwd, subject):
    git("add", "--all", cwd=cwd)
    if not git("diff", "--cached", "--name-only", cwd=cwd): return False
    git("-c", "user.name=LUXIPANEL integration", "-c", "user.email=integration@users.noreply.github.com",
        "commit", "-m", subject, cwd=cwd)
    return True


def push_developer(cwd, old):
    if ref("developer") != old: raise ValueError("Developer changed; rerun integration")
    git("push", "origin", "HEAD:refs/heads/developer", cwd=cwd)
    dispatch("developer-checks.yml", "developer")


def pull(base, head, title, body, label):
    prs = prepare.api(f"/pulls?state=open&base={base}&head=Luxisoft:{head}")
    data = {"title": title, "body": body}
    result = prepare.api("/pulls/" + str(prs[0]["number"]), "PATCH", data) if prs else prepare.api("/pulls", "POST", {**data, "base": base, "head": head})
    prepare.api("/issues/" + str(result["number"]) + "/labels", "POST", {"labels": [label]})
    print(result["html_url"])
    return result


def valid_run(run, path, branches):
    if (run.get("conclusion") != "success" or run.get("path") != ".github/workflows/" + path
            or run.get("event") not in ("push", "workflow_dispatch")
            or run.get("head_repository", {}).get("full_name") != REPO
            or run.get("head_branch") not in branches or ref(run["head_branch"]) != run["head_sha"]):
        raise ValueError("Checks are stale, unsuccessful or from an untrusted source")
    repeats = prepare.api("/actions/workflows/" + path + "/runs?head_sha=" + run["head_sha"] + "&per_page=100")["workflow_runs"]
    repeats = [row for row in repeats if row["head_branch"] == run["head_branch"] and row["event"] in ("push", "workflow_dispatch")]
    if not repeats or max(repeats, key=lambda row: (row["id"], row.get("run_attempt", 1)))["conclusion"] != "success":
        raise ValueError("Latest checks for this commit are incomplete or unsuccessful")
    return run["head_sha"]


def snapshot_candidates(lock, approved):
    """Only modules already in the tested snapshot; no late additions."""
    current = {row["id"]: row for row in approved["modules"]}
    for row in lock["modules"]:
        match = current.get(row["id"])
        if not match or any(row.get(key) != match.get(key) for key in ("commit", "version", "versionId")):
            raise ValueError("Module approval changed; integrate and test developer again")
    return {"format": 1, "modules": lock["modules"]}


def stamp_module(file, row):
    manifest = json.loads(file.read_text())
    manifest.update({**row.get("manifest", {}), "id": row["id"], "version": row["version"], "commit": row["commit"], "path": "web/modules/" + row["id"]})
    file.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")


def assert_module_sources(cwd, candidates):
    sources = cwd / "web/modules"
    actual = {item.name for item in sources.iterdir() if item.is_dir()} if sources.exists() else set()
    if actual != {row["id"] for row in candidates["modules"]}:
        raise ValueError("Unapproved module source in developer")
    with tempfile.TemporaryDirectory(prefix="lxp-approved-source-") as directory:
        expected = Path(directory)
        for row in candidates["modules"]:
            prepare.extract_module(expected, row, cwd)
            stamp_module(expected / "modules" / row["id"] / "module.manifest.json", row)
            def contents(root):
                result = {}
                for file in root.rglob("*"):
                    if file.is_symlink(): raise ValueError("Linked module source")
                    if file.is_file(): result[str(file.relative_to(root))] = file.read_bytes()
                return result
            if contents(expected / "modules" / row["id"]) != contents(sources / row["id"]):
                raise ValueError("Developer module differs from LP-approved source")


def artifact_manifest(run):
    artifacts = prepare.api(f"/actions/runs/{run['id']}/artifacts?per_page=100")["artifacts"]
    rows = [row for row in artifacts if row["name"] == "tested-release-manifest" and not row["expired"]]
    if len(rows) != 1: raise ValueError("Missing unique tested release manifest")
    raw = subprocess.check_output(["gh", "api", f"repos/{REPO}/actions/artifacts/{rows[0]['id']}/zip"])
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        if archive.namelist() != ["release.manifest.json"] or archive.getinfo("release.manifest.json").file_size > 4_000_000:
            raise ValueError("Invalid manifest artifact")
        result = json.loads(archive.read("release.manifest.json"))
    if result.get("format") != 1 or not isinstance(result.get("modules"), list): raise ValueError("Invalid tested manifest")
    return result


def baselines(sha):
    if ref("developer") != sha: return
    prs = []
    for branch in policy.CLIENTS:
        head = ref(branch)
        if head == sha or not ancestor(head, sha): continue
        pr = pull(branch, "developer", f"chore: sync {branch} with tested developer",
                  f"Internal baseline. Tested developer: `{sha}`. Pending client contributions are preserved.", "baseline")
        prs.append(pr)
    if prs:
        dispatch("client-checks.yml", "developer")
        dispatch("baseline-checks.yml", "developer")
    for pr in prs:
        subprocess.run(["gh", "pr", "merge", str(pr["number"]), "--repo", REPO, "--auto", "--merge"], check=True)


def module_baseline(main, cwd):
    """The temporary ref is shared with releases and used only while idle."""
    if prepare.api("/pulls?state=open&head=Luxisoft:" + TEMP): return
    modules = ref("modules")
    if not git("diff", "--name-only", modules, main, "--", ".", ":(exclude)web/modules", cwd=cwd): return
    git("checkout", "--detach", main, cwd=cwd)
    git("rm", "-r", "--ignore-unmatch", "--", "web/modules", cwd=cwd)
    if git("ls-tree", modules, "web/modules", cwd=cwd):
        git("read-tree", "--prefix=web/modules/", modules + ":web/modules", cwd=cwd)
        git("checkout-index", "--all", cwd=cwd)
    tree = git("write-tree", cwd=cwd)
    sha = git("-c", "user.name=LUXIPANEL integration", "-c", "user.email=integration@users.noreply.github.com",
              "commit-tree", tree, "-p", modules, "-p", main, "-m", "chore: sync released baseline preserving module sources", cwd=cwd)
    git("push", "--force-with-lease", "origin", sha + ":refs/heads/" + TEMP, cwd=cwd)
    pr = pull("modules", TEMP, "chore: sync released module baseline", "Internal baseline; the web/modules tree is unchanged.", "baseline")
    dispatch("baseline-checks.yml", TEMP)
    dispatch("module-review.yml", TEMP)
    subprocess.run(["gh", "pr", "merge", str(pr["number"]), "--repo", REPO, "--auto", "--merge"], check=True)


def prepare_snapshot(sha, run, approved, cwd):
    main = ref("main")
    if ancestor(sha, main, cwd): return
    if not git("diff", "--name-only", main, sha, cwd=cwd): return
    if prepare.api("/pulls?state=open&base=modules&head=Luxisoft:" + TEMP): return
    # Do not replace an identical snapshot or invalidate its owner's review.
    prs = prepare.api("/pulls?state=open&base=main&head=Luxisoft:" + TEMP)
    if prs and f"Developer tested: `{sha}`" in (prs[0].get("body") or ""): return
    candidates = snapshot_candidates(json.loads((cwd / "modules.lock.json").read_text()), approved)
    assert_module_sources(cwd, candidates)
    tested = artifact_manifest(run)
    expected = {(row["id"], row["version"], row["commit"]) for row in candidates["modules"]}
    if {(row["id"], row["version"], row["commit"]) for row in tested["modules"]} != expected:
        raise ValueError("Tested modules differ from approved snapshot")
    version = prepare.prepare(cwd / "web", candidates, extract=False)
    release = json.loads((cwd / "release.manifest.json").read_text()); release["modules"] = tested["modules"]
    (cwd / "release.manifest.json").write_text(json.dumps(release, indent=2) + "\n")
    commit(cwd, "chore(release): LUXIPANEL v" + version)
    if ref("developer") != sha: raise ValueError("Developer changed during preparation; rerun checks")
    git("push", "--force-with-lease", "origin", "HEAD:refs/heads/" + TEMP, cwd=cwd)
    pull("main", TEMP, "chore(release): LUXIPANEL v" + version,
         f"Developer tested: `{sha}`. CI run: {run['html_url']}.\n\nOnly modules approved in that tested snapshot are included. Owner review and full release checks are required. Merging publishes one official Release.", "release")
    dispatch("release-checks.yml", TEMP)


def main():
    event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
    mode = os.environ.get("PIPELINE_MODE", "auto")
    if mode == "bootstrap":
        if os.environ.get("GITHUB_REF") != "refs/heads/" + TEMP: raise ValueError("Bootstrap only on temporary branch")
        pull("main", TEMP, "feat: organize contributions by client and developer",
             "Installs branch/integration workflows and includes #3. This bootstrap does not publish a Release or change v2.0.3. Maintainer review required.", "bootstrap")
        dispatch("release-checks.yml", TEMP)
        return
    if os.environ.get("GITHUB_REF") != "refs/heads/main": raise ValueError("Orchestrator must run trusted main")
    run = prepare.api("/actions/runs/" + str(event["workflow_run"]["id"])) if "workflow_run" in event else None
    if run and run["path"] == ".github/workflows/client-checks.yml" and run["head_branch"] == "developer": return
    git("fetch", "origin", "+refs/heads/*:refs/remotes/origin/*", "--tags")
    approved = relay.lp("/release-candidates", "GET")
    old = ref("developer")
    with tempfile.TemporaryDirectory(prefix="lxp-integration-") as directory:
        cwd = Path(directory) / "source"
        git("worktree", "add", "--detach", str(cwd), old)
        try:
            if run and run["path"] == ".github/workflows/developer-checks.yml":
                sha = valid_run(run, "developer-checks.yml", ["developer"])
                prepare_snapshot(sha, run, approved, cwd)
                baselines(sha)
                return
            if run and run["path"] == ".github/workflows/client-checks.yml":
                sha = valid_run(run, "client-checks.yml", policy.CLIENTS)
                if ancestor(sha, old, cwd): return
                files = git("diff", "--name-only", git("merge-base", old, sha, cwd=cwd), sha, cwd=cwd).splitlines()
                if not files: return  # Internal baseline merge, no new contribution.
                policy.assert_scope(run["head_branch"], files)
                git("-c", "user.name=LUXIPANEL integration", "-c", "user.email=integration@users.noreply.github.com", "merge", "--no-edit", sha, cwd=cwd)
            else:
                if run and (run.get("conclusion") != "success" or run["path"] != ".github/workflows/module-review-relay.yml"):
                    raise ValueError("Unexpected workflow")
                git("-c", "user.name=LUXIPANEL integration", "-c", "user.email=integration@users.noreply.github.com", "merge", "--no-edit", ref("main"), cwd=cwd)
                for row in approved["modules"]:
                    prepare.extract_module(cwd / "web", row, cwd)
                    file = cwd / "web/modules" / row["id"] / "module.manifest.json"
                    stamp_module(file, row)
                (cwd / "modules.lock.json").write_text(json.dumps({"format": 1, "modules": approved["modules"]}, indent=2, ensure_ascii=False) + "\n")
                commit(cwd, "chore: integrate LP-approved module snapshot")
            if git("rev-parse", "HEAD", cwd=cwd) != old: push_developer(cwd, old)
            elif not run and mode == "auto": dispatch("developer-checks.yml", "developer")
            if not run: module_baseline(ref("main"), cwd)
        finally:
            git("worktree", "remove", "--force", str(cwd))


if __name__ == "__main__": main()
