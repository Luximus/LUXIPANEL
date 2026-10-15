#!/usr/bin/env python3
"""Trusted main orchestration. Candidate programs run only in read-only CI."""
import io
import json
import os
import re
import urllib.error
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
REPO, TEMP = prepare.REPOSITORY, policy.BOOTSTRAP
guard = load("guard", "release-snapshot-guard.py")


def git(*args, cwd=None):
    return subprocess.check_output(["git", "-c", "core.hooksPath=/dev/null", *args], cwd=cwd, text=True).strip()


def ancestor(old, new, cwd=None):
    return subprocess.run(["git", "merge-base", "--is-ancestor", old, new], cwd=cwd).returncode == 0


def ref(branch):
    if branch not in (*policy.PERMANENT, TEMP, policy.BASELINE) and not policy.candidate_version(branch): raise ValueError("Unsupported canonical branch")
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


def exact_candidates(lock):
    ids = [row["versionId"] for row in lock["modules"]]
    if len(ids) != len(set(ids)): raise ValueError("Duplicate frozen module versions")
    approved = []
    for offset in range(0, len(ids), 50):
        batch = ids[offset:offset + 50]
        if any(not re.fullmatch(r"[a-f0-9-]{36}", item) for item in batch): raise ValueError("Invalid module version ID")
        approved.extend(relay.lp("/release-candidates?versionIds=" + ",".join(batch), "GET")["modules"])
    snapshot_candidates(lock, {"modules": approved})
    current = {row["versionId"]: row for row in approved}
    for row in lock["modules"]:
        if row.get("manifest") != current[row["versionId"]].get("manifest"):
            raise ValueError("Frozen module manifest differs from authority")
    return {"format": 1, "modules": lock["modules"]}


def active_candidates():
    return [row for row in prepare.api("/pulls?state=open&base=main&per_page=100")
            if row["head"]["repo"] and row["head"]["repo"]["full_name"] == REPO
            and policy.candidate_version(row["head"]["ref"]) and row["user"]["login"] == "github-actions[bot]"
            and any(label["name"] == "release" for label in row.get("labels", []))]


def maybe_ref(branch):
    try: return ref(branch)
    except urllib.error.HTTPError as error:
        if error.code != 404: raise
        return None


def source_provenance(cwd, sha):
    try: return json.loads(git("show", sha + ":release.provenance.json", cwd=cwd))
    except subprocess.CalledProcessError: return None


def open_candidate(branch, version, provenance):
    result = pull("main", branch, ("fix(release): " if provenance["kind"] == "hotfix" else "chore(release): ") + "LUXIPANEL v" + version,
        f"Frozen source: `{provenance['sourceSha']}`. CI: https://github.com/{REPO}/actions/runs/{provenance['sourceRun']}.\n\n"
        f"Stable base: `{provenance['stableTag']}`. Developer may continue independently. Full candidate checks and owner review are required; merging publishes one Release.", "release")
    if provenance["kind"] == "hotfix": prepare.api("/issues/" + str(result["number"]) + "/labels", "POST", {"labels": ["hotfix"]})
    dispatch("release-checks.yml", branch)
    return result


