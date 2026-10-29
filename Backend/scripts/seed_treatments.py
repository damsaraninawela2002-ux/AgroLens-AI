import asyncio
from datetime import datetime, timezone
import json
import sys
from pathlib import Path

# Add Backend directory to sys.path so 'app' package can be imported
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
from app.core.config import settings  # noqa: E402

CLASS_NAMES_PATH = BACKEND_DIR / "app" / "ml_models" / "class_names.json"

# English and Sinhala metadata for all 15 PlantVillage classes
CLASS_METADATA: dict[str, dict[str, object]] = {
    "Pepper,_bell___Bacterial_spot": {
        "crop": "Pepper (Bell)",
        "disease_name_en": "Bell Pepper Bacterial Spot",
        "disease_name_si": "මාළු මිරිස් බැක්ටීරියා පත්‍ර පුල්ලි රෝගය",
        "is_healthy": False,
    },
    "Pepper,_bell___healthy": {
        "crop": "Pepper (Bell)",
        "disease_name_en": "Healthy Bell Pepper Leaf",
        "disease_name_si": "නිරෝගී මාළු මිරිස් පත්‍රය",
        "is_healthy": True,
    },
    "Potato___Early_blight": {
        "crop": "Potato",
        "disease_name_en": "Potato Early Blight",
        "disease_name_si": "අර්තාපල් මුල් අංගමාරය",
        "is_healthy": False,
    },
    "Potato___Late_blight": {
        "crop": "Potato",
        "disease_name_en": "Potato Late Blight",
        "disease_name_si": "අර්තාපල් පසු අංගමාරය",
        "is_healthy": False,
    },
    "Potato___healthy": {
        "crop": "Potato",
        "disease_name_en": "Healthy Potato Leaf",
        "disease_name_si": "නිරෝගී අර්තාපල් පත්‍රය",
        "is_healthy": True,
    },
    "Tomato___Bacterial_spot": {
        "crop": "Tomato",
        "disease_name_en": "Tomato Bacterial Spot",
        "disease_name_si": "තක්කාලි බැක්ටීරියා පත්‍ර පුල්ලි රෝගය",
        "is_healthy": False,
    },
    "Tomato___Early_blight": {
        "crop": "Tomato",
        "disease_name_en": "Tomato Early Blight",
        "disease_name_si": "තක්කාලි මුල් අංගමාරය",
        "is_healthy": False,
    },
    "Tomato___Late_blight": {
        "crop": "Tomato",
        "disease_name_en": "Tomato Late Blight",
        "disease_name_si": "තක්කාලි පසු අංගමාරය",
        "is_healthy": False,
    },
    "Tomato___Leaf_Mold": {
        "crop": "Tomato",
        "disease_name_en": "Tomato Leaf Mold",
        "disease_name_si": "තක්කාලි පත්‍ර පුස් රෝගය",
        "is_healthy": False,
    },
    "Tomato___Septoria_leaf_spot": {
        "crop": "Tomato",
        "disease_name_en": "Tomato Septoria Leaf Spot",
        "disease_name_si": "තක්කාලි සෙප්ටෝරියා පත්‍ර පුල්ලි රෝගය",
        "is_healthy": False,
    },
    "Tomato___Spider_mites Two-spotted_spider_mite": {
        "crop": "Tomato",
        "disease_name_en": "Tomato Two-Spotted Spider Mite",
        "disease_name_si": "තක්කාලි දෙතිත් මයිටා හානිය",
        "is_healthy": False,
    },
    "Tomato___Target_Spot": {
        "crop": "Tomato",
        "disease_name_en": "Tomato Target Spot",
        "disease_name_si": "තක්කාලි ඉලක්ක පුල්ලි රෝගය (Target Spot)",
        "is_healthy": False,
    },
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus": {
        "crop": "Tomato",
        "disease_name_en": "Tomato Yellow Leaf Curl Virus (TYLCV)",
        "disease_name_si": "තක්කාලි පත්‍ර කහ වී කොඩවීමේ වෛරස් රෝගය",
        "is_healthy": False,
    },
    "Tomato___Tomato_mosaic_virus": {
        "crop": "Tomato",
        "disease_name_en": "Tomato Mosaic Virus (ToMV)",
        "disease_name_si": "තක්කාලි විචිත්‍ර වෛරස් රෝගය (Mosaic Virus)",
        "is_healthy": False,
    },
    "Tomato___healthy": {
        "crop": "Tomato",
        "disease_name_en": "Healthy Tomato Leaf",
        "disease_name_si": "නිරෝගී තක්කාලි පත්‍රය",
        "is_healthy": True,
    },
}


