from typing import Any
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.database import get_database
from app.core.security import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


def serialize_notification(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "user_id": doc["user_id"],
        "type": doc["type"],
        "title_en": doc["title_en"],
        "title_si": doc["title_si"],
        "message_en": doc["message_en"],
        "message_si": doc["message_si"],
        "diagnosis_id": doc["diagnosis_id"],
        "is_read": doc.get("is_read", False),
        "created_at": doc["created_at"],
    }


@router.get(
    "",
    status_code=status.HTTP_200_OK,
    summary="Get the latest 20 notifications and unread count for the logged-in user",
)
async def get_notifications(
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    db = get_database()
    user_id = current_user["id"]

    cursor = (
        db["notifications"]
        .find({"user_id": user_id})
        .sort("created_at", -1)
        .limit(20)
    )
    docs = await cursor.to_list(length=20)
    unread_count = await db["notifications"].count_documents(
        {"user_id": user_id, "is_read": False}
    )

    return {
        "notifications": [serialize_notification(doc) for doc in docs],
        "unread_count": unread_count,
    }


@router.put(
    "/read-all",
    status_code=status.HTTP_200_OK,
    summary="Mark all notifications as read for the logged-in user",
)
async def mark_all_notifications_read(
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    db = get_database()
    result = await db["notifications"].update_many(
        {"user_id": current_user["id"], "is_read": False},
        {"$set": {"is_read": True}},
    )
    return {
        "message": "All notifications marked as read",
        "updated_count": result.modified_count,
    }


@router.put(
    "/{notification_id}/read",
    status_code=status.HTTP_200_OK,
    summary="Mark a single notification as read",
)
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    if not ObjectId.is_valid(notification_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    db = get_database()
    doc = await db["notifications"].find_one(
        {"_id": ObjectId(notification_id), "user_id": current_user["id"]}
    )
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    if not doc.get("is_read", False):
        await db["notifications"].update_one(
            {"_id": ObjectId(notification_id)},
            {"$set": {"is_read": True}},
        )
        doc["is_read"] = True

    return serialize_notification(doc)