def prepare_snapshot(sha, run, approved, cwd, kind="release", source_branch="developer", contributions=None):
    stable = prepare.api("/releases/latest")["tag_name"]
    if kind == "release" and (ancestor(sha, stable, cwd) or not git("diff", "--name-only", stable, sha, cwd=cwd)): return
    prs = active_candidates()
    if prs:
        print("A frozen candidate is already awaiting review:", prs[0]["html_url"])
        return
    if kind == "release" and maybe_ref("hotfix/" + prepare.next_version(stable, "patch")):
        print("An isolated hotfix is being tested; normal preparation waits for publication")
        return
    lock = json.loads((cwd / "modules.lock.json").read_text())
    candidates = exact_candidates(lock)
    assert_module_sources(cwd, candidates)
    tested = artifact_manifest(run)
    expected = {(row["id"], row["version"], row["commit"]) for row in candidates["modules"]}
    if {(row["id"], row["version"], row["commit"]) for row in tested["modules"]} != expected:
        raise ValueError("Tested modules differ from approved snapshot")
    if kind == "release" and not ancestor(ref("main"), sha, cwd): raise ValueError("Synchronize published main into developer before preparing a candidate")
    version = prepare.prepare(cwd / "web", candidates, bump="patch" if kind == "hotfix" else "auto", extract=False)
    branch = kind + "/" + version
    provenance = {"format": 1, "kind": kind, "sourceSha": sha, "sourceBranch": source_branch,
        "sourceRun": run["id"], "sourceAttempt": run.get("run_attempt", 1), "stableTag": stable,
        "contributions": contributions or [], "testedModulesSha256": guard.module_digest(tested["modules"])}
    existing = maybe_ref(branch)
    if existing and existing != sha:
        previous = source_provenance(cwd, existing)
        if previous and previous["sourceSha"] == sha and previous["sourceRun"] == run["id"] and previous["stableTag"] == stable:
            return open_candidate(branch, version, previous)
        raise ValueError("Candidate branch already contains a different snapshot; retire it explicitly")
    release = json.loads((cwd / "release.manifest.json").read_text()); release["modules"] = tested["modules"]
    release["contributions"] = sorted(set(release.get("contributions", [])) | set(contributions or []))
    (cwd / "release.manifest.json").write_text(json.dumps(release, indent=2) + "\n")
    (cwd / "release.provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")
    commit(cwd, "chore(release): LUXIPANEL v" + version)
    guard.metadata_only(sha, git("rev-parse", "HEAD", cwd=cwd), version, lambda *args: git(*args, cwd=cwd))
    if ref(source_branch) != sha: raise ValueError("Source changed during preparation; rerun its checks")
    git("push", "origin", "HEAD:refs/heads/" + branch, cwd=cwd)
    return open_candidate(branch, version, provenance)


def delete_ref(branch, sha, cwd=None):
    if branch in policy.PERMANENT or not (policy.candidate_version(branch) or branch in (policy.BOOTSTRAP, policy.BASELINE)):
        raise ValueError("Refusing to delete a permanent or unrelated branch")
    git("push", "--force-with-lease=refs/heads/" + branch + ":" + sha, "origin", ":refs/heads/" + branch, cwd=cwd)


def suspend_normal_candidates(cwd):
    for pr in active_candidates():
        if not pr["head"]["ref"].startswith("release/"): raise ValueError("A hotfix is already awaiting review")
        # Source history remains in developer; the closed PR retains the stamped commit.
        previous = source_provenance(cwd, pr["head"]["sha"])
        if not previous or not ancestor(previous["sourceSha"], ref("developer"), cwd):
            raise ValueError("Cannot retire candidate with unpreserved source history")
        prepare.api("/pulls/" + str(pr["number"]), "PATCH", {"state": "closed", "body": (pr.get("body") or "") + "\n\nSuperseded by an urgent hotfix. Preserved candidate SHA: `" + pr["head"]["sha"] + "`. A fresh normal candidate will follow the hotfix."})
        delete_ref(pr["head"]["ref"], pr["head"]["sha"], cwd)


