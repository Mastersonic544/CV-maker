import asyncio
import json
import logging
import shutil
import time
from pathlib import Path
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse, FileResponse

from backend.storage import json_store
from backend.services.cv_service import (
    research_company, run_gan_loop, render_cv_to_pdf, _coerce_persona,
    build_persona_from_description, build_resume_from_profile,
)
from backend.models.schemas import HiringPersona
from backend.config import settings
from backend.services.groq_service import call_groq

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory SSE queues per company_id (process-local, lost on restart)
_status_queues: dict[str, asyncio.Queue] = {}


def get_queue(company_id: str) -> asyncio.Queue:
    if company_id not in _status_queues:
        _status_queues[company_id] = asyncio.Queue()
    return _status_queues[company_id]


async def broadcast_status(company_id: str, message: str):
    await get_queue(company_id).put(message)


async def _generation_workflow(company_id: str, doc_type: str):
    logger.info(f"[{company_id}] Starting {doc_type} generation workflow")
    try:
        targets = json_store.read_targets()
        target = next((t for t in targets if t.company_id == company_id), None)
        if not target:
            raise ValueError(f"Target company '{company_id}' not found in targets.json")

        profile = json_store.read_raw_profile()

        # Reuse cached persona if meta.json already exists (avoids re-scraping for CL after CV)
        meta_path = json_store.get_applications_dir() / company_id / "meta.json"
        if meta_path.exists():
            logger.info(f"[{company_id}] Reusing existing persona from meta.json")
            await broadcast_status(company_id, "♻️ Reusing existing HR persona...")
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                persona_dict = meta.get("persona", {})
                try:
                    persona = HiringPersona(**persona_dict)
                except Exception:
                    persona = _coerce_persona(persona_dict)
            except Exception as e:
                logger.warning(f"[{company_id}] Could not load cached persona ({e}), re-researching")
                await broadcast_status(company_id, "🔍 Researching company and building HR persona...")
                persona = await research_company(company_id, target)
        else:
            logger.info(f"[{company_id}] No cached persona, running research")
            await broadcast_status(company_id, "🔍 Researching company and building HR persona...")
            persona = await research_company(company_id, target)

        logger.info(f"[{company_id}] Persona ready, starting GAN loop for {doc_type}")
        await broadcast_status(company_id, "🧬 Starting GAN generation loop...")

        async def gan_progress_cb(msg: str):
            await broadcast_status(company_id, msg)

        gan_result = await run_gan_loop(
            company_id=company_id,
            profile=profile,
            persona=persona,
            doc_type=doc_type,
            progress_callback=gan_progress_cb,
            company_name=target.company_name,
        )

        if not gan_result.get("doc"):
            raise ValueError(f"GAN loop returned no document for {doc_type}. LLM may have returned invalid output.")

        await broadcast_status(company_id, "🎨 Rendering PDF...")
        target_dir = json_store.get_applications_dir() / company_id
        pdf_path = target_dir / f"{doc_type}.pdf"
        await render_cv_to_pdf(gan_result["doc"], str(pdf_path), doc_type=doc_type)

        await broadcast_status(company_id, f"DONE|{gan_result['score']}")

    except Exception as e:
        logger.error(f"Generation workflow failed for {company_id}: {e}", exc_info=True)
        await broadcast_status(company_id, f"ERROR|{str(e)}")


# ── Quick CV (job-description-only, no scraping) ─────────────────────────────

async def _quick_generation_workflow(company_id: str, job_title: str, job_description: str):
    logger.info(f"[{company_id}] Starting quick CV generation for '{job_title}'")
    try:
        profile = json_store.read_raw_profile()

        if job_description.strip():
            await broadcast_status(company_id, "🔍 Analyzing job description...")
        else:
            await broadcast_status(company_id, "✍️ Drafting an ideal job description for this role...")
        persona = await build_persona_from_description(company_id, job_title, job_description)

        await broadcast_status(company_id, "🧬 Starting GAN generation loop...")

        async def gan_progress_cb(msg: str):
            await broadcast_status(company_id, msg)

        gan_result = await run_gan_loop(
            company_id=company_id,
            profile=profile,
            persona=persona,
            doc_type="cv",
            progress_callback=gan_progress_cb,
            company_name=job_title,
        )

        if not gan_result.get("doc"):
            raise ValueError("GAN loop returned no document. LLM may have returned invalid output.")

        await broadcast_status(company_id, "🎨 Rendering PDF...")
        target_dir = json_store.get_applications_dir() / company_id
        pdf_path = target_dir / "cv.pdf"
        await render_cv_to_pdf(gan_result["doc"], str(pdf_path), doc_type="cv")

        # Persist the achieved score into meta.json so the saved list can show it
        meta_path = target_dir / "meta.json"
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
            meta["cv_score"] = gan_result["score"]
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(meta, f, indent=2)
        except Exception as e:
            logger.warning(f"[{company_id}] Could not write score to meta.json: {e}")

        await broadcast_status(company_id, f"DONE|{gan_result['score']}")

    except Exception as e:
        logger.error(f"Quick generation failed for {company_id}: {e}", exc_info=True)
        await broadcast_status(company_id, f"ERROR|{str(e)}")


