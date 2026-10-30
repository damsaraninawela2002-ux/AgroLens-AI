from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Literal, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from app.core.database import get_database
from app.core.security import get_current_user
from app.services import gemini_service
from app.services.gemini_service import generate_reply

router = APIRouter(prefix="/api/chat", tags=["AI Assistant"])

CHAT_RATE_LIMIT_MAX = 20
CHAT_RATE_LIMIT_WINDOW = timedelta(hours=1)
_user_message_timestamps: dict[str, list[datetime]] = defaultdict(list)


def reset_chat_rate_limits() -> None:
    """Clear in-memory per-user chat rate limit counters."""
    _user_message_timestamps.clear()


def check_chat_rate_limit(user_id: str, language: str = "en") -> None:
    """Enforce 20 messages per user per hour."""
    now = datetime.now(timezone.utc)
    cutoff = now - CHAT_RATE_LIMIT_WINDOW
    recent = [ts for ts in _user_message_timestamps[user_id] if ts > cutoff]

    if len(recent) >= CHAT_RATE_LIMIT_MAX:
        _user_message_timestamps[user_id] = recent
        detail = (
            "ඔබ පැයකට යැවිය හැකි පණිවිඩ සීමාව (20) ඉක්මවා ඇත. කරුණාකර මද වේලාවකින් නැවත උත්සාහ කරන්න."
            if language == "si"
            else "You have reached the limit of 20 messages per hour. Please try again later."
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
        )

    recent.append(now)
    _user_message_timestamps[user_id] = recent


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    conversation_id: Optional[str] = None
    diagnosis_id: Optional[str] = None
    language: Literal["si", "en"] = "en"

    @field_validator("message")
    @classmethod
    def validate_message_not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Message cannot be empty")
        if len(stripped) > 1000:
            raise ValueError("Message cannot exceed 1000 characters")
        return stripped


async def _build_diagnosis_context(
    db: Any,
    diagnosis_id: str,
    current_user: dict[str, Any],
) -> dict[str, Any]:
    if not ObjectId.is_valid(diagnosis_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diagnosis not found",
        )

    diag_doc = await db["diagnoses"].find_one({"_id": ObjectId(diagnosis_id)})
    if diag_doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diagnosis not found",
        )

    if (
        current_user.get("role") == "farmer"
        and str(diag_doc.get("user_id")) != str(current_user["id"])
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own diagnoses",
        )

    predicted_class = str(diag_doc.get("predicted_class") or "")
    crop = diag_doc.get("crop")
    if not crop and predicted_class:
        crop = (
            predicted_class.split("___")[0].replace("_", " ")
            if "___" in predicted_class
            else predicted_class
        )

    status_val = str(diag_doc.get("status") or "auto")
    officer_label = diag_doc.get("officer_label")
    final_diagnosis = (
        officer_label
        if status_val in ("confirmed", "corrected") and officer_label
        else (officer_label or predicted_class)
    )

    return {
        "crop": crop or "Unknown",
        "final_diagnosis": final_diagnosis,
        "confidence": diag_doc.get("confidence"),
        "status": status_val,
        "district": diag_doc.get("district") or current_user.get("district"),
    }


def _classify_gemini_exception(
    exc: Exception,
) -> Literal["quota", "network", "config", "other"]:
    msg = f"{type(exc).__name__} {str(exc)}".lower()
    if any(
        k in msg
        for k in (
            "api_key",
            "apikey",
            "api key",
            "unauthenticated",
            "permission_denied",
            "permission denied",
            "invalid_argument",
            "not configured",
            "missing key",
        )
    ):
        return "config"
    if any(
        k in msg
        for k in (
            "429",
            "quota",
            "resource_exhausted",
            "rate limit",
            "ratelimit",
            "too many requests",
        )
    ):
        return "quota"
    if any(
        k in msg
        for k in (
            "timeout",
            "timed out",
            "connect",
            "network",
            "dns",
            "unreachable",
            "socket",
            "connection",
            "502",
            "503",
            "504",
        )
    ):
        return "network"
    return "other"


def _detect_fallback_error_type(
    reply_text: str,
) -> Optional[Literal["quota", "network", "config", "other"]]:
    if not reply_text:
        return "other"

    # Check fallback message tables defined in gemini_service
    for attr_val in vars(gemini_service).values():
        if isinstance(attr_val, dict):
            for key, val in attr_val.items():
                matched = False
                if isinstance(val, str) and reply_text.strip() == val.strip():
                    matched = True
                elif isinstance(val, dict) and reply_text.strip() in {
                    str(v).strip() for v in val.values() if isinstance(v, str)
                }:
                    matched = True
                if matched:
                    k_low = str(key).lower()
                    if "key" in k_low or "config" in k_low:
                        return "config"
                    if "quota" in k_low or "rate" in k_low or "limit" in k_low:
                        return "quota"
                    if "net" in k_low or "conn" in k_low or "timeout" in k_low:
                        return "network"
                    return "other"

    low = reply_text.lower()
    if (
        "is not configured" in low
        or "missing api key" in low
        or "සකසා නොමැත" in reply_text
    ):
        return "config"
    if (
        "experiencing high demand" in low
        or "quota" in low
        or "කාර්යබහුල බැවින්" in reply_text
    ):
        return "quota"
    if (
        "unable to connect to agrolens assistant" in low
        or "check your internet connection" in low
        or "සම්බන්ධ වීමට නොහැක" in reply_text
    ):
        return "network"
    if (
        "is temporarily unavailable" in low
        or "තාවකාලිකව ලබා ගත නොහැක" in reply_text
    ):
        return "other"

    return None


