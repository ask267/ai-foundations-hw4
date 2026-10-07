"""Authentication helpers for Campus Customs.

Passwords are never stored in plain text. We store a salted PBKDF2-HMAC-SHA256
hash in the users.password_hash column using the format:

    pbkdf2_sha256$<iterations>$<salt_hex>$<hash_hex>

Each account gets its own random 16-byte salt, so two people with the same
password still get different hashes, and a stolen database can't be reversed
into passwords (an attacker would have to brute-force each hash separately).
We also accept the seed database's 3-part format (pbkdf2_sha256$salt$hash)
for backward compatibility with the pre-loaded users.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import time
from pathlib import Path

ALGORITHM = "pbkdf2_sha256"
ITERATIONS = 260_000
SALT_BYTES = 16
# The seed database's 3-part hashes don't record their iteration count. They were
# made with PBKDF2-HMAC-SHA256, 120,000 iterations, and the salt text as UTF-8
# bytes (checked against the seed test user, test@campuscustoms.yale.edu).
LEGACY_ITERATIONS = 120_000


def _pbkdf2(password: str, salt: bytes, iterations: int) -> str:
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return dk.hex()


def hash_password(password: str) -> str:
    """Create a fresh salted hash string to store for a new account."""
    salt = os.urandom(SALT_BYTES)
    digest = _pbkdf2(password, salt, ITERATIONS)
    return f"{ALGORITHM}${ITERATIONS}${salt.hex()}${digest}"


def verify_password(password: str, stored: str) -> bool:
    """Check a password against a stored hash without ever un-hashing it."""
    try:
        parts = stored.split("$")
        if len(parts) == 4:
            _algo, iterations_s, salt_hex, digest = parts
            iterations = int(iterations_s)
            salt = bytes.fromhex(salt_hex)
        elif len(parts) == 3:
            # Legacy seed format: pbkdf2_sha256$<salt>$<hash>, salt used as text.
            _algo, salt_raw, digest = parts
            iterations = LEGACY_ITERATIONS
            salt = salt_raw.encode("utf-8")
        else:
            return False
    except (ValueError, AttributeError):
        return False

    candidate = _pbkdf2(password, salt, iterations)
    # Constant-time compare to avoid timing attacks.
    return hmac.compare_digest(candidate, digest)


# ---------- session tokens ----------
#
# After login/signup the API hands the browser a signed token:
#     <user_id>.<expires_unix>.<hmac_sha256_hex>
# The HMAC is keyed with a server-only secret, so the browser can't forge a token
# for someone else's user_id. Chat history routes trust only this token, never a
# user id sent by the client.

TOKEN_TTL_SECONDS = 7 * 24 * 3600
_SECRET_PATH = Path(__file__).resolve().parent / ".session_secret"


def _load_secret() -> bytes:
    """SESSION_SECRET env var, else a random secret kept in backend/.session_secret."""
    env = os.getenv("SESSION_SECRET")
    if env:
        return env.encode("utf-8")
    if not _SECRET_PATH.exists():
        _SECRET_PATH.write_text(secrets.token_hex(32), encoding="utf-8")
        _SECRET_PATH.chmod(0o600)
    return _SECRET_PATH.read_text(encoding="utf-8").strip().encode("utf-8")


_SECRET = _load_secret()


def _sign(payload: str) -> str:
    return hmac.new(_SECRET, payload.encode("utf-8"), hashlib.sha256).hexdigest()


def issue_token(user_id: int) -> str:
    payload = f"{user_id}.{int(time.time()) + TOKEN_TTL_SECONDS}"
    return f"{payload}.{_sign(payload)}"


def read_token(token: str | None) -> int | None:
    """The user_id inside a valid, unexpired token, else None."""
    try:
        user_id, expires, signature = (token or "").split(".")
        payload = f"{user_id}.{expires}"
        if not hmac.compare_digest(signature, _sign(payload)):
            return None
        if int(expires) < time.time():
            return None
        return int(user_id)
    except ValueError:
        return None
