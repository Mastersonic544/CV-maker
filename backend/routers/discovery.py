import logging
import json
import re
import time
from typing import Literal, Optional
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel, Field

from backend.storage import json_store
from backend.services.groq_service import call_groq
from backend.services.apify_service import scrape_linkedin_jobs
from backend.models.schemas import TargetCompany
from backend.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


def _flatten_skills(raw) -> list:
    if not raw:
        return []
    if isinstance(raw, list):
        return [s.get("name", "") if isinstance(s, dict) else str(s) for s in raw if s][:10]
    if isinstance(raw, dict):
        result = []
        for items in raw.values():
            if isinstance(items, list):
                for item in items:
                    result.append(item.get("name", "") if isinstance(item, dict) else str(item))
        return [s for s in result if s][:10]
    return []


class ScrapeRequest(BaseModel):
    role: str = Field(..., description="The job title or keywords to search for.")
    location: str = Field(..., description="City, country, or 'remote'.")
    radius_km: int = Field(25, description="Search radius around location.")


class FinalizeTargetsRequest(BaseModel):
    ids: list[str] = Field(..., description="List of company_ids to keep.")


class ManualTargetRequest(BaseModel):
    company_name: str = Field(..., description="Company name.")
    job_title: str = Field(..., description="Role you are applying for.")
    job_url: str = Field(..., description="Direct URL to the job posting.")
    location: str = Field(..., description="Job location or 'Remote'.")
    apply_type: Literal["email", "external"] = Field("email")
    company_linkedin: Optional[str] = Field(None)
    company_website: Optional[str] = Field(None)
    hr_name: Optional[str] = Field(None)
    hr_email: Optional[str] = Field(None)
    hr_linkedin: Optional[str] = Field(None)
    ceo_name: Optional[str] = Field(None)
    ceo_linkedin: Optional[str] = Field(None)
    job_description: Optional[str] = Field(None)


class UpdateTargetRequest(BaseModel):
    company_name: Optional[str] = Field(None)
    job_title: Optional[str] = Field(None)
    job_url: Optional[str] = Field(None)
    location: Optional[str] = Field(None)
    apply_type: Optional[Literal["email", "external"]] = Field(None)
    company_linkedin: Optional[str] = Field(None)
    company_website: Optional[str] = Field(None)
    hr_name: Optional[str] = Field(None)
    hr_email: Optional[str] = Field(None)
    hr_linkedin: Optional[str] = Field(None)
    ceo_name: Optional[str] = Field(None)
    ceo_linkedin: Optional[str] = Field(None)
    job_description: Optional[str] = Field(None)


