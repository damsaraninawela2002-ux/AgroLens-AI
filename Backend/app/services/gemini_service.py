import json
import os
from typing import Any, Optional
from google import genai
from google.genai import types
from app.core.config import settings

SYSTEM_INSTRUCTION = (
    "You are AgroLens Assistant, an agricultural advisor for Sri Lankan farmers. "
    "Reply in the same language as the farmer (Sinhala or English). "
    "Use simple, practical language. Keep answers under 150 words and use bullet points for steps. "
    "Use the diagnosis context if given. Only answer questions about crops, plant diseases, pests, "
    "soil, fertiliser, irrigation and farming. Do NOT give pesticide brand names or exact chemical "
    "dosages; recommend the local Agricultural Officer or Govi Sahana Sevaya (1920) for that. "
    "If unsure, say so."
)

MAX_HISTORY_MESSAGES = 10

ERROR_MESSAGES = {
    "missing_key": {
        "en": (
            "AgroLens Assistant is not configured right now (missing API key). "
            "Please contact the administrator or call Govi Sahana Sevaya (1920) for immediate advice."
        ),
        "si": (
            "AgroLens AI සහායක සේවාව දැනට සක්‍රීය කර නොමැත (API යතුර නොමැත). "
            "කරුණාකර පරිපාලක අමතන්න හෝ ක්ෂණික උපදෙස් සඳහා ගොවි සහන සේවාව (1920) අමතන්න."
        ),
    },
    "quota": {
        "en": (
            "AgroLens Assistant has reached its request limit for now. "
            "Please wait a moment and try again, or consult your local Agricultural Officer."
        ),
        "si": (
            "AgroLens AI සහායක සේවාවේ ඉල්ලීම් සීමාව දැනට ඉක්මවා ඇත. "
            "කරුණාකර මද වේලාවකින් නැවත උත්සාහ කරන්න, නැතහොත් ඔබගේ ප්‍රදේශයේ කෘෂිකර්ම නිලධාරීවරයා අමතන්න."
        ),
    },
    "network": {
        "en": (
            "Unable to reach AgroLens Assistant due to a network or service issue. "
            "Please check your connection and try again shortly."
        ),
        "si": (
            "ජාල හෝ සේවා දෝෂයක් හේතුවෙන් AgroLens AI සහායක සමඟ සම්බන්ධ වීමට නොහැකි විය. "
            "කරුණාකර මද වේලාවකින් නැවත උත්සාහ කරන්න."
        ),
    },
}


def _pick_lang(language: Optional[str], message: str = "") -> str:
    if language and str(language).strip().lower().startswith("si"):
        return "si"
    # Auto-detect Sinhala Unicode range (0D80–0DFF) if message is in Sinhala
    if any("\u0d80" <= ch <= "\u0dff" for ch in (message or "")):
        return "si"
    return "en"


def _format_diagnosis_context(diagnosis_context: Any) -> str:
    if not diagnosis_context:
        return ""
    if isinstance(diagnosis_context, str):
        return diagnosis_context.strip()
    if isinstance(diagnosis_context, dict):
        try:
            return json.dumps(diagnosis_context, ensure_ascii=False, default=str)
        except Exception:
            return str(diagnosis_context)
    return str(diagnosis_context)


async def generate_reply(
    message: str,
    history: Optional[list[dict[str, Any]]] = None,
    diagnosis_context: Optional[Any] = None,
    language: Optional[str] = "en",
) -> str:
    """
    Generate an agricultural advisory reply using the official Google Gen AI SDK.
    Never logs or prints the API key.
    """
    lang_code = _pick_lang(language, message)
    api_key = (settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY") or "").strip()
    model_name = (
        settings.GEMINI_MODEL
        or os.getenv("GEMINI_MODEL")
        or "gemini-2.5-flash"
    ).strip()

    if not api_key:
        return ERROR_MESSAGES["missing_key"][lang_code]

    system_prompt = SYSTEM_INSTRUCTION
    context_str = _format_diagnosis_context(diagnosis_context)
    if context_str:
        system_prompt = f"{SYSTEM_INSTRUCTION}\n\nDiagnosis Context:\n{context_str}"
    if language:
        lang_label = "Sinhala" if lang_code == "si" else "English"
        system_prompt = f"{system_prompt}\nPreferred response language: {lang_label}."

    contents: list[types.Content] = []
    recent_history = list(history or [])[-MAX_HISTORY_MESSAGES:]

    for item in recent_history:
        if not isinstance(item, dict):
            continue
        raw_role = str(item.get("role") or "user").strip().lower()
        role = "model" if raw_role in ("assistant", "model", "bot", "ai") else "user"
        text = str(item.get("content") or item.get("text") or item.get("message") or "").strip()
        if not text:
            continue
        contents.append(
            types.Content(
                role=role,
                parts=[types.Part.from_text(text=text)],
            )
        )

    user_text = (message or "").strip()
    if user_text:
        contents.append(
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=user_text)],
            )
        )

    try:
        client = genai.Client(api_key=api_key)
        response = await client.aio.models.generate_content(
            model=model_name,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
            ),
        )
        reply_text = (getattr(response, "text", None) or "").strip()
        if not reply_text:
            return ERROR_MESSAGES["network"][lang_code]
        return reply_text
    except Exception as exc:
        err_name = type(exc).__name__.lower()
        err_msg = str(exc).lower()
        if (
            "429" in err_msg
            or "quota" in err_msg
            or "resource_exhausted" in err_msg
            or "rate" in err_msg
        ):
            return ERROR_MESSAGES["quota"][lang_code]
        if (
            "api_key" in err_msg
            or "apikey" in err_msg
            or "unauthenticated" in err_msg
            or "permission_denied" in err_msg
            or "401" in err_msg
            or "403" in err_msg
            or "invalid key" in err_msg
        ):
            return ERROR_MESSAGES["missing_key"][lang_code]
        return ERROR_MESSAGES["network"][lang_code]
