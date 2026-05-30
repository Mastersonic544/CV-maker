"""
Multi-user management service.

Directory layout:
  data/users.json          — list of user metadata dicts
  data/.active_user        — contains the active user_id string
  data/users/{user_id}/    — per-user data root
    profile.json
    targets.json
    history.json
    api_keys.enc
    applications/
    interview_sessions/
"""
import json
import logging
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Path constants
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent.parent
USERS_INDEX = BASE_DIR / "data" / "users.json"
ACTIVE_USER_FILE = BASE_DIR / "data" / ".active_user"
USERS_DIR = BASE_DIR / "data" / "users"

SUPPORTED_KEYS = [
    {"key": "OPENROUTER_API_KEY", "label": "OpenRouter API Key", "service": "openrouter"},
    {"key": "GROQ_API_KEY", "label": "Groq API Key (fallback)", "service": "groq"},
    {"key": "LINKEDIN_EMAIL", "label": "LinkedIn Email", "service": "linkedin"},
    {"key": "LINKEDIN_PASSWORD", "label": "LinkedIn Password", "service": "linkedin"},
    {"key": "SMTP_USER", "label": "Sending Email Address", "service": "smtp"},
    {"key": "SMTP_PASSWORD", "label": "Gmail App Password", "service": "smtp"},
    {"key": "SENDER_NAME", "label": "Your Full Name", "service": "sender"},
]

# ---------------------------------------------------------------------------
# Low-level helpers
# ---------------------------------------------------------------------------

def _atomic_write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.flush()
            os.fsync(f.fileno())
        shutil.move(str(tmp), str(path))
    except Exception:
        if tmp.exists():
            tmp.unlink()
        raise


def _atomic_write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    try:
        tmp.write_text(text, encoding="utf-8")
        shutil.move(str(tmp), str(path))
    except Exception:
        if tmp.exists():
            tmp.unlink()
        raise


# ---------------------------------------------------------------------------
# User CRUD
# ---------------------------------------------------------------------------

def get_users() -> list[dict]:
    """Return list of user metadata dicts. Returns [] if file doesn't exist."""
    if not USERS_INDEX.exists():
        return []
    try:
        return json.loads(USERS_INDEX.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.error(f"Failed to read users.json: {exc}")
        return []


def save_users(users: list[dict]) -> None:
    """Atomically write the users list to users.json."""
    _atomic_write_json(USERS_INDEX, users)


def get_user(user_id: str) -> dict | None:
    """Return a single user dict by user_id, or None if not found."""
    for u in get_users():
        if u.get("user_id") == user_id:
            return u
    return None


def create_user(name: str, avatar_color: str = "#6C63FF") -> dict:
    """
    Create a new user, persist to users.json, and create their directory tree.
    Returns the new user dict.
    """
    user_id = f"usr_{uuid4().hex[:12]}"
    user = {
        "user_id": user_id,
        "name": name,
        "avatar_color": avatar_color,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "onboarding_complete": False,
        "apis_configured": False,
    }

    # Create directory structure
    user_dir = USERS_DIR / user_id
    (user_dir / "applications").mkdir(parents=True, exist_ok=True)
    (user_dir / "interview_sessions").mkdir(parents=True, exist_ok=True)

    users = get_users()
    users.append(user)
    save_users(users)

    logger.info(f"Created user {user_id} ({name})")
    return user


def update_user(user_id: str, fields: dict) -> dict:
    """
    Update arbitrary fields on an existing user.
    Returns the updated user dict. Raises ValueError if not found.
    """
    users = get_users()
    for i, u in enumerate(users):
        if u.get("user_id") == user_id:
            users[i].update(fields)
            save_users(users)
            return users[i]
    raise ValueError(f"User {user_id} not found")


def delete_user(user_id: str) -> None:
    """
    Remove the user from users.json and delete their data directory.
    """
    users = get_users()
    users = [u for u in users if u.get("user_id") != user_id]
    save_users(users)

    user_dir = USERS_DIR / user_id
    if user_dir.exists():
        shutil.rmtree(user_dir)

    logger.info(f"Deleted user {user_id}")


# ---------------------------------------------------------------------------
# Active-user management
# ---------------------------------------------------------------------------

def get_active_user_id() -> str | None:
    """Return the active user_id string, or None if not set."""
    if not ACTIVE_USER_FILE.exists():
        return None
    uid = ACTIVE_USER_FILE.read_text(encoding="utf-8").strip()
    return uid or None


def set_active_user(user_id: str) -> None:
    """Write user_id to the .active_user file."""
    _atomic_write_text(ACTIVE_USER_FILE, user_id)


def get_user_data_dir(user_id: str) -> Path:
    """Return the data directory Path for the given user_id."""
    return USERS_DIR / user_id


# ---------------------------------------------------------------------------
# Migration: single-user → multi-user
# ---------------------------------------------------------------------------

def migrate_existing_data() -> None:
    """
    If data/users.json doesn't exist but data/profile.json does, create a
    default user from the existing profile and migrate all legacy data into
    the new per-user directory.
    """
    if USERS_INDEX.exists():
        return  # Already migrated

    legacy_profile = BASE_DIR / "data" / "profile.json"
    if not legacy_profile.exists():
        # Nothing to migrate; initialise an empty users.json so we don't retry
        save_users([])
        return

    logger.info("Migrating existing single-user data to multi-user layout…")

    # Determine the user's name from profile.json
    try:
        profile_data = json.loads(legacy_profile.read_text(encoding="utf-8"))
        personal = profile_data.get("personal_info", {})
        name = (
            personal.get("full_name")
            or personal.get("name")
            or "Default User"
        )
    except Exception:
        name = "Default User"

    # Create the user record and directories
    user = create_user(name=name)
    user_id = user["user_id"]
    user_dir = USERS_DIR / user_id

    # Copy legacy files if they exist
    _copy_if_exists(legacy_profile, user_dir / "profile.json")
    _copy_if_exists(BASE_DIR / "data" / "targets.json", user_dir / "targets.json")
    _copy_if_exists(BASE_DIR / "data" / "history.json", user_dir / "history.json")

    # Copy legacy applications directory
    _copy_dir_if_exists(
        BASE_DIR / "data" / "applications",
        user_dir / "applications",
    )

    # Copy legacy interview_sessions directory
    _copy_dir_if_exists(
        BASE_DIR / "data" / "interview_sessions",
        user_dir / "interview_sessions",
    )

    # Mark as active user and onboarding complete (they have a profile)
    set_active_user(user_id)
    update_user(user_id, {"onboarding_complete": True})

    logger.info(f"Migration complete. Active user: {user_id}")


def _copy_if_exists(src: Path, dst: Path) -> None:
    if src.exists() and src.is_file():
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)


