import httpx
import asyncio
import json
import logging
from datetime import datetime
from typing import Any, Dict, Optional
from pathlib import Path

import requests
from backend.config import settings

logger = logging.getLogger(__name__)

_GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
_GROQ_FALLBACK_MODEL = "llama-3.3-70b-versatile"


def _get_openrouter_key() -> str:
    """Read the API key at call time — covers keys set via UI after startup."""
    import os
    key = os.environ.get("OPENROUTER_API_KEY", "") or settings.OPENROUTER_API_KEY
    if not key:
        try:
            from backend.services.user_service import get_active_user_id, get_api_keys
            uid = get_active_user_id()
            if uid:
                key = get_api_keys(uid).get("OPENROUTER_API_KEY", "")
        except Exception:
            pass
    return key


def _get_groq_key() -> str:
    """Read Groq API key at call time."""
    import os
    key = os.environ.get("GROQ_API_KEY", "") or settings.GROQ_API_KEY
    if not key:
        try:
            from backend.services.user_service import get_active_user_id, get_api_keys
            uid = get_active_user_id()
            if uid:
                key = get_api_keys(uid).get("GROQ_API_KEY", "")
        except Exception:
            pass
    return key


async def _call_via_groq_fallback(messages: list, max_tokens: int, expect_json: bool, purpose: str) -> Any:
    """Call Groq API directly when OpenRouter is out of credits."""
    key = _get_groq_key()
    if not key:
        raise Exception("No Groq API key available. Add one in API Keys settings.")

    logger.warning(f"OpenRouter out of credits — using Groq fallback for purpose={purpose}")

    payload = {
        "model": _GROQ_FALLBACK_MODEL,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": max_tokens,
    }
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(_GROQ_API_URL, headers=headers, json=payload, timeout=60.0)

    if response.status_code != 200:
        raise Exception(f"Groq fallback error: {response.status_code} - {response.text}")

    content = response.json()["choices"][0]["message"].get("content") or ""
    if not content:
        raise ValueError("Groq fallback returned empty content.")

    if expect_json:
        return _parse_json_response(content)
    return content


