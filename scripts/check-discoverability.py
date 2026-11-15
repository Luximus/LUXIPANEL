#!/usr/bin/env python3
"""Read-only GitHub Best match samples. Requires authenticated gh; emits JSONL.

Run before publication, then at 48h, 7d and 28d. Compare the same queries and
page limit. Counts describe matching repositories, not keyword search demand.
No recurring job is installed. Monthly demand remains unverified until a
keyword data provider is connected. Search Console metrics concern the website.
"""
import argparse
import datetime
import json
import subprocess
import urllib.parse

QUERIES = [
    'linux control panel', 'vps control panel', 'web hosting control panel',
    'linux server management', 'self-hosted server management',
    'panel de control para linux', 'administrar servidores linux',
    'git deployment panel',
]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--max-pages', type=int, choices=range(1, 11), default=10)
parser.add_argument('--query', action='append', help='Override the default plain-language queries')
args = parser.parse_args()
for query in args.query or QUERIES:
    row = dict(observed_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
               query=query, sort='best-match', source='github-rest', rank=None,
               total=None, scanned=0, incomplete=False, status='unmeasured')
    for page in range(1, args.max_pages + 1):
        endpoint = 'search/repositories?' + urllib.parse.urlencode(dict(q=query, per_page=100, page=page))
        result = subprocess.run(['gh', 'api', endpoint], capture_output=True, text=True)
        if result.returncode:
            # Do not misreport a rate limit or permission failure as absence.
            row.update(status='request-failed', error=result.stderr.strip())
            break
        data = json.loads(result.stdout)
        row.update(total=data['total_count'], incomplete=row['incomplete'] or data['incomplete_results'])
        row['scanned'] += len(data['items'])
        row['rank'] = next(((page - 1) * 100 + i for i, item in enumerate(data['items'], 1)
                            if item['full_name'].lower() == 'luxisoft/luxipanel'), None)
        if row['rank']:
            row['status'] = 'found'
            break
        if row['scanned'] >= row['total']:
            row['status'] = 'not-returned-in-complete-results'
            break
    if row['status'] == 'unmeasured':
        row['status'] = 'not-found-in-scanned-window'
    print(json.dumps(row, ensure_ascii=False), flush=True)
