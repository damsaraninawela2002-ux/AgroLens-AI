import dns.resolver

dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
dns.resolver.default_resolver.nameservers = ["8.8.8.8", "1.1.1.1"]

from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings


class DatabaseManager:
    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None


db_manager = DatabaseManager()


async def connect_to_mongo() -> None:
    """Connect to MongoDB Atlas using Motor and create required indexes."""
    if not settings.MONGODB_URI:
        print(
            "[ERROR] Startup failed: MONGODB_URI is required but not configured in environment variables."
        )
        raise RuntimeError("Missing required environment variable: MONGODB_URI")

    if not settings.JWT_SECRET_KEY:
        print(
            "[ERROR] Startup failed: JWT_SECRET_KEY is required but not configured in environment variables."
        )
        raise RuntimeError("Missing required environment variable: JWT_SECRET_KEY")

    try:
        db_manager.client = AsyncIOMotorClient(
            settings.MONGODB_URI,
            serverSelectionTimeoutMS=10000,
        )
        # Verify connection with a ping
        await db_manager.client.admin.command("ping")
        db_manager.db = db_manager.client[settings.DATABASE_NAME]

        # Ensure unique and compound indexes
        await db_manager.db["users"].create_index("email", unique=True)
        await db_manager.db["users"].create_index(
            [("role", 1), ("is_active", 1), ("is_approved", 1)]
        )
        await db_manager.db["treatments"].create_index("disease_key", unique=True)
        await db_manager.db["diagnoses"].create_index([("user_id", 1), ("created_at", -1)])
        await db_manager.db["diagnoses"].create_index(
            [("status", 1), ("district", 1), ("created_at", 1)]
        )
        await db_manager.db["notifications"].create_index(
            [("user_id", 1), ("is_read", 1), ("created_at", -1)]
        )
        await db_manager.db["audit_logs"].create_index([("created_at", -1)])
        await db_manager.db["audit_logs"].create_index([("action", 1), ("created_at", -1)])
        await db_manager.db["treatments"].create_index([("crop", 1), ("is_verified", 1)])
        await db_manager.db["login_events"].create_index([("email", 1), ("created_at", -1)])
        await db_manager.db["login_events"].create_index([("created_at", -1)])
        await db_manager.db["sessions"].delete_many(
            {
                "$or": [
                    {"hashed_token_id": None},
                    {"hashed_token_id": {"$exists": False}},
                    {"hashed_token_id": ""},
                ]
            }
        )
        await db_manager.db["sessions"].create_index("hashed_token_id", unique=True)
        await db_manager.db["sessions"].create_index([("user_id", 1), ("revoked", 1)])

        print(
            f"[OK] Successfully connected to MongoDB database '{settings.DATABASE_NAME}' "
            "and verified indexes."
        )
    except Exception as exc:
        print(
            f"[ERROR] Failed to connect to MongoDB database '{settings.DATABASE_NAME}': "
            f"{type(exc).__name__}"
        )
        raise


async def close_mongo_connection() -> None:
    """Close the MongoDB client connection cleanly."""
    if db_manager.client is not None:
        db_manager.client.close()
        db_manager.client = None
        db_manager.db = None
        print("[INFO] MongoDB connection closed.")


def get_database() -> AsyncIOMotorDatabase:
    """Return the active MongoDB database instance."""
    if db_manager.db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not initialized",
        )
    return db_manager.db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan handler to connect to MongoDB at startup without loading TensorFlow/ML models."""
    await connect_to_mongo()
    try:
        yield
    finally:
        await close_mongo_connection()