def _copy_dir_if_exists(src: Path, dst: Path) -> None:
    if src.exists() and src.is_dir():
        # Copy contents rather than the directory itself
        dst.mkdir(parents=True, exist_ok=True)
        for item in src.iterdir():
            target = dst / item.name
            if item.is_dir():
                shutil.copytree(item, target, dirs_exist_ok=True)
            else:
                shutil.copy2(item, target)


# ---------------------------------------------------------------------------
# API Keys
# ---------------------------------------------------------------------------

def _api_keys_path(user_id: str) -> Path:
    return USERS_DIR / user_id / "api_keys.enc"


def get_api_keys(user_id: str) -> dict:
    """
    Read and decrypt the user's stored API keys.
    Falls back to os.environ for keys not stored in the file.
    Returns {} if the encrypted file doesn't exist.
    """
    from backend.services.encryption_service import decrypt_dict  # lazy import

    path = _api_keys_path(user_id)
    stored: dict = {}
    if path.exists():
        try:
            stored = decrypt_dict(path.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.error(f"Failed to decrypt api_keys for {user_id}: {exc}")

    # Fill missing keys from environment
    result = {}
    for entry in SUPPORTED_KEYS:
        k = entry["key"]
        if k in stored:
            result[k] = stored[k]
        elif os.environ.get(k):
            result[k] = os.environ[k]

    return result


def set_api_key(user_id: str, key: str, value: str) -> None:
    """
    Store an API key for a user (encrypted) and inject it into os.environ
    so running services pick it up immediately.
    """
    from backend.services.encryption_service import encrypt_dict, decrypt_dict  # lazy

    path = _api_keys_path(user_id)
    existing: dict = {}
    if path.exists():
        try:
            existing = decrypt_dict(path.read_text(encoding="utf-8"))
        except Exception:
            existing = {}

    existing[key] = value

    # Atomic write
    encrypted = encrypt_dict(existing)
    tmp = path.with_suffix(".tmp")
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp.write_text(encrypted, encoding="utf-8")
        shutil.move(str(tmp), str(path))
    except Exception:
        if tmp.exists():
            tmp.unlink()
        raise

    # Update live environment
    os.environ[key] = value

    # Reflect in settings if possible
    try:
        from backend.config import settings  # lazy to avoid circular
        if hasattr(settings, key):
            setattr(settings, key, value)
    except Exception:
        pass

    # Update apis_configured flag
    try:
        update_user(user_id, {"apis_configured": True})
    except Exception:
        pass


def delete_api_key(user_id: str, key: str) -> None:
    """Remove a specific API key from the user's encrypted key store."""
    from backend.services.encryption_service import encrypt_dict, decrypt_dict  # lazy

    path = _api_keys_path(user_id)
    if not path.exists():
        return

    try:
        existing = decrypt_dict(path.read_text(encoding="utf-8"))
    except Exception:
        existing = {}

    existing.pop(key, None)

    encrypted = encrypt_dict(existing)
    tmp = path.with_suffix(".tmp")
    try:
        tmp.write_text(encrypted, encoding="utf-8")
        shutil.move(str(tmp), str(path))
    except Exception:
        if tmp.exists():
            tmp.unlink()
        raise


def test_api_key(key: str, value: str) -> dict:
    """
    Validate an API key.
    For OPENROUTER_API_KEY: makes a real HTTP call.
    For all others: checks the value is non-empty.
    """
    if not value:
        return {"ok": False, "message": "Value is empty"}

    if key == "OPENROUTER_API_KEY":
        try:
            response = httpx.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {value}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://jobless.io",
                    "X-Title": "jobless.io",
                },
                json={
                    "model": "meta-llama/llama-3.3-70b-instruct",
                    "messages": [{"role": "user", "content": "Say hi"}],
                    "max_tokens": 5,
                },
                timeout=8.0,
            )
            if response.status_code == 200:
                return {"ok": True, "message": "OpenRouter API key is valid"}
            else:
                return {
                    "ok": False,
                    "message": f"OpenRouter returned {response.status_code}: {response.text[:200]}",
                }
        except httpx.TimeoutException:
            return {"ok": False, "message": "Request timed out"}
        except Exception as exc:
            return {"ok": False, "message": str(exc)}

    return {"ok": True, "message": "Format looks valid"}


