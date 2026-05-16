import logging
import asyncio
import urllib.parse
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from pathlib import Path

from backend.config import settings
from backend.models.schemas import TargetCompany

logger = logging.getLogger(__name__)

_GUEST_JOBS_API = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
_LINKEDIN_JOBS_URL = "https://www.linkedin.com/jobs/search/"
_MAX_JOB_AGE_DAYS = 14
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/121.0.0.0 Safari/537.36"
)
_HEADERS = {
    "User-Agent": _USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.linkedin.com/jobs/",
    "X-Requested-With": "XMLHttpRequest",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _km_to_li_miles(km: int) -> int:
    """Convert km to the nearest LinkedIn distance bucket (LinkedIn uses miles)."""
    miles = km * 0.621371
    for bucket in (10, 25, 50, 75, 100):
        if miles <= bucket:
            return bucket
    return 100


def _is_recent(datetime_str: str) -> bool:
    """Return True if an ISO datetime string is within _MAX_JOB_AGE_DAYS."""
    if not datetime_str:
        return True
    try:
        posted = datetime.fromisoformat(datetime_str.replace("Z", "+00:00"))
        cutoff = datetime.now(timezone.utc) - timedelta(days=_MAX_JOB_AGE_DAYS)
        return posted >= cutoff
    except (ValueError, TypeError):
        return True


def _location_matches(scraped_loc: str, requested_loc: str) -> bool:
    """
    Rough check: at least one significant word in the requested location appears
    in the scraped location. Prevents results from completely different countries.
    """
    if not scraped_loc or not requested_loc:
        return True
    stop = {"the", "of", "and", "in", "at", "for", "a", "an", "remote"}
    req_tokens = {w.lower().strip(",.") for w in requested_loc.split() if w.lower() not in stop}
    scr_lower = scraped_loc.lower()
    return any(tok in scr_lower for tok in req_tokens)


def _total_experience_years(work_experience: list) -> int:
    """Estimate total years of professional experience from work_experience array."""
    total = 0
    for exp in work_experience:
        start = str(exp.get("start_date") or exp.get("start_year") or exp.get("start") or "")
        end   = str(exp.get("end_date")   or exp.get("end_year")   or exp.get("end")   or "")
        try:
            sy = int(start[:4])
            ey = int(end[:4]) if (end and end[:4].isdigit()) else datetime.now().year
            total += max(0, ey - sy)
        except (ValueError, TypeError):
            continue
    return total


def _infer_experience_level(years: int) -> str:
    """
    Map total years of experience to LinkedIn f_E filter codes.
    LinkedIn codes: 1=Internship, 2=Entry, 3=Associate, 4=Mid-Senior, 5=Director
    """
    if years <= 1:
        return "1,2"   # Internship + Entry
    if years <= 3:
        return "2,3"   # Entry + Associate
    if years <= 7:
        return "3,4"   # Associate + Mid-Senior
    return "4,5"       # Mid-Senior + Director


def _infer_work_type(preferences: dict) -> str:
    """
    Derive LinkedIn f_WT code from profile preferences.
    LinkedIn codes: 1=On-site, 2=Remote, 3=Hybrid
    """
    if not preferences:
        return ""
    text = " ".join(str(v) for v in preferences.values()).lower()
    for kw, code in (("remote", "2"), ("hybrid", "3"), ("on-site", "1"), ("onsite", "1"), ("office", "1")):
        if kw in text:
            return code
    return ""


def _score_job(job: dict, role: str, skills: list) -> float:
    """
    Relevance score 0.0–1.0.
    Weights: title-keyword match 60%, skills appearing in title 25%, Easy Apply bonus 15%.
    """
    title = (job.get("title") or "").lower()
    role_tokens = [w for w in role.lower().split() if len(w) > 2]
    skill_tokens = [s.lower() for s in skills if s and len(s) > 2]

    title_score = sum(1 for w in role_tokens if w in title) / max(len(role_tokens), 1)
    skill_score = min(sum(1 for s in skill_tokens if s in title) / max(len(skill_tokens), 3), 1.0)
    ea_bonus    = 0.15 if job.get("easyApply") else 0.0

    return round(title_score * 0.60 + skill_score * 0.25 + ea_bonus, 4)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def scrape_linkedin_jobs(
    role: str,
    location: str,
    radius_km: int = 25,
    profile_skills: Optional[List[str]] = None,
    work_experience: Optional[List[dict]] = None,
    preferences: Optional[dict] = None,
) -> List[TargetCompany]:
    """
    Scrape LinkedIn job listings and rank by relevance to the candidate profile.
    Strategy: HTTP guest API (multi-page) → Playwright fallback → raise on both failing.
    """
    skills     = profile_skills or []
    years      = _total_experience_years(work_experience or [])
    exp_level  = _infer_experience_level(years)
    work_type  = _infer_work_type(preferences or {})

    logger.info(
        f"Scraping LinkedIn: '{role}' in '{location}' ({radius_km} km) | "
        f"{years}yr exp → f_E={exp_level!r} | work_type={work_type!r} | "
        f"top skills: {skills[:5]}"
    )

    raw: List[dict] = []

    # 1. HTTP guest API — fastest, no auth, multi-page
    try:
        raw = await _scrape_jobs_http(role, location, radius_km, exp_level, work_type)
        if raw:
            logger.info(f"HTTP scrape succeeded: {len(raw)} unique jobs across pages.")
            await _log_debug("linkedin_scraper", "scrape_linkedin_jobs",
                             {"role": role, "location": location}, outcome="success (http)")
        else:
            logger.warning("HTTP guest API returned 0 results, trying Playwright...")
    except Exception as exc:
        logger.warning(f"HTTP scrape failed ({exc}), trying Playwright...")
        await _log_debug("linkedin_scraper", "scrape_linkedin_jobs",
                         {"role": role, "location": location},
                         error=str(exc), outcome="http_failed")

    # 2. Playwright fallback
    if not raw:
        try:
            raw = await _scrape_jobs_playwright(role, location, radius_km, exp_level, work_type)
            if raw:
                logger.info(f"Playwright scrape succeeded: {len(raw)} jobs.")
                await _log_debug("linkedin_scraper", "scrape_linkedin_jobs",
                                 {"role": role, "location": location}, outcome="success (playwright)")
        except Exception as exc:
            logger.error(f"Playwright scrape failed ({exc})")
            await _log_debug("linkedin_scraper", "scrape_linkedin_jobs",
                             {"role": role, "location": location},
                             error=str(exc), outcome="playwright_failed")

    if not raw:
        raise RuntimeError(
            "Could not fetch jobs from LinkedIn. LinkedIn may be rate-limiting requests. "
            "Try again in a few minutes, or add jobs manually using the 'Add Manually' button."
        )

    # Score and sort by relevance before mapping
    for job in raw:
        job["_score"] = _score_job(job, role, skills)
    raw.sort(key=lambda j: j["_score"], reverse=True)

    logger.info(
        f"Top 3 scores: {[round(j['_score'],3) for j in raw[:3]]} | "
        f"Easy Apply: {sum(1 for j in raw if j.get('easyApply'))} / {len(raw)}"
    )

    return _map_to_targets(raw, role, location)


async def scrape_linkedin_person_profile(linkedin_url: str) -> dict:
    """Scrape a LinkedIn public person profile. Returns {} on failure."""
    if not linkedin_url:
        return {}
    if not linkedin_url.startswith("http"):
        linkedin_url = "https://" + linkedin_url
    try:
        return await _scrape_person_profile_playwright(linkedin_url)
    except Exception as exc:
        logger.warning(f"LinkedIn person profile scrape failed ({exc}).")
    return {}


async def scrape_company_profile(linkedin_url: str) -> dict:
    """Scrape a LinkedIn company About page. Returns empty dict on failure."""
    if not linkedin_url:
        return {}
    try:
        return await _scrape_company_playwright(linkedin_url)
    except Exception as exc:
        logger.warning(f"Company profile scrape failed ({exc}).")
    return {}


async def scrape_person_posts(linkedin_url: str, max_posts: int = 20) -> List[str]:
    """Scrape recent LinkedIn posts for a person. Returns empty list on failure."""
    if not linkedin_url:
        return []
    try:
        return await _scrape_posts_playwright(linkedin_url, max_posts)
    except Exception as exc:
        logger.warning(f"Person posts scrape failed ({exc}).")
    return []


# ---------------------------------------------------------------------------
# HTTP guest API scraper (primary — no auth, 3-page pagination)
# ---------------------------------------------------------------------------

async def _scrape_jobs_http(
    role: str,
    location: str,
    radius_km: int = 25,
    exp_level: str = "",
    work_type: str = "",
) -> List[dict]:
    """Fetch jobs via LinkedIn's public guest API, paginating up to 3 pages."""
    import httpx
    from bs4 import BeautifulSoup

    jobs: List[dict] = []
    seen: set = set()

    base_params: dict = {
        "keywords": role,
        "location": location,
        "pageSize": "25",
        "f_TPR":    "r604800",                       # posted in last 7 days
        "distance": str(_km_to_li_miles(radius_km)),
        "sortBy":   "DD",                            # newest first
        "f_JT":     "F,C",                           # Full-time + Contract
    }
    if exp_level:
        base_params["f_E"] = exp_level
    if work_type:
        base_params["f_WT"] = work_type

    async with httpx.AsyncClient(timeout=25, follow_redirects=True) as client:
        for start in (0, 25, 50):
            params = {**base_params, "start": str(start)}
            try:
                resp = await client.get(_GUEST_JOBS_API, params=params, headers=_HEADERS)
                resp.raise_for_status()
            except Exception as exc:
                logger.warning(f"HTTP scrape page start={start} failed: {exc}")
                break

            soup = BeautifulSoup(resp.text, "html.parser")
            page_hits = 0

            for card in soup.find_all("li"):
                title_el   = card.find("h3", class_="base-search-card__title")
                company_el = card.find("h4", class_="base-search-card__subtitle")
                loc_el     = card.find("span", class_="job-search-card__location")
                time_el    = card.find("time")
                link_el    = card.find("a", class_="base-card__full-link") or \
                             card.find("a", href=lambda h: h and "/jobs/view/" in str(h))
                co_link_el = card.find("a", href=lambda h: h and "/company/" in str(h))
                ea_el      = card.find(class_="job-search-card__easy-apply-label")

                if not link_el:
                    continue
                raw_href = link_el.get("href") or ""
                job_url = raw_href.split("?")[0]
                if "/jobs/view/" not in job_url or job_url in seen:
                    continue
                seen.add(job_url)

                if time_el and not _is_recent(time_el.get("datetime", "")):
                    continue

                scraped_loc = loc_el.get_text(strip=True) if loc_el else location
                if not _location_matches(scraped_loc, location):
                    continue

                co_href = (co_link_el.get("href") or "").split("?")[0] if co_link_el else ""
                page_hits += 1

                jobs.append({
                    "title":      title_el.get_text(strip=True) if title_el else "",
                    "company":    company_el.get_text(strip=True) if company_el else "Unknown",
                    "companyUrl": co_href,
                    "jobUrl":     job_url,
                    "location":   scraped_loc,
                    "easyApply":  bool(ea_el),
                })

            logger.debug(f"HTTP page start={start}: {page_hits} new jobs (total so far: {len(jobs)})")

            if page_hits == 0:
                break  # LinkedIn has no more results for this query

            await asyncio.sleep(0.6)  # polite delay between pages

    return jobs


# ---------------------------------------------------------------------------
# Playwright scraper (fallback — handles JS + auth)
# ---------------------------------------------------------------------------

async def _new_browser_context(pw):
    browser = await pw.chromium.launch(
        headless=True,
        args=["--no-sandbox", "--disable-setuid-sandbox",
              "--disable-blink-features=AutomationControlled"],
    )
    context = await browser.new_context(
        user_agent=_USER_AGENT,
        viewport={"width": 1366, "height": 768},
        locale="en-US",
    )
    return browser, context


async def _login(page) -> bool:
    email = settings.LINKEDIN_EMAIL
    password = settings.LINKEDIN_PASSWORD
    if not email or not password:
        return False
    try:
        await page.goto("https://www.linkedin.com/login",
                        wait_until="domcontentloaded", timeout=20000)
        await asyncio.sleep(1.0)
        await page.fill("#username", email)
        await page.fill("#password", password)
        await asyncio.sleep(0.4)
        await page.click("button[type='submit']")
        await asyncio.sleep(3)
        url = page.url
        return "login" not in url and "checkpoint" not in url and "authwall" not in url
    except Exception as exc:
        logger.warning(f"LinkedIn login attempt failed: {exc}")
        return False


async def _scrape_jobs_playwright(
    role: str,
    location: str,
    radius_km: int,
    exp_level: str = "",
    work_type: str = "",
) -> List[dict]:
    from playwright.async_api import async_playwright

    kw  = urllib.parse.quote_plus(role)
    loc = urllib.parse.quote_plus(location)
    radius_miles = _km_to_li_miles(radius_km)

    search_url = (
        f"{_LINKEDIN_JOBS_URL}?keywords={kw}&location={loc}"
        f"&distance={radius_miles}&f_TPR=r604800&sortBy=DD&f_JT=F%2CC"
    )
    if exp_level:
        search_url += f"&f_E={urllib.parse.quote_plus(exp_level)}"
    if work_type:
        search_url += f"&f_WT={work_type}"

    async with async_playwright() as pw:
        browser, context = await _new_browser_context(pw)
        page = await context.new_page()
        try:
            await page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(2)

            if "login" in page.url or "authwall" in page.url:
                logger.info("LinkedIn auth wall hit — attempting login...")
                ok = await _login(page)
                if ok:
                    await page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
                    await asyncio.sleep(2)

            for _ in range(4):
                await page.keyboard.press("End")
                await asyncio.sleep(0.7)

            return await _extract_job_cards(page)
        finally:
            await browser.close()


async def _extract_job_cards(page) -> List[dict]:
    return await page.evaluate("""
        () => {
            const results = [];

            let cards = Array.from(document.querySelectorAll(
                '.jobs-search__results-list li, .job-search-card, .base-card'
            ));
            if (!cards.length) {
                cards = Array.from(document.querySelectorAll(
                    '.jobs-search-results__list-item, .scaffold-layout__list-item'
                ));
            }

            cards.forEach(card => {
                const titleEl = card.querySelector(
                    'h3.base-search-card__title a, h3.base-search-card__title, ' +
                    '.job-card-list__title, .job-card-container__link, h3 a[href*="/jobs/view/"]'
                );
                const linkEl = card.querySelector(
                    'a.base-card__full-link, a[href*="/jobs/view/"], .job-card-list__title--link'
                );
                const companyEl = card.querySelector(
                    'h4.base-search-card__subtitle a, h4.base-search-card__subtitle, ' +
                    '.job-card-container__company-name, .artdeco-entity-lockup__subtitle'
                );
                const companyLinkEl = card.querySelector(
                    'h4.base-search-card__subtitle a, a[href*="/company/"]'
                );
                const locationEl = card.querySelector(
                    '.job-search-card__location, .job-card-container__metadata-item'
                );
                const easyApplyEl = card.querySelector(
                    '.job-search-card__easy-apply-label, [aria-label*="Easy Apply"]'
                );

                let jobUrl = linkEl ? (linkEl.href || linkEl.getAttribute('href') || '') : '';
                if (!jobUrl) return;
                if (!jobUrl.startsWith('http')) jobUrl = 'https://www.linkedin.com' + jobUrl;
                jobUrl = jobUrl.split('?')[0];
                if (!jobUrl.includes('/jobs/view/')) return;

                let companyUrl = companyLinkEl
                    ? (companyLinkEl.href || companyLinkEl.getAttribute('href') || '')
                    : '';
                if (companyUrl && !companyUrl.startsWith('http')) {
                    companyUrl = 'https://www.linkedin.com' + companyUrl;
                }
                companyUrl = companyUrl.split('?')[0];

                results.push({
                    title:      titleEl   ? titleEl.textContent.trim()   : '',
                    company:    companyEl ? companyEl.textContent.trim()  : 'Unknown',
                    companyUrl: companyUrl,
                    location:   locationEl ? locationEl.textContent.trim() : '',
                    jobUrl:     jobUrl,
                    easyApply:  !!(easyApplyEl || card.textContent.includes('Easy Apply')),
                });
            });

            const seen = new Set();
            return results.filter(j => {
                if (seen.has(j.jobUrl)) return false;
                seen.add(j.jobUrl);
                return true;
            });
        }
    """)


async def _scrape_person_profile_playwright(url: str) -> dict:
    from playwright.async_api import async_playwright

    async with async_playwright() as pw:
        browser, context = await _new_browser_context(pw)
        page = await context.new_page()
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=25000)
            await asyncio.sleep(2)

            if "login" in page.url or "authwall" in page.url:
                logger.info("LinkedIn auth wall — attempting login for person profile scrape...")
                ok = await _login(page)
                if ok:
                    await page.goto(url, wait_until="domcontentloaded", timeout=25000)
                    await asyncio.sleep(2)

            for _ in range(6):
                await page.keyboard.press("End")
                await asyncio.sleep(0.5)

            return await page.evaluate("""
                () => {
                    const t  = sel => document.querySelector(sel)?.textContent?.trim() || '';
                    const ts = sel => Array.from(document.querySelectorAll(sel))
                                           .map(el => el.textContent.trim()).filter(Boolean);
                    return {
                        name:       t('.pv-text-details__left-panel h1, .top-card-layout__title'),
                        headline:   t('.pv-text-details__left-panel .text-body-medium, .top-card-layout__headline'),
                        location:   t('.pv-text-details__left-panel .text-body-small:not(.inline), .top-card__subline-item'),
                        about:      t('#about ~ .pvs-list__outer-container .visually-hidden, .pv-shared-text-with-see-more span[aria-hidden]'),
                        experience: ts('#experience ~ .pvs-list .pvs-list__paged-list-item .display-flex span[aria-hidden]'),
                        education:  ts('#education  ~ .pvs-list .pvs-list__paged-list-item .display-flex span[aria-hidden]'),
                        skills:     ts('#skills     ~ .pvs-list .pvs-list__paged-list-item .display-flex span[aria-hidden]').slice(0, 30),
                    };
                }
            """)
        finally:
            await browser.close()


