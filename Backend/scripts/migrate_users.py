import asyncio
from datetime import datetime, timezone
from pathlib import Path
import sys

# Ensure Backend/ is on sys.path when invoked from anywhere
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import dns.resolver

dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
dns.resolver.default_resolver.nameservers = ["8.8.8.8", "1.1.1.1"]

from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings


async def run_migration() -> None:
    if not settings.MONGODB_URI:
        raise RuntimeError("MONGODB_URI is not configured in .env")

    client = AsyncIOMotorClient(settings.MONGODB_URI, serverSelectionTimeoutMS=10000)
    try:
        await client.admin.command("ping")
        db = client[settings.DATABASE_NAME]
        now = datetime.now(timezone.utc)

        # 1. Migrate existing users (existing farmers, officers, and admins -> is_active=True, is_approved=True)
        users_cursor = db["users"].find({})
        users = await users_cursor.to_list(length=10000)

        updated_users = 0
        for user in users:
            updates = {}
            if "is_active" not in user:
                updates["is_active"] = True
            if "is_approved" not in user:
                # Existing users (including existing officers) become approved=True
                updates["is_approved"] = True
            if "approved_by" not in user:
                updates["approved_by"] = None
            if "approved_at" not in user:
                updates["approved_at"] = (
                    user.get("created_at", now)
                    if user.get("role") == "officer"
                    else None
                )
            if "updated_at" not in user:
                updates["updated_at"] = user.get("created_at", now)

            if updates:
                await db["users"].update_one(
                    {"_id": user["_id"]},
                    {"$set": updates},
                )
                updated_users += 1

        # 2. Migrate existing treatments to include verification metadata fields if missing
        treatments_cursor = db["treatments"].find({})
        treatments = await treatments_cursor.to_list(length=500)
        updated_treatments = 0
        for tr in treatments:
            tr_updates = {}
            if "is_verified" not in tr:
                tr_updates["is_verified"] = False
            if "source" not in tr:
                tr_updates["source"] = "Department of Agriculture, Sri Lanka"
            if "verified_by" not in tr:
                tr_updates["verified_by"] = None
            if "verified_at" not in tr:
                tr_updates["verified_at"] = None
            if "updated_at" not in tr:
                tr_updates["updated_at"] = now

            if tr_updates:
                await db["treatments"].update_one(
                    {"_id": tr["_id"]},
                    {"$set": tr_updates},
                )
                updated_treatments += 1

        # 3. Ensure required MongoDB indexes
        await db["users"].create_index("email", unique=True)
        await db["users"].create_index(
            [("role", 1), ("is_active", 1), ("is_approved", 1)]
        )
        await db["treatments"].create_index("disease_key", unique=True)
        await db["diagnoses"].create_index(
            [("status", 1), ("district", 1), ("created_at", 1)]
        )
        await db["audit_logs"].create_index([("created_at", -1)])

        print(
            f"[OK] User migration complete: scanned {len(users)} user(s), "
            f"updated {updated_users} user(s)."
        )
        print(
            f"[OK] Treatment metadata check complete: scanned {len(treatments)} treatment(s), "
            f"updated {updated_treatments} treatment(s)."
        )
        print("[OK] Verified MongoDB indexes for users, treatments, and audit_logs.")
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(run_migration())