async def call_groq(
    system_prompt: str,
    user_message: str,
    expect_json: bool = False,
    purpose: str = "generic_completion"
) -> Any:
    """
    Call the OpenRouter API (aliased as call_groq for compatibility) with exponential backoff.
    
    Args:
        system_prompt: The initial system instruction.
        user_message: The user prompt containing data/request.
        expect_json: If True, attempts to parse output as JSON and returns dict/list.
                     Raises ValueError if parsing fails.
        purpose: Log context identifier for this API call.

    Returns:
        String response if expect_json=False, otherwise parsed Python dict/list.

    Raises:
        Exception: If API fails after max retries.
        ValueError: If expect_json is True but response isn't valid JSON.
    """
    max_retries = settings.LLM_MAX_RETRIES
    base_delay = settings.LLM_RETRY_BASE_DELAY

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message}
    ]

    # Compute token budget before any branching so all paths can reference it
    if purpose.startswith("score_") or purpose.startswith("gan_discriminator"):
        max_tokens = settings.LLM_MAX_TOKENS_SCORING
    elif purpose.startswith("suggest_roles") or purpose.startswith("synthesize_persona"):
        max_tokens = settings.LLM_MAX_TOKENS_ROLES
    elif "cover_letter" in purpose:
        max_tokens = settings.LLM_MAX_TOKENS_CL
    else:
        max_tokens = settings.LLM_MAX_TOKENS_GENERATION

    # If no OpenRouter key, try Groq directly; only mock if both are missing
    if not _get_openrouter_key():
        if _get_groq_key():
            return await _call_via_groq_fallback(messages, max_tokens, expect_json, purpose)

        logger.info(f"Mock LLM response for purpose={purpose} (expect_json={expect_json})")
        await asyncio.sleep(0.5) # Simulate slight delay even in mock
        # Provide lightweight mocks tailored to common purposes used by the pipeline
        if expect_json:
            # Synthesize a hiring persona
            if purpose.startswith("synthesize_persona"):
                return {
                    "company_values": ["ownership", "iterative development", "customer-focus"],
                    "hr_communication_style": "direct and outcome-focused",
                    "what_they_look_for": ["impact-oriented engineers", "strong ownership", "clear communication"],
                    "red_flags_to_avoid": ["lack of ownership", "vague impact statements"],
                    "cultural_keywords": ["ownership", "bias-for-action", "collaboration"],
                    "tone_preference": "technical"
                }
            # Generator output — cover letter (must come before generic generate_ check)
            if purpose.startswith("generate_cover_letter"):
                return {
                    "header": {
                        "name": "John Doe",
                        "email": "john@example.com",
                        "phone": "(555) 555-5555",
                        "date": "May 2025",
                        "target_company": "Target Company"
                    },
                    "salutation": "Dear Hiring Manager,",
                    "paragraphs": [
                        "I'm applying for the Software Engineer role at Target Company because your focus on building practical, scalable tools matches how I think about engineering.",
                        "At Acme Corp I reduced API response time by 40% and shipped three features that improved customer retention. I bring the same ownership mindset to every project I take on.",
                        "I'd be glad to talk through how my background fits what you're looking for. I'm available for a call at your convenience."
                    ],
                    "sign_off": "Best regards,"
                }
            # Generator output for CV
            if purpose.startswith("generate_"):
                return {
                    "header": {"name": "John Doe", "email": "john@example.com", "phone": "(555) 555-5555", "location": "Remote", "links": ["https://github.com/johndoe"]},
                    "education": [{"institution": "University X", "degree": "B.S.", "date": "2015-2019"}],
                    "experience": [{"company": "Acme Corp", "role": "Engineer", "date": "2019-2023", "bullet_points": ["Built feature X", "Improved Y by 30%"]}],
                    "projects": [],
                    "skills": ["Python", "APIs", "Automation"],
                    "soft_skills": ["communication", "ownership"]
                }
            # Discriminator / scoring mock
            if purpose.startswith("score_") or purpose.startswith("gan_discriminator"):
                return {"score": 8.2, "notes": ["Quantify achievements", "Use action verbs"], "passed": False}
            # Insight explanation mock
            if purpose.startswith("explain_insight"):
                return {
                    "term_definition": "Taking full responsibility for a task from start to finish — including problems you didn't cause — without waiting to be told what to do next.",
                    "why_identified": "This was identified from the job posting which explicitly mentions this requirement in the qualifications section.",
                    "source_quote": "We value candidates who demonstrate strong ownership and technical depth.",
                    "what_it_means": "Add a bullet point in your most recent role that shows you drove something end-to-end without being managed.",
                    "priority": "high"
                }
            # Generic JSON fallback
            return {"mock": True, "purpose": purpose}

        # Non-JSON (text) mock responses
        if purpose.startswith("suggest_roles"):
            return "Software Engineer; Backend Engineer; Platform Engineer"
        return f"[MOCKED RESPONSE] purpose={purpose}"

    # Live OpenRouter path
    for attempt in range(max_retries):
        try:
            logger.info(f"Calling OpenRouter API (Attempt {attempt+1}/{max_retries}) | Purpose: {purpose}")
            
            headers = {
                "Authorization": f"Bearer {_get_openrouter_key()}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://jobless.io",
                "X-Title": "jobless.io"
            }
            
            payload = {
                "model": settings.OPENROUTER_MODEL,
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": max_tokens,
                "tool_choice": "none",
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url="https://openrouter.ai/api/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=60.0
                )
            
            if response.status_code == 402:
                return await _call_via_groq_fallback(messages, max_tokens, expect_json, purpose)
            if response.status_code != 200:
                raise Exception(f"OpenRouter API error: {response.status_code} - {response.text}")
            
            data = response.json()
            choice = data["choices"][0]
            finish_reason = choice.get("finish_reason", "unknown")
            content = choice["message"].get("content") or ""
            usage = data.get("usage", {"prompt_tokens": 0, "completion_tokens": 0})

            if not content:
                logger.error(
                    f"Empty content from OpenRouter | purpose={purpose} | "
                    f"finish_reason={finish_reason} | full_response={data}"
                )
                raise ValueError(f"LLM returned empty content (finish_reason={finish_reason}).")

            # Log decision
            _log_groq_decision(
                module="groq_service",
                function="call_groq",
                purpose=purpose,
                prompt_tokens=usage.get("prompt_tokens", 0),
                completion_tokens=usage.get("completion_tokens", 0),
                model=settings.OPENROUTER_MODEL,
                success=True,
                attempt=attempt+1
            )

            if expect_json:
                return _parse_json_response(content)

            return content

        except Exception as e:
            error_msg = str(e).lower()
            
            _log_groq_decision(
                module="groq_service",
                function="call_groq",
                purpose=purpose,
                prompt_tokens=0,
                completion_tokens=0,
                model=settings.OPENROUTER_MODEL,
                success=False,
                attempt=attempt+1,
                error=str(e)
            )

            # Retry logic for rate limits, server errors, or truncated JSON responses
            if "rate limit" in error_msg or "429" in error_msg or "503" in error_msg or "500" in error_msg or isinstance(e, ValueError):
                if attempt < max_retries - 1:
                    sleep_time = base_delay * (2 ** attempt)
                    logger.warning(f"OpenRouter API Error: {str(e)}. Retrying in {sleep_time}s...")
                    await asyncio.sleep(sleep_time)
                    continue
            
            # If not a retryable error or out of retries, raise
            logger.error(f"OpenRouter API call failed after {attempt+1} attempts: {str(e)}")
            raise e

    raise Exception("Max retries exceeded for OpenRouter API call.")


def _parse_json_response(content: str) -> Any:
    """Safely extract and parse JSON from response, handling markdown fences and trailing text."""
    import re
    content = content.strip()

    # Strip markdown code fences (```json ... ``` or ``` ... ```)
    fence = re.match(r'^```(?:json)?\s*([\s\S]*?)\s*```$', content)
    if fence:
        content = fence.group(1).strip()

    # Try direct parse
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass

    # Extract first {...} or [...] block
    match = re.search(r'(\{[\s\S]*\}|\[[\s\S]*\])', content)
    if match:
        extracted = match.group(0)
        try:
            return json.loads(extracted)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse extracted JSON: {extracted[:300]}")
            raise ValueError(f"Invalid JSON returned by LLM: {str(e)}")

    logger.error(f"No JSON structure found in LLM response: {content[:300]}")
    raise ValueError("No valid JSON found in LLM response.")


def _log_groq_decision(
    module: str,
    function: str,
    purpose: str,
    prompt_tokens: int,
    completion_tokens: int,
    model: str,
    success: bool,
    attempt: int,
    error: Optional[str] = None
) -> None:
    """Logs LLM interaction details to decisions.log."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    status = "success" if success else f"failed (error: {error})"
    
    log_entry = (
        f"[{timestamp}] [DECISION] module={module} function={function} purpose={purpose}\n"
        f"  model={model} attempt={attempt} status={status}\n"
        f"  prompt_tokens={prompt_tokens} completion_tokens={completion_tokens}\n"
        f"  action=groq_completion\n"
    )
    
    try:
        log_path = Path(settings.DECISIONS_LOG)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(log_entry)
    except Exception as e:
        logger.error(f"Could not write to decisions.log: {e}")
