"""multilingual.py — Multilingual Nudge & Recommendation Generator for Flipkart ML Platform

Decoupled refactored integration that delegates translation resolution and heuristic keyword
matching to the central JSON-based localization engine (`cart_abandonment_ml.i18n.translator`).
"""

from __future__ import annotations
from typing import Dict, Any, Optional

from cart_abandonment_ml.i18n import translator

# Retain legacy language mapping for UI components and recommendation agent compatibility
SUPPORTED_LANGUAGES = {
    "English": "English",
    "Hindi": "Hindi (हिंदी)",
    "Bengali": "Bengali (বাংলা)",
    "Tamil": "Tamil (தமிழ்)",
    "Telugu": "Telugu (తెలుగు)",
    "Kannada": "Kannada (ಕನ್ನಡ)",
    "Marathi": "Marathi (मराठी)",
    "Gujarati": "Gujarati (ગુજરાતી)"
}


def translate_nudge(text: str, target_language: str) -> str:
    """Translate or format intervention nudge into target language using the dynamic i18n engine."""
    if not target_language or target_language.lower() in ["english", "en"]:
        return text

    # Delegate dynamic lookup and keyword fallback to the central Localization Engine
    return translator.get(text, lang=target_language)
