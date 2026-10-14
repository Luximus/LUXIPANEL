"""Health checks from the supervisor, with no customer-selected remote target."""
import re
import time
import urllib.error
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


def healthy_components(parts, manifest, attempts=30, delay=1):
    if len(parts) != len(manifest):
        raise RuntimeError('invalid_result_components')
    client = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    for part, expected in zip(parts, manifest):
        surface = 'http' if expected['surface'] == 'mobile' else expected['surface']
        if part['name'] != expected['name'] or part['surface'] != surface:
            raise RuntimeError('invalid_result_component')
        if surface != 'http':
            continue
        port = part['port']
        health_path = expected['healthPath']
        if type(port) is not int or not 1 <= port <= 65535:
            raise RuntimeError('invalid_result_port')
        if health_path.startswith('//') or not re.fullmatch(r'/[A-Za-z0-9_/?=&.-]{0,199}', health_path):
            raise RuntimeError('invalid_health_path')
        address = f'http://127.0.0.1:{port}{health_path}'
        ready = False
        for attempt in range(attempts):
            try:
                with client.open(address, timeout=3) as response:
                    ready = 200 <= response.status < 300
            except (OSError, urllib.error.URLError):
                pass
            if ready:
                break
            if attempt + 1 < attempts:
                time.sleep(delay)
        if not ready:
            raise RuntimeError('runtime_health_failed')
