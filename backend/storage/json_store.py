import json
import logging
import os
import shutil
from pathlib import Path
from typing import Any, List, Optional, Type, TypeVar
from pydantic import BaseModel, TypeAdapter
from backend.config import settings
from backend.models.schemas import (
    ProfileMeta, ApplicationHistory, TargetCompany,
    ApplicationMeta, InterviewSession
)

# Setup logging for storage operations
logging.basicConfig(
    filename=settings.DEBUG_LOG,
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(module)s: %(message)s"
)
logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

# ---------------------------------------------------------------------------
# User-aware path resolution
# ---------------------------------------------------------------------------
_BASE = Path(__file__).resolve().parent.parent.parent
_ACTIVE_USER_FILE = _BASE / "data" / ".active_user"
_USERS_DIR = _BASE / "data" / "users"


def _user_data_dir() -> Path:
    """Returns the active user's data directory, falls back to settings.DATA_DIR."""
    if _ACTIVE_USER_FILE.exists():
        uid = _ACTIVE_USER_FILE.read_text(encoding="utf-8").strip()
        if uid:
            d = _USERS_DIR / uid
            if d.exists():
                return d
    return settings.DATA_DIR


# ---------------------------------------------------------------------------
# Generic atomic write / read helpers
# ---------------------------------------------------------------------------

def write_json_atomic(path: Path, data: Any):
    """
    Writes data to a temporary file then renames it to the target path.
    This ensures atomic writes and prevents data corruption.
    """
    tmp_path = path.with_suffix(".tmp")
    try:
        # Ensure directory exists
        path.parent.mkdir(parents=True, exist_ok=True)

        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.flush()
            os.fsync(f.fileno())

        shutil.move(tmp_path, path)
        logger.info(f"Successfully wrote {path}")
    except Exception as e:
        logger.error(f"Failed to write {path}: {str(e)}")
        if tmp_path.exists():
            tmp_path.unlink()
        raise


def read_json(path: Path, model: Type[T]) -> T:
    """Reads JSON from path and validates against the provided Pydantic model."""
    try:
        if not path.exists():
            logger.warning(f"File not found: {path}")
            raise FileNotFoundError(f"File {path} does not exist.")

        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        logger.info(f"Successfully read {path}")
        return model.model_validate(data)
    except Exception as e:
        logger.error(f"Error reading {path}: {str(e)}")
        raise


def read_json_list(path: Path, model: Type[T]) -> List[T]:
    """Reads a JSON list and validates each item against the Pydantic model."""
    try:
        if not path.exists():
            return []

        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        adapter = TypeAdapter(List[model])
        logger.info(f"Successfully read list from {path}")
        return adapter.validate_python(data)
    except Exception as e:
        logger.error(f"Error reading list from {path}: {str(e)}")
        raise


# ---------------------------------------------------------------------------
# Specific Store Implementations (user-aware)
# ---------------------------------------------------------------------------

def read_raw_profile() -> dict:
    """Reads profile.json and returns the raw dict without Pydantic validation."""
    path = _user_data_dir() / "profile.json"
    try:
        if not path.exists():
            logger.warning(f"File not found: {path}")
            raise FileNotFoundError(f"File {path} does not exist.")
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        logger.info(f"Successfully read raw profile from {path}")
        return data
    except Exception as e:
        logger.error(f"Error reading raw profile from {path}: {str(e)}")
        raise


def write_profile(data: dict):
    """Writes profile data to profile.json using atomic write."""
    write_json_atomic(_user_data_dir() / "profile.json", data)


def read_profile() -> ProfileMeta:
    return read_json(_user_data_dir() / "profile.json", ProfileMeta)


def read_history() -> List[ApplicationHistory]:
    return read_json_list(_user_data_dir() / "history.json", ApplicationHistory)


def write_history(data: List[ApplicationHistory]):
    json_data = [item.model_dump(mode='json') for item in data]
    write_json_atomic(_user_data_dir() / "history.json", json_data)


def read_targets() -> List[TargetCompany]:
    return read_json_list(_user_data_dir() / "targets.json", TargetCompany)


def write_targets(data: List[TargetCompany]):
    json_data = [item.model_dump(mode='json') for item in data]
    write_json_atomic(_user_data_dir() / "targets.json", json_data)


def read_application_meta(company_id: str) -> ApplicationMeta:
    path = (_user_data_dir() / "applications") / company_id / "meta.json"
    return read_json(path, ApplicationMeta)


def write_application_meta(company_id: str, data: ApplicationMeta):
    path = (_user_data_dir() / "applications") / company_id / "meta.json"
    write_json_atomic(path, data.model_dump(mode='json'))


def read_interview_session(company_id: str, session_id: str) -> InterviewSession:
    path = (_user_data_dir() / "interview_sessions") / company_id / f"{session_id}.json"
    return read_json(path, InterviewSession)


def write_interview_session(company_id: str, session_id: str, data: InterviewSession):
    path = (_user_data_dir() / "interview_sessions") / company_id / f"{session_id}.json"
    write_json_atomic(path, data.model_dump(mode='json'))


def read_blacklist() -> list:
    """Read the list of blacklisted job URLs."""
    path = _user_data_dir() / "blacklist.json"
    if not path.exists():
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def write_blacklist(urls: list):
    """Write the list of blacklisted job URLs."""
    write_json_atomic(_user_data_dir() / "blacklist.json", urls)


def get_applications_dir() -> Path:
    """Returns the active user's applications directory."""
    return _user_data_dir() / "applications"


def get_interview_sessions_dir() -> Path:
    """Returns the active user's interview sessions directory."""
    return _user_data_dir() / "interview_sessions"
