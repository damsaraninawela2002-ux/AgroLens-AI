from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import HTTPException, Request, status

RATE_LIMIT_MAX_REQUESTS = 20
RATE_LIMIT_WINDOW_MINUTES = 15
MAX_REQUESTS = RATE_LIMIT_MAX_REQUESTS
WINDOW_MINUTES = RATE_LIMIT_WINDOW_MINUTES
WINDOW_SECONDS = RATE_LIMIT_WINDOW_MINUTES * 60

_ip_requests: dict[str, list[datetime]] = defaultdict(list)
_ip_auth_requests = _ip_requests
rate_limit_store = _ip_requests


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


get_client_ip = get_request_ip


def reset_rate_limits() -> None:
    """Clear in-memory IP rate limit counters."""
    _ip_requests.clear()


reset_auth_rate_limits = reset_rate_limits
clear_rate_limits = reset_rate_limits


def check_rate_limit(request: Request) -> None:
    """
    Enforce an in-memory IP rate limit of 20 requests per 15 minutes
    for POST /api/auth/login and POST /api/auth/register.
    Raises HTTP 429 when the limit is exceeded.
    """
    ip = get_request_ip(request)
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=RATE_LIMIT_WINDOW_MINUTES)

    recent = [ts for ts in _ip_requests[ip] if ts > cutoff]
    if len(recent) >= RATE_LIMIT_MAX_REQUESTS:
        _ip_requests[ip] = recent
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Please try again later.",
        )

    recent.append(now)
    _ip_requests[ip] = recent


check_auth_rate_limit = check_rate_limit
rate_limit = check_rate_limit
