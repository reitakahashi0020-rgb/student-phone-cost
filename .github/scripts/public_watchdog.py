"""Free public-repository watchdog. Requests only this site's static files, never ads."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from datetime import datetime, timezone, timedelta


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def inspect(root, fetch):
    manifest = json.loads((root / "operations.json").read_text(encoding="utf-8"))
    origin = manifest['site_url'].rstrip('/')
    parsed = urlsplit(origin)
    if parsed.scheme != 'https' or parsed.username or parsed.password:
        raise ValueError('Invalid production origin')
    if parsed.hostname != 'reitakahashi0020-rgb.github.io' and not parsed.hostname.endswith('.pages.dev'):
        raise ValueError('Unapproved production host')
    problems = []
    # Fixed allowlist: do not follow page links, pixels, redirects or arbitrary manifest URLs.
    for name in ('index.html', 'calculator.html', 'site.js', 'offer-policy.js', 'cost-engine.js', 'robots.txt', 'sitemap.xml'):
        try:
            actual = fetch(origin + '/' + name)
            expected = (root / name).read_bytes()
            if hashlib.sha256(actual).digest() != hashlib.sha256(expected).digest():
                problems.append(f'{name}: deployed bytes differ from the reviewed release')
        except (HTTPError, URLError, TimeoutError, OSError) as error:
            code = error.code if isinstance(error, HTTPError) else type(error).__name__
            problems.append(f'{name}: unavailable ({code}; no affiliate requests made)')
    for offer in manifest['offers']:
        expiry = datetime.fromisoformat(offer['expires_at'])
        if expiry <= datetime.now(timezone.utc) + timedelta(days=7):
            problems.append(f"{offer['offer_id']}: material expires {offer['expires_at']}; owner must verify ASP conditions")
    if not manifest['offers']:
        problems.append('No approved monetization material is currently available')
    return problems


def gh(*args):
    return subprocess.check_output(['gh', *args], text=True)


def main():
    root = Path.cwd()
    opener = build_opener(NoRedirects())
    def fetch(url):
        for attempt in range(3):
            try:
                with opener.open(Request(url, headers={'User-Agent': 'CostLab-Static-Health/1.0'}), timeout=10) as response:
                    return response.read(2_000_000)
            except (HTTPError, URLError, TimeoutError, OSError) as error:
                transient = not isinstance(error, HTTPError) or error.code in (404, 408, 429, 500, 502, 503, 504)
                if attempt == 2 or not transient:
                    raise
                time.sleep(1)
    problems = inspect(root, fetch)
    print('STATIC_HEALTH_OK' if not problems else '\n'.join(problems))
    if not os.getenv('GITHUB_ACTIONS'):
        return 1 if problems else 0
    repo = os.environ['GITHUB_REPOSITORY']
    if repo != 'reitakahashi0020-rgb/student-phone-cost':
        raise ValueError('Watchdog must run in the approved personal public repository')
    title = 'Site maintenance: action needed'
    issues = json.loads(gh('issue', 'list', '--repo', repo, '--state', 'open', '--search', title + ' in:title', '--json', 'number,title,body'))
    issue = next((i for i in issues if i['title'] == title), None)
    if problems:
        body = '無料の静的サイト点検で対応事項を検出しました。広告URLへのアクセスは行っていません。\n\n' + '\n'.join('- ' + p for p in problems)
        if issue and issue['body'] != body:
            gh('issue', 'edit', str(issue['number']), '--repo', repo, '--body', body)
        elif not issue:
            gh('issue', 'create', '--repo', repo, '--title', title, '--body', body)
    elif issue:
        gh('issue', 'close', str(issue['number']), '--repo', repo)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