def prepare_hotfix(cwd, pull_number="", version_ids=""):
    if bool(pull_number) == bool(version_ids): raise ValueError("Select exactly one merged core PR or approved module-version list")
    stable = prepare.api("/releases/latest")["tag_name"]
    if git("diff", "--name-only", stable, ref("main"), cwd=cwd):
        raise ValueError("Main contains unpublished changes; publish/reconcile them before isolating a hotfix")
    version = prepare.next_version(stable, "patch"); branch = "hotfix/" + version
    marker = "Hotfix input: " + ("PR " + pull_number if pull_number else "modules " + ",".join(sorted(version_ids.split(","))))
    existing = maybe_ref(branch)
    if existing:
        history = git("log", "-2", "--format=%B", existing, cwd=cwd)
        if marker not in history or "Stable base: " + stable not in history: raise ValueError("A different hotfix already owns this version")
        previous = source_provenance(cwd, existing)
        if previous and previous.get("kind") == "hotfix" and previous["stableTag"] == stable:
            return open_candidate(branch, version, previous)
        dispatch_hotfix(branch, existing)
        return
    if pull_number:
        if not re.fullmatch(r"[1-9]\d*", pull_number): raise ValueError("Invalid core PR")
        pr = prepare.api("/pulls/" + pull_number)
        if not pr.get("merged") or pr["base"]["repo"]["full_name"] != REPO or pr["base"]["ref"] != "developer":
            raise ValueError("Hotfix source must be a merged developer PR")
        merged = pr["merge_commit_sha"]
        if not re.fullmatch(r"[a-f0-9]{40}", merged): raise ValueError("Invalid source merge SHA")
        git("fetch", "--no-tags", "origin", merged, cwd=cwd)
        changed = git("diff", "--name-only", merged + "^1", merged, cwd=cwd).splitlines()
        policy.assert_scope("developer", changed)
        if any(re.search(r"(^|/)(?:\.env(?:\.|$)|\.git|node_modules|dist)|\.(?:key|pem|ndjson|log)$", name) for name in changed): raise ValueError("Private/generated file in hotfix")
        patch = subprocess.check_output(["git", "diff", "--binary", "--full-index", merged + "^1", merged], cwd=cwd)
        subprocess.run(["git", "-c", "core.hooksPath=/dev/null", "apply", "--index", "--binary"], input=patch, cwd=cwd, check=True)
        subject = "fix: urgent correction from PR #" + pull_number
    else:
        ids = version_ids.split(",")
        if len(ids) > 100 or len(set(ids)) != len(ids) or any(not re.fullmatch(r"[a-f0-9-]{36}", item) for item in ids): raise ValueError("Invalid module version IDs")
        selected = relay.lp("/release-candidates?versionIds=" + ",".join(ids), "GET")["modules"]
        if {row["versionId"] for row in selected} != set(ids): raise ValueError("Missing authoritative module selection")
        lock = json.loads((cwd / "modules.lock.json").read_text()); current = {row["id"]: row for row in lock["modules"]}
        for row in selected:
            if row["id"] not in current: raise ValueError("Hotfixes cannot add unrelated new modules")
            prepare.extract_module(cwd / "web", row, cwd); stamp_module(cwd / "web/modules" / row["id"] / "module.manifest.json", row)
            current[row["id"]] = row
        lock["modules"] = [current[row["id"]] for row in lock["modules"]]
        (cwd / "modules.lock.json").write_text(json.dumps(lock, indent=2, ensure_ascii=False) + "\n")
        subject = "fix: urgent LP-approved module corrections"
    if not commit(cwd, subject + "\n\n" + marker + "\nStable base: " + stable): raise ValueError("Hotfix has no code changes")
    suspend_normal_candidates(cwd)
    git("push", "origin", "HEAD:refs/heads/" + branch, cwd=cwd)
    dispatch_hotfix(branch, git("rev-parse", "HEAD", cwd=cwd))


def dispatch_hotfix(branch, sha):
    prepare.api("/actions/workflows/hotfix-checks.yml/dispatches", "POST", {"ref": "main", "inputs": {"source_branch": branch, "source_sha": sha}})


def hotfix_run_source(run):
    match = re.fullmatch(r"Hotfix checks (hotfix/\d+\.\d+\.\d+) @ ([a-f0-9]{40})", run.get("display_title", ""))
    if (not match or run.get("conclusion") != "success" or run.get("path") != ".github/workflows/hotfix-checks.yml"
            or run.get("event") != "workflow_dispatch" or run.get("head_branch") != "main" or run.get("head_repository", {}).get("full_name") != REPO):
        raise ValueError("Untrusted hotfix checks")
    return match[1], match[2]


def module_baseline(main, cwd):
    branch = policy.BASELINE; modules = ref("modules")
    if prepare.api("/pulls?state=open&base=modules&head=Luxisoft:" + branch): return
    existing = maybe_ref(branch)
    if existing:
        closed = prepare.api("/pulls?state=closed&base=modules&head=Luxisoft:" + branch)
        if any(pr.get("merged_at") and pr["head"]["sha"] == existing and pr["user"]["login"] == "github-actions[bot]" for pr in closed) and ancestor(existing, modules, cwd):
            delete_ref(branch, existing, cwd)
    if not git("diff", "--name-only", modules, main, "--", ".", ":(exclude)web/modules", cwd=cwd): return
    git("checkout", "--detach", main, cwd=cwd)
    git("rm", "-r", "--ignore-unmatch", "--", "web/modules", cwd=cwd)
    if git("ls-tree", modules, "web/modules", cwd=cwd):
        git("read-tree", "--prefix=web/modules/", modules + ":web/modules", cwd=cwd); git("checkout-index", "--all", cwd=cwd)
    tree = git("write-tree", cwd=cwd)
    sha = git("-c", "user.name=LUXIPANEL integration", "-c", "user.email=integration@users.noreply.github.com", "commit-tree", tree, "-p", modules, "-p", main, "-m", "chore: sync released baseline preserving module sources", cwd=cwd)
    git("push", "--force-with-lease", "origin", sha + ":refs/heads/" + branch, cwd=cwd)
    pr = pull("modules", branch, "chore: sync released module baseline", "Internal baseline; the web/modules tree is unchanged.", "baseline")
    dispatch("baseline-checks.yml", branch); dispatch("module-review.yml", branch)
    subprocess.run(["gh", "pr", "merge", str(pr["number"]), "--repo", REPO, "--auto", "--merge"], check=True)