# ---------------------------------------------------------------------------
# Onboarding
# ---------------------------------------------------------------------------

async def scrape_github_profile(github_url: str) -> dict:
    """Scrape public GitHub profile + repos via the unauthenticated REST API."""
    if not github_url:
        return {}
    import re
    import httpx

    match = re.search(r'github\.com/([a-zA-Z0-9_.-]+)', github_url)
    if not match:
        return {}
    username = match.group(1).rstrip("/")

    gh_headers = {"Accept": "application/vnd.github+json", "User-Agent": "CVMaker/1.0"}
    result: dict = {"username": username}

    try:
        async with httpx.AsyncClient(timeout=12, headers=gh_headers) as client:
            # User profile
            pr = await client.get(f"https://api.github.com/users/{username}")
            if pr.status_code == 200:
                gh = pr.json()
                result.update({
                    "name":         gh.get("name") or "",
                    "bio":          gh.get("bio") or "",
                    "location":     gh.get("location") or "",
                    "company":      (gh.get("company") or "").strip("@"),
                    "blog":         gh.get("blog") or "",
                    "public_repos": gh.get("public_repos", 0),
                    "followers":    gh.get("followers", 0),
                })

            # Repos (own, not forks, sorted by last update)
            rr = await client.get(
                f"https://api.github.com/users/{username}/repos",
                params={"sort": "updated", "per_page": "30", "type": "owner"},
            )
            repos: list = []
            if rr.status_code == 200:
                for repo in rr.json():
                    if repo.get("fork"):
                        continue
                    repos.append({
                        "name":        repo.get("name", ""),
                        "description": repo.get("description") or "",
                        "language":    repo.get("language") or "",
                        "topics":      repo.get("topics") or [],
                        "stars":       repo.get("stargazers_count", 0),
                        "url":         repo.get("html_url", ""),
                    })
            result["repos"] = repos[:20]

            # README text for the 3 most-starred repos
            top_repos = sorted(repos, key=lambda x: x["stars"], reverse=True)[:3]
            readmes: dict = {}
            for repo in top_repos:
                for branch in ("main", "master"):
                    try:
                        raw_url = (
                            f"https://raw.githubusercontent.com/{username}"
                            f"/{repo['name']}/{branch}/README.md"
                        )
                        rd = await client.get(raw_url)
                        if rd.status_code == 200:
                            readmes[repo["name"]] = rd.text[:2500]
                            break
                    except Exception:
                        continue
            result["readmes"] = readmes

    except Exception as exc:
        logger.warning(f"GitHub scrape failed for {github_url}: {exc}")

    return result


