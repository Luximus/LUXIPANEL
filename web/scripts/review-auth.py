"""Short-lived GitHub Actions identity for LP's narrow module review API."""
import json
import os
import time
import urllib.parse
import urllib.request

_identity = None
_until = 0

def token():
    global _identity, _until
    dedicated = os.environ.get("RUNNER_REVIEW_TOKEN")
    if dedicated:
        if len(dedicated) < 32:
            raise RuntimeError("Dedicated review token must contain at least 32 characters")
        return dedicated
    if _identity and time.monotonic() < _until:
        return _identity
    endpoint = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL", "")
    authorization = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN", "")
    parsed = urllib.parse.urlsplit(endpoint)
    if parsed.scheme != "https" or not (parsed.hostname or "").endswith(".actions.githubusercontent.com") or not authorization:
        raise RuntimeError("Run from the trusted GitHub workflow or configure a dedicated review token")
    query = urllib.parse.parse_qsl(parsed.query) + [("audience", "luxipanel-module-review")]
    endpoint = urllib.parse.urlunsplit(parsed._replace(query=urllib.parse.urlencode(query)))
    request = urllib.request.Request(endpoint, headers={"Authorization": "Bearer " + authorization})
    with urllib.request.urlopen(request, timeout=15) as response:
        _identity = json.load(response)["value"]
    if not isinstance(_identity, str) or len(_identity) > 16000:
        raise RuntimeError("Invalid workflow identity")
    _until = time.monotonic() + 180
    return _identity