def main():
    event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text()); mode = os.environ.get("PIPELINE_MODE", "auto")
    if mode == "bootstrap":
        if os.environ.get("GITHUB_REF") != "refs/heads/" + TEMP: raise ValueError("Bootstrap only on its migration branch")
        pull("main", TEMP, "feat: simplify contributions to three permanent branches", "Installs developer integration, frozen release candidates and isolated hotfixes. This bootstrap does not publish a Release or change v2.0.3. Owner review is required.", "bootstrap")
        dispatch("release-checks.yml", TEMP); return
    if os.environ.get("GITHUB_REF") != "refs/heads/main": raise ValueError("Orchestrator must run trusted main")
    run = prepare.api("/actions/runs/" + str(event["workflow_run"]["id"])) if "workflow_run" in event else None
    git("fetch", "origin", "+refs/heads/*:refs/remotes/origin/*", "--tags")
    hotfix = hotfix_run_source(run) if run and run["path"] == ".github/workflows/hotfix-checks.yml" else None
    old = ref("developer")
    if run and run["path"] == ".github/workflows/developer-checks.yml":
        if run.get("head_sha") != old:
            print("Skipping superseded developer checks")
            return
        target = valid_run(run, "developer-checks.yml", ["developer"])
    elif hotfix: target = ref(hotfix[0])
    elif mode == "hotfix": target = prepare.api("/releases/latest")["tag_name"]
    else: target = old
    with tempfile.TemporaryDirectory(prefix="lxp-integration-") as directory:
        cwd = Path(directory) / "source"; git("worktree", "add", "--detach", str(cwd), target)
        try:
            if mode == "hotfix": return prepare_hotfix(cwd, os.environ.get("HOTFIX_PR", ""), os.environ.get("HOTFIX_VERSION_IDS", ""))
            if hotfix:
                branch, source = hotfix
                if target != source:
                    previous = source_provenance(cwd, target)
                    if previous and previous.get("sourceSha") == source and previous.get("sourceRun") == run["id"]:
                        return open_candidate(branch, policy.candidate_version(branch), previous)
                    raise ValueError("Hotfix changed after checks")
                marker = git("log", "-1", "--format=%B", source, cwd=cwd)
                match = re.search(r"Hotfix input: PR ([1-9]\d*)", marker)
                return prepare_snapshot(source, run, None, cwd, "hotfix", branch, [int(match[1])] if match else [])
            if run and run["path"] == ".github/workflows/developer-checks.yml": return prepare_snapshot(target, run, None, cwd)
            if run and run["path"] not in (".github/workflows/module-review-relay.yml", ".github/workflows/publish-release.yml"):
                raise ValueError("Unexpected workflow")
            if run and (run.get("conclusion") != "success" or run.get("head_repository", {}).get("full_name") != REPO): raise ValueError("Untrusted integration workflow")
            if os.environ.get("GITHUB_EVENT_NAME") == "push":
                pulls = prepare.api("/commits/" + ref("main") + "/pulls")
                if any(any(label["name"] == "release" for label in pr.get("labels", [])) for pr in pulls): return  # Wait for publication before integration.
            git("-c", "user.name=LUXIPANEL integration", "-c", "user.email=integration@users.noreply.github.com", "merge", "--no-edit", ref("main"), cwd=cwd)
            approved = relay.lp("/release-candidates", "GET")
            for row in approved["modules"]:
                prepare.extract_module(cwd / "web", row, cwd); stamp_module(cwd / "web/modules" / row["id"] / "module.manifest.json", row)
            (cwd / "modules.lock.json").write_text(json.dumps({"format": 1, "modules": approved["modules"]}, indent=2, ensure_ascii=False) + "\n")
            commit(cwd, "chore: integrate LP-approved module snapshot")
            if git("rev-parse", "HEAD", cwd=cwd) != old: push_developer(cwd, old)
            elif not run: dispatch("developer-checks.yml", "developer")
            module_baseline(ref("main"), cwd)
        finally: git("worktree", "remove", "--force", str(cwd))


if __name__ == "__main__": main()
