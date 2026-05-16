"""
Encryption service using Fernet (AES-128 CBC + HMAC-SHA256).
Manages a master key stored at data/master.key.
"""
import json
import os
from pathlib import Path

from cryptography.fernet import Fernet

_BASE_DIR = Path(__file__).resolve().parent.parent.parent
_MASTER_KEY_FILE = _BASE_DIR / "data" / "master.key"

_fernet_instance: Fernet | None = None


def get_or_create_master_key() -> Fernet:
    """
    Reads the master key from data/master.key.
    If the file does not exist, generates a new key and writes it.
    Returns a Fernet instance ready for use.
    """
    global _fernet_instance
    if _fernet_instance is not None:
        return _fernet_instance

    _MASTER_KEY_FILE.parent.mkdir(parents=True, exist_ok=True)

    if _MASTER_KEY_FILE.exists():
        key = _MASTER_KEY_FILE.read_bytes().strip()
    else:
        key = Fernet.generate_key()
        # Write atomically
        tmp = _MASTER_KEY_FILE.with_suffix(".tmp")
        tmp.write_bytes(key)
        import shutil
        shutil.move(str(tmp), str(_MASTER_KEY_FILE))

    _fernet_instance = Fernet(key)
    return _fernet_instance


def encrypt_value(value: str) -> str:
    """Encrypt a plaintext string and return a base64-encoded ciphertext string."""
    f = get_or_create_master_key()
    return f.encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_value(encrypted: str) -> str:
    """Decrypt a base64-encoded ciphertext string and return the plaintext string."""
    f = get_or_create_master_key()
    return f.decrypt(encrypted.encode("utf-8")).decode("utf-8")


def encrypt_dict(data: dict) -> str:
    """JSON-serialise *data* then encrypt; returns a base64 string."""
    return encrypt_value(json.dumps(data, ensure_ascii=False))


def decrypt_dict(encrypted: str) -> dict:
    """Decrypt *encrypted* then JSON-parse; returns a dict."""
    return json.loads(decrypt_value(encrypted))
