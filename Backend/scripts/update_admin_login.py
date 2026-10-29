import asyncio
from datetime import datetime, timezone
from pathlib import Path
import sys

# Ensure Backend/ directory is on sys.path so 'app' package can be imported
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import dns.resolver

dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
dns.resolver.default_resolver.nameservers = ["8.8.8.8", "1.1.1.1"]

from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.core.security import hash_password


async def update_admin_login() -> None:
    print("=== AgroLens AI - Update Admin Login ===")

    target_email = "admin@gmail.com"
    new_password = "3131"  # Bypasses normal min-length rule only for this admin update

    if not settings.MONGODB_URI:
        print("[ERROR] MONGODB_URI is not configured in Backend/.env")
        sys.exit(1)

    client = AsyncIOMotorClient(settings.MONGODB_URI, serverSelectionTimeoutMS=10000)
    try:
        await client.admin.command("ping")
        db = client[settings.DATABASE_NAME]

        # 1. Search for the admin user:
        # a) "admin@gmail.com" with role "admin"
        admin_user = await db["users"].find_one({"email": "admin@gmail.com", "role": "admin"})
        if admin_user:
            print(f"[INFO] Found admin user with email: '{admin_user['email']}' (ID: {admin_user['_id']})")
        else:
            # b) "admin@agrolens.lk" with role "admin"
            admin_user = await db["users"].find_one({"email": "admin@agrolens.lk", "role": "admin"})
            if admin_user:
                print(f"[INFO] Admin 'admin@gmail.com' not found. Found admin user with email: '{admin_user['email']}' (ID: {admin_user['_id']})")
            else:
                # c) First user with role "admin"
                admin_user = await db["users"].find_one({"role": "admin"})
                if admin_user:
                    print(f"[INFO] Neither 'admin@gmail.com' nor 'admin@agrolens.lk' found. Found first admin user with email: '{admin_user['email']}' (ID: {admin_user['_id']})")
                else:
                    print("[ERROR] No user with role 'admin' was found in the database.")
                    sys.exit(1)

        # 2. Make sure email is "admin@gmail.com" (check for conflicts if changing from another email)
        existing_target_user = await db["users"].find_one({"email": target_email})
        if existing_target_user and str(existing_target_user["_id"]) != str(admin_user["_id"]):
            print(
                f"[ERROR] Cannot set email to '{target_email}': another user (ID: {existing_target_user['_id']}) already uses this email."
            )
            sys.exit(1)

        # 3. Hash the new password with the exact bcrypt method used in app/core/security.py
        hashed_pw = hash_password(new_password)

        # 4. Update admin document with email, password hash, and updated_at
        now = datetime.now(timezone.utc)
        result = await db["users"].update_one(
            {"_id": admin_user["_id"]},
            {
                "$set": {
                    "email": target_email,
                    "hashed_password": hashed_pw,
                    "updated_at": now,
                }
            },
        )

        if result.modified_count > 0 or (admin_user.get("email") == target_email and result.matched_count > 0):
            print(
                f"[SUCCESS] Admin account (ID: {admin_user['_id']}, Name: '{admin_user.get('full_name', '')}') updated successfully!\n"
                f"          Email: {target_email}\n"
                f"          Password: updated (4 characters: '3131')\n"
                f"          Updated at: {now.isoformat()}"
            )
        else:
            print(f"[WARNING] Database update executed but modified count was {result.modified_count}.")

    except Exception as exc:
        print(f"[ERROR] Failed to update admin user: {exc}")
        sys.exit(1)
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(update_admin_login())
