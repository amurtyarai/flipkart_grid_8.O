"""root_cause_agent.py — Root Cause Reasoning Agent (Gemini API)

Purpose
-------
Given a shopping session's predicted abandonment probability and SHAP-derived
feature evidence, determine the MOST LIKELY root cause of cart abandonment
using structured reasoning via the Gemini API.

Design principles
-----------------
* **No interventions** — the agent ONLY infers root cause, never recommends actions.
* **No RAG** — all context is injected into the prompt directly from the session data.
* **Structured output** — Gemini is instructed to return a strict JSON schema that is
  validated and parsed into a typed ``RootCauseResult`` dataclass before returning.
* **Deterministic** — low temperature (0.2) ensures consistent, reproducible reasoning.
* **Graceful degradation** — if the Gemini call fails (quota, network, invalid key),
  a fallback heuristic root cause is returned instead of raising.

Allowed Root Causes (10)
------------------------
    Price Sensitive         | Trust Issues          | Low Purchase Intent
    Delivery Concern        | Payment Friction      | Product Availability
    Quality Uncertainty     | Window Shopping       | Technical Problem
    Gift Purchase           |

Output Schema
-------------
{
    "root_cause":  "Price Sensitive",
    "confidence":  0.87,
    "evidence": [
        "competitor_difference SHAP = +0.214 (strong positive)",
        "price_sensitivity_score SHAP = +0.179"
    ],
    "reasoning": "The customer is exhibiting classic price-sensitive behaviour.
                  The two strongest SHAP drivers both relate to price comparison..."
}

Integration point for LLM pipeline
-----------------------------------
This module is the FIRST component of the LLM reasoning layer.
Later modules (intervention engine, notification generator, etc.) will consume
``RootCauseResult`` objects produced here.

Usage
-----
    from cart_abandonment_ml.reasoning.root_cause_agent import RootCauseAgent

    agent = RootCauseAgent()
    result = agent.analyse(
        session=session_dict,
        abandonment_probability=0.87,
        top_shap_features=shap_features,
        product_info=product_dict,       # optional
        user_history=history_dict,       # optional
    )
    print(result.root_cause)     # "Price Sensitive"
    print(result.confidence)     # 0.87
    print(result.reasoning)      # Full paragraph explanation
"""

from __future__ import annotations

import json
import logging
import os
import textwrap
import time
from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional

from cart_abandonment_ml.config.config import Config, config as default_config

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Optional Gemini import — graceful degradation if not installed
# ---------------------------------------------------------------------------
try:
    import google.generativeai as genai
    _GENAI_AVAILABLE = True
except ImportError:
    _GENAI_AVAILABLE = False
    logger.warning("google-generativeai not installed. Run: pip install google-generativeai")


# ===========================================================================
# Root cause taxonomy — the closed set of allowed answers
# ===========================================================================

ROOT_CAUSES = [
    "Price Sensitivity",
    "Delivery Cost Concern",
    "Coupon Seeking Behavior",
    "Payment Friction",
    "Checkout Complexity",
    "Trust & Security Concern",
    "Delivery Delay Concern",
    "Product Comparison Overload",
    "Low Purchase Intent",
    "Stock Availability Concern",
    "Technical Issue",
    "High Shipping Fee",
    "Long Checkout Duration",
    "Repeated Cart Modification",
    "Frequent Back Navigation",
    "Payment Failure",
    "Lack of Preferred Payment Method",
    "Price Sensitive",
    "Delivery Concern",
    "Quality Uncertainty",
    "Trust Issues",
    "Window Shopping",
    "Gift Purchase",
    "Technical Problem",
    "Product Availability",
]


# ===========================================================================
# Output schema
# ===========================================================================

@dataclass
class RootCauseResult:
    root_cause: str
    confidence: float
    evidence: List[str]
    reasoning: str
    source: str = "gemini"
    latency_ms: float = 0.0
    primary_root_cause: Optional[str] = None
    top_contributors: Optional[List[Dict[str, str]]] = None
    recommended_strategy: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


# ===========================================================================
# Prompt builder
# ===========================================================================

