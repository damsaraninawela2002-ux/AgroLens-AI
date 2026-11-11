import base64
import hashlib
import time
import httpx
from app.core.config import settings


def is_cloudinary_configured() -> bool:
    return bool(
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    )


def _bytes_to_data_uri(image_bytes: bytes, content_type: str = "image/jpeg") -> str:
    mime = content_type if content_type in ("image/jpeg", "image/png") else "image/jpeg"
    encoded = base64.b64encode(image_bytes).decode("ascii")
    return f"data:{mime};base64,{encoded}"


async def upload_image_bytes(
    image_bytes: bytes,
    filename: str = "image.jpg",
    content_type: str = "image/jpeg",
    folder: str = "agrolens/scans",
) -> str:
    """
    Upload validated image bytes to Cloudinary directly from memory (no local disk write).
    If Cloudinary environment variables are not configured or upload fails, logs a warning
    and returns a base64 data URI fallback so the app never crashes or writes to local disk.
    """
    if not is_cloudinary_configured():
        print(
            "[WARN] Cloudinary credentials (CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET) "
            "are not configured; using in-memory data URI fallback."
        )
        return _bytes_to_data_uri(image_bytes, content_type)

    cloud_name = settings.CLOUDINARY_CLOUD_NAME
    api_key = settings.CLOUDINARY_API_KEY
    api_secret = settings.CLOUDINARY_API_SECRET
    timestamp = str(int(time.time()))

    # Cloudinary signature: SHA-1 of alphabetically sorted params + api_secret
    params_to_sign = f"folder={folder}&timestamp={timestamp}{api_secret}"
    signature = hashlib.sha1(params_to_sign.encode("utf-8")).hexdigest()

    upload_url = f"https://api.cloudinary.com/v1_1/{cloud_name}/image/upload"

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                upload_url,
                data={
                    "api_key": api_key,
                    "timestamp": timestamp,
                    "folder": folder,
                    "signature": signature,
                },
                files={
                    "file": (filename, image_bytes, content_type or "image/jpeg"),
                },
            )
            response.raise_for_status()
            payload = response.json()
            secure_url = payload.get("secure_url") or payload.get("url")
            if secure_url:
                return str(secure_url)
    except Exception as exc:
        print(
            f"[WARN] Cloudinary upload failed ({type(exc).__name__}: {exc}); "
            "using in-memory data URI fallback."
        )

    return _bytes_to_data_uri(image_bytes, content_type)
