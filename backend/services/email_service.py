import os
import smtplib
import logging
from email.message import EmailMessage
from datetime import datetime

from backend.models.schemas import TargetCompany

logger = logging.getLogger(__name__)

# Default to Gmail — works from any IP, completely free, 500/day
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587


def _load_user_keys() -> dict:
    try:
        from backend.services.user_service import get_active_user_id, get_api_keys
        uid = get_active_user_id()
        if uid:
            return get_api_keys(uid)
    except Exception:
        pass
    return {}


async def send_application_email(
    target: TargetCompany,
    cv_pdf_path: str,
    cl_pdf_path: str,
    cover_letter_subject: str,
    cover_letter_text: str,
) -> dict:
    """Send application via Gmail SMTP (App Password — no IP restrictions)."""
    logger.info(f"Sending email to {target.company_name}")

    user_keys = None

    def _get(key: str) -> str:
        nonlocal user_keys
        val = os.environ.get(key, "")
        if not val:
            if user_keys is None:
                user_keys = _load_user_keys()
            val = user_keys.get(key, "")
        return val

    smtp_user = _get("SMTP_USER").strip()
    smtp_password = _get("SMTP_PASSWORD").replace(" ", "")  # App Passwords are shown with spaces but sent without
    sender_name = _get("SENDER_NAME").strip()

    if not smtp_user or not smtp_password:
        logger.warning("No SMTP credentials — mocking email send.")
        return {
            "success": True, "method": "email",
            "timestamp": datetime.now().isoformat(),
            "error": None, "message_id": "mock_id_123",
        }

    # From: "Yassine Dhouib <yassine.m.dhouib@gmail.com>"
    from_header = f"{sender_name} <{smtp_user}>" if sender_name else smtp_user

    try:
        msg = EmailMessage()
        msg["Subject"] = cover_letter_subject
        msg["From"] = from_header
        msg["To"] = target.hr_email or "hr@example.com"

        msg.set_content(cover_letter_text)
        msg.add_alternative(
            f"<html><body><p>{cover_letter_text.replace(chr(10), '<br>')}</p></body></html>",
            subtype="html",
        )

        name_prefix = sender_name if sender_name else "CV"
        for path, filename in [
            (cv_pdf_path, f"{name_prefix} CV.pdf"),
            (cl_pdf_path, f"{name_prefix} Cover Letter.pdf"),
        ]:
            try:
                with open(path, "rb") as f:
                    msg.add_attachment(
                        f.read(), maintype="application", subtype="pdf", filename=filename
                    )
            except FileNotFoundError:
                pass

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)

        logger.info(f"Email sent to {target.company_name}")
        return {
            "success": True, "method": "email",
            "timestamp": datetime.now().isoformat(),
            "error": None, "message_id": "gmail_sent",
        }

    except Exception as e:
        logger.error(f"Email send failed: {e}")
        return {
            "success": False, "method": "email",
            "timestamp": datetime.now().isoformat(),
            "error": str(e), "message_id": None,
        }