async def process_onboarding_dump(
    user_id: str,
    dump_text: str,
    basic_info: dict,
) -> dict:
    """
    Build a structured profile.json by combining:
      1. AI data dump (user's chat export — may be empty)
      2. Basic form info
      3. LinkedIn profile scrape (if URL provided)
      4. GitHub profile + repos scrape (if URL provided)
    Writes the merged result to the user's profile.json and marks onboarding complete.
    """
    from backend.services.groq_service import call_groq
    from backend.services.apify_service import scrape_linkedin_person_profile

    linkedin_url = basic_info.get("linkedin", "")
    github_url   = basic_info.get("github", "")

    # Scrape LinkedIn and GitHub concurrently (best-effort)
    linkedin_data: dict = {}
    github_data:   dict = {}

    import asyncio as _asyncio

    async def _safe(coro, label):
        try:
            return await coro
        except Exception as exc:
            logger.warning(f"{label} scrape failed during onboarding: {exc}")
            return {}

    results = await _asyncio.gather(
        _safe(scrape_linkedin_person_profile(linkedin_url), "LinkedIn") if linkedin_url else _asyncio.sleep(0),
        _safe(scrape_github_profile(github_url),            "GitHub")   if github_url   else _asyncio.sleep(0),
    )
    if linkedin_url:
        linkedin_data = results[0] or {}
        logger.info(f"LinkedIn scraped for {user_id}: {bool(linkedin_data)}")
    if github_url:
        github_data = results[1] if linkedin_url else results[0]
        github_data = github_data or {}
        logger.info(f"GitHub scraped for {user_id}: {len(github_data.get('repos', []))} repos")

    # Build enriched context string
    parts = []
    if dump_text:
        parts.append(f"## AI Data Dump (from user's chat history)\n{dump_text}")
    parts.append(f"## Basic Info from Onboarding Form\n{json.dumps(basic_info, ensure_ascii=False)}")
    if linkedin_data:
        parts.append(f"## LinkedIn Profile (auto-scraped)\n{json.dumps(linkedin_data, ensure_ascii=False)}")
    if github_data:
        parts.append(f"## GitHub Profile and Repos (auto-scraped)\n{json.dumps(github_data, ensure_ascii=False)}")

    system_prompt = (
        "You are a professional resume analyst. "
        "Extract a complete structured professional profile from the provided data sources below. "
        "Merge all sources intelligently: prioritise explicit facts, infer the rest from context. "
        "For GitHub repos and READMEs, extract project names, descriptions, technologies, and outcomes. "
        "For LinkedIn data, extract experience, education, and skills. "
        "Return ONLY a valid JSON object with this exact schema (no markdown, no explanation):\n"
        '{"personal_info":{"full_name":"","first_name":"","last_name":"","headline":"",'
        '"summary":"","contact":{"email":"","phone":"","linkedin":"","github":"","portfolio":""},'
        '"location":{"city":"","country":"","remote_open":true,"relocation_open":false},'
        '"languages":[{"language":"","proficiency":""}]},'
        '"work_experience":[{"company":"","title":"","start_date":"YYYY-MM","end_date":"YYYY-MM",'
        '"is_current":false,"location":"","responsibilities":[],"achievements":[],"tech_stack":[]}],'
        '"education":[{"institution":"","degree":"","field":"","start_date":"YYYY","end_date":"YYYY","grade":""}],'
        '"skills":{"technical":[],"soft":[],"tools":[],"frameworks":[]},'
        '"projects":[{"name":"","description":"","technologies":[],"outcome":"","url":""}],'
        '"certifications":[{"name":"","issuer":"","issued_date":"YYYY-MM"}],'
        '"personality_and_work_style":{"work_style":"","strengths":[],"values":[]},'
        '"preferences_and_goals":{"target_roles":[],"target_industries":[],'
        '"preferred_locations":[],"work_type":"remote|hybrid|onsite","open_to_relocation":false}}'
    )

    profile = await call_groq(
        system_prompt=system_prompt,
        user_message="\n\n".join(parts),
        expect_json=True,
        purpose="generate_onboarding_profile",
    )

    profile_path = USERS_DIR / user_id / "profile.json"
    _atomic_write_json(profile_path, profile)
    update_user(user_id, {"onboarding_complete": True})

    return profile


# ---------------------------------------------------------------------------
# Profile enrichment (incremental update without full re-onboarding)
# ---------------------------------------------------------------------------

