"""
Users router — multi-user management API.
Prefix: /api/users
"""
import json
import logging
import os
import shutil
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Body, File, HTTPException, Path as FPath, UploadFile
from fastapi.responses import FileResponse

from backend.services import user_service
from backend.services.user_service import (
    SUPPORTED_KEYS,
    USERS_DIR,
    ACTIVE_USER_FILE,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _get_user_or_404(user_id: str) -> dict:
    user = user_service.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"User '{user_id}' not found")
    return user


# ---------------------------------------------------------------------------
# User CRUD
# ---------------------------------------------------------------------------

@router.get("/", summary="List all users")
def list_users():
    return user_service.get_users()


@router.get("/active", summary="Get active user")
def get_active_user():
    uid = user_service.get_active_user_id()
    if not uid:
        return {"user_id": None}
    user = user_service.get_user(uid)
    return {"user_id": uid, "user": user}


@router.post("/", summary="Create a new user")
def create_user(body: dict = Body(...)):
    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="'name' is required")
    avatar_color = body.get("avatar_color", "#6C63FF")
    user = user_service.create_user(name=name, avatar_color=avatar_color)
    return user


@router.post("/switch/{user_id}", summary="Switch active user")
def switch_user(user_id: str = FPath(...)):
    user = _get_user_or_404(user_id)
    user_service.set_active_user(user_id)
    return user


@router.delete("/{user_id}", summary="Delete a user")
def delete_user(user_id: str = FPath(...)):
    _get_user_or_404(user_id)
    user_service.delete_user(user_id)
    # Clear active user if it was this one
    if user_service.get_active_user_id() == user_id:
        try:
            ACTIVE_USER_FILE.unlink(missing_ok=True)
        except Exception:
            pass
    return {"ok": True}


@router.patch("/{user_id}", summary="Update user fields")
def update_user(user_id: str = FPath(...), body: dict = Body(...)):
    _get_user_or_404(user_id)
    allowed = {"name", "avatar_color", "onboarding_complete", "apis_configured",
               "has_avatar", "avatar_ext", "avatar_updated_at"}
    fields = {k: v for k, v in body.items() if k in allowed}
    updated = user_service.update_user(user_id, fields)
    return updated


# ---------------------------------------------------------------------------
# Avatar
# ---------------------------------------------------------------------------

_ALLOWED_TYPES = {
    "image/jpeg": "jpg", "image/jpg": "jpg",
    "image/png": "png", "image/webp": "webp",
}
_MAX_BYTES = 5 * 1024 * 1024  # 5 MB


@router.post("/{user_id}/avatar", summary="Upload profile picture")
async def upload_avatar(
    user_id: str = FPath(...),
    file: UploadFile = File(...),
):
    _get_user_or_404(user_id)

    ext = _ALLOWED_TYPES.get(file.content_type or "")
    if not ext:
        raise HTTPException(status_code=422, detail="Only JPEG, PNG or WEBP images are accepted")

    data = await file.read()
    if len(data) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="Image too large — max 5 MB")

    user_dir = USERS_DIR / user_id
    user_dir.mkdir(parents=True, exist_ok=True)

    for old in user_dir.glob("avatar.*"):
        old.unlink(missing_ok=True)

    (user_dir / f"avatar.{ext}").write_bytes(data)

    from datetime import datetime as _dt
    ts = _dt.utcnow().strftime("%Y%m%d%H%M%S")
    user_service.update_user(user_id, {"has_avatar": True, "avatar_ext": ext, "avatar_updated_at": ts})
    return {"ok": True}


@router.get("/{user_id}/avatar", summary="Serve profile picture")
def get_avatar(user_id: str = FPath(...)):
    user = _get_user_or_404(user_id)
    ext = user.get("avatar_ext", "jpg")
    avatar_path = USERS_DIR / user_id / f"avatar.{ext}"

    if not avatar_path.exists():
        for f in (USERS_DIR / user_id).glob("avatar.*"):
            avatar_path = f
            ext = f.suffix.lstrip(".")
            break
        else:
            raise HTTPException(status_code=404, detail="No avatar uploaded")

    media_type = "image/jpeg" if ext == "jpg" else f"image/{ext}"
    return FileResponse(str(avatar_path), media_type=media_type)


# ---------------------------------------------------------------------------
# API Keys
# ---------------------------------------------------------------------------

@router.get("/{user_id}/api-keys", summary="List API key metadata (masked)")
def list_api_keys(user_id: str = FPath(...)):
    _get_user_or_404(user_id)
    stored = user_service.get_api_keys(user_id)
    result = []
    for entry in SUPPORTED_KEYS:
        k = entry["key"]
        is_set = bool(stored.get(k))
        result.append(
            {
                "key": k,
                "label": entry["label"],
                "service": entry["service"],
                "is_set": is_set,
                "value": "***masked***" if is_set else "",
            }
        )
    return result