# ── Harvard Resume (profile-based, no job, no LLM) ──────────────────────────

async def _resume_generation_workflow(company_id: str):
    logger.info(f"[{company_id}] Starting Harvard resume generation")
    try:
        profile = json_store.read_raw_profile()

        await broadcast_status(company_id, "📄 Building Harvard-format resume from your profile...")
        resume_json = build_resume_from_profile(profile)

        target_dir = json_store.get_applications_dir() / company_id
        target_dir.mkdir(parents=True, exist_ok=True)

        with open(target_dir / "resume.json", "w", encoding="utf-8") as f:
            json.dump(resume_json, f, indent=2)

        # meta.json keeps it listable alongside Quick CVs (kind distinguishes them)
        meta_content = {
            "company_id": company_id,
            "quick": True,
            "kind": "resume",
            "job_title": "Harvard Resume",
            "scraped_on": time.strftime("%Y-%m-%d %H:%M:%S"),
        }
        with open(target_dir / "meta.json", "w", encoding="utf-8") as f:
            json.dump(meta_content, f, indent=2)

        await broadcast_status(company_id, "🎨 Rendering PDF...")
        pdf_path = target_dir / "resume.pdf"
        await render_cv_to_pdf(resume_json, str(pdf_path), doc_type="resume")

        await broadcast_status(company_id, "DONE|0")

    except Exception as e:
        logger.error(f"Resume generation failed for {company_id}: {e}", exc_info=True)
        await broadcast_status(company_id, f"ERROR|{str(e)}")


@router.post("/resume/generate")
async def resume_generate(background_tasks: BackgroundTasks):
    """Generate a Harvard-format resume straight from the active user's profile."""
    company_id = f"quick_{int(time.time() * 1000)}"
    _status_queues[company_id] = asyncio.Queue()
    background_tasks.add_task(_resume_generation_workflow, company_id)
    return {"status": "started", "company_id": company_id, "job_title": "Harvard Resume"}


@router.get("/resume/{company_id}")
async def get_resume_pdf(company_id: str):
    pdf_path = json_store.get_applications_dir() / company_id / "resume.pdf"
    return _get_pdf_response(pdf_path, f"Resume_{company_id}.pdf")


@router.get("/resume/json/{company_id}")
async def get_resume_json(company_id: str):
    json_path = json_store.get_applications_dir() / company_id / "resume.json"
    if not json_path.exists():
        raise HTTPException(status_code=404, detail="Resume JSON not found.")
    with open(json_path, "r", encoding="utf-8") as f:
        return json.load(f)


@router.post("/quick/generate")
async def quick_generate(body: dict, background_tasks: BackgroundTasks):
    """Generate a tailored CV straight from a pasted job description.

    No company, no scraping, no targets.json entry. Returns a company_id the
    frontend uses to stream progress (/status) and fetch the PDF (/cv).
    """
    job_title = (body.get("job_title") or "").strip()
    job_description = (body.get("job_description") or "").strip()
    if not job_title:
        raise HTTPException(status_code=400, detail="job_title is required.")

    company_id = f"quick_{int(time.time() * 1000)}"
    _status_queues[company_id] = asyncio.Queue()
    background_tasks.add_task(_quick_generation_workflow, company_id, job_title, job_description)
    return {"status": "started", "company_id": company_id, "job_title": job_title}


@router.get("/quick/list")
async def quick_list():
    """List previously generated quick CVs (most recent first)."""
    apps_dir = json_store.get_applications_dir()
    results = []
    if apps_dir.exists():
        for d in apps_dir.iterdir():
            if not d.is_dir():
                continue
            meta_path = d / "meta.json"
            if not meta_path.exists():
                continue
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    meta = json.load(f)
            except Exception:
                continue
            if not meta.get("quick"):
                continue
            kind = meta.get("kind", "cv")
            pdf_file = "resume.pdf" if kind == "resume" else "cv.pdf"
            doc_pdf = d / pdf_file
            results.append({
                "company_id": meta.get("company_id", d.name),
                "kind": kind,
                "job_title": meta.get("job_title")
                    or (meta.get("company_info") or {}).get("job_title", "Tailored Role"),
                "score": meta.get("cv_score"),
                "created_on": meta.get("scraped_on"),
                "has_cv": doc_pdf.exists() and doc_pdf.stat().st_size > 0,
            })
    # Newest first by default; manual order (if set) takes precedence (stable sort)
    results.sort(key=lambda r: r.get("created_on") or "", reverse=True)
    results.sort(key=lambda r: r.get("order") if r.get("order") is not None else -1)
    return results