class PromptBuilder:
    SYSTEM_PROMPT = textwrap.dedent("""\
        You are the Root Cause Reasoning Agent for an AI Cart Abandonment Prevention System.

        Your task is NOT to invent reasons.
        Use ONLY the provided model prediction, SHAP feature importance, and customer behavioral signals.

        Rules:
        1. Never always return "Low Purchase Intent".
        2. Infer the dominant customer hesitation from the highest SHAP contributors.
        3. Return a concise business-friendly root cause.
        4. Explain why this root cause was selected.
        5. Confidence should depend on SHAP contribution magnitude.
        6. If multiple causes exist, rank them by importance.
        7. Never hallucinate information not present in the input.

        Available Root Cause Categories:
        - Delivery Cost Concern
        - Price Sensitivity
        - Coupon Seeking Behavior
        - Payment Friction
        - Checkout Complexity
        - Trust & Security Concern
        - Delivery Delay Concern
        - Product Comparison Overload
        - Low Purchase Intent
        - Stock Availability Concern
        - Technical Issue
        - High Shipping Fee
        - Long Checkout Duration
        - Repeated Cart Modification
        - Frequent Back Navigation
        - Payment Failure
        - Lack of Preferred Payment Method

        Return JSON ONLY in this format:
        {
          "primary_root_cause": "<one of the categories above>",
          "confidence": <float between 0.0 and 1.0>,
          "top_contributors": [
            {
              "feature": "<feature_name>",
              "impact": "<SHAP impact description>"
            }
          ],
          "reasoning": "<concise explanation of why this cause was chosen based on evidence>",
          "recommended_strategy": "<high level strategic direction>"
        }
    """)

    @staticmethod
    def build_user_prompt(
        abandonment_probability: float,
        top_shap_features: List[Dict[str, Any]],
        session: Optional[Dict[str, Any]] = None,
        product_info: Optional[Dict[str, Any]] = None,
        user_history: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Assemble the user-turn prompt with all available context."""
        lines = [
            "=== ABANDONMENT PREDICTION ===",
            f"Predicted Abandonment Probability : {abandonment_probability:.1%}",
            f"Risk Level                        : {'HIGH' if abandonment_probability >= 0.7 else 'MEDIUM' if abandonment_probability >= 0.4 else 'LOW'}",
            "",
            "=== TOP SHAP FEATURES (ranked by |SHAP|) ===",
        ]

        for i, feat in enumerate(top_shap_features[:15], start=1):
            direction = feat.get("direction", "")
            shap_val  = feat.get("importance", feat.get("shap_value", 0.0))
            arrow = "▲ increases abandonment" if shap_val > 0 else "▼ decreases abandonment"
            lines.append(
                f"  {i:>2}. {feat['feature']:<45} SHAP={shap_val:+.4f}  [{arrow}]"
            )

        # Key behavioural signals from the session
        if session:
            lines += ["", "=== SESSION SIGNALS ==="]
            signal_keys = [
                "hesitation_score", "trust_score", "price_sensitivity_score",
                "quality_uncertainty_score", "purchase_intent_score",
                "checkout_restart_count", "payment_failures", "otp_timeout",
                "total_shipping_charges", "delivery_unavailable_items",
                "competitor_price_checked", "tab_switch_count",
                "session_duration_seconds", "page_views", "cart_value",
                "total_items_in_cart", "is_premium_member", "device_type",
                "network_type", "persona",
            ]
            for key in signal_keys:
                if key in session:
                    lines.append(f"  {key:<40} : {session[key]}")

        # Product info
        if product_info:
            lines += ["", "=== PRODUCT INFORMATION ==="]
            for k, v in product_info.items():
                lines.append(f"  {k:<40} : {v}")

        # User history
        if user_history:
            lines += ["", "=== USER HISTORY ==="]
            for k, v in user_history.items():
                lines.append(f"  {k:<40} : {v}")

        lines += [
            "",
            "=== TASK ===",
            "Based on ALL evidence above, identify the single most likely root cause",
            "of this customer's cart abandonment. Return ONLY the JSON object.",
        ]
        return "\n".join(lines)


# ===========================================================================
# Heuristic fallback — used when Gemini is unavailable
# ===========================================================================

def _heuristic_root_cause(
    abandonment_probability: float,
    top_shap_features: List[Dict[str, Any]],
    session: Optional[Dict[str, Any]],
) -> RootCauseResult:
    """Contextual dynamic inference combining real-time behavioral signals, cart attributes, and SHAP attributions."""
    session = session or {}
    
    cart_val = float(session.get("cart_value", 0) or session.get("cart_total_value", 0))
    hesitation = float(session.get("hesitation_score", 0))
    shipping = float(session.get("total_shipping_charges", 0) or session.get("shipping_charges", 0))
    trust = float(session.get("trust_score", 0.85))
    tab_switches = float(session.get("tab_switch_count", 0))
    pay_fails = float(session.get("payment_failures", 0))
    restarts = float(session.get("checkout_restart_count", 0))
    price_sens_score = float(session.get("price_sensitivity_score", 0) or session.get("price_sensitivity", 0))
    comp_checked = float(session.get("competitor_price_checked", 0))
    quality_score = float(session.get("quality_uncertainty_score", 0) or session.get("quality_uncertainty", 0))

    # 1. Contextual friction scores derived from session behavior & cart attributes
    scores: Dict[str, float] = {
        "Price Sensitive": price_sens_score * 3.5 + comp_checked * 5.0 + (2.5 if cart_val > 10000 else 0.0),
        "Delivery Concern": (3.0 if shipping > 0 else 0.0) + float(session.get("delivery_unavailable_items", 0)) * 4.0,
        "Quality Uncertainty": quality_score * 4.0,
        "Trust Issues": max(0.0, 1.0 - trust) * 6.0,
        "Payment Friction": pay_fails * 6.5 + restarts * 5.0,
        "Window Shopping": tab_switches * 4.0 + (2.5 if str(session.get("persona", "")) == "Window Shopper" else 0.0),
        "Low Purchase Intent": (hesitation * 0.25) if hesitation > 3.0 else 0.2,
        "Product Availability": 0.0,
    }

    # 2. Weighted mapping of SHAP feature contributions
    feature_mapping = {
        "Price Sensitive": ["price", "competitor", "coupon", "discount", "cost", "value"],
        "Delivery Concern": ["shipping", "delivery", "freight", "pincode", "estimated"],
        "Quality Uncertainty": ["quality", "review", "rating", "specification", "zoom"],
        "Trust Issues": ["trust", "seller", "fake", "assurance", "guarantee"],
        "Payment Friction": ["payment", "otp", "checkout", "card", "upi"],
        "Window Shopping": ["tab_switch", "window", "browse", "duration"],
        "Low Purchase Intent": ["idle", "intent"],
        "Product Availability": ["availability", "stock", "sold"]
    }

    evidence_list = []
    for f in top_shap_features:
        feat_name = str(f.get("feature", "")).lower()
        imp = float(f.get("importance", 0))
        if imp > 0:
            evidence_list.append(f"{f.get('feature')}: SHAP = {imp:+.4f} ({f.get('direction', 'increases_abandonment')})")
            for cause, keywords in feature_mapping.items():
                if any(kw in feat_name for kw in keywords):
                    scores[cause] += imp * 2.5

    # 3. Select dominant root cause with highest combined dynamic score
    best_cause = max(scores, key=scores.get)
    best_score = scores[best_cause]

    return RootCauseResult(
        root_cause=best_cause,
        confidence=round(min(0.95, max(0.65, 0.55 + best_score * 0.05)), 2),
        evidence=evidence_list[:3] or ["Inferred from real-time session telemetry and SHAP feature attribution."],
        reasoning=(
            f"Contextual inference: Diagnosed '{best_cause}' as the core cart abandonment driver based on "
            f"cart attributes, behavioral telemetry, and local SHAP attributions (composite score: {best_score:.2f})."
        ),
        source="heuristic",
        latency_ms=0.0,
    )


# ===========================================================================
# Main agent class
# ===========================================================================

class RootCauseAgent:
    """Root Cause Reasoning Agent using Gemini API.

    Determines the single most likely reason a customer may abandon their cart
    based on XGBoost model outputs and SHAP feature evidence.

    Parameters
    ----------
    cfg : Config, optional
        Configuration object. Uses module-level singleton if not provided.
    """

    def __init__(self, cfg: Optional[Config] = None) -> None:
        self._cfg = cfg or default_config
        self._model: Optional[Any] = None
        self._prompt_builder = PromptBuilder()
        self._init_gemini()

    def _init_gemini(self) -> None:
        """Initialise the Gemini client. Safe to call even if key is missing."""
        if not _GENAI_AVAILABLE:
            logger.warning("google-generativeai not installed — agent will use heuristic fallback.")
            return

        api_key = self._cfg.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY", "")
        if not api_key:
            logger.warning(
                "GEMINI_API_KEY not set. Set it in config.py or as an environment variable. "
                "Agent will use heuristic fallback."
            )
            return

        try:
            genai.configure(api_key=api_key)
            self._model = genai.GenerativeModel(
                model_name=self._cfg.GEMINI_MODEL_NAME,
                generation_config=genai.types.GenerationConfig(
                    temperature=self._cfg.GEMINI_TEMPERATURE,
                    max_output_tokens=self._cfg.GEMINI_MAX_OUTPUT_TOKENS,
                    response_mime_type="application/json",  # enforce JSON output
                ),
                system_instruction=PromptBuilder.SYSTEM_PROMPT,
            )
            logger.info("Gemini client initialised — model: %s", self._cfg.GEMINI_MODEL_NAME)
        except Exception as exc:
            logger.warning("Gemini initialisation failed: %s — using heuristic fallback.", exc)
            self._model = None

    def _call_gemini(self, prompt: str) -> str:
        """Send the prompt to Gemini and return the raw response text."""
        response = self._model.generate_content(prompt)
        return response.text.strip()

    def _parse_response(self, raw: str) -> Dict[str, Any]:
        """Parse and validate the Gemini JSON response."""
        # Strip markdown code fences if Gemini adds them despite instructions
        if raw.startswith("```"):
            raw = "\n".join(raw.split("\n")[1:])
        if raw.endswith("```"):
            raw = "\n".join(raw.split("\n")[:-1])

        parsed = json.loads(raw)

        # Validate root cause is in the allowed set
        if parsed.get("root_cause") not in ROOT_CAUSES:
            logger.warning(
                "Gemini returned an unexpected root_cause: %r — clamping to 'Low Purchase Intent'",
                parsed.get("root_cause"),
            )
            parsed["root_cause"] = "Low Purchase Intent"

        # Clamp confidence to [0, 1]
        parsed["confidence"] = max(0.0, min(1.0, float(parsed.get("confidence", 0.5))))

        # Ensure evidence is a list of strings
        if not isinstance(parsed.get("evidence"), list):
            parsed["evidence"] = [str(parsed.get("evidence", ""))]

        return parsed

    def analyse(
        self,
        session: Optional[Dict[str, Any]] = None,
        abandonment_probability: float = 0.5,
        top_shap_features: Optional[List[Dict[str, Any]]] = None,
        product_info: Optional[Dict[str, Any]] = None,
        user_history: Optional[Dict[str, Any]] = None,
    ) -> RootCauseResult:
        """Determine the root cause of cart abandonment for a session.

        Parameters
        ----------
        session : dict, optional
            Raw session feature values.
        abandonment_probability : float
            XGBoost classifier's predicted probability (0–1).
        top_shap_features : list[dict]
            SHAP features from ``ShapEngine.get_top_features()``.
            Each dict: {"feature": str, "importance": float, "direction": str}.
        product_info : dict, optional
            Product metadata (category, price, rating, etc.).
        user_history : dict, optional
            Historical user behaviour (past purchases, return rate, etc.).

        Returns
        -------
        RootCauseResult
            Structured root cause with evidence, reasoning, and confidence.
        """
        top_shap_features = top_shap_features or []
        session = session or {}

        # --- Heuristic path ---
        if self._model is None:
            logger.info("Gemini unavailable — using heuristic root cause inference.")
            return _heuristic_root_cause(abandonment_probability, top_shap_features, session)

        # --- Gemini path ---
        user_prompt = self._prompt_builder.build_user_prompt(
            abandonment_probability=abandonment_probability,
            top_shap_features=top_shap_features,
            session=session,
            product_info=product_info,
            user_history=user_history,
        )

        logger.debug("Sending prompt to Gemini (%d chars)...", len(user_prompt))
        t0 = time.perf_counter()

        try:
            raw_response = self._call_gemini(user_prompt)
            latency_ms = (time.perf_counter() - t0) * 1000
            logger.info("Gemini responded in %.0fms", latency_ms)

            parsed = self._parse_response(raw_response)
            return RootCauseResult(
                root_cause=parsed["root_cause"],
                confidence=parsed["confidence"],
                evidence=parsed["evidence"],
                reasoning=parsed.get("reasoning", ""),
                source="gemini",
                latency_ms=round(latency_ms, 1),
            )

        except json.JSONDecodeError as exc:
            logger.warning("Gemini returned invalid JSON (%s). Falling back to heuristic.", exc)
            return _heuristic_root_cause(abandonment_probability, top_shap_features, session)
        except Exception as exc:
            logger.warning("Gemini call failed (%s). Falling back to heuristic.", exc)
            return _heuristic_root_cause(abandonment_probability, top_shap_features, session)

    def analyse_batch(
        self,
        sessions: List[Dict[str, Any]],
        abandonment_probabilities: List[float],
        top_shap_features_list: List[List[Dict[str, Any]]],
        product_infos: Optional[List[Optional[Dict[str, Any]]]] = None,
        user_histories: Optional[List[Optional[Dict[str, Any]]]] = None,
    ) -> List[RootCauseResult]:
        """Analyse root cause for a batch of sessions.

        Processes sessions sequentially to respect Gemini rate limits.
        """
        results = []
        n = len(sessions)
        for i, (sess, prob, feats) in enumerate(
            zip(sessions, abandonment_probabilities, top_shap_features_list)
        ):
            logger.info("Analysing session %d/%d (prob=%.2f)", i + 1, n, prob)
            result = self.analyse(
                session=sess,
                abandonment_probability=prob,
                top_shap_features=feats,
                product_info=(product_infos[i] if product_infos else None),
                user_history=(user_histories[i] if user_histories else None),
            )
            results.append(result)
        return results


# ===========================================================================
# CLI demo
# ===========================================================================

if __name__ == "__main__":
    import pprint
    logging.basicConfig(
        level=logging.INFO,
        format=default_config.LOG_FORMAT,
    )

    # -----------------------------------------------------------------------
    # Example: high-risk session with strong price sensitivity signals
    # -----------------------------------------------------------------------
    demo_session = {
        "persona":                    "Price Sensitive Shopper",
        "hesitation_score":           2.8,
        "trust_score":                0.65,
        "price_sensitivity_score":    1.9,
        "quality_uncertainty_score":  0.4,
        "purchase_intent_score":      0.3,
        "checkout_restart_count":     0,
        "payment_failures":           0,
        "otp_timeout":                0,
        "total_shipping_charges":     50.0,
        "delivery_unavailable_items": 0,
        "competitor_price_checked":   1,
        "tab_switch_count":           6,
        "session_duration_seconds":   340,
        "page_views":                 18,
        "cart_value":                 8500.0,
        "total_items_in_cart":        2,
        "is_premium_member":          0,
        "device_type":                "Mobile",
        "network_type":               "4G",
    }

    demo_shap_features = [
        {"feature": "competitor_difference",       "importance":  0.214, "direction": "increases_abandonment"},
        {"feature": "price_sensitivity_score",     "importance":  0.179, "direction": "increases_abandonment"},
        {"feature": "hesitation_score",            "importance":  0.156, "direction": "increases_abandonment"},
        {"feature": "tab_switch_count",            "importance":  0.098, "direction": "increases_abandonment"},
        {"feature": "trust_score",                 "importance": -0.089, "direction": "decreases_abandonment"},
        {"feature": "total_shipping_charges",      "importance":  0.071, "direction": "increases_abandonment"},
        {"feature": "purchase_intent_score",       "importance": -0.054, "direction": "decreases_abandonment"},
        {"feature": "checkout_restart_count",      "importance":  0.021, "direction": "increases_abandonment"},
        {"feature": "is_premium_member",           "importance": -0.018, "direction": "decreases_abandonment"},
        {"feature": "quality_uncertainty_score",   "importance":  0.012, "direction": "increases_abandonment"},
    ]

    demo_product = {
        "category":       "Electronics",
        "brand":          "Samsung",
        "price":          8500.0,
        "rating":         4.1,
        "rating_count":   1243,
        "discount":       "15%",
        "in_stock":       True,
    }

    demo_history = {
        "total_purchases":       3,
        "days_since_last_buy":   45,
        "previous_abandoned":    2,
        "abandonment_rate":      0.40,
        "preferred_category":    "Electronics",
    }

    agent = RootCauseAgent()
    result = agent.analyse(
        session=demo_session,
        abandonment_probability=0.874,
        top_shap_features=demo_shap_features,
        product_info=demo_product,
        user_history=demo_history,
    )

    print("\n" + "=" * 60)
    print("ROOT CAUSE ANALYSIS RESULT")
    print("=" * 60)
    print(json.dumps(result.to_dict(), indent=2))
    print("=" * 60)
    print("\nLLM SUMMARY:\n")
    print(result.to_llm_summary())