@router.get("/{user_id}/api-keys/export", summary="Export actual API key values")
def export_api_keys(user_id: str = FPath(...)):
    _get_user_or_404(user_id)
    stored = user_service.get_api_keys(user_id)
    return {entry["key"]: stored.get(entry["key"], "") for entry in SUPPORTED_KEYS}


@router.put("/{user_id}/api-keys/{key_name}", summary="Set an API key")
def set_api_key(
    user_id: str = FPath(...),
    key_name: str = FPath(...),
    body: dict = Body(...),
):
    _get_user_or_404(user_id)
    value = body.get("value", "")
    if not value:
        raise HTTPException(status_code=422, detail="'value' is required")
    valid_keys = {e["key"] for e in SUPPORTED_KEYS}
    if key_name not in valid_keys:
        raise HTTPException(status_code=422, detail=f"Unknown key '{key_name}'")
    user_service.set_api_key(user_id, key_name, value)
    return {"ok": True}


@router.delete("/{user_id}/api-keys/{key_name}", summary="Delete an API key")
def delete_api_key(
    user_id: str = FPath(...),
    key_name: str = FPath(...),
):
    _get_user_or_404(user_id)
    user_service.delete_api_key(user_id, key_name)
    return {"ok": True}


@router.post("/{user_id}/api-keys/{key_name}/test", summary="Test an API key")
def test_api_key(
    user_id: str = FPath(...),
    key_name: str = FPath(...),
    body: dict = Body(...),
):
    _get_user_or_404(user_id)
    value = body.get("value", "")
    result = user_service.test_api_key(key_name, value)
    return result


# ---------------------------------------------------------------------------
# Onboarding
# ---------------------------------------------------------------------------

@router.post("/{user_id}/onboarding", summary="Complete onboarding step")
async def onboarding(
    user_id: str = FPath(...),
    body: dict = Body(...),
):
    _get_user_or_404(user_id)
    dump_text: str = body.get("dump_text", "")
    basic_info: dict = body.get("basic_info", {})

    # Always attempt profile extraction when we have any context at all
    has_context = dump_text or basic_info.get("linkedin") or basic_info.get("github") or basic_info
    profile: dict = {}
    if has_context:
        try:
            profile = await user_service.process_onboarding_dump(
                user_id=user_id,
                dump_text=dump_text,
                basic_info=basic_info,
            )
        except Exception as exc:
            logger.error(f"Onboarding dump failed for {user_id}: {exc}")
            raise HTTPException(status_code=500, detail=str(exc))
    else:
        user_service.update_user(user_id, {"onboarding_complete": True})

    return {"ok": True, "profile": profile}


# ---------------------------------------------------------------------------
# Profile JSON management (per-user)
# ---------------------------------------------------------------------------

@router.get("/{user_id}/profile-json", summary="Get user profile.json")
def get_profile_json(user_id: str = FPath(...)):
    _get_user_or_404(user_id)
    path = USERS_DIR / user_id / "profile.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Profile not found for this user")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.patch("/{user_id}/profile-json", summary="Update user profile.json")
def patch_profile_json(
    user_id: str = FPath(...),
    body: dict = Body(...),
):
    _get_user_or_404(user_id)
    path = USERS_DIR / user_id / "profile.json"

    # Merge with existing if present
    existing: dict = {}
    if path.exists():
        try:
            existing = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            existing = {}

    existing.update(body)

    import os as _os
    tmp = path.with_suffix(".tmp")
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(existing, f, indent=2, ensure_ascii=False)
            f.flush()
            _os.fsync(f.fileno())
        shutil.move(str(tmp), str(path))
    except Exception as exc:
        if tmp.exists():
            tmp.unlink()
        raise HTTPException(status_code=500, detail=str(exc))

    return {"ok": True}


@router.delete("/{user_id}/profile-json/section", summary="Remove a section from profile.json")
def delete_profile_section(
    user_id: str = FPath(...),
    body: dict = Body(...),
):
    _get_user_or_404(user_id)
    section = body.get("section", "").strip()
    if not section:
        raise HTTPException(status_code=422, detail="'section' is required")

    path = USERS_DIR / user_id / "profile.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Profile not found for this user")

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    data.pop(section, None)

    import os as _os
    tmp = path.with_suffix(".tmp")
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.flush()
            _os.fsync(f.fileno())
        shutil.move(str(tmp), str(path))
    except Exception as exc:
        if tmp.exists():
            tmp.unlink()
        raise HTTPException(status_code=500, detail=str(exc))

    return {"ok": True}


# ---------------------------------------------------------------------------
# AI Auto-fill
# ---------------------------------------------------------------------------

def _deep_merge_fill(existing: dict, filled: dict) -> dict:
    """Recursively fill empty/null/[]/{}  values from `filled` into `existing`.
    Never overwrites non-empty existing values."""
    result = dict(existing)
    for key, fill_val in filled.items():
        if key not in result:
            result[key] = fill_val
            continue
        ex = result[key]
        if ex is None or ex == "" or ex == [] or ex == {}:
            result[key] = fill_val
        elif isinstance(ex, dict) and isinstance(fill_val, dict):
            result[key] = _deep_merge_fill(ex, fill_val)
    return result


