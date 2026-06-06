import asyncio
import json
import logging
import time
from datetime import datetime
from pathlib import Path

from pydantic import ValidationError

from backend.config import settings
from backend.services.apify_service import scrape_company_profile, scrape_person_posts
from backend.services.groq_service import call_groq, _log_groq_decision
from backend.models.schemas import TargetCompany, HiringPersona
from backend.storage import json_store

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# CV HTML Template (LaTeX-inspired two-column layout)
# ---------------------------------------------------------------------------

_CV_TEMPLATE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    font-size: 9pt;
    line-height: 1.38;
    color: #1a1a2e;
    display: flex;
    height: 297mm;
    max-height: 297mm;
    overflow: hidden;
    background: #fff;
  }

  /* ════════════════ SIDEBAR ════════════════ */
  .sidebar {
    width: 185px;
    height: 297mm;
    background: #1c3050;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .photo-block {
    width: 185px;
    height: 185px;
    overflow: hidden;
    background: #152540;
    flex-shrink: 0;
  }
  .photo-block img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
    display: block;
  }
  .photo-initials {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 48pt;
    font-weight: 800;
    color: #4a90d9;
  }

  .sidebar-body { padding: 14px 12px 16px; overflow: hidden; }

  .s-section-title {
    font-size: 6pt;
    text-transform: uppercase;
    letter-spacing: 1.8px;
    color: #6aafdd;
    border-bottom: 1px solid #2a4a6e;
    padding-bottom: 3px;
    margin: 13px 0 7px;
  }
  .s-section-title:first-child { margin-top: 0; }

  .contact-row {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin-bottom: 5px;
  }
  .c-icon { font-size: 7.5pt; color: #6aafdd; flex-shrink: 0; margin-top: 0.5px; }
  .c-text { font-size: 7pt; color: #c2d8ee; word-break: break-all; line-height: 1.3; }

  .skill-item {
    font-size: 7.5pt;
    color: #c2d8ee;
    padding: 2px 0;
    border-bottom: 1px dotted #2a4a6e;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .skill-bullet { color: #4a90d9; font-size: 6.5pt; }

  .lang-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }
  .lang-name { font-size: 7.5pt; color: #c2d8ee; }
  .lang-level {
    font-size: 6.5pt;
    color: #4a90d9;
    background: #1a3a5c;
    border-radius: 8px;
    padding: 1px 5px;
  }

  /* ════════════════ MAIN ════════════════ */
  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

  .name-header {
    background: #f0f4fa;
    padding: 18px 22px 14px;
    border-bottom: 3px solid #1c3050;
    flex-shrink: 0;
  }
  .full-name {
    font-size: 20pt;
    font-weight: 800;
    color: #1c3050;
    letter-spacing: 0.3px;
    line-height: 1.1;
  }
  .job-headline {
    font-size: 9.5pt;
    color: #4a90d9;
    margin-top: 3px;
    font-weight: 400;
    letter-spacing: 0.2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .main-body { padding: 12px 22px 14px; overflow: hidden; }

  .section { margin-bottom: 12px; }
  .section-title {
    font-size: 7.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #1c3050;
    border-bottom: 2px solid #4a90d9;
    padding-bottom: 2px;
    margin-bottom: 8px;
  }

  .summary-text {
    font-size: 8pt;
    color: #3a3a4a;
    line-height: 1.55;
    text-align: justify;
  }

  .entry { margin-bottom: 8px; }
  .entry:last-child { margin-bottom: 0; }
  .entry-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }
  .entry-title {
    font-weight: 700;
    font-size: 9pt;
    color: #1c3050;
    line-height: 1.25;
  }
  .entry-date {
    font-size: 7pt;
    color: #7a8a9a;
    white-space: nowrap;
    font-style: italic;
    flex-shrink: 0;
  }
  .entry-sub {
    font-size: 8pt;
    color: #4a90d9;
    font-style: italic;
    margin: 1px 0 3px;
  }
  ul.bullets { margin: 3px 0 0 15px; }
  ul.bullets li {
    font-size: 8pt;
    margin-bottom: 2px;
    line-height: 1.35;
    color: #2a2a3a;
  }
  ul.bullets li::marker { color: #4a90d9; }
</style>
</head>
<body>

<!-- ═══════ SIDEBAR ═══════ -->
<div class="sidebar">

  <div class="photo-block">
    {% if profile_pic %}
    <img src="{{ profile_pic }}" alt="Profile photo">
    {% else %}
    <div class="photo-initials">{{ initial }}</div>
    {% endif %}
  </div>

  <div class="sidebar-body">

    <div class="s-section-title">Contact</div>

    {% if cv.header.email %}
    <div class="contact-row">
      <span class="c-icon">✉</span>
      <span class="c-text">{{ cv.header.email }}</span>
    </div>
    {% endif %}

    {% if cv.header.phone %}
    <div class="contact-row">
      <span class="c-icon">☎</span>
      <span class="c-text">{{ cv.header.phone }}</span>
    </div>
    {% endif %}

    {% if cv.header.location %}
    <div class="contact-row">
      <span class="c-icon">⌖</span>
      <span class="c-text">{{ cv.header.location }}</span>
    </div>
    {% endif %}

    {% for link in (cv.header.links | default([]))[:3] %}
    <div class="contact-row">
      <span class="c-icon">↗</span>
      <span class="c-text">{{ link | replace('https://', '') | replace('http://', '') }}</span>
    </div>
    {% endfor %}

    {% if cv.skills %}
    <div class="s-section-title">Technical Skills</div>
    {% for s in cv.skills[:8] %}
    <div class="skill-item">
      <span class="skill-bullet">▸</span>{{ s }}
    </div>
    {% endfor %}
    {% endif %}

    {% if cv.soft_skills %}
    <div class="s-section-title">Soft Skills</div>
    {% for s in cv.soft_skills[:5] %}
    <div class="skill-item">
      <span class="skill-bullet">▸</span>{{ s }}
    </div>
    {% endfor %}
    {% endif %}

    {% if cv.languages %}
    <div class="s-section-title">Languages</div>
    {% for lang in cv.languages %}
    <div class="lang-row">
      <span class="lang-name">{{ lang.language }}</span>
      <span class="lang-level">{{ lang.proficiency }}</span>
    </div>
    {% endfor %}
    {% endif %}

  </div>
</div>

<!-- ═══════ MAIN ═══════ -->
<div class="main">

  <div class="name-header">
    <div class="full-name">{{ cv.header.name | default('') }}</div>
    <div class="job-headline">{{ cv.header.headline | default('') }}</div>
  </div>

  <div class="main-body">

    {% if cv.summary %}
    <div class="section">
      <div class="section-title">Profile</div>
      <p class="summary-text">{{ cv.summary }}</p>
    </div>
    {% endif %}

    {% if cv.education %}
    <div class="section">
      <div class="section-title">Education</div>
      {% for edu in cv.education %}
      <div class="entry">
        <div class="entry-top">
          <span class="entry-title">{{ edu.institution | default('') }}</span>
          <span class="entry-date">{{ edu.date | default('') }}</span>
        </div>
        <div class="entry-sub">
          {{ edu.degree | default('') }}{% if edu.gpa %} — GPA {{ edu.gpa }}{% endif %}
        </div>
      </div>
      {% endfor %}
    </div>
    {% endif %}

    {% if cv.experience %}
    <div class="section">
      <div class="section-title">Experience</div>
      {% for exp in cv.experience %}
      <div class="entry">
        <div class="entry-top">
          <span class="entry-title">{{ exp.role | default('') }} — {{ exp.company | default('') }}</span>
          <span class="entry-date">{{ exp.date | default('') }}</span>
        </div>
        {% if exp.location %}<div class="entry-sub">{{ exp.location }}</div>{% endif %}
        {% if exp.bullet_points %}
        <ul class="bullets">
          {% for b in exp.bullet_points[:2] %}<li>{{ b }}</li>{% endfor %}
        </ul>
        {% endif %}
      </div>
      {% endfor %}
    </div>
    {% endif %}

    {% if cv.projects %}
    <div class="section">
      <div class="section-title">Projects</div>
      {% for proj in cv.projects %}
      <div class="entry">
        <div class="entry-top">
          <span class="entry-title">{{ proj.name | default('') }}</span>
        </div>
        {% if proj.description %}<div class="entry-sub">{{ proj.description }}</div>{% endif %}
        {% if proj.bullet_points %}
        <ul class="bullets">
          {% for b in proj.bullet_points[:2] %}<li>{{ b }}</li>{% endfor %}
        </ul>
        {% endif %}
      </div>
      {% endfor %}
    </div>
    {% endif %}

  </div>
</div>

</body>
</html>"""


# ---------------------------------------------------------------------------
# Cover Letter HTML Template
# ---------------------------------------------------------------------------

_CL_TEMPLATE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #1a1a2e;
    padding: 2.54cm; /* standard 1-inch margins */
    height: 297mm;
    max-height: 297mm;
    background: #fff;
    overflow: hidden;
  }
  .header {
    border-bottom: 2px solid #1c3050;
    padding-bottom: 15px;
    margin-bottom: 30px;
    text-align: center;
  }
  .name { font-size: 24pt; font-weight: 800; color: #1c3050; letter-spacing: 0.5px; }
  .contact-info { font-size: 10pt; color: #4a90d9; margin-top: 5px; }
  .date-company { margin-bottom: 30px; font-size: 10pt; color: #333; display: flex; justify-content: space-between; }
  .salutation { font-weight: bold; margin-bottom: 15px; font-size: 11pt; }
  .body-text p { margin-bottom: 15px; text-align: justify; }
  .sign-off { margin-top: 40px; }
  .sign-name { font-weight: bold; margin-top: 25px; }
</style>
</head>
<body>
  <div class="header">
    <div class="name">{{ cv.header.name | default('') }}</div>
    <div class="contact-info">
      {% if cv.header.email %}{{ cv.header.email }} | {% endif %}
      {% if cv.header.phone %}{{ cv.header.phone }}{% endif %}
    </div>
  </div>
  <div class="date-company">
    <span>{{ cv.header.date | default('') }}</span>
    <span><strong>Targeting:</strong> {{ cv.header.target_company | default('') }}</span>
  </div>
  <div class="salutation">
    {{ cv.salutation | default('Dear Hiring Manager,') }}
  </div>
  <div class="body-text">
    {% for p in cv.paragraphs %}
      <p>{{ p }}</p>
    {% endfor %}
  </div>
  <div class="sign-off">
    <p>{{ cv.sign_off | default('Sincerely,') }}</p>
    <div class="sign-name">{{ cv.header.name | default('') }}</div>
  </div>
</body>
</html>"""


# ---------------------------------------------------------------------------
# Harvard Resume HTML Template (single-column, classic black-and-white)
# ---------------------------------------------------------------------------

_RESUME_TEMPLATE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 1.5cm 1.8cm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 10.5pt;
    line-height: 1.32;
    color: #000;
    background: #fff;
  }
  .name {
    text-align: center;
    font-size: 19pt;
    font-weight: 700;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }
  .contact { text-align: center; font-size: 9.5pt; margin-bottom: 12px; }
  .section-title {
    font-size: 11pt;
    font-weight: 700;
    border-bottom: 1px solid #000;
    padding-bottom: 1px;
    margin: 11px 0 5px;
  }
  .entry { margin-bottom: 7px; }
  .row { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
  .left-bold { font-weight: 700; }
  .right { font-weight: 700; white-space: nowrap; }
  .left-italic { font-style: italic; }
  .right-italic { font-style: italic; white-space: nowrap; }
  ul { margin: 2px 0 0 18px; }
  li { margin-bottom: 1.5px; }
  .skills-line { margin-bottom: 2px; }
  .skills-line .cat { font-weight: 700; }
  .note { font-style: italic; }
</style>
</head>
<body>

<div class="name">{{ r.header.name | default('') }}</div>
<div class="contact">
  {% if r.header.address %}{{ r.header.address }} &bull; {% endif %}
  {% if r.header.email %}{{ r.header.email }}{% endif %}
  {% if r.header.phone %} &bull; {{ r.header.phone }}{% endif %}
  {% for l in (r.header.links | default([])) %} &bull; {{ l }}{% endfor %}
</div>

{% if r.education %}
<div class="section-title">Education</div>
{% for e in r.education %}
<div class="entry">
  <div class="row">
    <span class="left-bold">{{ e.institution | default('') }}</span>
    <span class="right">{{ e.location | default('') }}</span>
  </div>
  <div class="row">
    <span class="left-italic">{{ e.degree | default('') }}{% if e.gpa %}. GPA {{ e.gpa }}{% endif %}</span>
    <span class="right-italic">{{ e.graduation_date | default('') }}</span>
  </div>
  {% if e.notes %}<div class="note">{{ e.notes }}</div>{% endif %}
  {% if e.coursework %}<div>Relevant Coursework: {{ e.coursework }}</div>{% endif %}
</div>
{% endfor %}
{% endif %}

{% if r.experience %}
<div class="section-title">Experience</div>
{% for x in r.experience %}
<div class="entry">
  <div class="row">
    <span class="left-bold">{{ x.organization | default('') }}</span>
    <span class="right">{{ x.location | default('') }}</span>
  </div>
  <div class="row">
    <span class="left-italic">{{ x.title | default('') }}</span>
    <span class="right-italic">{{ x.dates | default('') }}</span>
  </div>
  {% if x.bullets %}<ul>{% for b in x.bullets %}<li>{{ b }}</li>{% endfor %}</ul>{% endif %}
</div>
{% endfor %}
{% endif %}

{% if r.leadership %}
<div class="section-title">Leadership &amp; Activities</div>
{% for a in r.leadership %}
<div class="entry">
  <div class="row">
    <span class="left-bold">{{ a.organization | default('') }}</span>
    <span class="right">{{ a.location | default('') }}</span>
  </div>
  {% if a.role or a.dates %}
  <div class="row">
    <span class="left-italic">{{ a.role | default('') }}</span>
    <span class="right-italic">{{ a.dates | default('') }}</span>
  </div>
  {% endif %}
  {% if a.bullets %}<ul>{% for b in a.bullets %}<li>{{ b }}</li>{% endfor %}</ul>{% endif %}
</div>
{% endfor %}
{% endif %}

{% if r.skills %}
<div class="section-title">Skills &amp; Interests</div>
{% if r.skills.technical %}<div class="skills-line"><span class="cat">Technical:</span> {{ r.skills.technical }}</div>{% endif %}
{% if r.skills.language %}<div class="skills-line"><span class="cat">Language:</span> {{ r.skills.language }}</div>{% endif %}
{% if r.skills.laboratory %}<div class="skills-line"><span class="cat">Laboratory:</span> {{ r.skills.laboratory }}</div>{% endif %}
{% if r.skills.interests %}<div class="skills-line"><span class="cat">Interests:</span> {{ r.skills.interests }}</div>{% endif %}
{% endif %}

</body>
</html>"""


# ---------------------------------------------------------------------------
# Profile slimmer — strips metadata/noise before sending to LLM
# ---------------------------------------------------------------------------

def _extract_skills_list(raw) -> list:
    """Flatten skills whether stored as list, list-of-dicts, or category dict."""
    if not raw:
        return []
    if isinstance(raw, list):
        result = []
        for s in raw:
            result.append(s.get("name", "") if isinstance(s, dict) else str(s))
        return [s for s in result if s][:16]
    if isinstance(raw, dict):
        result = []
        # technical and frameworks first — most relevant for ATS
        for key in ("technical", "frameworks", "tools", "soft"):
            items = raw.get(key) or []
            if isinstance(items, list):
                for item in items:
                    result.append(item.get("name", "") if isinstance(item, dict) else str(item))
        # catch any other keys
        for key, items in raw.items():
            if key not in ("technical", "frameworks", "tools", "soft") and isinstance(items, list):
                for item in items:
                    result.append(item.get("name", "") if isinstance(item, dict) else str(item))
        return [s for s in result if s][:16]
    return []


def _slim_profile(profile: dict) -> dict:
    """Return only CV-relevant fields from the full profile. Cuts token usage ~40%."""
    pi = profile.get("personal_info", {})
    contact = pi.get("contact", {})
    loc = pi.get("location", {})

    def trim_exp(e):
        # Support both profile schemas: work_experience uses responsibilities/achievements/tech_stack
        # while a pre-generated CV JSON uses bullet_points
        responsibilities = (e.get("responsibilities") or [])[:6]
        achievements = (e.get("achievements") or [])[:6]
        bullet_points = (e.get("bullet_points") or [])[:6]
        tech_stack = (e.get("tech_stack") or e.get("technologies") or [])[:8]
        return {
            "company":          e.get("company") or e.get("organization"),
            "role":             e.get("role") or e.get("title"),
            "start_date":       e.get("start_date"),
            "end_date":         e.get("end_date") or ("present" if e.get("is_current") else None),
            "location":         e.get("location"),
            "responsibilities": responsibilities,
            "achievements":     achievements,
            "bullet_points":    bullet_points,
            "tech_stack":       tech_stack,
        }

    def trim_edu(e):
        return {
            "institution": e.get("institution"),
            "degree":      e.get("degree"),
            "field":       e.get("field"),
            "start_date":  e.get("start_date"),
            "end_date":    e.get("end_date"),
            "grade":       e.get("grade") or e.get("gpa"),
        }

    def trim_proj(p):
        return {
            "name":         p.get("name"),
            "description":  p.get("description") or "",
            "technologies": p.get("technologies") or p.get("tech_stack") or [],
            "outcome":      p.get("outcome") or "",
            "url":          p.get("url") or "",
            "bullet_points": p.get("bullet_points") or [],
        }

    # soft_skills can live at root level or inside skills.soft (onboarding schema)
    soft = profile.get("soft_skills") or (profile.get("skills") or {}).get("soft") or []
    if isinstance(soft, dict):
        soft = list(soft.values())[:8]

    # work_experience is the key used by the onboarding schema;
    # experience is used by older/manual profile structures
    raw_exp = profile.get("work_experience") or profile.get("experience") or []

    return {
        "name":     pi.get("full_name"),
        "headline": pi.get("headline"),
        "location": f"{loc.get('city', '')}, {loc.get('country', '')}".strip(", "),
        "contact": {
            "email":    contact.get("email"),
            "phone":    contact.get("phone"),
            "linkedin": contact.get("linkedin"),
            "github":   contact.get("github"),
            "portfolio":contact.get("portfolio"),
        },
        "summary":        pi.get("summary") or "",
        "languages":      pi.get("languages", []),
        "education":      [trim_edu(e) for e in (profile.get("education") or [])[:4]],
        "experience":     [trim_exp(e) for e in raw_exp[:5]],
        "projects":       [trim_proj(p) for p in (profile.get("projects") or [])[:5]],
        "skills":         _extract_skills_list(profile.get("skills") or profile.get("technical_skills")),
        "soft_skills":    soft[:8],
        "certifications": [
            {"name": c.get("name"), "issuer": c.get("issuer"), "date": c.get("issued_date") or c.get("date")}
            for c in (profile.get("certifications") or [])[:5]
        ],
        "target_roles":   (profile.get("preferences_and_goals") or {}).get("target_roles", [])[:4],
        "strengths":      (profile.get("personality_and_work_style") or {}).get("strengths", [])[:5],
    }


# ---------------------------------------------------------------------------
# Harvard Resume builder — maps profile data directly into the Harvard blueprint
# ---------------------------------------------------------------------------

_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _fmt_month(d) -> str:
    """Format a profile date ('2025-04', '2024', 'present') as 'Apr 2025'."""
    import re
    if not d:
        return ""
    s = str(d).strip()
    if s.lower() in ("present", "current", "now"):
        return "Present"
    m = re.match(r"^(\d{4})-(\d{1,2})", s)
    if m:
        year, mo = m.group(1), int(m.group(2))
        return f"{_MONTHS[mo - 1]} {year}" if 1 <= mo <= 12 else year
    if re.match(r"^\d{4}$", s):
        return s
    return s


def build_resume_from_profile(profile: dict) -> dict:
    """Build a Harvard-format resume JSON straight from the candidate's profile.

    Deterministic — no LLM, no job description. Uses only data that exists in the
    profile so nothing is fabricated.
    """
    pi = profile.get("personal_info", {}) or {}
    contact = pi.get("contact", {}) or {}
    loc = pi.get("location", {}) or {}

    # ── Header ──
    city_country = ", ".join(p for p in (loc.get("city"), loc.get("country")) if p)
    links = []
    if contact.get("portfolio"):
        links.append(contact["portfolio"])
    if contact.get("linkedin"):
        links.append(contact["linkedin"].replace("https://", "").replace("http://", ""))
    header = {
        "name": pi.get("full_name") or "",
        "address": city_country,
        "email": contact.get("email") or "",
        "phone": contact.get("phone") or "",
        "links": links[:2],
    }

    # ── Education ──
    education = []
    for e in (profile.get("education") or []):
        deg = (e.get("degree") or "").strip()
        field = (e.get("field") or "").strip()
        if deg and field and field.lower() not in deg.lower():
            degree_line = f"{deg}, {field}"
        else:
            degree_line = deg or field
        education.append({
            "institution": e.get("institution") or "",
            "location": "",
            "degree": degree_line,
            "gpa": e.get("grade") or e.get("gpa") or "",
            "graduation_date": _fmt_month(e.get("end_date")),
            "notes": "",
            "coursework": "",
        })

    # ── Experience ──
    raw_exp = profile.get("work_experience") or profile.get("experience") or []
    experience = []
    for x in raw_exp:
        bullets = list(x.get("responsibilities") or []) + list(x.get("achievements") or [])
        if not bullets:
            bullets = list(x.get("bullet_points") or [])
        seen, deduped = set(), []
        for b in bullets:
            if b and b not in seen:
                seen.add(b)
                deduped.append(b)
        start = _fmt_month(x.get("start_date"))
        end = "Present" if x.get("is_current") else _fmt_month(x.get("end_date"))
        dates = " – ".join(d for d in (start, end) if d)
        experience.append({
            "organization": x.get("company") or x.get("organization") or "",
            "location": x.get("location") or "",
            "title": x.get("title") or x.get("role") or "",
            "dates": dates,
            "bullets": deduped[:5],
        })

    # ── Leadership & Activities (derived from projects — no dedicated profile field) ──
    leadership = []
    for p in (profile.get("projects") or [])[:4]:
        bl = [b for b in (p.get("description"), p.get("outcome")) if b]
        leadership.append({
            "organization": p.get("name") or "",
            "location": "",
            "role": "Project",
            "dates": "",
            "bullets": bl[:2],
        })

    # ── Skills & Interests ──
    sk = profile.get("skills") or {}
    technical = []
    if isinstance(sk, dict):
        for key in ("technical", "tools", "frameworks"):
            for item in (sk.get(key) or []):
                technical.append(item if isinstance(item, str) else item.get("name", ""))
    elif isinstance(sk, list):
        technical = [s if isinstance(s, str) else s.get("name", "") for s in sk]
    seen, tech = set(), []
    for t in technical:
        if t and t not in seen:
            seen.add(t)
            tech.append(t)
    lang_str = ", ".join(
        f"{l.get('language', '')} ({str(l.get('proficiency', '')).capitalize()})"
        for l in (pi.get("languages") or []) if l.get("language")
    )
    skills = {
        "technical": ", ".join(tech[:28]),
        "language": lang_str,
        "laboratory": "",
        "interests": "",
    }

    return {
        "header": header,
        "education": education,
        "experience": experience,
        "leadership": leadership,
        "skills": skills,
    }


# ---------------------------------------------------------------------------
# Research
# ---------------------------------------------------------------------------

async def _scrape_job_posting_text(job_url: str) -> str:
    """Fetch the raw text of a job posting. Tries LinkedIn guest API first, then direct GET."""
    import httpx
    from bs4 import BeautifulSoup

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/121.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }

    html = ""

    # LinkedIn guest job API — extract job ID from URL
    if "linkedin.com/jobs/view/" in job_url:
        try:
            job_id = job_url.rstrip("/").split("/jobs/view/")[1].split("/")[0].split("?")[0]
            api_url = f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}"
            async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
                resp = await client.get(api_url, headers=headers)
                if resp.status_code == 200:
                    html = resp.text
        except Exception as exc:
            logger.warning(f"LinkedIn job API failed ({exc}), falling back to direct GET")

    # Fallback: direct GET of whatever URL we have
    if not html:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(job_url, headers=headers)
            html = resp.text

    soup = BeautifulSoup(html, "html.parser")
    # Remove script/style noise
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    text = soup.get_text(separator=" ", strip=True)
    # Truncate to ~3000 chars to stay within token budget
    return text[:3000]


async def research_company(company_id: str, target: TargetCompany) -> HiringPersona:
    """Scrape the job posting and synthesize a HiringPersona via LLM."""
    logger.info(f"Starting research for company_id: {company_id}")

    job_posting_text = ""
    try:
        job_posting_text = await _scrape_job_posting_text(str(target.job_url))
        logger.info(f"Scraped job posting: {len(job_posting_text)} chars")
    except Exception as exc:
        logger.warning(f"Job posting scrape failed ({exc}), proceeding with minimal context")

    # Fall back to user-provided description if scraping yielded nothing
    if not job_posting_text and getattr(target, "job_description", None):
        job_posting_text = target.job_description
        logger.info("Using user-provided job description as fallback")

    # Build a compact context block even if scraping returned nothing
    context = (
        f"Company: {target.company_name}\n"
        f"Role: {target.job_title}\n"
        f"Location: {target.location}\n\n"
        f"Job Posting Content:\n{job_posting_text or '(not available)'}"
    )

    prompt_path = settings.BASE_DIR / "backend" / "prompts" / "persona_build.txt"
    with open(prompt_path, "r", encoding="utf-8") as f:
        prompt_template = f.read()

    system_prompt = prompt_template.replace("{job_posting_text}", context)

    persona_dict = await call_groq(
        system_prompt=system_prompt,
        user_message="Build the hiring persona for this job posting.",
        expect_json=True,
        purpose="synthesize_persona"
    )

    raw_persona = persona_dict
    try:
        persona = HiringPersona(**persona_dict)
    except ValidationError:
        logger.warning("HiringPersona validation failed, coercing.")
        persona = _coerce_persona(persona_dict)

    # Persist meta.json
    target_dir = json_store.get_applications_dir() / company_id
    target_dir.mkdir(parents=True, exist_ok=True)
    meta_path = target_dir / "meta.json"
    meta_content = {
        "company_id": company_id,
        "company_info": target.model_dump(mode="json"),
        "persona": persona.model_dump(mode="json"),
        "raw_persona_output": raw_persona,
        "scraped_data": {"job_posting_text": job_posting_text},
        "scraped_on": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    tmp = meta_path.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(meta_content, f, indent=2)
    tmp.replace(meta_path)

    return persona


async def generate_job_description(job_title: str) -> str:
    """Draft a realistic, industry-standard job description from a role title alone.

    Used by the Quick CV flow when the user leaves the description blank — a synthetic
    posting gives the persona builder and GAN loop real signal instead of nothing.
    """
    logger.info(f"Generating synthetic job description for '{job_title}'")
    prompt_path = settings.BASE_DIR / "backend" / "prompts" / "job_description_generate.txt"
    with open(prompt_path, "r", encoding="utf-8") as f:
        prompt_template = f.read()
    system_prompt = prompt_template.replace("{job_title}", job_title)

    try:
        result = await call_groq(
            system_prompt=system_prompt,
            user_message=f"Write the job description for the role: {job_title}",
            expect_json=False,
            purpose="generate_job_description",
        )
        return (result or "").strip()
    except Exception as exc:
        logger.warning(f"Job description generation failed ({exc}); proceeding without one")
        return ""


async def build_persona_from_description(
    company_id: str,
    job_title: str,
    job_description: str,
    company_name: str = "Target Role",
) -> HiringPersona:
    """Synthesize a HiringPersona directly from a pasted job description.

    Used by the Dashboard "Quick CV" flow — no company scraping, no targets.json
    entry. Persists a meta.json marked with `quick: True` so it can be listed and
    re-used (the GAN loop and explain endpoints read the same meta).

    If no description is provided, the AI drafts a realistic one from the title
    for sharper, more relevant tailoring.
    """
    logger.info(f"Building quick persona for {company_id} ({job_title})")

    if not (job_description or "").strip():
        job_description = await generate_job_description(job_title)

    context = (
        f"Company: {company_name}\n"
        f"Role: {job_title}\n\n"
        f"Job Posting Content:\n{job_description or '(not available)'}"
    )

    prompt_path = settings.BASE_DIR / "backend" / "prompts" / "persona_build.txt"
    with open(prompt_path, "r", encoding="utf-8") as f:
        prompt_template = f.read()
    system_prompt = prompt_template.replace("{job_posting_text}", context)

    persona_dict = await call_groq(
        system_prompt=system_prompt,
        user_message="Build the hiring persona for this job posting.",
        expect_json=True,
        purpose="synthesize_persona",
    )

    raw_persona = persona_dict
    try:
        persona = HiringPersona(**persona_dict)
    except ValidationError:
        logger.warning("HiringPersona validation failed, coercing.")
        persona = _coerce_persona(persona_dict)

    # Synthetic target keeps meta.json schema-consistent with the scraped flow
    target = TargetCompany(
        company_id=company_id,
        company_name=company_name,
        job_title=job_title,
        job_url="",
        job_description=job_description,
        apply_type="email",
        location="",
    )

    target_dir = json_store.get_applications_dir() / company_id
    target_dir.mkdir(parents=True, exist_ok=True)
    meta_path = target_dir / "meta.json"
    meta_content = {
        "company_id": company_id,
        "company_info": target.model_dump(mode="json"),
        "persona": persona.model_dump(mode="json"),
        "raw_persona_output": raw_persona,
        "scraped_data": {"job_posting_text": job_description},
        "scraped_on": time.strftime("%Y-%m-%d %H:%M:%S"),
        "quick": True,
        "job_title": job_title,
    }
    tmp = meta_path.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(meta_content, f, indent=2)
    tmp.replace(meta_path)

    return persona


def _clean_cover_letter(doc: dict) -> dict:
    """Strip em-dashes and en-dashes from cover letter text as a post-processing safety net."""
    if not doc or not isinstance(doc, dict):
        return doc
    fields = ["salutation", "sign_off"]
    for field in fields:
        val = doc.get(field)
        if isinstance(val, str):
            doc[field] = val.replace(" — ", ", ").replace("—", ", ").replace(" – ", " - ").replace("–", "-")
    paragraphs = doc.get("paragraphs")
    if isinstance(paragraphs, list):
        doc["paragraphs"] = [
            p.replace(" — ", ", ").replace("—", ", ").replace(" – ", " - ").replace("–", "-")
            if isinstance(p, str) else p
            for p in paragraphs
        ]
    return doc


# Tokens that signal a software/engineering role. Used to decide whether the
# GitHub link belongs on the CV — for design, video, marketing, etc. it doesn't.
_TECH_ROLE_SIGNALS = (
    "developer", "engineer", "software", "frontend", "front-end", "backend",
    "back-end", "full stack", "fullstack", "full-stack", "programmer", "devops",
    "data ", "machine learning", " ml", " ai", "cloud", "web ", "mobile", " qa",
    "automation", "api", "sre", "architect", "coding", "programming",
    "python", "javascript", "typescript", "react", "node", "tech",
)


def _coerce_text(val) -> str:
    """Flatten a value the LLM may have nested (e.g. summary as {"text": "..."}) into a plain string."""
    if val is None:
        return ""
    if isinstance(val, str):
        return val
    if isinstance(val, dict):
        for key in ("text", "summary", "value", "content"):
            if isinstance(val.get(key), str):
                return val[key]
        return " ".join(v for v in val.values() if isinstance(v, str))
    if isinstance(val, list):
        return " ".join(_coerce_text(v) for v in val)
    return str(val)


def _role_is_technical(persona: HiringPersona, company_name: str, doc: dict) -> bool:
    """Heuristic: does the target role involve software development?"""
    blob = " ".join([
        company_name or "",
        " ".join(persona.what_they_look_for or []),
        " ".join(persona.cultural_keywords or []),
        " ".join(s for s in (doc.get("skills") or []) if isinstance(s, str)),
    ]).lower()
    return any(sig in blob for sig in _TECH_ROLE_SIGNALS)


def _normalize_cv_doc(doc: dict, persona: HiringPersona, company_name: str) -> dict:
    """Repair LLM output before save/render: flatten nested text fields and drop
    irrelevant links (e.g. GitHub on a non-technical CV)."""
    if not doc or not isinstance(doc, dict):
        return doc

    # 1. Flatten summary if the model nested it as a dict/list
    doc["summary"] = _coerce_text(doc.get("summary"))

    header = doc.get("header")
    if isinstance(header, dict):
        # Headline can also come back nested occasionally
        header["headline"] = _coerce_text(header.get("headline"))

        # 2. Curate links: keep strings only; strip GitHub for non-technical roles
        links = header.get("links")
        if isinstance(links, list):
            clean = [l for l in links if isinstance(l, str) and l.strip()]
            if not _role_is_technical(persona, company_name, doc):
                clean = [l for l in clean if "github" not in l.lower()]
            header["links"] = clean

    return doc


def _coerce_persona(d: dict) -> HiringPersona:
    new = dict(d) if isinstance(d, dict) else {}
    for k in ("company_values", "what_they_look_for", "red_flags_to_avoid", "cultural_keywords"):
        v = new.get(k)
        if v is None:
            new[k] = []
        elif isinstance(v, str):
            new[k] = [s.strip() for s in v.split(",") if s.strip()]
        else:
            new[k] = list(v) if isinstance(v, (list, tuple)) else []
    if not isinstance(new.get("hr_communication_style"), str):
        new["hr_communication_style"] = "direct and outcome-focused"
    tp = str(new.get("tone_preference", "")).lower()
    if "form" in tp:
        new["tone_preference"] = "formal"
    elif "cas" in tp:
        new["tone_preference"] = "casual"
    else:
        new["tone_preference"] = "technical"
    # Coerce personality_traits — ensure all values are floats in 0.0–1.0
    pt = new.get("personality_traits")
    if isinstance(pt, dict):
        new["personality_traits"] = {
            k: max(0.0, min(1.0, float(v))) for k, v in pt.items()
            if isinstance(v, (int, float))
        }
    else:
        new["personality_traits"] = None
    try:
        return HiringPersona(**new)
    except ValidationError:
        return HiringPersona(
            company_values=["ownership"],
            hr_communication_style="direct and outcome-focused",
            what_they_look_for=["impact-oriented engineers"],
            red_flags_to_avoid=["lack of ownership"],
            cultural_keywords=["ownership"],
            tone_preference="technical",
            personality_traits=None
        )


# ---------------------------------------------------------------------------
# GAN Loop
# ---------------------------------------------------------------------------

async def run_gan_loop(
    company_id: str,
    profile: dict,
    persona: HiringPersona,
    doc_type: str,
    progress_callback=None,
    company_name: str = "",
) -> dict:
    """Generator/Discriminator loop for CV or Cover Letter generation."""
    prompts_dir = settings.BASE_DIR / "backend" / "prompts"
    if doc_type == "cv":
        gen_prompt_path = prompts_dir / "cv_generate.txt"
        score_prompt_path = prompts_dir / "cv_score.txt"
    elif doc_type == "cover_letter":
        gen_prompt_path = prompts_dir / "cover_letter_generate.txt"
        score_prompt_path = prompts_dir / "cover_letter_score.txt"
    else:
        raise ValueError("Invalid doc_type. Must be 'cv' or 'cover_letter'")

    with open(gen_prompt_path, "r", encoding="utf-8") as f:
        gen_sys_prompt = f.read()
    with open(score_prompt_path, "r", encoding="utf-8") as f:
        score_sys_prompt_template = f.read()

    pt_str = ", ".join(
        f"{k}: {v:.1f}" for k, v in (persona.personality_traits or {}).items()
    ) or "not specified"
    score_sys_prompt = (
        score_sys_prompt_template
        .replace("{hr_name_or_title}", persona.hr_communication_style or "HR Director")
        .replace("{company_name}", company_name or "the target company")
        .replace("{company_values}", ", ".join(persona.company_values))
        .replace("{personality_traits}", pt_str)
    )

    best_score = 0.0
    best_doc = None
    feedback_notes = "No previous feedback. This is the first attempt."
    iterations = []
    max_loops = settings.MAX_GAN_ITERATIONS

    for i in range(max_loops):
        iter_num = i + 1
        if progress_callback:
            await progress_callback(f"Generating {doc_type.upper()} (iteration {iter_num}/{max_loops})...")

        slim = _slim_profile(profile)
        target_role_hint = (
            f"TARGET ROLE: {company_name} — {', '.join(persona.what_they_look_for[:3]) if persona.what_they_look_for else 'see persona'}\n"
            f"DOMAIN KEYWORDS: {', '.join(persona.cultural_keywords[:6]) if persona.cultural_keywords else 'see persona'}\n\n"
        )
        cl_context = (
            f"Target Company: {company_name}\nToday's Date: {datetime.now().strftime('%B %Y')}\n\n"
            if doc_type == "cover_letter" and company_name else ""
        )
        gen_user_message = (
            f"{target_role_hint}"
            f"{cl_context}"
            f"Profile:\n{json.dumps(slim)}\n\n"
            f"Persona:\n{persona.model_dump_json()}\n\n"
            f"Feedback Notes:\n{feedback_notes}"
        )
        doc_json = await call_groq(
            system_prompt=gen_sys_prompt,
            user_message=gen_user_message,
            expect_json=True,
            purpose=f"generate_{doc_type}_iter_{iter_num}"
        )

        # Cover letters skip scoring — single-pass generation only
        if doc_type == "cover_letter":
            best_doc = doc_json
            best_score = 10.0
            if progress_callback:
                await progress_callback("✅ Cover letter generated.")
            break

        if progress_callback:
            await progress_callback(f"Scoring CV (iteration {iter_num})...")

        score_user_message = f"Evaluate this document:\n{json.dumps(doc_json)}"
        eval_result = await call_groq(
            system_prompt=score_sys_prompt,
            user_message=score_user_message,
            expect_json=True,
            purpose=f"score_{doc_type}_iter_{iter_num}"
        )

        score = float(eval_result.get("score", 0.0))
        notes = eval_result.get("notes", [])
        passed = eval_result.get("passed", False)

        _log_groq_decision(
            module="cv_service",
            function="run_gan_loop",
            purpose=f"gan_discriminator_{doc_type}",
            prompt_tokens=0, completion_tokens=0,
            model=settings.OPENROUTER_MODEL, success=True, attempt=iter_num,
            error=f"Score: {score}/10, Passed: {passed}"
        )

        iterations.append({
            "iteration": iter_num,
            "score": score,
            "notes": notes,
            "passed": passed
        })

        if best_doc is None or score > best_score:
            best_score = score
            best_doc = doc_json

        if passed or score >= settings.MIN_CV_SCORE:
            if progress_callback:
                await progress_callback(
                    f"✅ CV achieved {score}/10 in {iter_num} iterations."
                )
            break

        feedback_notes = (
            f"Previous draft scored {score}/10. Fix: "
            + "; ".join(notes) if notes else f"Previous draft scored {score}/10. Improve quality."
        )
        if progress_callback:
            await progress_callback(
                f"🔄 Score {score}/10 — refining: {notes[0] if notes else 'improving quality'}..."
            )

    # Normalize CV: flatten nested text fields (summary), curate links (drop GitHub on non-tech roles)
    if doc_type == "cv" and best_doc:
        best_doc = _normalize_cv_doc(best_doc, persona, company_name)

    # Humanize cover letter: strip em-dashes as a safety net on top of prompt rules
    if doc_type == "cover_letter" and best_doc:
        best_doc = _clean_cover_letter(best_doc)
        # Overwrite header fields the LLM often gets wrong
        if "header" in best_doc:
            best_doc["header"]["date"] = datetime.now().strftime("%B %Y")
            if company_name:
                best_doc["header"]["target_company"] = company_name

    # Inject profile picture from candidate profile
    if profile and "personal_info" in profile:
        contact = profile["personal_info"].get("contact", {})
        pic_url = contact.get("profile_picture")
        if pic_url and best_doc and "header" in best_doc:
            best_doc["header"]["profile_picture"] = pic_url

    # Persist final JSON + iterations
    target_dir = json_store.get_applications_dir() / company_id
    target_dir.mkdir(parents=True, exist_ok=True)

    out_path = target_dir / f"{doc_type}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(best_doc, f, indent=2)

    iter_path = target_dir / f"{doc_type}_iterations.json"
    with open(iter_path, "w", encoding="utf-8") as f:
        json.dump(iterations, f, indent=2)

    return {"doc": best_doc, "score": best_score, "iterations": iterations}


# ---------------------------------------------------------------------------
# PDF Rendering
# ---------------------------------------------------------------------------

def _fetch_image_base64(url: str) -> str:
    """Download image and return as base64 data-URI. Returns '' on failure."""
    try:
        import requests as req, base64
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/121.0.0.0 Safari/537.36"
            ),
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            "Referer": "https://www.linkedin.com/",
        }
        resp = req.get(url, timeout=10, headers=headers)
        if resp.status_code == 200:
            ct = resp.headers.get("content-type", "image/jpeg").split(";")[0]
            data = base64.b64encode(resp.content).decode()
            return f"data:{ct};base64,{data}"
    except Exception as exc:
        logger.warning(f"Could not fetch profile picture as base64: {exc}")
    return ""


def _render_pdf_sync(html_content: str, output_path: str) -> None:
    """Render HTML to PDF using Playwright sync API (runs in executor thread)."""
    from playwright.sync_api import sync_playwright

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-gpu",
                "--disable-dev-shm-usage",
                "--disable-web-security",
            ],
        )
        try:
            page = browser.new_page()
            page.set_content(html_content, wait_until="domcontentloaded")
            # Wait for images to load (profile photo)
            page.wait_for_timeout(1500)
            page.emulate_media(media="print")
            page.pdf(
                path=output_path,
                format="A4",
                print_background=True,
                margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
            )
        finally:
            browser.close()


async def render_cv_to_pdf(cv_json: dict, output_path: str, doc_type: str = "cv") -> str:
    """Render a CV/Cover Letter JSON dict to a PDF file via Playwright."""
    from jinja2 import Environment, BaseLoader

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    # Resolve profile picture: prefer local uploaded avatar, then fall back to URL in profile
    import base64 as _b64
    from backend.storage import json_store as _store

    profile_pic: str = ""

    # 1. Check for local avatar file in the active user's directory
    user_dir = _store._user_data_dir()
    for ext in ("jpg", "jpeg", "png", "webp", "gif"):
        avatar_path = user_dir / f"avatar.{ext}"
        if avatar_path.exists():
            try:
                raw = avatar_path.read_bytes()
                mime = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"
                profile_pic = f"data:{mime};base64,{_b64.b64encode(raw).decode()}"
            except Exception as exc:
                logger.warning(f"Could not read local avatar: {exc}")
            break

    # 2. Fall back to URL stored in the CV header (e.g. LinkedIn photo)
    if not profile_pic:
        pic_url = (cv_json.get("header") or {}).get("profile_picture", "")
        if pic_url:
            loop = asyncio.get_running_loop()
            profile_pic = await loop.run_in_executor(None, _fetch_image_base64, pic_url)
            if not profile_pic:
                profile_pic = pic_url

    # Derive initial letter for placeholder
    name = (cv_json.get("header") or {}).get("name", "")
    initial = name[0].upper() if name else "Z"

    env = Environment(loader=BaseLoader(), autoescape=False)
    if doc_type == "cv":
        template_html = _CV_TEMPLATE
    elif doc_type == "resume":
        template_html = _RESUME_TEMPLATE
    else:
        template_html = _CL_TEMPLATE
    template = env.from_string(template_html)
    rendered_html = template.render(cv=cv_json, r=cv_json, profile_pic=profile_pic, initial=initial)

    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _render_pdf_sync, rendered_html, output_path)

    # Verify output is non-empty
    pdf_path = Path(output_path)
    if not pdf_path.exists() or pdf_path.stat().st_size == 0:
        raise RuntimeError(
            f"PDF rendering produced an empty file at {output_path}. "
            "Ensure Playwright Chromium is installed: `playwright install chromium`"
        )

    logger.info(f"PDF rendered successfully: {output_path} ({pdf_path.stat().st_size} bytes)")
    return output_path