async def _scrape_company_playwright(url: str) -> dict:
    from playwright.async_api import async_playwright

    about_url = url.rstrip("/") + "/about/"
    async with async_playwright() as pw:
        browser, context = await _new_browser_context(pw)
        page = await context.new_page()
        try:
            await page.goto(about_url, wait_until="domcontentloaded", timeout=20000)
            await asyncio.sleep(1.5)
            if "login" in page.url or "authwall" in page.url:
                await _login(page)
                await page.goto(about_url, wait_until="domcontentloaded", timeout=20000)
                await asyncio.sleep(1.5)

            return await page.evaluate("""
                () => ({
                    about: document.querySelector(
                        '.org-about-us-organization-description__text, ' +
                        '.core-section-container__content p'
                    )?.textContent?.trim() || '',
                    size: document.querySelector(
                        '[data-test-id="about-us__size"] dd, ' +
                        '.org-about-company-module__company-size-definition-text'
                    )?.textContent?.trim() || '',
                    industry: document.querySelector(
                        '[data-test-id="about-us__industry"] dd, ' +
                        '.org-about-company-module__industry'
                    )?.textContent?.trim() || '',
                })
            """)
        finally:
            await browser.close()


async def _scrape_posts_playwright(url: str, max_posts: int) -> List[str]:
    from playwright.async_api import async_playwright

    recent_url = url.rstrip("/") + "/recent-activity/shares/"
    async with async_playwright() as pw:
        browser, context = await _new_browser_context(pw)
        page = await context.new_page()
        try:
            await page.goto(recent_url, wait_until="domcontentloaded", timeout=20000)
            await asyncio.sleep(1.5)
            if "login" in page.url or "authwall" in page.url:
                await _login(page)
                await page.goto(recent_url, wait_until="domcontentloaded", timeout=20000)
                await asyncio.sleep(1.5)

            return await page.evaluate("""
                (maxPosts) => {
                    const els = Array.from(document.querySelectorAll(
                        '.feed-shared-update-v2__description, .attributed-text-segment-list__content'
                    ));
                    return els.slice(0, maxPosts)
                               .map(el => el.textContent.trim())
                               .filter(t => t.length > 20);
                }
            """, max_posts)
        finally:
            await browser.close()


