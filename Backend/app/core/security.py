from collections import defaultdict
from datetime import datetime, timedelta, timezone
import hashlib
import re
from typing import Any, Callable, Optional
import uuid
import bcrypt
from bson import ObjectId
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from motor.motor_asyncio import AsyncIOMotorCollection
from app.core.config import settings
from app.core.database import get_database

# OAuth2 scheme pointing to /api/auth/login so Swagger UI "Authorize" button works directly
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

# Brute-force & IP Rate Limiting constants
MAX_FAILED_LOGINS = 5
LOCKOUT_WINDOW_MINUTES = 15
LOCKOUT_DURATION_MINUTES = 15


def format_lockout_message(minutes: int) -> str:
    """Format the account lockout error message."""
    return f"Account locked. Try again in {max(1, int(minutes))} minutes."

RATE_LIMIT_MAX_REQUESTS = 20
RATE_LIMIT_WINDOW_MINUTES = 15
_ip_auth_requests: dict[str, list[datetime]] = defaultdict(list)

# In-memory revoked token / session tracking
_revoked_tokens: set[str] = set()
_revoked_sessions: set[str] = set()


def _install_user_token_version_hook() -> None:
    """Automatically increment token_version when a user's password changes or account is deactivated."""
    if getattr(AsyncIOMotorCollection, "_token_version_hook_installed", False):
        return
    orig_update_one = AsyncIOMotorCollection.update_one

    async def _wrapped_update_one(
        self: AsyncIOMotorCollection,
        filter: Any,
        update: Any,
        *args: Any,
        **kwargs: Any,
    ) -> Any:
        if self.name == "users" and isinstance(update, dict):
            set_fields = update.get("$set")
            inc_fields = update.get("$inc")
            if isinstance(set_fields, dict):
                password_changed = "hashed_password" in set_fields
                deactivated = set_fields.get("is_active") is False
                already_handled = (
                    "token_version" in set_fields
                    or (isinstance(inc_fields, dict) and "token_version" in inc_fields)
                )
                if (password_changed or deactivated) and not already_handled:
                    new_inc = dict(inc_fields) if isinstance(inc_fields, dict) else {}
                    new_inc["token_version"] = int(new_inc.get("token_version", 0)) + 1
                    update = {**update, "$inc": new_inc}
        return await orig_update_one(self, filter, update, *args, **kwargs)

    AsyncIOMotorCollection.update_one = _wrapped_update_one  # type: ignore[method-assign]
    AsyncIOMotorCollection._token_version_hook_installed = True  # type: ignore[attr-defined]


_install_user_token_version_hook()


def hash_token_id(token_id: Optional[str]) -> str:
    """Return the SHA-256 hex digest of a refresh token ID (never null or empty)."""
    raw = (token_id or "").strip() or str(uuid.uuid4())
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def revoke_token_in_memory(token: Optional[str], hashed_token_id: Optional[str] = None) -> None:
    """Record a token and/or hashed_token_id as revoked in memory."""
    if token:
        _revoked_tokens.add(token)
    if hashed_token_id:
        _revoked_sessions.add(hashed_token_id)
        _revoked_sessions.add(hash_token_id(hashed_token_id))


def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Ensure a datetime object returned by MongoDB is timezone-aware UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def get_request_ip(request: Optional[Request]) -> str:
    """Extract client IP address from X-Forwarded-For or client host."""
    if request is None:
        return "unknown"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def reset_auth_rate_limits() -> None:
    """Clear in-memory IP rate limit counters."""
    _ip_auth_requests.clear()


def check_auth_rate_limit(request: Request) -> None:
    """
    Enforce a sliding-window IP rate limit of 20 requests per 15 minutes
    on /api/auth/login and /api/auth/register.
    Raises HTTP 429 with a friendly message when exceeded.
    """
    ip = get_request_ip(request)
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=RATE_LIMIT_WINDOW_MINUTES)

    recent = [ts for ts in _ip_auth_requests[ip] if ts > cutoff]
    if len(recent) >= RATE_LIMIT_MAX_REQUESTS:
        _ip_auth_requests[ip] = recent
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "Too many authentication requests from your IP address. "
                f"Please wait {RATE_LIMIT_WINDOW_MINUTES} minutes and try again."
            ),
        )

    recent.append(now)
    _ip_auth_requests[ip] = recent


def validate_password_policy(password: str, email: Optional[str] = None) -> str:
    """
    Enforce password policy for new registrations, password resets, and admin-created users:
    - Minimum 8 characters
    - At least one letter (A-Z or a-z)
    - At least one number (0-9)
    - Not equal to the user's email address
    """
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if not re.search(r"[A-Za-z]", password):
        raise ValueError("Password must contain at least one letter")
    if not re.search(r"\d", password):
        raise ValueError("Password must contain at least one number")
    if email and password.strip().lower() == email.strip().lower():
        raise ValueError("Password cannot be the same as your email address")
    return password


