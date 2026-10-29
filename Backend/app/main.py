from pathlib import Path
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.database import get_database, lifespan
from app.routes.admin import router as admin_router
from app.routes.auth import router as auth_router
from app.routes.chat import router as chat_router
from app.routes.notifications import router as notifications_router
from app.routes.officer import router as officer_router
from app.routes.predict import router as predict_router

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"
(UPLOADS_DIR / "images").mkdir(parents=True, exist_ok=True)
(UPLOADS_DIR / "heatmaps").mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="AgroLens AI API",
    version="1.0.0",
    lifespan=lifespan,
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded leaf images and Grad-CAM heatmaps at /uploads
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

app.include_router(auth_router)
app.include_router(predict_router)
app.include_router(officer_router)
app.include_router(notifications_router)
app.include_router(admin_router)
app.include_router(chat_router)


@app.get("/")
def root():
    return {"message": "AgroLens AI API is running"}


@app.get("/api/health", tags=["Health"])
async def health_check():
    """Check API status and verify active MongoDB connection."""
    try:
        db = get_database()
        await db.command("ping")
        return {
            "status": "healthy",
            "api": "running",
            "database": "connected",
        }
    except Exception:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "api": "running",
                "database": "disconnected",
            },
        )