# ---------------------------------------------------------------------------
# Mapping
# ---------------------------------------------------------------------------

def _map_to_targets(raw: List[dict], role: str, location: str) -> List[TargetCompany]:
    targets = []
    for idx, job in enumerate(raw[:50]):
        job_url     = job.get("jobUrl", "")
        company_url = job.get("companyUrl") or ""
        if not job_url:
            continue

        scraped_loc = job.get("location") or location

        # Safety net: drop stale or geographically irrelevant results
        if not _is_recent(job.get("postedAt", "")):
            logger.debug(f"Filtered stale job: {job.get('title')} @ {job.get('company')}")
            continue
        if not _location_matches(scraped_loc, location):
            logger.debug(f"Filtered off-location job: {scraped_loc!r} vs {location!r}")
            continue

        if company_url and not company_url.startswith("http"):
            company_url = "https://www.linkedin.com" + company_url
        if not company_url:
            company_url = "https://www.linkedin.com/company/unknown"
        try:
            targets.append(TargetCompany(
                company_id=f"tgt_{int(datetime.now().timestamp() * 1000)}_{idx}",
                company_name=job.get("company", "Unknown Company"),
                company_linkedin=company_url,
                job_title=job.get("title") or role,
                job_url=job_url,
                apply_type="easy_apply" if job.get("easyApply") else "external",
                location=scraped_loc,
                status="pending",
            ))
        except Exception as exc:
            logger.debug(f"Skipping job entry: {exc}")
    return targets


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

async def _log_debug(
    module: str, function: str, params: dict,
    outcome: str, error: Optional[str] = None
) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_type = "ERROR" if error else "INFO"
    param_str = " ".join(f"{k}={v}" for k, v in params.items())
    entry = f"[{timestamp}] [{log_type}] module={module} function={function}\n  {param_str}\n"
    if error:
        entry += f"  error={error}\n"
    entry += f"  outcome={outcome}\n"
    try:
        log_path = Path(settings.DEBUG_LOG)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(entry)
    except Exception as exc:
        logger.error(f"Could not write debug.log: {exc}")