@router.post("/quick/reorder")
async def quick_reorder(body: dict):
    """Persist a manual ordering of saved Quick CVs / resumes.

    Body: {"ordered_ids": ["quick_...", ...]} — index in the list becomes the order.
    """
    ordered_ids = body.get("ordered_ids") or []
    apps_dir = json_store.get_applications_dir()
    for idx, company_id in enumerate(ordered_ids):
        meta_path = apps_dir / company_id / "meta.json"
        if not meta_path.exists():
            continue
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
            meta["order"] = idx
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(meta, f, indent=2)
        except Exception as e:
            logger.warning(f"Could not set order for {company_id}: {e}")
    return {"status": "reordered", "count": len(ordered_ids)}


@router.delete("/quick/{company_id}")
async def quick_delete(company_id: str):
    """Delete a saved quick CV and its generated files."""
    d = json_store.get_applications_dir() / company_id
    if d.exists():
        shutil.rmtree(d, ignore_errors=True)
    _status_queues.pop(company_id, None)
    return {"status": "deleted", "company_id": company_id}


# ── Trigger endpoints ──────────────────────────────────────────────────────

@router.post("/cv/generate/{company_id}")
async def generate_cv(company_id: str, background_tasks: BackgroundTasks):
    _status_queues[company_id] = asyncio.Queue()
    background_tasks.add_task(_generation_workflow, company_id, "cv")
    return {"status": "started", "company_id": company_id, "doc_type": "cv"}


@router.post("/cover-letter/generate/{company_id}")
async def generate_cl(company_id: str, background_tasks: BackgroundTasks):
    _status_queues[company_id] = asyncio.Queue()
    background_tasks.add_task(_generation_workflow, company_id, "cover_letter")
    return {"status": "started", "company_id": company_id, "doc_type": "cover_letter"}


# ── SSE stream ─────────────────────────────────────────────────────────────

@router.get("/status/{company_id}")
async def stream_status(company_id: str):
    q = get_queue(company_id)

    async def event_generator():
        try:
            while True:
                message = await q.get()
                yield f"data: {message}\n\n"
                if message.startswith("DONE|") or message.startswith("ERROR|"):
                    break
        except asyncio.CancelledError:
            pass

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ── PDF file endpoints ──────────────────────────────────────────────────────

def _get_pdf_response(pdf_path: Path, filename: str) -> FileResponse:
    """Serve a PDF inline — raises 404 if missing or empty (corrupted)."""
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="PDF not found. Run generation first.")
    if pdf_path.stat().st_size == 0:
        raise HTTPException(
            status_code=500,
            detail=(
                "PDF file is empty (rendering failed). "
                "Check logs and ensure `playwright install chromium` has been run."
            )
        )
    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
        }
    )


@router.get("/cv/{company_id}")
async def get_cv_pdf(company_id: str):
    pdf_path = json_store.get_applications_dir() / company_id / "cv.pdf"
    return _get_pdf_response(pdf_path, f"CV_{company_id}.pdf")


@router.get("/cover-letter/{company_id}")
async def get_cl_pdf(company_id: str):
    pdf_path = json_store.get_applications_dir() / company_id / "cover_letter.pdf"
    return _get_pdf_response(pdf_path, f"CoverLetter_{company_id}.pdf")


# ── JSON read / edit ────────────────────────────────────────────────────────

@router.get("/cv/json/{company_id}")
async def get_cv_json(company_id: str):
    json_path = json_store.get_applications_dir() / company_id / "cv.json"
    if not json_path.exists():
        raise HTTPException(status_code=404, detail="CV JSON not found.")
    with open(json_path, "r", encoding="utf-8") as f:
        return json.load(f)


@router.patch("/cv/{company_id}")
async def update_cv(company_id: str, cv_json: dict):
    target_dir = json_store.get_applications_dir() / company_id
    json_path = target_dir / "cv.json"
    pdf_path = target_dir / "cv.pdf"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(cv_json, f, indent=2)
    await render_cv_to_pdf(cv_json, str(pdf_path), doc_type="cv")
    return {"status": "updated"}


@router.post("/cv/optimize")
async def optimize_cv(cv_json: dict):
    prompt_path = Path("backend/prompts/cv_optimize.txt")
    if not prompt_path.exists():
        raise HTTPException(status_code=500, detail="Optimization prompt not found.")
    with open(prompt_path, "r", encoding="utf-8") as f:
        prompt_template = f.read()
    system_prompt = "You are an ATS optimization engine. Return valid JSON only."
    user_message = prompt_template.replace("{{cv_json}}", json.dumps(cv_json, indent=2))
    try:
        return await call_groq(
            system_prompt=system_prompt,
            user_message=user_message,
            expect_json=True,
            purpose="optimize_cv_ats"
        )
    except Exception as e:
        logger.error(f"Optimization failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cover-letter/json/{company_id}")
