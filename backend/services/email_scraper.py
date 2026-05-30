import json as json_mod
import logging
import re
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_EMAIL_RE = re.compile(r'\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,7}\b')

_JUNK_LOCALS = frozenset([
    'noreply', 'no-reply', 'donotreply', 'do-not-reply', 'bounce',
    'example', 'test', 'privacy', 'legal', 'admin', 'webmaster',
    'postmaster', 'mailer-daemon', 'unsubscribe', 'newsletter',
])
_PREFERRED_LOCALS = frozenset([
    'hr', 'hiring', 'career', 'careers', 'job', 'jobs', 'recruit',
    'recruitment', 'talent', 'people', 'apply', 'work', 'staffing',
])

_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/121.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
}


def _score_email(email: str) -> int:
    local = email.split('@')[0].lower().strip('. ')
    if any(j in local for j in _JUNK_LOCALS):
        return -1
    if any(p in local for p in _PREFERRED_LOCALS):
        return 2
    return 1


async def scrape_email_from_website(url: str) -> Optional[str]:
    """Try to find a contact/HR email by scraping common pages on a company website."""
    if not url:
        return None

    base = url.rstrip('/')
    paths = ['', '/contact', '/contact-us', '/about', '/about-us',
             '/careers', '/jobs', '/team', '/hiring', '/people']

    collected: list[tuple[str, int]] = []

    async with httpx.AsyncClient(timeout=8, follow_redirects=True, headers=_HEADERS) as client:
        for path in paths:
            try:
                resp = await client.get(base + path)
                if resp.status_code != 200:
                    continue
                for email in _EMAIL_RE.findall(resp.text):
                    score = _score_email(email)
                    if score < 0:
                        continue
                    collected.append((email, score))
                    if score == 2:
                        return email  # HR/careers email found — stop early
            except Exception as exc:
                logger.debug("fetch %s%s: %s", base, path, exc)

    if not collected:
        return None
    collected.sort(key=lambda x: x[1], reverse=True)
    return collected[0][0]


async def get_website_from_linkedin(linkedin_url: str) -> Optional[str]:
    """
    Try to extract the company website URL from a LinkedIn company page.
    Works via JSON-LD structured data embedded in the page HTML.
    LinkedIn serves some structured data even without JS.
    """
    if not linkedin_url:
        return None

    _LD_RE = re.compile(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        re.DOTALL | re.IGNORECASE,
    )

    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True, headers=_HEADERS) as client:
            resp = await client.get(linkedin_url)
            if resp.status_code != 200:
                return None

            for m in _LD_RE.finditer(resp.text):
                try:
                    data = json_mod.loads(m.group(1))
                    if not isinstance(data, dict):
                        continue
                    # Direct website field
                    for key in ('url', 'sameAs', 'website'):
                        val = data.get(key)
                        if isinstance(val, str) and val.startswith('http') and 'linkedin.com' not in val:
                            return val
                    # sameAs list
                    same = data.get('sameAs')
                    if isinstance(same, list):
                        for v in same:
                            if isinstance(v, str) and v.startswith('http') and 'linkedin.com' not in v:
                                return v
                except Exception:
                    pass
    except Exception as exc:
        logger.debug("LinkedIn website scrape failed for %s: %s", linkedin_url, exc)

    return None