async def enrich_profile_from_dump(user_id: str, dump_text: str) -> dict:
    """
    Merge new free-text data into an existing profile.json without overwriting it.
    Only fields that are currently empty or missing are filled in; existing values
    are preserved. Newly filled fields are marked as _ai_pending for user review.
    """
    from backend.services.groq_service import call_groq

    profile_path = USERS_DIR / user_id / "profile.json"
    existing: dict = {}
    if profile_path.exists():
        with open(profile_path, "r", encoding="utf-8") as f:
            existing = json.load(f)

    system_prompt = (
        "You are a professional resume analyst. "
        "The user has provided new information about themselves. "
        "Your job is to extract structured data from this new text and return ONLY the fields "
        "that contain new or additional information not already captured. "
        "Return a JSON object using the same schema as the existing profile. "
        "Rules:\n"
        "- Include a field ONLY if the new text provides a value for it.\n"
        "- Do NOT copy fields that are already complete in the existing profile.\n"
        "- For array fields (work_experience, education, projects, certifications), "
        "return only NEW entries not already present — do not duplicate existing ones.\n"
        "- For object fields (skills, personal_info), return only the sub-keys that have new values.\n"
        "- If nothing new is found, return an empty object {}.\n"
        "Return ONLY valid JSON. No markdown, no explanation.\n\n"
        "Profile schema:\n"
        '{"personal_info":{"full_name":"","first_name":"","last_name":"","headline":"",'
        '"summary":"","contact":{"email":"","phone":"","linkedin":"","github":"","portfolio":""},'
        '"location":{"city":"","country":"","remote_open":true,"relocation_open":false},'
        '"languages":[{"language":"","proficiency":""}]},'
        '"work_experience":[{"company":"","title":"","start_date":"YYYY-MM","end_date":"YYYY-MM",'
        '"is_current":false,"location":"","responsibilities":[],"achievements":[],"tech_stack":[]}],'
        '"education":[{"institution":"","degree":"","field":"","start_date":"YYYY","end_date":"YYYY","grade":""}],'
        '"skills":{"technical":[],"soft":[],"tools":[],"frameworks":[]},'
        '"projects":[{"name":"","description":"","technologies":[],"outcome":"","url":""}],'
        '"certifications":[{"name":"","issuer":"","issued_date":"YYYY-MM"}],'
        '"personality_and_work_style":{"work_style":"","strengths":[],"values":[]},'
        '"preferences_and_goals":{"target_roles":[],"target_industries":[],'
        '"preferred_locations":[],"work_type":"remote|hybrid|onsite","open_to_relocation":false}}'
    )

    user_message = (
        f"## Existing Profile (DO NOT repeat these — only add what's missing)\n"
        f"{json.dumps(existing, ensure_ascii=False)}\n\n"
        f"## New Data Provided by User\n{dump_text}"
    )

    new_data = await call_groq(
        system_prompt=system_prompt,
        user_message=user_message,
        expect_json=True,
        purpose="enrich_profile",
    )

    if not new_data or not isinstance(new_data, dict):
        return existing

    # Deep-merge: new_data fills in missing/empty values; existing values win
    pending_fields: list = list(existing.get("_ai_pending", []))

    def _deep_merge(base: dict, patch: dict, section_key: str = "") -> dict:
        result = dict(base)
        for k, v in patch.items():
            if k.startswith("_"):
                continue
            full_key = f"{section_key}.{k}" if section_key else k
            if k not in base or base[k] in (None, "", [], {}):
                result[k] = v
                if full_key not in pending_fields:
                    pending_fields.append(full_key)
            elif isinstance(v, dict) and isinstance(base.get(k), dict):
                result[k] = _deep_merge(base[k], v, full_key)
            elif isinstance(v, list) and isinstance(base.get(k), list):
                # Append new list items that don't already exist
                existing_reprs = {json.dumps(i, sort_keys=True) for i in base[k]}
                additions = [i for i in v if json.dumps(i, sort_keys=True) not in existing_reprs]
                if additions:
                    result[k] = base[k] + additions
                    if full_key not in pending_fields:
                        pending_fields.append(full_key)
        return result

    merged = _deep_merge(existing, new_data)
    merged["_ai_pending"] = pending_fields

    _atomic_write_json(profile_path, merged)
    return merged


# ---------------------------------------------------------------------------
# Auto-migrate on import
# ---------------------------------------------------------------------------
try:
    migrate_existing_data()
except Exception as _migrate_exc:
    logger.warning(f"migrate_existing_data() failed silently: {_migrate_exc}")