def hash_password(password: str) -> str:
    """Hash a plain-text password using bcrypt."""
    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except ValueError:
        return False


def create_access_token(
    data: dict, expires_delta: Optional[timedelta] = None
) -> str:
    """Create a signed JWT access token including token_version and jti."""
    if not settings.JWT_SECRET_KEY:
        raise RuntimeError("JWT_SECRET_KEY is not configured")

    to_encode = data.copy()
    if "token_version" not in to_encode:
        to_encode["token_version"] = 0
    else:
        to_encode["token_version"] = int(to_encode["token_version"] or 0)
    if "jti" not in to_encode:
        to_encode["jti"] = str(uuid.uuid4())
    expire = datetime.now(timezone.utc) + (
        expires_delta
        if expires_delta is not None
        else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def create_refresh_token(
    data: dict, expires_delta: Optional[timedelta] = None
) -> str:
    """Create a signed JWT refresh token."""
    if not settings.JWT_SECRET_KEY:
        raise RuntimeError("JWT_SECRET_KEY is not configured")

    to_encode = data.copy()
    to_encode["type"] = "refresh"
    if "jti" not in to_encode:
        to_encode["jti"] = str(uuid.uuid4())
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta is not None else timedelta(days=7)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def verify_access_token(token: str) -> dict:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def serialize_user(user_doc: dict) -> dict:
    """Convert a MongoDB user document into a safe dictionary without password fields."""
    role = user_doc["role"]
    default_approved = False if role == "officer" else True
    failed_count = int(
        user_doc.get("failed_login_count", user_doc.get("failed_login_attempts", 0)) or 0
    )
    token_version = int(user_doc.get("token_version", 0) or 0)
    return {
        "id": str(user_doc["_id"]),
        "full_name": user_doc["full_name"],
        "email": user_doc["email"],
        "role": role,
        "district": user_doc["district"],
        "preferred_language": user_doc.get("preferred_language", "en"),
        "is_active": bool(user_doc.get("is_active", True)),
        "is_approved": bool(user_doc.get("is_approved", default_approved)),
        "approved_by": user_doc.get("approved_by"),
        "approved_at": user_doc.get("approved_at"),
        "failed_login_count": failed_count,
        "failed_login_attempts": failed_count,
        "locked_until": user_doc.get("locked_until"),
        "token_version": token_version,
        "updated_at": user_doc.get("updated_at"),
        "created_at": user_doc["created_at"],
    }


async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
) -> dict:
    """FastAPI dependency that validates the Bearer token and returns the current user."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if token in _revoked_tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Session has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = verify_access_token(token)
    raw_jti: Optional[str] = payload.get("jti")
    hashed_tid: Optional[str] = payload.get("hashed_token_id") or (
        hash_token_id(raw_jti) if raw_jti else None
    )
    if (hashed_tid and hashed_tid in _revoked_sessions) or (
        raw_jti and raw_jti in _revoked_sessions
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Session has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id: Optional[str] = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Token payload is missing subject",
            headers={"WWW-Authenticate": "Bearer"},
        )

    db = get_database()
    if hashed_tid:
        session_doc = await db["sessions"].find_one({"hashed_token_id": hashed_tid})
        if session_doc is not None and (
            session_doc.get("revoked", False) or not session_doc.get("is_active", True)
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized: Session has been revoked",
                headers={"WWW-Authenticate": "Bearer"},
            )

    user_doc = None
    if ObjectId.is_valid(user_id):
        user_doc = await db["users"].find_one({"_id": ObjectId(user_id)})
    if user_doc is None:
        user_doc = await db["users"].find_one({"email": user_id})

    if user_doc is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: User no longer exists",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_token_version = int(user_doc.get("token_version", 0) or 0)
    token_version = payload.get("token_version")
    if token_version is None or int(token_version) != user_token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Token version mismatch",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user_doc.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated",
        )

    return serialize_user(user_doc)


def require_role(*allowed_roles: str) -> Callable:
    """Dependency factory that restricts route access to specific user roles."""

    async def role_dependency(
        current_user: dict = Depends(get_current_user),
    ) -> dict:
        user_role = current_user.get("role")
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Forbidden: Insufficient permissions. "
                    f"Required role(s): {', '.join(allowed_roles)}"
                ),
            )

        if user_role == "officer" and not current_user.get("is_approved", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your officer account is waiting for admin approval",
            )

        return current_user

    return role_dependency