async def _log_chat_error(
    db: Any,
    user_id: str,
    error_type: Literal["quota", "network", "config", "other"],
) -> None:
    """Save a Gemini failure record in chat_errors without storing message text or API key."""
    await db["chat_errors"].insert_one(
        {
            "user_id": str(user_id),
            "error_type": error_type,
            "created_at": datetime.now(timezone.utc),
        }
    )


def _serialize_conversation_summary(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "title": doc.get("title") or "New Conversation",
        "diagnosis_id": doc.get("diagnosis_id"),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }


def _serialize_conversation_detail(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "user_id": doc.get("user_id"),
        "diagnosis_id": doc.get("diagnosis_id"),
        "title": doc.get("title") or "New Conversation",
        "messages": doc.get("messages") or [],
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }


@router.post(
    "",
    status_code=status.HTTP_200_OK,
    summary="Send a message to AgroLens Assistant and create or continue a conversation",
)
async def send_chat_message(
    payload: ChatRequest,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = str(current_user["id"])
    check_chat_rate_limit(user_id, payload.language)

    db = get_database()
    conv_doc: Optional[dict[str, Any]] = None

    if payload.conversation_id:
        if not ObjectId.is_valid(payload.conversation_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )
        conv_doc = await db["conversations"].find_one(
            {"_id": ObjectId(payload.conversation_id)}
        )
        if conv_doc is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )
        if str(conv_doc.get("user_id")) != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this conversation",
            )

    effective_diagnosis_id = payload.diagnosis_id or (
        conv_doc.get("diagnosis_id") if conv_doc else None
    )
    diagnosis_context: Optional[dict[str, Any]] = None
    if effective_diagnosis_id:
        if payload.diagnosis_id:
            diagnosis_context = await _build_diagnosis_context(
                db, effective_diagnosis_id, current_user
            )
        else:
            try:
                diagnosis_context = await _build_diagnosis_context(
                    db, effective_diagnosis_id, current_user
                )
            except HTTPException:
                diagnosis_context = None

    history = (conv_doc.get("messages") or []) if conv_doc else []
    now = datetime.now(timezone.utc)

    try:
        reply_text = await generate_reply(
            message=payload.message,
            history=history,
            diagnosis_context=diagnosis_context,
            language=payload.language,
        )
        detected_error = _detect_fallback_error_type(reply_text)
        if detected_error is not None:
            await _log_chat_error(db, user_id, detected_error)
    except Exception as exc:
        err_type = _classify_gemini_exception(exc)
        await _log_chat_error(db, user_id, err_type)
        reply_text = (
            "AgroLens Assistant දැනට තාවකාලිකව ලබා ගත නොහැක. කරුණාකර මද වේලාවකින් නැවත උත්සාහ කරන්න."
            if payload.language == "si"
            else "AgroLens Assistant is temporarily unavailable. Please try again in a moment."
        )

    reply_time = datetime.now(timezone.utc)
    user_msg = {
        "role": "user",
        "content": payload.message,
        "created_at": now,
    }
    assistant_msg = {
        "role": "assistant",
        "content": reply_text,
        "created_at": reply_time,
    }

    if conv_doc is not None:
        update_set: dict[str, Any] = {"updated_at": reply_time}
        if payload.diagnosis_id and not conv_doc.get("diagnosis_id"):
            update_set["diagnosis_id"] = payload.diagnosis_id

        await db["conversations"].update_one(
            {"_id": conv_doc["_id"]},
            {
                "$push": {"messages": {"$each": [user_msg, assistant_msg]}},
                "$set": update_set,
            },
        )
        conv_id_str = str(conv_doc["_id"])
    else:
        title = payload.message[:50]
        new_conv = {
            "user_id": user_id,
            "diagnosis_id": effective_diagnosis_id,
            "title": title,
            "messages": [user_msg, assistant_msg],
            "created_at": now,
            "updated_at": reply_time,
        }
        result = await db["conversations"].insert_one(new_conv)
        conv_id_str = str(result.inserted_id)

    return {
        "conversation_id": conv_id_str,
        "reply": reply_text,
        "created_at": reply_time,
    }


@router.get(
    "/conversations",
    status_code=status.HTTP_200_OK,
    summary="List the authenticated user's conversations (newest first)",
)
async def list_conversations(
    current_user: dict = Depends(get_current_user),
) -> list[dict[str, Any]]:
    db = get_database()
    cursor = (
        db["conversations"]
        .find(
            {"user_id": str(current_user["id"])},
            {"title": 1, "diagnosis_id": 1, "created_at": 1, "updated_at": 1},
        )
        .sort("updated_at", -1)
    )
    docs = await cursor.to_list(length=200)
    return [_serialize_conversation_summary(doc) for doc in docs]


@router.get(
    "/conversations/{conversation_id}",
    status_code=status.HTTP_200_OK,
    summary="Get a single conversation with all messages",
)
async def get_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    if not ObjectId.is_valid(conversation_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    db = get_database()
    conv_doc = await db["conversations"].find_one(
        {"_id": ObjectId(conversation_id)}
    )
    if conv_doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )
    if str(conv_doc.get("user_id")) != str(current_user["id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this conversation",
        )

    return _serialize_conversation_detail(conv_doc)


@router.delete(
    "/conversations/{conversation_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a conversation belonging to the authenticated user",
)
async def delete_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict[str, str]:
    if not ObjectId.is_valid(conversation_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    db = get_database()
    conv_doc = await db["conversations"].find_one(
        {"_id": ObjectId(conversation_id)}
    )
    if conv_doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )
    if str(conv_doc.get("user_id")) != str(current_user["id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this conversation",
        )

    await db["conversations"].delete_one({"_id": conv_doc["_id"]})
    return {"message": "Conversation deleted", "id": conversation_id}
