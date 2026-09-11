"""recommender_agent.py — Production Recommendation Agent using Gemini API

Purpose
-------
The final execution layer of the Cart Abandonment ML platform. It accepts the
outputs of the preceding modules:
  1. predicted abandonment probability (from train/predict)
  2. inferred root cause (from RootCauseAgent)
  3. candidate interventions (from RagRetriever)
  4. business rules (e.g. margin constraints, return risks)

It uses the Gemini API (JSON mode) to select the single most effective,
lowest-cost intervention that aligns with the root cause, prioritising cost-efficiency
and margin protection over broad discounts.

Business Rules Enforced
-----------------------
* **Discount Minimisation**: Avoid direct discounts if abandonment risk is moderate
  (< 0.75) or if the customer has high return tendencies.
* **Cost Optimisation**: Pick the lowest-cost effective intervention from candidates.
* **Structured Priority**:
    - High priority: abandonment risk >= 0.75
    - Medium priority: abandonment risk 0.45 - 0.75
    - Low priority: abandonment risk < 0.45

Output JSON Schema
------------------
{
  "recommended_intervention": "Offer no-cost EMI options at checkout.",
  "reason": "The customer is Price Sensitive, but risk is medium (0.68) and category is high-value Electronics. No-cost EMI resolves budget hesitation without direct discount margin impact.",
  "expected_success_rate": 0.72,
  "business_cost": "Low (financing partnership overhead, no direct discount)",
  "priority": "Medium",
  "confidence_score": 0.85
}
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
from cart_abandonment_ml.recommendation.multilingual import translate_nudge, SUPPORTED_LANGUAGES

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Optional Gemini import — graceful fallback
# ---------------------------------------------------------------------------
try:
    import google.generativeai as genai
    _GENAI_AVAILABLE = True
except ImportError:
    _GENAI_AVAILABLE = False


# ===========================================================================
# Structured Output Schema
# ===========================================================================

@dataclass
class RecommendationResult:
    """Structured output from the Recommendation Agent."""
    recommended_intervention: str
    reason: str
    expected_success_rate: float
    business_cost: str
    priority: str  # "High" | "Medium" | "Low"
    confidence_score: float
    source: str  # "gemini" or "fallback_heuristic"
    language: str = "English"
    multilingual_nudge: str = ""
    latency_ms: float = 0.0
    evidence_trail: List[Dict[str, Any]] = None
    rejected_alternatives: List[Dict[str, Any]] = None

    def __post_init__(self):
        if self.evidence_trail is None:
            self.evidence_trail = []
        if self.rejected_alternatives is None:
            self.rejected_alternatives = []

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


# ===========================================================================
# Prompt Builder
# ===========================================================================

class PromptBuilder:
    """Builds the prompt that guides the recommendation synthesis."""

    SYSTEM_PROMPT = textwrap.dedent("""\
        You are a Principal AI Strategist and Conversion Optimisation Director at Flipkart.
        Your task is to review a cart abandonment session analysis and select the single
        most cost-effective, high-probability intervention.

        Allowed Priorities:
        - High
        - Medium
        - Low

        Decision Criteria:
        1. Discount Minimisation: Do NOT offer direct discounts (cost 'Medium' or 'High')
           if abandonment probability is less than 0.75, or if the user has a history of high return rates.
        2. Cost Efficiency: Prefer 'None' or 'Low' cost interventions (e.g. no-cost EMI,
           social proof, secure platform trust highlights, delivery date guarantees)
           over direct discounts where possible.
        3. Match the Root Cause: The recommended intervention must directly resolve the inferred root cause.

        Your output MUST be a single valid JSON object matching this exact schema:
        {
          "recommended_intervention": "<the specific intervention description>",
          "reason": "<one detailed paragraph explaining how this complies with the cost-efficiency rules>",
          "expected_success_rate": <float between 0.0 and 1.0 representing expected conversion chance>,
          "business_cost": "<None, Low, Medium, or High>",
          "priority": "<High, Medium, or Low>",
          "confidence_score": <float between 0.0 and 1.0 representing your confidence in this decision>
        }

        Rules:
        1. Output ONLY the JSON object. No markdown, no conversational text.
        2. Keep the recommendation concrete and immediately actionable.
    """)

    @staticmethod
    def build_user_prompt(
        abandonment_probability: float,
        root_cause: str,
        retrieved_knowledge: List[Dict[str, Any]],
        business_rules: Optional[Dict[str, Any]] = None,
    ) -> str:
        lines = [
            "=== ANALYSIS STATE ===",
            f"Abandonment Probability : {abandonment_probability:.4f}",
            f"Root Cause              : {root_cause}",
            "",
            "=== CANDIDATE INTERVENTIONS FROM KNOWLEDGE BASE ===",
        ]

        for i, item in enumerate(retrieved_knowledge, start=1):
            lines.append(f"Candidate {i}:")
            lines.append(f"  • Document ID  : {item.get('document_id', 'N/A')}")
            lines.append(f"  • Intervention : {item.get('recommended_intervention', '')}")
            lines.append(f"  • Business Cost: {item.get('business_cost', '')}")
            lines.append(f"  • Success Rate : {item.get('success_rate', 0.0):.1%}")
            lines.append(f"  • Risk Level   : {item.get('risk_level', '')}")
            lines.append(f"  • Explanation  : {item.get('explanation', '')}")
            lines.append("")

        if business_rules:
            lines.append("=== CUSTOM BUSINESS RULES ===")
            for k, v in business_rules.items():
                lines.append(f"  • {k}: {v}")
            lines.append("")

        lines += [
            "=== TASK ===",
            "Select the best intervention from the candidates (or adapt one to be more cost-efficient).",
            "Ensure you prefer the lowest cost option that resolves the root cause. Return ONLY the JSON object.",
        ]
        return "\n".join(lines)


# ===========================================================================
# Evidence Trail & Rejected Alternatives Builders (W1.1)
# ===========================================================================

def build_evidence_trail(
    shap_features: Optional[List[Dict[str, Any]]] = None,
    session_data: Optional[Dict[str, Any]] = None,
    root_cause: str = ""
) -> List[Dict[str, Any]]:
    """Map top SHAP feature attributions and session signals to human evidence sentences."""
    evidence = []
    if shap_features:
        for feat in shap_features[:5]:
            fname = feat.get("feature", "unknown_feature")
            imp = float(feat.get("importance", feat.get("shap_value", 0.0)))
            val = feat.get("value", "N/A")
            direction = "increases_risk" if imp >= 0 else "decreases_risk"
            
            clean_name = fname.replace("_", " ").title()
            sentence = f"Feature '{clean_name}' (val: {val}) {direction.replace('_', ' ')} for root cause '{root_cause}'."
            evidence.append({
                "feature": fname,
                "value": val,
                "importance": round(imp, 4),
                "direction": direction,
                "target_cause": root_cause,
                "evidence_sentence": sentence,
            })
    return evidence


def build_rejected_alternatives(
    selected_doc_id: str,
    retrieved_knowledge: List[Dict[str, Any]],
    abandonment_probability: float
) -> List[Dict[str, Any]]:
    """Explain why alternative candidates were eliminated."""
    rejected = []
    for item in retrieved_knowledge:
        doc_id = item.get("document_id", "N/A")
        if doc_id == selected_doc_id:
            continue
        cost_str = str(item.get("business_cost", "")).lower()
        if ("medium" in cost_str or "high" in cost_str) and abandonment_probability < 0.75:
            reason = f"Candidate {doc_id} rejected: Discount cost violates margin rule for moderate risk ({abandonment_probability:.2f} < 0.75)."
        else:
            reason = f"Candidate {doc_id} rejected: Lower overall efficiency score than selected strategy."
        rejected.append({
            "candidate_id": doc_id,
            "recommended_intervention": item.get("recommended_intervention", ""),
            "reason": reason,
        })
    return rejected


# ===========================================================================
# Heuristic fallback — used when Gemini is unavailable
# ===========================================================================

def _heuristic_recommendation(
    abandonment_probability: float,
    root_cause: str,
    retrieved_knowledge: List[Dict[str, Any]],
    top_shap_features: Optional[List[Dict[str, Any]]] = None,
    language: str = "English",
) -> RecommendationResult:
    """Rule-based synthesis fallback.

    Sorts retrieved knowledge based on business rules:
    1. Filter out direct discounts if probability < 0.75.
    2. Sort by business_cost ascending ('none', 'low', 'medium', 'high'),
       then by success_rate descending.
    3. Return the top match.
    """
    evidence = build_evidence_trail(top_shap_features, None, root_cause)

    if not retrieved_knowledge:
        rec_default = "Trigger a standard cart abandonment reminder notification after 24 hours."
        return RecommendationResult(
            recommended_intervention=rec_default,
            reason="Heuristic fallback: No retrieved knowledge candidates available.",
            expected_success_rate=0.15,
            business_cost="None",
            priority="Low",
            confidence_score=0.90,
            source="fallback_heuristic",
            language=language,
            multilingual_nudge=translate_nudge(rec_default, language),
            evidence_trail=evidence,
            rejected_alternatives=[],
        )

    # Cost mapping weights
    cost_weights = {"none": 1, "low": 2, "medium": 3, "high": 4}

    scored_candidates = []
    for item in retrieved_knowledge:
        cost_str = str(item.get("business_cost", "none")).lower()
        base_cost = "none"
        for kw in ["none", "low", "medium", "high"]:
            if kw in cost_str:
                base_cost = kw
                break

        cost_val = cost_weights.get(base_cost, 1)

        is_discount = base_cost in ["medium", "high"]
        if is_discount and abandonment_probability < 0.75:
            cost_val += 10

        success = float(item.get("success_rate", 0.0))
        score = success / cost_val
        scored_candidates.append((score, base_cost, item))

    scored_candidates.sort(key=lambda x: x[0], reverse=True)
    best_cost, best_doc = scored_candidates[0][1], scored_candidates[0][2]
    selected_id = best_doc.get("document_id", "DOC-UNKNOWN")

    rejected = build_rejected_alternatives(selected_id, retrieved_knowledge, abandonment_probability)

    priority = (
        "High" if abandonment_probability >= 0.75
        else "Medium" if abandonment_probability >= 0.45
        else "Low"
    )

    rec_text = best_doc.get("recommended_intervention", "")
    nudge = translate_nudge(rec_text, language)

    return RecommendationResult(
        recommended_intervention=rec_text,
        reason=(
            f"Heuristic fallback: Selected candidate {selected_id} matching root cause '{root_cause}'. "
            f"Cost '{best_cost}' prioritised for conversion rate optimization relative to abandonment risk ({abandonment_probability:.2f})."
        ),
        expected_success_rate=float(best_doc.get("success_rate", 0.5)),
        business_cost=best_doc.get("business_cost", "Low"),
        priority=priority,
        confidence_score=0.85,
        source="fallback_heuristic",
        language=language,
        multilingual_nudge=nudge,
        evidence_trail=evidence,
        rejected_alternatives=rejected,
    )


# ===========================================================================
# RecommenderAgent Class
# ===========================================================================

class RecommenderAgent:
    """Recommendation Agent using Gemini API.

    Selects the single most cost-effective recommendation from RAG retrieved docs.

    Parameters
    ----------
    cfg : Config, optional
        Configuration object.
    """

    def __init__(self, cfg: Optional[Config] = None) -> None:
        self._cfg = cfg or default_config
        self._model: Optional[Any] = None
        self._prompt_builder = PromptBuilder()
        self._init_gemini()

    def _init_gemini(self) -> None:
        if not _GENAI_AVAILABLE:
            return

        api_key = self._cfg.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY", "")
        if not api_key:
            return

        try:
            genai.configure(api_key=api_key)
            self._model = genai.GenerativeModel(
                model_name=self._cfg.GEMINI_MODEL_NAME,
                generation_config=genai.types.GenerationConfig(
                    temperature=self._cfg.GEMINI_TEMPERATURE,
                    max_output_tokens=self._cfg.GEMINI_MAX_OUTPUT_TOKENS,
                    response_mime_type="application/json",
                ),
                system_instruction=PromptBuilder.SYSTEM_PROMPT,
            )
            logger.info("Recommendation Gemini client initialised — model: %s", self._cfg.GEMINI_MODEL_NAME)
        except Exception as exc:
            logger.error("Failed to initialise Gemini for RecommenderAgent: %s", exc)
            self._model = None

    def _call_gemini(self, prompt: str) -> str:
        response = self._model.generate_content(prompt)
        return response.text.strip()

    def _parse_response(self, raw: str) -> Dict[str, Any]:
        if raw.startswith("```"):
            raw = "\n".join(raw.split("\n")[1:])
        if raw.endswith("```"):
            raw = "\n".join(raw.split("\n")[:-1])
        parsed = json.loads(raw)

        # Validate structured fields
        parsed["expected_success_rate"] = max(0.0, min(1.0, float(parsed.get("expected_success_rate", 0.5))))
        parsed["confidence_score"] = max(0.0, min(1.0, float(parsed.get("confidence_score", 0.5))))

        priority = parsed.get("priority", "Low")
        if priority not in ["High", "Medium", "Low"]:
            parsed["priority"] = "Medium"

        return parsed

    def recommend(
        self,
        abandonment_probability: float,
        root_cause: str,
        retrieved_knowledge: List[Dict[str, Any]],
        business_rules: Optional[Dict[str, Any]] = None,
        top_shap_features: Optional[List[Dict[str, Any]]] = None,
        session_data: Optional[Dict[str, Any]] = None,
        language: str = "English",
    ) -> RecommendationResult:
        """Generate the structured recommendation.

        Parameters
        ----------
        abandonment_probability : float
            Predicted probability (0.0 - 1.0).
        root_cause : str
            Inferred root cause.
        retrieved_knowledge : list[dict]
            Candidate documents from RAG search.
        business_rules : dict, optional
            Additional contextual business constraints.
        top_shap_features : list[dict], optional
            SHAP attributions for evidence trail mapping.
        session_data : dict, optional
            Raw session signals for evidence trail.
        language : str, optional
            Target language for the intervention nudge.
        """
        t0 = time.perf_counter()
        evidence = build_evidence_trail(top_shap_features, session_data, root_cause)

        # Heuristic path
        if self._model is None:
            res = _heuristic_recommendation(abandonment_probability, root_cause, retrieved_knowledge, top_shap_features, language=language)
            res.latency_ms = round((time.perf_counter() - t0) * 1000, 2)
            return res

        # Gemini path
        try:
            user_prompt = self._prompt_builder.build_user_prompt(
                abandonment_probability=abandonment_probability,
                root_cause=root_cause,
                retrieved_knowledge=retrieved_knowledge,
                business_rules=business_rules,
            )

            raw = self._call_gemini(user_prompt)
            latency_ms = (time.perf_counter() - t0) * 1000

            parsed = self._parse_response(raw)
            rec_text = parsed["recommended_intervention"]
            
            # Find matching doc ID if any
            selected_doc_id = "CUSTOM_LLM"
            for doc in retrieved_knowledge:
                if doc.get("recommended_intervention") == rec_text:
                    selected_doc_id = doc.get("document_id", "CUSTOM_LLM")
                    break
            
            rejected = build_rejected_alternatives(selected_doc_id, retrieved_knowledge, abandonment_probability)
            nudge = translate_nudge(rec_text, language)

            return RecommendationResult(
                recommended_intervention=rec_text,
                reason=parsed["reason"],
                expected_success_rate=parsed["expected_success_rate"],
                business_cost=parsed["business_cost"],
                priority=parsed["priority"],
                confidence_score=parsed["confidence_score"],
                source="gemini",
                language=language,
                multilingual_nudge=nudge,
                latency_ms=round(latency_ms, 2),
                evidence_trail=evidence,
                rejected_alternatives=rejected,
            )

        except Exception as exc:
            logger.warning("Recommender Gemini call failed: %s. Falling back to rules.", exc)
            res = _heuristic_recommendation(abandonment_probability, root_cause, retrieved_knowledge, top_shap_features, language=language)
            res.latency_ms = round((time.perf_counter() - t0) * 1000, 2)
            return res


# ===========================================================================
# CLI Demo / test run
# ===========================================================================

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format=default_config.LOG_FORMAT)

    agent = RecommenderAgent()

    # Sample retrieved candidates
    candidates = [
        {
            "document_id": "DOC-001",
            "recommended_intervention": "Trigger a 10% coupon valid for 15 minutes.",
            "business_cost": "Medium (margin impact)",
            "success_rate": 0.65,
            "risk_level": "Medium",
            "explanation": "Direct price incentives convert price sensitive users."
        },
        {
            "document_id": "DOC-002",
            "recommended_intervention": "Highlight no-cost EMI and Flipkart Pay Later credit options.",
            "business_cost": "Low (no margin impact)",
            "success_rate": 0.58,
            "risk_level": "Low",
            "explanation": "No-cost financing resolves budget friction without margin cost."
        }
    ]

    print("\n" + "=" * 60)
    print("DEMO 1: MODERATE ABANDONMENT RISK (probability = 0.68)")
    print("=" * 60)
    res_1 = agent.recommend(
        abandonment_probability=0.68,
        root_cause="Price Sensitive",
        retrieved_knowledge=candidates,
    )
    print(json.dumps(res_1.to_dict(), indent=2))

    print("\n" + "=" * 60)
    print("DEMO 2: HIGH ABANDONMENT RISK (probability = 0.88)")
    print("=" * 60)
    res_2 = agent.recommend(
        abandonment_probability=0.88,
        root_cause="Price Sensitive",
        retrieved_knowledge=candidates,
    )
    print(json.dumps(res_2.to_dict(), indent=2))
