import asyncio
import json
import logging
import random
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from backend.config import settings
from backend.storage import json_store
from backend.models.schemas import ApplicationHistory
from backend.services.email_service import send_application_email
from backend.services.email_scraper import scrape_email_from_website, get_website_from_linkedin
from backend.services.groq_service import call_groq

logger = logging.getLogger(__name__)

router = APIRouter()


def _enforce_daily_limit(count_to_add=1):
    history_entries = json_store.read_history()
    today_str = datetime.now().strftime("%Y-%m-%d")
    sent_today = len([e for e in history_entries if e.date_sent.strftime("%Y-%m-%d") == today_str])
    max_limit = settings.MAX_DAILY_APPLICATIONS
    if sent_today + count_to_add > max_limit:
        raise HTTPException(
            status_code=429,
            detail=f"Daily limit of {max_limit} applications reached. {sent_today} sent today."
        )


def _get_candidate_name() -> str:
    try:
        profile = json_store.read_profile()
        return (profile.personal_info.full_name or "").strip() or "The Applicant"
    except Exception:
        return "The Applicant"


def _load_email_draft(company_id: str) -> dict | None:
    """Load a saved custom email draft for a company, if it exists."""
    draft_path = json_store.get_applications_dir() / company_id / "email_draft.json"
    if draft_path.exists():
        try:
            with open(draft_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return None


def _save_email_draft(company_id: str, subject: str, body: str) -> None:
    draft_path = json_store.get_applications_dir() / company_id / "email_draft.json"
    draft_path.parent.mkdir(parents=True, exist_ok=True)
    with open(draft_path, "w", encoding="utf-8") as f:
        json.dump({"subject": subject, "body": body}, f, indent=2, ensure_ascii=False)


async def _build_email_content(target, candidate_name: str) -> tuple[str, str]:
    """Generate (subject, body) using LLM + persona + cover letter context. Saves result as draft."""
    # Load HR persona for tone matching
    persona_lines = []
    meta_path = json_store.get_applications_dir() / target.company_id / "meta.json"
    if meta_path.exists():
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                meta_data = json.load(f)
            p = meta_data.get("persona", {})
            if p.get("hr_communication_style"):
                persona_lines.append(f"Communication style: {p['hr_communication_style']}")
            if p.get("tone_preference"):
                persona_lines.append(f"Tone: {p['tone_preference']}")
            if p.get("what_they_look_for"):
                persona_lines.append(f"They look for: {', '.join(p['what_they_look_for'][:5])}")
            if p.get("company_values"):
                persona_lines.append(f"Company values: {', '.join(p['company_values'][:3])}")
            if p.get("cultural_keywords"):
                persona_lines.append(f"Keywords to mirror: {', '.join(p['cultural_keywords'][:5])}")
        except Exception:
            pass

    # Load cover letter excerpt for tone reference
    cl_excerpt = ""
    cl_path = json_store.get_applications_dir() / target.company_id / "cover_letter.json"
    if cl_path.exists():
        try:
            with open(cl_path, "r", encoding="utf-8") as f:
                cl_data = json.load(f)
            paragraphs = cl_data.get("paragraphs") or cl_data.get("body") or []
            if isinstance(paragraphs, list):
                cl_excerpt = " ".join(p for p in paragraphs[:2] if isinstance(p, str))[:600]
        except Exception:
            pass

    persona_block = "\n".join(persona_lines) if persona_lines else "Professional and formal."
    cl_block = f"\nCover letter excerpt (match this tone):\n{cl_excerpt}" if cl_excerpt else ""

    system_prompt = (
        "You are an expert job application email writer. "
        "Write a short, genuine, professional application email — 3 tight paragraphs. "
        "Paragraph 1: why you're applying and the role. "
        "Paragraph 2: one concrete achievement or skill that directly fits their needs. "
        "Paragraph 3: clear call-to-action, offer a call. "
        "No em-dashes, no filler phrases, no hollow adjectives, no placeholder text. "
        "Return ONLY valid JSON: {\"subject\": \"...\", \"body\": \"...\"} "
        "where body paragraphs are separated by \\n\\n."
    )
    user_message = (
        f"Candidate: {candidate_name}\n"
        f"Company: {target.company_name}\n"
        f"Role: {target.job_title}\n"
        f"Location: {target.location}\n\n"
        f"HR persona:\n{persona_block}"
        f"{cl_block}\n\n"
        f"Write the application email now."
    )

    try:
        result = await call_groq(
            system_prompt=system_prompt,
            user_message=user_message,
            expect_json=True,
            purpose="generate_email",
        )
        subject = (result.get("subject") or f"Application – {target.job_title} | {candidate_name}").strip()
        body = (result.get("body") or "").strip()
        if body:
            _save_email_draft(target.company_id, subject, body)
            return subject, body
    except Exception as e:
        logger.warning(f"Email generation failed for {target.company_id}, using cover-letter fallback: {e}")

    # Fallback: use cover letter paragraphs directly as email body
    if cl_excerpt:
        subject = f"Application – {target.job_title} | {candidate_name}"
        body = cl_excerpt
        _save_email_draft(target.company_id, subject, body)
        return subject, body

    # Last resort plain body
    subject = f"Application – {target.job_title} | {candidate_name}"
    body = (
        f"Dear Hiring Team,\n\n"
        f"I'm writing to apply for the {target.job_title} role at {target.company_name}. "
        f"Please find my CV and cover letter attached.\n\n"
        f"I'd welcome the chance to discuss how my background fits your needs.\n\n"
        f"Best regards,\n{candidate_name}"
    )
    return subject, body


async def _apply_single(target, cv_pdf: Path, cl_pdf: Path) -> dict:
    """Core apply logic for a single target. Returns result dict."""
    if target.apply_type == "email":
        candidate_name = _get_candidate_name()
        draft = _load_email_draft(target.company_id)
        if draft:
            subject = draft.get("subject") or f"Application – {target.job_title} | {candidate_name}"
            body = draft.get("body") or ""
        else:
            subject, body = await _build_email_content(target, candidate_name)
        return await send_application_email(
            target, str(cv_pdf), str(cl_pdf) if cl_pdf.exists() else str(cv_pdf), subject, body
        )

    return {"success": False, "error": "Unknown apply type"}


def _record_result(target, cv_pdf: Path, cl_pdf: Path, result: dict) -> None:
    """Write outcome to history.json and flip target status."""
    target_dir = json_store.get_applications_dir() / target.company_id
    cv_score = settings.MIN_CV_SCORE
    iter_path = target_dir / "cv_iterations.json"
    try:
        if iter_path.exists():
            with open(iter_path, "r", encoding="utf-8") as f:
                iters = json.load(f)
            if iters:
                cv_score = iters[-1].get("score", settings.MIN_CV_SCORE)
    except Exception:
        pass

    history_entries = json_store.read_history()
    history_entries.append(ApplicationHistory(
        company_id=target.company_id,
        company_name=target.company_name,
        job_title=target.job_title,
        date_sent=datetime.now(),
        apply_method=target.apply_type,
        cv_score_achieved=cv_score,
        status="sent" if result.get("success") else "rejected",
        cv_path=str(cv_pdf),
        cl_path=str(cl_pdf) if cl_pdf.exists() else "",
        notes=result.get("error"),
    ))
    json_store.write_history(history_entries)

    # Only mark as applied on success; keep pending on failure so the user can retry
    if result.get("success"):
        targets = json_store.read_targets()
        for i, t in enumerate(targets):
            if t.company_id == target.company_id:
                targets[i].status = "applied"
        json_store.write_targets(targets)

    log_entry = (
        f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [DECISION] "
        f"module=apply_router company={target.company_name} "
        f"success={result.get('success')} method={target.apply_type}\n"
    )
    log_path = Path(settings.DEBUG_LOG).parent / "decisions.log"
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(log_entry)
    except Exception as e:
        logger.error(f"Could not log decision: {e}")


# ── Auto-fetch HR email from website ────────────────────────────────────────

@router.get("/fetch-email/{company_id}")
async def fetch_hr_email(company_id: str):
    """Scrape the company website (or LinkedIn page) to find a contact/HR email."""
    targets = json_store.read_targets()
    target = next((t for t in targets if t.company_id == company_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found.")

    website = target.company_website

    if not website and target.company_linkedin:
        website = await get_website_from_linkedin(target.company_linkedin)

    if not website:
        raise HTTPException(
            status_code=404,
            detail="No company website found. Add one in Discovery or enter the email manually."
        )

    email = await scrape_email_from_website(website)
    if not email:
        raise HTTPException(
            status_code=404,
            detail=f"No contact email found on {website}. Please add the email manually."
        )

    # Auto-save to targets
    for t in targets:
        if t.company_id == company_id:
            t.hr_email = email
            break
    json_store.write_targets(targets)

    return {"email": email, "source": website}


# ── Skip target and blacklist its job URL ────────────────────────────────────

@router.delete("/targets/{company_id}/skip")
async def skip_and_blacklist_target(company_id: str):
    """Remove target from queue and blacklist its job URL so it never resurfaces in scraping."""
    targets = json_store.read_targets()
    target = next((t for t in targets if t.company_id == company_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found.")

    if target.job_url:
        blacklist = json_store.read_blacklist()
        if target.job_url not in blacklist:
            blacklist.append(target.job_url)
            json_store.write_blacklist(blacklist)

    updated = [t for t in targets if t.company_id != company_id]
    json_store.write_targets(updated)

    return {"status": "skipped", "blacklisted_url": target.job_url}


# ── HR email update ─────────────────────────────────────────────────────────

@router.patch("/targets/{company_id}/email")
async def update_target_hr_email(company_id: str, body: dict):
    """Update the hr_email field of a target company."""
    hr_email = body.get("hr_email", "").strip()
    targets = json_store.read_targets()
    found = False
    for t in targets:
        if t.company_id == company_id:
            t.hr_email = hr_email or None
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail="Target not found")
    json_store.write_targets(targets)
    return {"status": "ok", "hr_email": hr_email or None}


# ── Email preview ────────────────────────────────────────────────────────────

@router.get("/email-preview/{company_id}")
async def get_email_preview(company_id: str):
    """Return the email subject and body that would be sent for this target."""
    targets = json_store.read_targets()
    target = next((t for t in targets if t.company_id == company_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")

    candidate_name = _get_candidate_name()
    target_dir = json_store.get_applications_dir() / company_id
    cv_pdf = target_dir / "cv.pdf"
    cl_pdf = target_dir / "cover_letter.pdf"

    # Use a saved draft if one exists
    draft = _load_email_draft(company_id)
    if draft:
        subject = draft.get("subject") or f"Application – {target.job_title} | {candidate_name}"
        body_text = draft.get("body") or ""
        is_draft = True
    else:
        # Auto-generate and save so the sent email matches what the user sees
        subject, body_text = await _build_email_content(target, candidate_name)
        is_draft = True  # marks it as AI-generated (Custom badge)

    return {
        "company_id": company_id,
        "company_name": target.company_name,
        "job_title": target.job_title,
        "hr_email": target.hr_email,
        "subject": subject,
        "body": body_text,
        "has_cv": cv_pdf.exists(),
        "has_cover_letter": cl_pdf.exists(),
        "is_draft": is_draft,
    }


# ── Generate email with AI ───────────────────────────────────────────────────

@router.post("/email-content/{company_id}/generate")
async def generate_email_content(company_id: str):
    """Use the LLM + HR persona to generate a tailored application email."""
    targets = json_store.read_targets()
    target = next((t for t in targets if t.company_id == company_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found.")
    candidate_name = _get_candidate_name()
    try:
        subject, body = await _build_email_content(target, candidate_name)
        return {"subject": subject, "body": body}
    except Exception as e:
        logger.error(f"Email generation failed for {company_id}: {e}")
        raise HTTPException(status_code=502, detail="AI email generation failed. Try again.")


# ── Save custom email draft ──────────────────────────────────────────────────

@router.patch("/email-content/{company_id}")
async def save_email_content(company_id: str, payload: dict):
    """Persist a manually edited email subject and body."""
    subject = (payload.get("subject") or "").strip()
    body = (payload.get("body") or "").strip()
    if not subject or not body:
        raise HTTPException(status_code=400, detail="Both subject and body are required.")
    targets = json_store.read_targets()
    if not any(t.company_id == company_id for t in targets):
        raise HTTPException(status_code=404, detail="Target not found.")
    _save_email_draft(company_id, subject, body)
    return {"status": "saved"}


# ── Status ──────────────────────────────────────────────────────────────────

@router.get("/status")
def get_status():
    history_entries = json_store.read_history()
    today_str = datetime.now().strftime("%Y-%m-%d")
    sent_today = len([e for e in history_entries if e.date_sent.strftime("%Y-%m-%d") == today_str])
    max_limit = settings.MAX_DAILY_APPLICATIONS
    targets = json_store.read_targets()
    pending = [t for t in targets if t.status == "pending"]
    return {
        "sent_today": sent_today,
        "max_limit": max_limit,
        "remaining_today": max_limit - sent_today,
        "pending_targets": len(pending),
        "total_targets": len(targets),
    }


# ── Single-target endpoint (kept for direct use) ────────────────────────────

@router.post("/run/{company_id}")
async def apply_to_target(company_id: str):
    _enforce_daily_limit(1)

    targets = json_store.read_targets()
    target = next((t for t in targets if t.company_id == company_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    if target.status != "pending":
        raise HTTPException(status_code=400, detail="Target is not pending")

    target_dir = json_store.get_applications_dir() / company_id
    cv_pdf = target_dir / "cv.pdf"
    cl_pdf = target_dir / "cover_letter.pdf"

    if not cv_pdf.exists():
        raise HTTPException(status_code=400, detail="CV PDF not found. Ensure CV generation completed.")
    if target.apply_type == "external":
        raise HTTPException(status_code=400, detail=f"External jobs must be applied manually: {target.job_url}")

    result = await _apply_single(target, cv_pdf, cl_pdf)
    _record_result(target, cv_pdf, cl_pdf, result)

    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to apply"))
    return result


# ── Batch SSE endpoint ───────────────────────────────────────────────────────

@router.get("/batch/stream")
async def batch_apply_stream(request: Request):
    """
    SSE stream that runs all pending auto-apply targets sequentially.
    Each message is one of:
      PREPARING|company_id|company_name
      DONE_ONE|company_id|company_name|success|failed
      ERROR_ONE|company_id|company_name|<error text>
      WAITING|<seconds>
      TICK|<seconds_left>
      LIMIT_REACHED|<max>
      BATCH_DONE
    """

    async def event_generator():
        try:
            all_targets = json_store.read_targets()
            auto_targets = [
                t for t in all_targets
                if t.status == "pending" and t.apply_type != "external"
            ]

            if not auto_targets:
                yield "data: BATCH_DONE\n\n"
                return

            history_entries = json_store.read_history()
            today_str = datetime.now().strftime("%Y-%m-%d")
            sent_today = len([
                e for e in history_entries
                if e.date_sent.strftime("%Y-%m-%d") == today_str
            ])

            for idx, target in enumerate(auto_targets):
                if await request.is_disconnected():
                    return

                if sent_today >= settings.MAX_DAILY_APPLICATIONS:
                    yield f"data: LIMIT_REACHED|{settings.MAX_DAILY_APPLICATIONS}\n\n"
                    return

                target_dir = json_store.get_applications_dir() / target.company_id
                cv_pdf = target_dir / "cv.pdf"
                cl_pdf = target_dir / "cover_letter.pdf"

                if not cv_pdf.exists():
                    yield f"data: ERROR_ONE|{target.company_id}|{target.company_name}|CV not generated yet\n\n"
                    continue

                yield f"data: PREPARING|{target.company_id}|{target.company_name}\n\n"

                try:
                    result = await _apply_single(target, cv_pdf, cl_pdf)
                    _record_result(target, cv_pdf, cl_pdf, result)
                    outcome = "success" if result.get("success") else "failed"
                    yield f"data: DONE_ONE|{target.company_id}|{target.company_name}|{outcome}\n\n"
                    if result.get("success"):
                        sent_today += 1
                except Exception as e:
                    logger.error(f"Batch apply failed for {target.company_name}: {e}", exc_info=True)
                    yield f"data: ERROR_ONE|{target.company_id}|{target.company_name}|{str(e)}\n\n"

                # Inter-application delay — sleep in 1-second ticks so the UI can show a countdown
                if idx < len(auto_targets) - 1:
                    delay = random.randint(
                        settings.MIN_APPLY_DELAY_SECONDS,
                        settings.MAX_APPLY_DELAY_SECONDS,
                    )
                    yield f"data: WAITING|{delay}\n\n"
                    for remaining in range(delay, 0, -1):
                        if await request.is_disconnected():
                            return
                        yield f"data: TICK|{remaining}\n\n"
                        await asyncio.sleep(1)

            yield "data: BATCH_DONE\n\n"

        except asyncio.CancelledError:
            pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