def build_treatment_doc(disease_key: str) -> dict:
    meta = CLASS_METADATA.get(disease_key)
    if meta is None:
        parts = disease_key.split("___")
        crop = parts[0].replace("_", " ").strip()
        raw_disease = parts[1].replace("_", " ").strip() if len(parts) > 1 else disease_key
        is_healthy = "healthy" in raw_disease.lower()
        disease_name_en = f"{crop} - {raw_disease}"
        disease_name_si = f"{crop} - {raw_disease} (සිංහල නාමය එක් කිරීමට නියමිතයි)"
    else:
        crop = str(meta["crop"])
        disease_name_en = str(meta["disease_name_en"])
        disease_name_si = str(meta["disease_name_si"])
        is_healthy = bool(meta["is_healthy"])

    if is_healthy:
        return {
            "disease_key": disease_key,
            "crop": crop,
            "disease_name_en": disease_name_en,
            "disease_name_si": disease_name_si,
            "is_healthy": True,
            "symptoms_en": (
                f"TO BE VERIFIED: No disease symptoms detected for {disease_name_en}. "
                "Verify healthy leaf indicators with Department of Agriculture guidelines."
            ),
            "symptoms_si": (
                f"TO BE VERIFIED (තහවුරු කළ යුතුය): {disease_name_si} සඳහා රෝග ලක්ෂණ නොමැත. "
                "කෘෂිකර්ම දෙපාර්තමේන්තුවේ තොරතුරු අනුව යාවත්කාලීන කරන්න."
            ),
            "treatment_en": (
                "TO BE VERIFIED: No chemical or biological treatment required for healthy crop leaves."
            ),
            "treatment_si": (
                "TO BE VERIFIED (තහවුරු කළ යුතුය): නිරෝගී භෝග සඳහා ප්‍රතිකාර අවශ්‍ය නොවේ."
            ),
            "prevention_en": (
                f"TO BE VERIFIED: Standard preventive crop care and monitoring recommendations for {crop} "
                "from the Department of Agriculture to be added here."
            ),
            "prevention_si": (
                f"TO BE VERIFIED (තහවුරු කළ යුතුය): {crop} වගාව රෝගවලින් ආරක්ෂා කර ගැනීම සඳහා "
                "කෘෂිකර්ම දෙපාර්තමේන්තුවේ නිර්දේශිත පූර්ව ආරක්ෂණ පියවර මෙහි ඇතුළත් කරන්න."
            ),
            "is_verified": False,
            "source": "Department of Agriculture, Sri Lanka",
            "verified_by": None,
            "verified_at": None,
            "updated_at": datetime.now(timezone.utc),
        }

    return {
        "disease_key": disease_key,
        "crop": crop,
        "disease_name_en": disease_name_en,
        "disease_name_si": disease_name_si,
        "is_healthy": False,
        "symptoms_en": (
            f"TO BE VERIFIED: Detailed visual symptoms for {disease_name_en} "
            "to be verified and filled from Department of Agriculture sources."
        ),
        "symptoms_si": (
            f"TO BE VERIFIED (තහවුරු කළ යුතුය): {disease_name_si} හි රෝග ලක්ෂණ "
            "කෘෂිකර්ම දෙපාර්තමේන්තුවේ නිල මූලාශ්‍රවලින් තහවුරු කර ඇතුළත් කිරීමට නියමිතය."
        ),
        "treatment_en": (
            f"TO BE VERIFIED: Recommended treatment and management instructions for {disease_name_en} "
            "to be verified from Department of Agriculture sources."
        ),
        "treatment_si": (
            f"TO BE VERIFIED (තහවුරු කළ යුතුය): {disease_name_si} සඳහා නිර්දේශිත ප්‍රතිකාර ක්‍රම "
            "කෘෂිකර්ම දෙපාර්තමේන්තුවේ නිල උපදෙස් අනුව ඇතුළත් කිරීමට නියමිතය."
        ),
        "prevention_en": (
            f"TO BE VERIFIED: Preventive measures and cultural practices for {disease_name_en} "
            "to be verified from Department of Agriculture sources."
        ),
        "prevention_si": (
            f"TO BE VERIFIED (තහවුරු කළ යුතුය): {disease_name_si} වළක්වා ගැනීමේ ක්‍රමවේද "
            "කෘෂිකර්ම දෙපාර්තමේන්තුවේ නිල මූලාශ්‍රවලින් තහවුරු කර ඇතුළත් කිරීමට නියමිතය."
        ),
        "is_verified": False,
        "source": "Department of Agriculture, Sri Lanka",
        "verified_by": None,
        "verified_at": None,
        "updated_at": datetime.now(timezone.utc),
    }


async def seed_treatments() -> None:
    if not CLASS_NAMES_PATH.exists():
        print(f"[ERROR] class_names.json not found at: {CLASS_NAMES_PATH}")
        sys.exit(1)

    with open(CLASS_NAMES_PATH, "r", encoding="utf-8") as f:
        class_names: list[str] = json.load(f)

    if not settings.MONGODB_URI:
        print("[ERROR] MONGODB_URI is not set in Backend/.env")
        sys.exit(1)

    client = AsyncIOMotorClient(settings.MONGODB_URI, serverSelectionTimeoutMS=10000)
    try:
        await client.admin.command("ping")
        db = client[settings.DATABASE_NAME]
        collection = db["treatments"]
        await collection.create_index("disease_key", unique=True)

        inserted_count = 0
        skipped_count = 0

        for disease_key in class_names:
            existing = await collection.find_one({"disease_key": disease_key})
            if existing is not None:
                skipped_count += 1
                print(f"[SKIP] Treatment already exists for: {disease_key}")
                continue

            doc = build_treatment_doc(disease_key)
            await collection.insert_one(doc)
            inserted_count += 1
            print(f"[OK] Inserted treatment for: {disease_key}")

        print(
            f"\n[DONE] Treatments seeding complete: {inserted_count} inserted, {skipped_count} skipped (Total classes: {len(class_names)})."
        )
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(seed_treatments())