async def get_cl_json(company_id: str):
    json_path = json_store.get_applications_dir() / company_id / "cover_letter.json"
    if not json_path.exists():
        raise HTTPException(status_code=404, detail="Cover Letter JSON not found.")
    with open(json_path, "r", encoding="utf-8") as f:
        return json.load(f)


@router.patch("/cover-letter/{company_id}")
async def update_cl(company_id: str, cl_json: dict):
    target_dir = json_store.get_applications_dir() / company_id
    json_path = target_dir / "cover_letter.json"
    pdf_path = target_dir / "cover_letter.pdf"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(cl_json, f, indent=2)
    await render_cv_to_pdf(cl_json, str(pdf_path), doc_type="cover_letter")
    return {"status": "updated"}


# ── Research / scoring transparency endpoints ───────────────────────────────

@router.get("/meta/{company_id}")
async def get_application_meta(company_id: str):
    """Returns persona, scraped data, and target info for a company."""
    meta_path = json_store.get_applications_dir() / company_id / "meta.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Research data not found. Run generation first.")
    with open(meta_path, "r", encoding="utf-8") as f:
        return json.load(f)


@router.get("/iterations/{company_id}")
async def get_gan_iterations(company_id: str):
    """Returns the GAN loop scoring history for a company's CV."""
    iter_path = json_store.get_applications_dir() / company_id / "cv_iterations.json"
    if not iter_path.exists():
        return []
    with open(iter_path, "r", encoding="utf-8") as f:
        return json.load(f)


@router.post("/explain/{company_id}")
async def explain_insight(company_id: str, body: dict):
    """Return an AI explanation of why a specific insight was identified, grounded in the job posting."""
    insight_type = body.get("insight_type", "")
    insight_value = body.get("insight_value", "")

    meta_path = json_store.get_applications_dir() / company_id / "meta.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Research data not found. Run generation first.")

    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    job_text = (meta.get("scraped_data") or {}).get("job_posting_text", "")
    company_info = meta.get("company_info") or {}
    persona = meta.get("persona") or {}

    is_scoring_note = insight_type == "scoring_note"

    json_schema = (
        '{"term_definition":"string","why_identified":"string",'
        '"source_quote":"string","what_it_means":"string","priority":"high|medium|low"}'
    )

    if is_scoring_note:
        system_prompt = (
            "You are an AI assistant explaining CV scoring feedback to a job applicant. "
            "Given a specific piece of feedback from an HR evaluator, explain what it means "
            "and give the candidate a concrete way to fix it for this exact role and company.\n\n"
            f"Return ONLY valid JSON: {json_schema}\n"
            'Set term_definition to "" and source_quote to "" for scoring notes. '
            "Write plainly. No buzzwords. Short sentences."
        )
    else:
        system_prompt = (
            "You are an AI research assistant explaining hiring insights to a job applicant. "
            "Given a specific keyword or insight and the job posting it came from, produce four things:\n\n"
            "1. term_definition: Define the keyword in plain English (1-2 sentences). "
            "If it is corporate jargon or a technical concept (e.g. 'ownership', 'bias-for-action', "
            "'cross-functional', 'stakeholder management'), explain what it actually means in practice — "
            "no jargon in the definition itself. If the term is already obvious everyday language, set this to \"\".\n"
            "2. why_identified: What specifically in the job posting or company data led the AI to flag this keyword. "
            "Be concrete — name the signal (job title, requirement, company culture note, etc.).\n"
            "3. source_quote: An exact short excerpt (5-25 words) from the job posting that is the primary source. "
            "Empty string if unavailable.\n"
            "4. what_it_means: One concrete action the candidate should take for this specific role and company. "
            "Start with a verb. One sentence max.\n"
            "5. priority: high | medium | low\n\n"
            f"Return ONLY valid JSON: {json_schema}\n"
            "Write plainly. No buzzwords in your explanations."
        )

    user_message = (
        f"Insight Type: {insight_type.replace('_', ' ')}\n"
        f"Insight: {insight_value}\n\n"
        f"Company: {company_info.get('company_name', 'Unknown')}\n"
        f"Role: {company_info.get('job_title', 'Unknown')}\n\n"
        f"Job Posting Text:\n{job_text[:2500] if job_text else '(not available)'}\n\n"
        f"Hiring Persona:\n{json.dumps(persona, indent=2)}"
    )

    try:
        return await call_groq(
            system_prompt=system_prompt,
            user_message=user_message,
            expect_json=True,
            purpose="explain_insight"
        )
    except Exception as e:
        logger.error(f"Insight explanation failed for {company_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
