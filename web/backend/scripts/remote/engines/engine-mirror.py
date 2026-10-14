#!/usr/bin/env python3
"""
engine-mirror.py — generic `sidecar-mirror` engine.

For one `<module>/<collection>` whose policy source is `sidecar-mirror`:
reads the JSON sidecar LUXIPANEL already writes
(`${LUXIPANEL_CONFIG_DIR}/<module>/<collection>.json`, an object map),
projects/sorts/paginates it and pushes the precomputed view to the dedicated
Redis. No business logic is duplicated — it just mirrors what's on disk.

Usage: engine-mirror.py <module> <collection>
Exit 0 always on a clean no-op (fail-open); non-zero only on usage error.
"""

import os
import sys
import time

import common


def main(argv):
    if len(argv) < 3 or len(argv) > 4:
        sys.stderr.write("usage: engine-mirror.py <module> <collection> [scope]\n")
        return 2
    module, collection = argv[1], argv[2]
    only_scope = argv[3] if len(argv) == 4 else None

    conn = common.load_conn()
    if not conn:
        return 1 if os.environ.get("LXP_REFRESH_STRICT") == "1" else 0
    redis = common.Redis(*conn)
    if not redis.ping():
        return 1 if os.environ.get("LXP_REFRESH_STRICT") == "1" else 0

    policy = common.load_policy() or []
    entry = next((c for c in policy
                  if c.get("module") == module
                  and c.get("collection") == collection), None)
    if not entry or entry.get("source") != "sidecar-mirror":
        return 0  # Not a mirror collection (or not in the allowlist).

    raw = common.load_json(common.sidecar_path(module, collection))
    rows = common.docs_from_sidecar(raw) if raw is not None else []
    projection = entry.get("projection")
    scoped = bool(entry.get("scoped"))
    scope_field = entry.get("scopeField") if scoped else None

    started = time.time()
    # Granular refresh path: when the caller asked for ONE scope only,
    # re-emit just that scope's blob (filtering rows). The full unscoped
    # blob stays as-is from the last full tick. This is what
    # `dispatcher.sh --entry m c --scope <s>` triggers on per-account
    # mutations.
    if only_scope is not None and scoped and scope_field:
        sub_rows = [
            r for r in rows
            if r.get(scope_field) is not None
            and str(r.get(scope_field)) == only_scope
        ]
        stat = common.write_view(redis, module, collection, sub_rows,
                                 "sidecar-mirror", projection, scope=only_scope)
    else:
        # Full pass: write the unscoped blob plus per-scope blobs.
        stat = common.write_view(redis, module, collection, rows,
                                 "sidecar-mirror", projection)
        if scoped and scope_field:
            per_scope = {}
            for r in rows:
                v = r.get(scope_field)
                if v is None:
                    continue
                per_scope.setdefault(str(v), []).append(r)
            for scope_val, sub_rows in per_scope.items():
                common.write_view(redis, module, collection, sub_rows,
                                  "sidecar-mirror", projection, scope=scope_val)
    stat["wallMs"] = int((time.time() - started) * 1000)
    common.write_stat(module, collection, stat)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