def _ensure_https(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    url = url.strip()
    if not url.startswith("http"):
        url = "https://" + url
    return url


@router.get("/suggest-roles")
async def suggest_roles():
    try:
        profile_data = json_store.read_raw_profile()
        pi = profile_data.get("personal_info", {})
        slim = {
            "headline":   pi.get("headline"),
            "summary":    (pi.get("summary") or "")[:200],
            "skills":     _flatten_skills(profile_data.get("skills") or profile_data.get("technical_skills")),
            "experience": [
                {"role": e.get("role") or e.get("title"), "company": e.get("company")}
                for e in (profile_data.get("experience") or [])[:4]
            ],
            "education":  [
                {"degree": e.get("degree"), "field": e.get("field")}
                for e in (profile_data.get("education") or [])[:2]
            ],
        }
        profile_json = json.dumps(slim)
    except Exception as e:
        logger.error(f"Failed to read profile for role suggestion: {e}")
        raise HTTPException(status_code=500, detail="Could not read profile data.")

    try:
        prompt_path = settings.BASE_DIR / "backend" / "prompts" / "role_suggest.txt"
        with open(prompt_path, "r", encoding="utf-8") as f:
            system_prompt = f.read()
    except Exception as e:
        logger.error(f"Failed to load role_suggest.txt: {e}")
        raise HTTPException(status_code=500, detail="Missing prompt configuration.")

    user_message = f"Please analyze my profile and suggest roles:\n\n{profile_json}"

    try:
        suggestions = await call_groq(
            system_prompt=system_prompt,
            user_message=user_message,
            expect_json=True,
            purpose="suggest_roles"
        )
        if isinstance(suggestions, list):
            return suggestions
        if isinstance(suggestions, dict):
            for key in ("value", "roles", "suggestions", "data", "results", "items"):
                if key in suggestions and isinstance(suggestions[key], list):
                    return suggestions[key]
            for v in suggestions.values():
                if isinstance(v, list):
                    return v
        return suggestions
    except ValueError as e:
        logger.error(f"Groq returned malformed JSON: {e}")
        raise HTTPException(status_code=502, detail="AI returned malformed response.")
    except Exception as e:
        logger.error(f"Groq call failed: {e}")
        raise HTTPException(status_code=502, detail="Failed to communicate with AI.")


async def _filter_targets_by_language(targets: list[TargetCompany], langs: list[str]) -> list[TargetCompany]:
    if not langs or not targets:
        return targets
        
    prompt_path = settings.BASE_DIR / "backend" / "prompts" / "language_filter.txt"
    if not prompt_path.exists():
        return targets
        
    with open(prompt_path, "r", encoding="utf-8") as f:
        system_prompt = f.read().format(languages=", ".join(langs))
        
    targets_data = [{"company_id": t.company_id, "location": t.location, "title": t.job_title} for t in targets]
    user_message = json.dumps(targets_data)
    
    try:
        response = await call_groq(
            system_prompt=system_prompt,
            user_message=user_message,
            expect_json=True,
            purpose="filter_languages"
        )
        kept_ids = set(response.get("kept_company_ids", []))
        if not kept_ids:
            return targets
        filtered = [t for t in targets if t.company_id in kept_ids]
        return filtered if filtered else targets
    except Exception as e:
        logger.error(f"Error checking languages with LLM: {e}")
        return targets


def _extract_skills(profile_data: dict) -> list:
    raw = profile_data.get("skills") or profile_data.get("technical_skills") or {}
    if isinstance(raw, list):
        return [s.get("name", "") if isinstance(s, dict) else str(s) for s in raw if s][:20]
    if isinstance(raw, dict):
        result = []
        for items in raw.values():
            if isinstance(items, list):
                for item in items:
                    result.append(item.get("name", "") if isinstance(item, dict) else str(item))
        return [s for s in result if s][:20]
    return []


@router.post("/scrape")
async def scrape_jobs(params: ScrapeRequest):
    try:
        # Extract profile context for relevance scoring and filter params
        profile_skills: list = []
        work_experience: list = []
        preferences: dict = {}
        try:
            profile_data = json_store.read_raw_profile()
            profile_skills  = _extract_skills(profile_data)
            work_experience = profile_data.get("work_experience") or profile_data.get("experience") or []
            preferences     = profile_data.get("preferences_and_goals") or {}
        except Exception as profile_err:
            logger.warning(f"Could not read profile for scrape context: {profile_err}")

        targets = await scrape_linkedin_jobs(
            role=params.role,
            location=params.location,
            radius_km=params.radius_km,
            profile_skills=profile_skills,
            work_experience=work_experience,
            preferences=preferences,
        )
        
        try:
            langs = [
                l.get("language") for l in profile_data.get("personal_info", {}).get("languages", [])
                if l.get("language")
            ]
            if langs:
                targets = await _filter_targets_by_language(targets, langs)
        except Exception as filter_err:
            logger.warning(f"Failed to filter targets by language: {filter_err}")

        # Preserve manually added targets so a new scrape doesn't wipe them
        try:
            existing = json_store.read_targets()
            manual = [t for t in existing if t.company_id.startswith("manual_")]
            scraped_ids = {t.company_id for t in targets}
            for m in manual:
                if m.company_id not in scraped_ids:
                    targets.append(m)
        except Exception:
            pass

        json_store.write_targets(targets)
        return {
            "count": len(targets),
            "preview": [t.model_dump(mode="json") for t in targets]
        }
    except Exception as e:
        logger.error(f"Failed to scrape jobs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/targets")
async def get_targets():
    try:
        targets = json_store.read_targets()
        return [t.model_dump(mode="json") for t in targets]
    except Exception as e:
        logger.error(f"Failed to read targets: {e}")
        raise HTTPException(status_code=500, detail="Could not read targets.")


@router.post("/targets/finalize")
async def finalize_targets(req: FinalizeTargetsRequest):
    try:
        targets = json_store.read_targets()
        selected_ids = set(req.ids)
        for t in targets:
            t.status = "pending" if t.company_id in selected_ids else "ignored"
        json_store.write_targets(targets)
        return {"status": "success", "count": len(targets)}
    except Exception as e:
        logger.error(f"Failed to finalize targets: {e}")
        raise HTTPException(status_code=500, detail="Could not finalize targets.")


@router.post("/targets/manual")
async def add_manual_target(req: ManualTargetRequest):
    """Add a job listing manually without scraping."""
    try:
        slug = re.sub(r"[^a-z0-9]+", "-", req.company_name.lower()).strip("-")[:24]
        company_id = f"manual_{int(time.time())}_{slug}"

        linkedin_url = _ensure_https(req.company_linkedin)
        if not linkedin_url:
            linkedin_url = f"https://www.linkedin.com/company/{slug}"

        target = TargetCompany(
            company_id=company_id,
            company_name=req.company_name,
            company_linkedin=linkedin_url,
            company_website=_ensure_https(req.company_website),
            hr_name=req.hr_name or None,
            hr_email=req.hr_email or None,
            hr_linkedin=_ensure_https(req.hr_linkedin),
            ceo_name=req.ceo_name or None,
            ceo_linkedin=_ensure_https(req.ceo_linkedin),
            job_title=req.job_title,
            job_url=_ensure_https(req.job_url) or req.job_url,
            job_description=req.job_description or None,
            apply_type=req.apply_type,
            location=req.location,
            status="pending"
        )

        existing = json_store.read_targets()
        existing.append(target)
        json_store.write_targets(existing)

        return target.model_dump(mode="json")
    except Exception as e:
        logger.error(f"Failed to add manual target: {e}")
        raise HTTPException(status_code=400, detail=str(e))


_NORMALIZE_PROMPT = """You are a data normalizer. The user will paste raw JSON from an Apify LinkedIn job scraper (or any similar source). The format is unpredictable.

Your job: extract every job listing from the JSON and return a JSON array where each item has ONLY these fields (omit any field you cannot find):
- company_name (string, required)
- job_title (string, required)
- job_url (string, required — the direct URL to the job posting)
- location (string, required)
- apply_type (string: "external" or "email", default "email")
- company_linkedin (string or null — company LinkedIn URL)
- company_website (string or null)
- hr_name (string or null)
- hr_email (string or null)
- job_description (string or null — full job description text if present)

Return ONLY a raw JSON array, no explanation, no markdown fences."""


def _extract_one(item: dict) -> dict | None:
    """Try to extract a single job dict from an arbitrary item. Returns None if required fields missing."""
    if not isinstance(item, dict):
        return None

    company_raw = item.get("company")

    company_name = (
        item.get("companyName") or item.get("company_name") or
        item.get("organizationName") or item.get("employer") or
        item.get("hiringOrganization") or
        (company_raw.get("name") if isinstance(company_raw, dict) else None) or
        (company_raw if isinstance(company_raw, str) else None)
    )

    job_title = (
        item.get("title") or item.get("jobTitle") or item.get("job_title") or
        item.get("positionName") or item.get("name") or item.get("position")
    )

    job_url = (
        item.get("url") or item.get("jobUrl") or item.get("job_url") or
        item.get("applyUrl") or item.get("link") or item.get("jobLink") or
        item.get("shareUrl") or item.get("externalApplyLink")
    )

    if not company_name or not job_title or not job_url:
        return None

    location = (
        item.get("location") or item.get("jobLocation") or
        item.get("locationName") or item.get("formattedLocation") or "Remote"
    )

    company_linkedin = (
        item.get("companyUrl") or item.get("company_linkedin") or
        item.get("companyLinkedinUrl") or
        (company_raw.get("url") if isinstance(company_raw, dict) else None)
    )

    return {
        "company_name": str(company_name).strip(),
        "job_title": str(job_title).strip(),
        "job_url": str(job_url).strip(),
        "location": str(location).strip(),
        "apply_type": item.get("apply_type") or "email",
        "company_linkedin": str(company_linkedin).strip() if company_linkedin else None,
        "company_website": item.get("companyWebsite") or item.get("company_website"),
        "hr_name": item.get("hrName") or item.get("hr_name"),
        "hr_email": item.get("hrEmail") or item.get("hr_email"),
        "job_description": (
            item.get("description") or item.get("jobDescription") or
            item.get("job_description") or item.get("descriptionText")
        ),
    }


def _try_normalize_directly(items: list) -> list[dict] | None:
    """Try to map items to our schema without LLM.
    Returns list of normalized items (may be partial), or None if no items could be parsed."""
    results = [r for item in items if isinstance(item, dict) for r in [_extract_one(item)] if r]
    return results if results else None


@router.post("/targets/import-json")
async def import_json_targets(body: dict = Body(...)):
    """Import job listings from raw Apify JSON, normalizing via LLM if needed."""
    raw = body.get("json_data", "")
    if not raw:
        raise HTTPException(status_code=422, detail="json_data is required.")

    # Parse JSON
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=422, detail=f"Invalid JSON: {e}")

    items = parsed if isinstance(parsed, list) else [parsed]

    # Try direct normalization first
    normalized = _try_normalize_directly(items)

    # Fall back to LLM normalization
    if normalized is None:
        try:
            result = await call_groq(
                system_prompt=_NORMALIZE_PROMPT,
                user_message=json.dumps(items[:30]),  # cap at 30 items to stay within token budget
                expect_json=True,
                purpose="generate_normalize_jobs",
            )
            normalized = result if isinstance(result, list) else result.get("jobs", result.get("results", []))
        except Exception as e:
            logger.error(f"LLM normalization failed: {e}")
            raise HTTPException(status_code=502, detail="Could not normalize the JSON. Please check the format.")

    if not normalized:
        raise HTTPException(status_code=422, detail="No valid job listings found in the JSON.")

    # Build TargetCompany objects and save
    existing = json_store.read_targets()
    existing_urls = {t.job_url for t in existing}
    added = []

    for item in normalized:
        if not isinstance(item, dict):
            continue
        company_name = (item.get("company_name") or "").strip()
        job_title = (item.get("job_title") or "").strip()
        job_url = (item.get("job_url") or "").strip()
        location = (item.get("location") or "Remote").strip()

        if not company_name or not job_title or not job_url:
            continue
        if job_url in existing_urls:
            continue

        slug = re.sub(r"[^a-z0-9]+", "-", company_name.lower()).strip("-")[:24]
        company_id = f"manual_{int(time.time())}_{slug}"

        company_linkedin = _ensure_https(item.get("company_linkedin"))
        if not company_linkedin:
            company_linkedin = f"https://www.linkedin.com/company/{slug}"

        target = TargetCompany(
            company_id=company_id,
            company_name=company_name,
            company_linkedin=company_linkedin,
            company_website=_ensure_https(item.get("company_website")),
            hr_name=item.get("hr_name") or None,
            hr_email=item.get("hr_email") or None,
            hr_linkedin=None,
            ceo_name=None,
            ceo_linkedin=None,
            job_title=job_title,
            job_url=_ensure_https(job_url) or job_url,
            job_description=item.get("job_description") or None,
            apply_type=item.get("apply_type", "email"),
            location=location,
            status="pending",
        )
        existing.append(target)
        existing_urls.add(job_url)
        added.append(target)

    json_store.write_targets(existing)
    return {
        "added": len(added),
        "targets": [t.model_dump(mode="json") for t in added],
    }