@router.post("/{user_id}/profile-json/ai-fill", summary="AI auto-fill missing profile fields")
async def ai_fill_profile(user_id: str = FPath(...)):
    _get_user_or_404(user_id)
    path = USERS_DIR / user_id / "profile.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Profile not found for this user")

    try:
        profile = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    from backend.services.groq_service import call_groq

    system_prompt = (
        "You are a professional resume analyst. "
        "Given the following partially filled professional profile JSON, "
        "intelligently fill in ALL empty, null, or missing fields with plausible "
        "professional values inferred from the rest of the profile. "
        "Do NOT invent company names, specific dates, or achievements that have no basis in the data. "
        "Leave a field null/empty only if it truly cannot be inferred at all. "
        "Return ONLY the complete valid JSON profile object with the same top-level structure.\n\n"
        "FIELD GUIDE — use this to understand exactly what each field expects:\n"
        "  personal_info.headline: One-line professional title, e.g. 'Senior Full-Stack Engineer | Python & React'\n"
        "  personal_info.summary: 2-3 sentence professional bio highlighting key strengths, experience level, and career direction\n"
        "  personal_info.contact.email: Professional email address — infer from name if LinkedIn URL present\n"
        "  personal_info.contact.phone: Phone number in international format, e.g. +1 555 000 0000\n"
        "  personal_info.contact.linkedin: Full LinkedIn profile URL, e.g. https://linkedin.com/in/username\n"
        "  personal_info.contact.github: Full GitHub profile URL — infer from projects or tech stack if mentioned\n"
        "  personal_info.location.city: City of current residence\n"
        "  personal_info.languages: Array of {language, proficiency} — infer from nationality, education country, or role descriptions\n"
        "  education: Array of {institution, degree, field, start_date, end_date, grade} — include all academic qualifications\n"
        "  work_experience: Array of {company, title, start_date, end_date, responsibilities: [], achievements: [], tech_stack: []} — fill gaps from context\n"
        "  skills: Object with keys like 'technical', 'soft', 'tools', each an array — infer ALL skills from every job's tech_stack, responsibilities, and achievements\n"
        "  projects: Array of {name, description, technologies: [], outcome} — extract side projects or significant deliverables from work experience if not already listed\n"
        "  certifications: Array of {name, issuer, issued_date} — only include if clearly inferable from the data; leave empty if not\n"
        "  personality_and_work_style: Object like {traits: [], approach: str, team_preference: str, strengths: []} — infer from career progression and role types\n"
        "  preferences_and_goals: Object like {target_roles: [], target_industries: [], remote_preference: str, career_goal: str} — infer from job history and seniority\n"
        "  cv_generation_hints: Object like {tone: str, emphasis: [], avoid: [], keywords: []} — strategic hints for writing a great CV from this profile\n"
    )

    try:
        filled = await call_groq(
            system_prompt=system_prompt,
            user_message=json.dumps(profile, ensure_ascii=False),
            expect_json=True,
            purpose="generate_ai_fill_profile",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI fill failed: {exc}")

    from backend.services.profile_service import get_raw_missing_labels
    before_missing = get_raw_missing_labels(profile)

    merged = _deep_merge_fill(profile, filled)

    # Detect which labels went from empty → filled: those are now AI-pending
    after_missing = get_raw_missing_labels(merged)
    newly_filled = before_missing - after_missing
    existing_pending = set(profile.get("_ai_pending", []))
    merged["_ai_pending"] = sorted(existing_pending | newly_filled)

    import os as _os2
    tmp = path.with_suffix(".tmp")
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(merged, f, indent=2, ensure_ascii=False)
            f.flush()
            _os2.fsync(f.fileno())
        shutil.move(str(tmp), str(path))
    except Exception as exc:
        if tmp.exists():
            tmp.unlink()
        raise HTTPException(status_code=500, detail=str(exc))

    return {"ok": True, "profile": merged}


@router.post("/{user_id}/profile-json/approve", summary="Approve AI-filled profile fields")
def approve_ai_fields(user_id: str = FPath(...), body: dict = Body(...)):
    _get_user_or_404(user_id)
    path = USERS_DIR / user_id / "profile.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Profile not found for this user")

    try:
        profile = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    pending = profile.get("_ai_pending", [])
    field = body.get("field")          # single field label, or None for approve-all
    pending = [p for p in pending if p != field] if field else []
    profile["_ai_pending"] = pending

    import os as _os3
    tmp = path.with_suffix(".tmp")
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(profile, f, indent=2, ensure_ascii=False)
            f.flush()
            _os3.fsync(f.fileno())
        shutil.move(str(tmp), str(path))
    except Exception as exc:
        if tmp.exists():
            tmp.unlink()
        raise HTTPException(status_code=500, detail=str(exc))

    return {"ok": True, "ai_pending": pending}
