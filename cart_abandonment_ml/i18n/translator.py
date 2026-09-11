"""translator.py — Production Singleton Localization Engine for E2E Cart Abandonment system."""

import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional

logger = logging.getLogger("flipkart.i18n.translator")


class LocalizationEngine:
    """Singleton engine responsible for dynamically loading translation JSON schemas

    and serving localized UI strings, ML intervention nudges, and system notifications.
    """

    _instance: Optional["LocalizationEngine"] = None
    DEFAULT_LOCALE = "en"

    # Map varied language input representations to 2-letter ISO folder codes
    LOCALE_MAPPING = {
        "english": "en", "en": "en",
        "hindi": "hi", "hi": "hi",
        "bengali": "bn", "bn": "bn",
        "tamil": "ta", "ta": "ta",
        "telugu": "te", "te": "te",
        "kannada": "kn", "kn": "kn",
        "marathi": "mr", "mr": "mr",
        "gujarati": "gu", "gu": "gu",
    }

    def __new__(cls) -> "LocalizationEngine":
        if cls._instance is None:
            cls._instance = super(LocalizationEngine, cls).__new__(cls)
            cls._instance._load_all_translations()
        return cls._instance

    def _load_all_translations(self) -> None:
        """Loads and caches all JSON translation files from disk into memory."""
        self._catalog: Dict[str, Dict[str, Any]] = {}
        locales_dir = Path(__file__).parent / "locales"

        if not locales_dir.exists():
            logger.warning("Locales directory missing at %s. Creating directory structure.", locales_dir)
            locales_dir.mkdir(parents=True, exist_ok=True)
            return

        for locale_path in locales_dir.iterdir():
            if locale_path.is_dir():
                lang_code = locale_path.name.lower()
                if lang_code not in self._catalog:
                    self._catalog[lang_code] = {}
                for json_file in locale_path.glob("*.json"):
                    try:
                        with open(json_file, "r", encoding="utf-8") as f:
                            data = json.load(f)
                            self._catalog[lang_code].update(data)
                    except Exception as exc:
                        logger.error("Failed to parse translation file %s: %s", json_file, exc)

        logger.info("Localization Engine loaded locales: %s", list(self._catalog.keys()))

    def reload(self) -> None:
        """Force reloading translations from disk (useful after adding new languages/keys)."""
        self._load_all_translations()

    def _normalize_locale(self, lang: Optional[str]) -> str:
        if not lang:
            return self.DEFAULT_LOCALE
        # Extract first word before any parenthesis or separator (e.g. "Hindi (हिंदी)" -> "Hindi" or "en-US" -> "en")
        cleaned = lang.split("(")[0].split("-")[0].strip().lower()
        return self.LOCALE_MAPPING.get(cleaned, self.DEFAULT_LOCALE)

    def get(self, key: str, lang: str = "en", **kwargs: Any) -> str:
        """Retrieve localized string with graceful default fallback and interpolation.

        If exact matching fails on sentence keys, fallback heuristics match domain keywords.
        """
        target_lang = self._normalize_locale(lang)

        # 1. Exact lookup in target language catalog
        lang_catalog = self._catalog.get(target_lang, {})
        translated_str = lang_catalog.get(key)

        # 2. Try English / Default language fallback
        if translated_str is None:
            default_catalog = self._catalog.get(self.DEFAULT_LOCALE, {})
            translated_str = default_catalog.get(key)

        # 3. If exact key lookup fails, evaluate domain keyword matching heuristics
        if translated_str is None:
            translated_str = self._heuristic_fallback(key, lang_catalog)

        # 4. Final fallback is the original key string itself
        if translated_str is None:
            translated_str = key

        # 5. Handle string interpolation if kwargs are passed
        if kwargs:
            try:
                return translated_str.format(**kwargs)
            except (KeyError, ValueError) as e:
                logger.warning("Interpolation failed on key '%s' with error: %s", key, e)
                return translated_str

        return translated_str

    def _heuristic_fallback(self, text: str, catalog: Dict[str, Any]) -> Optional[str]:
        """Fuzzy semantic keyword matching when arbitrary text doesn't exactly match a key."""
        text_lower = text.lower()
        if "emi" in text_lower:
            return catalog.get("nudge.emi.no_cost")
        if "shipping" in text_lower or "delivery" in text_lower:
            if "express" in text_lower or "tomorrow" in text_lower:
                return catalog.get("nudge.shipping.express_tomorrow")
            return catalog.get("nudge.shipping.free_instant")
        if "discount" in text_lower or "cashback" in text_lower or "coupon" in text_lower or "price" in text_lower or "₹100" in text:
            if "timer" in text_lower or "lock" in text_lower:
                return catalog.get("nudge.urgency.price_lock")
            return catalog.get("nudge.discount.upi_100")
        if "stock" in text_lower or "left in stock" in text_lower or "viewing right now" in text_lower:
            return catalog.get("nudge.social_proof.stock_alert")
        if "assured" in text_lower or "buyer protection" in text_lower or "returns" in text_lower:
            return catalog.get("nudge.trust.flipkart_assured")
        if "reminder" in text_lower or "24 hours" in text_lower:
            return catalog.get("nudge.reminder.standard_24h")
        return None

    def get_supported_locales(self) -> List[str]:
        return list(self.LOCALE_MAPPING.keys())

    def get_catalog_for_locale(self, lang: str) -> Dict[str, Any]:
        target = self._normalize_locale(lang)
        return self._catalog.get(target, {})


# Global module-level instance
translator = LocalizationEngine()
