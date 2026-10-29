import asyncio
from pathlib import Path
import sys

# Ensure backend root is on sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import dns.resolver

dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
dns.resolver.default_resolver.nameservers = ["8.8.8.8", "1.1.1.1"]

from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings


async def fix_sessions() -> None:
    if not settings.MONGODB_URI:
        raise RuntimeError("MONGODB_URI is not configured in .env")

    client = AsyncIOMotorClient(settings.MONGODB_URI, serverSelectionTimeoutMS=10000)
    try:
        db = client[settings.DATABASE_NAME]
        result = await db["sessions"].delete_many(
            {
                "$or": [
                    {"hashed_token_id": None},
                    {"hashed_token_id": {"$exists": False}},
                    {"hashed_token_id": ""},
                ]
            }
        )
        await db["sessions"].create_index("hashed_token_id", unique=True)
        print(
            f"[OK] Deleted {result.deleted_count} session document(s) with missing or null hashed_token_id "
            "and verified unique index on hashed_token_id."
        )
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(fix_sessions())