@router.patch("/targets/{company_id}")
async def update_target(company_id: str, req: UpdateTargetRequest):
    """Update editable fields of an existing target. Invalidates the HR persona so it rebuilds on next generation."""
    try:
        targets = json_store.read_targets()
        target = next((t for t in targets if t.company_id == company_id), None)
        if not target:
            raise HTTPException(status_code=404, detail="Target not found.")

        updates = req.model_dump(exclude_none=True)
        for field, val in updates.items():
            # Treat empty strings as None for URL/name fields
            if isinstance(val, str) and val.strip() == "":
                val = None
            setattr(target, field, val)

        json_store.write_targets(targets)

        # Invalidate persona + iteration data so next generation rebuilds from fresh info
        app_dir = json_store.get_applications_dir() / company_id
        for fname in ("meta.json", "cv_iterations.json", "cover_letter_iterations.json"):
            fpath = app_dir / fname
            try:
                if fpath.exists():
                    fpath.unlink()
            except Exception:
                pass

        return target.model_dump(mode="json")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update target {company_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/targets/{company_id}")
async def delete_target(company_id: str):
    """Remove a target from the list."""
    try:
        targets = json_store.read_targets()
        updated = [t for t in targets if t.company_id != company_id]
        if len(updated) == len(targets):
            raise HTTPException(status_code=404, detail="Target not found.")
        json_store.write_targets(updated)
        return {"status": "deleted", "company_id": company_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete target: {e}")
        raise HTTPException(status_code=500, detail=str(e))
