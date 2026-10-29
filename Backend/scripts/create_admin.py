import asyncio
import sys
from datetime import datetime, timezone
from getpass import getpass
from pathlib import Path

# Add Backend directory to sys.path so 'app' package can be imported
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
from pymongo.errors import DuplicateKeyError  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.core.security import hash_password  # noqa: E402


async def create_admin_user() -> None:
    print("=== AgroLens AI - Create Admin User ===")

    full_name = input("Enter admin full name: ").strip()
    if len(full_name) < 2:
        print("[ERROR] Full name must be at least 2 characters.")
        sys.exit(1)

    email = input("Enter admin email: ").strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        print("[ERROR] Please enter a valid email address.")
        sys.exit(1)

    try:
        password = getpass("Enter admin password (min 6 characters): ")
    except Exception:
        password = input("Enter admin password (min 6 characters): ")

    if len(password) < 6:
        print("[ERROR] Password must be at least 6 characters long.")
        sys.exit(1)

    if not settings.MONGODB_URI:
        print("[ERROR] MONGODB_URI is not set in Backend/.env")
        sys.exit(1)

    client = AsyncIOMotorClient(settings.MONGODB_URI, serverSelectionTimeoutMS=10000)
    try:
        await client.admin.command("ping")
        db = client[settings.DATABASE_NAME]
        await db["users"].create_index("email", unique=True)

        existing = await db["users"].find_one({"email": email})
        if existing is not None:
            print(f"[ERROR] A user with email '{email}' already exists.")
            sys.exit(1)

        now = datetime.now(timezone.utc)
        admin_doc = {
            "full_name": full_name,
            "email": email,
            "hashed_password": hash_password(password),
            "role": "admin",
            "district": "Colombo",
            "preferred_language": "en",
            "is_active": True,
            "is_approved": True,
            "approved_by": None,
            "approved_at": None,
            "updated_at": now,
            "created_at": now,
        }

        result = await db["users"].insert_one(admin_doc)
        print(
            f"[OK] Admin user '{full_name}' ({email}) created successfully with ID: {result.inserted_id}"
        )
    except DuplicateKeyError:
        print(f"[ERROR] A user with email '{email}' already exists.")
        sys.exit(1)
    except Exception as exc:
        print(f"[ERROR] Failed to create admin user: {type(exc).__name__}")
        sys.exit(1)
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(create_admin_user())
