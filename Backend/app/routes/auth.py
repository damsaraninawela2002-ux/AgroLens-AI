from datetime import datetime, timedelta, timezone
import hashlib
import math
from typing import Any, Optional
import uuid
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from jose import JWTError, jwt
from pydantic import ValidationError
from pymongo.errors import DuplicateKeyError
from app.core.config import settings
from app.core.database import get_database
from app.core.rate_limit import check_rate_limit, get_request_ip
from app.core.security import (
    LOCKOUT_DURATION_MINUTES,
    LOCKOUT_WINDOW_MINUTES,
    MAX_FAILED_LOGINS,
    create_access_token,
    create_refresh_token,
    ensure_utc,
    format_lockout_message,
    get_current_user,
    hash_password,
    hash_token_id,
    oauth2_scheme,
    revoke_token_in_memory,
    serialize_user,
    validate_password_policy,
    verify_password,
)
from app.models.user import TokenResponse, UserLogin, UserRegister, UserResponse

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


async def record_login_event(
    db: Any,
    user_id: Optional[str],
    email: str,
    success: bool,
    reason: str,
    request: Request,
) -> None:
    """Record every login attempt in the 'login_events' collection."""
    event_doc = {
        "user_id": user_id,
        "email": email,
        "success": bool(success),
        "reason": reason,
        "ip_address": get_request_ip(request),
        "user_agent": request.headers.get("user-agent") or "",
        "created_at": datetime.now(timezone.utc),
    }
    await db["login_events"].insert_one(event_doc)


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new Farmer or Agricultural Officer",
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "application/json": {
                    "schema": UserRegister.model_json_schema(),
                }
            },
        }
    },
)
async def register_user(request: Request) -> UserResponse:
    """Register a new user account. Admin creation is prohibited via public registration."""
    check_rate_limit(request)

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid request body",
        )

    if isinstance(body, dict):
        raw_password = body.get("password")
        raw_email = body.get("email")
        if isinstance(raw_password, str):
            try:
                validate_password_policy(
                    raw_password,
                    raw_email if isinstance(raw_email, str) else None,
                )
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(exc),
                )

    try:
        payload = UserRegister(**body)
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=exc.errors(),
        )

    try:
        validate_password_policy(payload.password, payload.email)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    db = get_database()

    # Check if email already exists
    existing_user = await db["users"].find_one({"email": payload.email})
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already exists",
        )

    now = datetime.now(timezone.utc)
    is_approved = True if payload.role == "farmer" else False
    user_doc = {
        "full_name": payload.full_name,
        "email": payload.email,
        "hashed_password": hash_password(payload.password),
        "role": payload.role,
        "district": payload.district,
        "preferred_language": payload.preferred_language,
        "is_active": True,
        "is_approved": is_approved,
        "approved_by": None,
        "approved_at": None,
        "failed_login_count": 0,
        "failed_login_attempts": 0,
        "first_failed_login_at": None,
        "locked_until": None,
        "token_version": 0,
        "updated_at": now,
        "created_at": now,
    }

    try:
        result = await db["users"].insert_one(user_doc)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already exists",
        )

    user_doc["_id"] = result.inserted_id
    return UserResponse(**serialize_user(user_doc))


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Log in with email and password (supports JSON and Swagger Authorize form)",
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "application/json": {
                    "schema": UserLogin.model_json_schema(),
                },
                "application/x-www-form-urlencoded": {
                    "schema": {
                        "type": "object",
                        "required": ["username", "password"],
                        "properties": {
                            "username": {
                                "type": "string",
                                "title": "Email (username)",
                                "description": "User email address",
                            },
                            "password": {
                                "type": "string",
                                "title": "Password",
                                "format": "password",
                            },
                        },
                    }
                },
            },
        }
    },
)
async def login_user(request: Request, response: Response) -> TokenResponse:
    """
    Authenticate a user and return a JWT access token along with user details.
    Accepts either:
    - JSON payload (`{"email": "...", "password": "..."}`) for frontend / API clients
    - Form data (`username=...&password=...`) for the FastAPI `/docs` Authorize button
    """
    content_type = request.headers.get("content-type", "").lower()
    email: str = ""
    password: str = ""

    check_rate_limit(request)

    if "application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type:
        form_data = await request.form()
        email = str(form_data.get("username") or form_data.get("email") or "").strip().lower()
        password = str(form_data.get("password") or "")
        if not email or not password:
            await record_login_event(
                db=get_database(),
                user_id=None,
                email=email,
                success=False,
                reason="missing_credentials",
                request=request,
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
    else:
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid request body",
            )
        if (
            isinstance(body, dict)
            and isinstance(body.get("email"), str)
            and isinstance(body.get("password"), str)
            and body.get("email", "").strip()
            and body.get("password", "")
        ):
            try:
                login_data = UserLogin(**body)
                email = login_data.email
                password = login_data.password
            except ValidationError:
                email = body["email"].strip().lower()
                password = body["password"]
        else:
            try:
                login_data = UserLogin(**body)
                email = login_data.email
                password = login_data.password
            except ValidationError as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=exc.errors(),
                )

    db = get_database()
    now = datetime.now(timezone.utc)
    user_doc = await db["users"].find_one({"email": email})

    # 1. If user does not exist, record failed login event and return generic error
    if user_doc is None:
        await record_login_event(
            db=db,
            user_id=None,
            email=email,
            success=False,
            reason="user_not_found",
            request=request,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    uid_str = str(user_doc["_id"])

    # 2. Check if the account is currently locked due to brute-force protection
    locked_until = ensure_utc(user_doc.get("locked_until"))
    if locked_until is not None and locked_until > now:
        remaining_seconds = (locked_until - now).total_seconds()
        minutes_remaining = max(1, math.ceil(remaining_seconds / 60))
        await record_login_event(
            db=db,
            user_id=uid_str,
            email=email,
            success=False,
            reason="account_locked",
            request=request,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=format_lockout_message(minutes_remaining),
        )

    # 3. Verify password
    if not verify_password(password, user_doc.get("hashed_password", "")):
        first_failed = ensure_utc(user_doc.get("first_failed_login_at"))
        current_attempts = int(
            user_doc.get("failed_login_count", user_doc.get("failed_login_attempts", 0)) or 0
        )

        # Reset counter if a previous lock expired or the 15-minute window has elapsed
        if (locked_until is not None and locked_until <= now) or (
            first_failed is None
            or (now - first_failed) > timedelta(minutes=LOCKOUT_WINDOW_MINUTES)
        ):
            new_attempts = 1
            new_first_failed = now
        else:
            new_attempts = current_attempts + 1
            new_first_failed = first_failed

        if new_attempts >= MAX_FAILED_LOGINS:
            new_locked_until = now + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
            await db["users"].update_one(
                {"_id": user_doc["_id"]},
                {
                    "$set": {
                        "failed_login_count": new_attempts,
                        "failed_login_attempts": new_attempts,
                        "first_failed_login_at": new_first_failed,
                        "locked_until": new_locked_until,
                        "updated_at": now,
                    }
                },
            )
            await record_login_event(
                db=db,
                user_id=uid_str,
                email=email,
                success=False,
                reason="account_locked",
                request=request,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=format_lockout_message(LOCKOUT_DURATION_MINUTES),
            )

        await db["users"].update_one(
            {"_id": user_doc["_id"]},
            {
                "$set": {
                    "failed_login_count": new_attempts,
                    "failed_login_attempts": new_attempts,
                    "first_failed_login_at": new_first_failed,
                    "locked_until": None,
                    "updated_at": now,
                }
            },
        )
        await record_login_event(
            db=db,
            user_id=uid_str,
            email=email,
            success=False,
            reason="invalid_password",
            request=request,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 4. Check if the account is deactivated
    if not user_doc.get("is_active", True):
        await record_login_event(
            db=db,
            user_id=uid_str,
            email=email,
            success=False,
            reason="account_deactivated",
            request=request,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated",
        )

    # 5. Successful login: reset brute-force counter and record login event
    token_version = int(user_doc.get("token_version", 0) or 0)
    if (
        user_doc.get("failed_login_count", 0)
        or user_doc.get("failed_login_attempts", 0)
        or user_doc.get("locked_until") is not None
        or user_doc.get("first_failed_login_at") is not None
        or "failed_login_count" not in user_doc
        or "locked_until" not in user_doc
        or "token_version" not in user_doc
    ):
        await db["users"].update_one(
            {"_id": user_doc["_id"]},
            {
                "$set": {
                    "failed_login_count": 0,
                    "failed_login_attempts": 0,
                    "first_failed_login_at": None,
                    "locked_until": None,
                    "token_version": token_version,
                }
            },
        )
    user_doc["failed_login_count"] = 0
    user_doc["failed_login_attempts"] = 0
    user_doc["first_failed_login_at"] = None
    user_doc["locked_until"] = None
    user_doc["token_version"] = token_version

    await record_login_event(
        db=db,
        user_id=uid_str,
        email=email,
        success=True,
        reason="success",
        request=request,
    )

    user_data = serialize_user(user_doc)
    token_id = str(uuid.uuid4())
    hashed_tid = hash_token_id(token_id)
    expire_days = int(getattr(settings, "REFRESH_TOKEN_EXPIRE_DAYS", 7) or 7)

    access_token = create_access_token(
        data={
            "sub": user_data["id"],
            "email": user_data["email"],
            "role": user_data["role"],
            "token_version": token_version,
            "jti": token_id,
            "hashed_token_id": hashed_tid,
        }
    )
    refresh_token = create_refresh_token(
        data={
            "sub": user_data["id"],
            "email": user_data["email"],
            "role": user_data["role"],
            "token_version": token_version,
            "jti": token_id,
            "hashed_token_id": hashed_tid,
        },
        expires_delta=timedelta(days=expire_days),
    )

    await db["sessions"].insert_one(
        {
            "hashed_token_id": hashed_tid,
            "user_id": user_data["id"],
            "refresh_token": refresh_token,
            "ip_address": get_request_ip(request),
            "user_agent": request.headers.get("user-agent") or "",
            "is_active": True,
            "revoked": False,
            "revoked_at": None,
            "created_at": now,
            "expires_at": now + timedelta(days=expire_days),
        }
    )

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=bool(getattr(settings, "COOKIE_SECURE", False)),
        samesite="lax",
        max_age=expire_days * 24 * 60 * 60,
        path="/",
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(**user_data),
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Rotate refresh token cookie and issue a new access token",
)
async def refresh_access_token(
    request: Request,
    response: Response,
) -> TokenResponse:
    """Validate the refresh_token cookie, rotate hashed_token_id, and issue a new access token."""
    cookie_token = request.cookies.get("refresh_token")
    if not cookie_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(
            cookie_token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError:
        response.delete_cookie(key="refresh_token", path="/", httponly=True, samesite="lax")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    raw_jti = payload.get("jti")
    hashed_tid = payload.get("hashed_token_id") or (
        hash_token_id(str(raw_jti)) if raw_jti else hash_token_id(cookie_token)
    )
    user_id = payload.get("sub")
    if not user_id or not hashed_tid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    db = get_database()
    now = datetime.now(timezone.utc)

    session_doc = await db["sessions"].find_one({"hashed_token_id": hashed_tid})
    if (
        session_doc is None
        or session_doc.get("revoked", False)
        or not session_doc.get("is_active", True)
    ):
        response.delete_cookie(key="refresh_token", path="/", httponly=True, samesite="lax")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been revoked or expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    expires_at = ensure_utc(session_doc.get("expires_at"))
    if expires_at is not None and expires_at <= now:
        await db["sessions"].update_one(
            {"hashed_token_id": hashed_tid},
            {"$set": {"revoked": True, "is_active": False, "revoked_at": now}},
        )
        response.delete_cookie(key="refresh_token", path="/", httponly=True, samesite="lax")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_doc = None
    if ObjectId.is_valid(str(user_id)):
        user_doc = await db["users"].find_one({"_id": ObjectId(str(user_id))})
    if user_doc is None:
        user_doc = await db["users"].find_one({"email": str(user_id)})

    if user_doc is None or not user_doc.get("is_active", True):
        response.delete_cookie(key="refresh_token", path="/", httponly=True, samesite="lax")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive or not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_token_version = int(user_doc.get("token_version", 0) or 0)
    token_version = payload.get("token_version", 0)
    if int(token_version) != user_token_version:
        await db["sessions"].update_one(
            {"hashed_token_id": hashed_tid},
            {"$set": {"revoked": True, "is_active": False, "revoked_at": now}},
        )
        response.delete_cookie(key="refresh_token", path="/", httponly=True, samesite="lax")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token version mismatch",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_data = serialize_user(user_doc)
    new_token_id = str(uuid.uuid4())
    new_hashed_tid = hash_token_id(new_token_id)
    expire_days = int(getattr(settings, "REFRESH_TOKEN_EXPIRE_DAYS", 7) or 7)

    new_access_token = create_access_token(
        data={
            "sub": user_data["id"],
            "email": user_data["email"],
            "role": user_data["role"],
            "token_version": user_token_version,
            "jti": new_token_id,
            "hashed_token_id": new_hashed_tid,
        }
    )
    new_refresh_token = create_refresh_token(
        data={
            "sub": user_data["id"],
            "email": user_data["email"],
            "role": user_data["role"],
            "token_version": user_token_version,
            "jti": new_token_id,
            "hashed_token_id": new_hashed_tid,
        },
        expires_delta=timedelta(days=expire_days),
    )

    await db["sessions"].update_one(
        {"hashed_token_id": hashed_tid},
        {
            "$set": {
                "hashed_token_id": new_hashed_tid,
                "refresh_token": new_refresh_token,
                "ip_address": get_request_ip(request),
                "user_agent": request.headers.get("user-agent") or "",
                "expires_at": now + timedelta(days=expire_days),
                "updated_at": now,
            }
        },
    )

    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=bool(getattr(settings, "COOKIE_SECURE", False)),
        samesite="lax",
        max_age=expire_days * 24 * 60 * 60,
        path="/",
    )

    return TokenResponse(
        access_token=new_access_token,
        token_type="bearer",
        user=UserResponse(**user_data),
    )


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Revoke the current session and clear the refresh_token cookie",
)
async def logout_user(
    request: Request,
    response: Response,
    token: Optional[str] = Depends(oauth2_scheme),
) -> dict[str, str]:
    """Revoke the current session and clear the refresh_token cookie."""
    db = get_database()
    now = datetime.now(timezone.utc)
    cookie_token = request.cookies.get("refresh_token")

    hashed_ids: set[str] = set()
    user_id: Optional[str] = None

    for raw_tok in (token, cookie_token):
        if not raw_tok:
            continue
        revoke_token_in_memory(raw_tok)
        try:
            payload = jwt.decode(
                raw_tok,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM],
                options={"verify_exp": False},
            )
            htid = payload.get("hashed_token_id")
            raw_jti = payload.get("jti")
            if htid:
                hashed_ids.add(str(htid))
                revoke_token_in_memory(raw_tok, str(htid))
            elif raw_jti:
                computed = hash_token_id(str(raw_jti))
                hashed_ids.add(computed)
                revoke_token_in_memory(raw_tok, computed)
            if payload.get("sub") and not user_id:
                user_id = str(payload.get("sub"))
        except JWTError:
            pass

    if hashed_ids:
        await db["sessions"].update_many(
            {"hashed_token_id": {"$in": list(hashed_ids)}},
            {"$set": {"is_active": False, "revoked": True, "revoked_at": now}},
        )
    if cookie_token:
        await db["sessions"].update_many(
            {"refresh_token": cookie_token},
            {"$set": {"is_active": False, "revoked": True, "revoked_at": now}},
        )
    if not hashed_ids and not cookie_token and user_id:
        latest = await db["sessions"].find_one(
            {"user_id": user_id, "revoked": False},
            sort=[("created_at", -1)],
        )
        if latest is not None and latest.get("hashed_token_id"):
            await db["sessions"].update_one(
                {"hashed_token_id": latest["hashed_token_id"]},
                {"$set": {"is_active": False, "revoked": True, "revoked_at": now}},
            )
            revoke_token_in_memory(token, str(latest["hashed_token_id"]))

    response.delete_cookie(
        key="refresh_token",
        path="/",
        httponly=True,
        samesite="lax",
    )
    return {"message": "Logged out successfully"}


