"""Versioned, atomic read snapshots. No client/user payload in the event stream."""
import json
import os
import time

PREFIX = "lprc:v2"
EVENTS = PREFIX + ":events"

# Content is immutable within a version. The pointer and event become visible
# together, after all content is present. Old readers keep their v1 keys.
PUBLISH = """
local previous = redis.call('GET', KEYS[1])
local changed = true
if previous then
  local ok, old = pcall(cjson.decode, previous)
  if ok and old.version == ARGV[1] and old.state ~= 'stale' then changed = false end
end
redis.call('SET', KEYS[2], ARGV[3], 'EX', 7200, 'NX')
redis.call('EXPIRE', KEYS[2], 7200)
redis.call('SET', KEYS[1], ARGV[2], 'EX', 7200)
if changed or ARGV[8] == "1" then
  redis.call('XADD', KEYS[3], 'MAXLEN', '~', 10000, '*',
    'module', ARGV[4], 'collection', ARGV[5], 'scope', ARGV[6],
    'version', ARGV[1], 'collectedAt', ARGV[7])
end
return changed and 1 or 0
"""

def features(config_dir):
    try:
        with open(os.path.join(config_dir, "cache-engine", "live-data.json")) as f:
            value = json.load(f)
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError):
        return {}

def publish(redis, config_dir, module, collection, meta, payload, scope=None):
    if features(config_dir).get("versionedReads") is not True:
        return False
    suffix = ":scope:" + str(scope) if scope is not None else ""
    base = f"{PREFIX}:{module}:{collection}{suffix}"
    pointer = dict(meta, payloadKey=f"{base}:full:{meta['version']}", protocol=2)
    keys = [base + ":current", pointer["payloadKey"], EVENTS]
    args = [meta["version"], json.dumps(pointer, separators=(",", ":")), payload,
            module, collection, "" if scope is None else str(scope), str(meta["collectedAt"]), os.environ.get("LXP_INVALIDATE", "0")]
    # stdin, not argv: collections may exceed ARG_MAX. redis-cli parses its
    # quoted inline protocol; no value is evaluated by a shell.
    command = "EVAL " + " ".join(json.dumps(str(v), ensure_ascii=False)
        for v in [PUBLISH, len(keys), *keys, *args]) + "\n"
    result = redis._run(["--raw"], stdin=command, timeout=30)
    if result.returncode != 0 or result.stdout.strip() not in ("0", "1"):
        raise RuntimeError("versioned snapshot publication failed")
    return True

# Failure only changes metadata. The last valid immutable payload remains usable.
MARK_STALE = """
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local meta = cjson.decode(raw)
if meta.state == 'stale' then return 0 end
meta.state = 'stale'
meta.failedAt = tonumber(ARGV[3])
redis.call('SET', KEYS[1], cjson.encode(meta), 'EX', 7200)
redis.call('XADD', KEYS[2], 'MAXLEN', '~', 10000, '*',
 'module', ARGV[1], 'collection', ARGV[2], 'version', meta.version,
 'collectedAt', tostring(meta.collectedAt))
return 1
"""

def mark_stale(module, collection):
    import common
    if features(common.CFG_DIR).get("versionedReads") is not True:
        return
    conn = common.load_conn()
    if not conn: return
    redis = common.Redis(*conn)
    keys = [f"{PREFIX}:{module}:{collection}:current", EVENTS]
    args = [module, collection, str(int(time.time()))]
    command = "EVAL " + " ".join(json.dumps(str(v)) for v in [MARK_STALE, len(keys), *keys, *args]) + "\n"
    try: redis._run(["--raw"], stdin=command, timeout=2)
    except Exception: pass