@router.post(
    "/logout-all",
    status_code=status.HTTP_200_OK,
    summary="Revoke all sessions for the currently authenticated user",
)
async def logout_all_sessions(
    response: Response,
    token: Optional[str] = Depends(oauth2_scheme),
    current_user: dict = Depends(get_current_user),
) -> dict[str, str]:
    """Revoke all active sessions of the user and increment token_version."""
    db = get_database()
    now = datetime.now(timezone.utc)
    user_id = current_user["id"]

    if token:
        revoke_token_in_memory(token)

    await db["sessions"].update_many(
        {"user_id": user_id},
        {"$set": {"is_active": False, "revoked": True, "revoked_at": now}},
    )

    if ObjectId.is_valid(user_id):
        await db["users"].update_one(
            {"_id": ObjectId(user_id)},
            {"$inc": {"token_version": 1}, "$set": {"updated_at": now}},
        )
    else:
        await db["users"].update_one(
            {"email": current_user["email"]},
            {"$inc": {"token_version": 1}, "$set": {"updated_at": now}},
        )

    response.delete_cookie(
        key="refresh_token",
        path="/",
        httponly=True,
        samesite="lax",
    )
    return {"message": "Logged out from all sessions"}


@router.post(
    "/change-password",
    status_code=status.HTTP_200_OK,
    summary="Change current user's password and increment token_version",
)
@router.put(
    "/change-password",
    status_code=status.HTTP_200_OK,
    summary="Change current user's password and increment token_version",
)
async def change_password(
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> dict[str, str]:
    """Change the authenticated user's password and increment token_version."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid request body",
        )

    current_password = body.get("current_password") or body.get("old_password")
    new_password = body.get("new_password") or body.get("password")
    if not new_password or not isinstance(new_password, str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password is required",
        )

    db = get_database()
    user_doc = await db["users"].find_one({"_id": ObjectId(current_user["id"])})
    if user_doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if current_password is not None and not verify_password(
        str(current_password), user_doc.get("hashed_password", "")
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid current password",
        )

    try:
        validate_password_policy(new_password, email=user_doc.get("email"))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    now = datetime.now(timezone.utc)
    await db["users"].update_one(
        {"_id": user_doc["_id"]},
        {
            "$set": {
                "hashed_password": hash_password(new_password),
                "updated_at": now,
            },
            "$inc": {"token_version": 1},
        },
    )
    await db["sessions"].update_many(
        {"user_id": current_user["id"]},
        {"$set": {"is_active": False, "revoked": True, "revoked_at": now}},
    )
    return {"message": "Password changed successfully"}


@router.post(
    "/deactivate",
    status_code=status.HTTP_200_OK,
    summary="Deactivate current user's account and increment token_version",
)
async def deactivate_account(
    response: Response,
    current_user: dict = Depends(get_current_user),
) -> dict[str, str]:
    """Deactivate the authenticated user's account and increment token_version."""
    db = get_database()
    now = datetime.now(timezone.utc)
    await db["users"].update_one(
        {"_id": ObjectId(current_user["id"])},
        {
            "$set": {"is_active": False, "updated_at": now},
            "$inc": {"token_version": 1},
        },
    )
    await db["sessions"].update_many(
        {"user_id": current_user["id"]},
        {"$set": {"is_active": False, "revoked": True, "revoked_at": now}},
    )
    response.delete_cookie(
        key="refresh_token",
        path="/",
        httponly=True,
        samesite="lax",
    )
    return {"message": "Account deactivated"}


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get the currently authenticated user's profile",
)
async def get_me(current_user: dict = Depends(get_current_user)) -> UserResponse:
    """Return the authenticated user's profile information."""
    return UserResponse(**current_user)
