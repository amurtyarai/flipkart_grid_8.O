"""confidence_engine.py — Production-Grade Recommendation Confidence Scoring Engine

Mathematical Formula
--------------------
The confidence score is computed as a weighted linear combination of six core
components, each normalised to the [0.0, 1.0] interval:

    C_final = (
        w_prob * C_prob +
        w_shap * C_shap +
        w_cause * C_cause +
        w_sim * C_sim +
        w_hist * C_hist +
        w_rules * C_rules
    ) * 100

Where:
  1. C_prob (XGBoost certainty): 2 * |probability - 0.5|.
     Maximized at absolute certainty (0.0 or 1.0), zero at the decision boundary (0.5).
  2. C_shap (Attribution strength): Sum of absolute top-3 SHAP values / normalisation constant (1.5).
     Clamped to 1.0. Measures the strength of the statistical signals.
  3. C_cause (Root cause reasoning confidence): Confidence score from the Root Cause Agent.
  4. C_sim (Semantic similarity): Retrieval score from ChromaDB (cosine space).
  5. C_hist (Historical success rate): Empirical success rate of the intervention in the KB.
  6. C_rules (Business rule consistency): 1.0 if the intervention satisfies the discount minimisation
     and segment rules; 0.2 if a high-cost discount is offered for low-risk scenarios.

Weights (Sum to 1.0):
  - w_prob  = 0.20
  - w_shap  = 0.15
  - w_cause = 0.20
  - w_sim   = 0.15
  - w_hist  = 0.15
  - w_rules = 0.15

Confidence Levels:
  - HIGH   : Score >= 75
  - MEDIUM : 45 <= Score < 75
  - LOW    : Score < 45
"""

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ===========================================================================
# Structured Output Schema
# ===========================================================================

@dataclass
class ConfidenceBreakdown:
    """Breakdown of individual normalised scores for auditing."""
    model_probability_certainty: float
    shap_evidence_strength: float
    root_cause_confidence: float
    semantic_similarity: float
    historical_success_rate: float
    business_rule_consistency: float


@dataclass
class ConfidenceScoreResult:
    """Final output from the Confidence Scoring Engine."""
    confidence_score: int                 # 0 to 100
    confidence_level: str                 # "HIGH" | "MEDIUM" | "LOW"
    action_tier: str                      # "FULL" | "LOW_COST" | "INFO_ONLY" | "NOOP"
    action_explanation: str               # Human-readable rationale for action tier
    max_allowable_discount_pct: float    # Max discount allowed under margin rules
    formula_explanation: str
    breakdown: ConfidenceBreakdown

    def to_dict(self) -> Dict[str, Any]:
        return {
            "confidence_score": self.confidence_score,
            "confidence_level": self.confidence_level,
            "action_tier": self.action_tier,
            "action_explanation": self.action_explanation,
            "max_allowable_discount_pct": self.max_allowable_discount_pct,
            "formula_explanation": self.formula_explanation,
            "breakdown": asdict(self.breakdown),
        }


# ===========================================================================
# Confidence Scoring Engine
# ===========================================================================

class ConfidenceEngine:
    """Production confidence assessment engine for cart abandonment decisions."""

    # Weights configuration
    W_PROB = 0.20
    W_SHAP = 0.15
    W_CAUSE = 0.20
    W_SIM = 0.15
    W_HIST = 0.15
    W_RULES = 0.15

    # SHAP normalisation denominator (typical absolute sum of top-3 SHAP values)
    SHAP_NORM_VAL = 1.5

    def __init__(self) -> None:
        pass

    def compute_score(
        self,
        abandonment_probability: float,
        top_shap_features: List[Dict[str, Any]],
        root_cause_confidence: float,
        semantic_similarity: float,
        historical_success_rate: float,
        business_cost: str,
    ) -> ConfidenceScoreResult:
        """Calculate the weighted conversion confidence score.

        Parameters
        ----------
        abandonment_probability : float
            Predicted probability from XGBoost classifier (0.0 to 1.0).
        top_shap_features : list[dict]
            Top SHAP features. Each dict contains {"importance": float}.
        root_cause_confidence : float
            Confidence of the root cause reasoning agent (0.0 to 1.0).
        semantic_similarity : float
            Similarity score of the retrieved intervention (0.0 to 1.0).
        historical_success_rate : float
            Historical success rate from the knowledge base (0.0 to 1.0).
        business_cost : str
            Cost category of the selected intervention ("None", "Low", "Medium", "High").

        Returns
        -------
        ConfidenceScoreResult
            Final score, confidence level, and formula breakdown.
        """
        # 1. Model Certainty (maximized at 0 or 1, zero at decision boundary 0.5)
        c_prob = float(2.0 * abs(abandonment_probability - 0.5))

        # 2. SHAP Evidence Strength (attributions strength sum)
        shap_sum = sum(
            abs(float(f.get("importance", f.get("shap_value", 0.0))))
            for f in top_shap_features[:3]
        )
        c_shap = float(min(1.0, shap_sum / self.SHAP_NORM_VAL))

        # 3. Root cause confidence (already 0-1)
        c_cause = float(max(0.0, min(1.0, root_cause_confidence)))

        # 4. Semantic similarity (already 0-1)
        c_sim = float(max(0.0, min(1.0, semantic_similarity)))

        # 5. Historical success (already 0-1)
        c_hist = float(max(0.0, min(1.0, historical_success_rate)))

        # 6. Business Rule Consistency
        # Discount minimisation rule: do not offer Medium/High cost if risk < 0.75
        c_rules = 1.0
        cost_lower = business_cost.lower()
        is_discount = any(k in cost_lower for k in ["medium", "high"])
        if is_discount and abandonment_probability < 0.75:
            # Low consistency score due to rule violation
            c_rules = 0.20

        # Calculate final weighted score
        weighted_score = (
            self.W_PROB * c_prob +
            self.W_SHAP * c_shap +
            self.W_CAUSE * c_cause +
            self.W_SIM * c_sim +
            self.W_HIST * c_hist +
            self.W_RULES * c_rules
        )

        final_score = int(round(weighted_score * 100))
        # Ensure within bounds [0, 100]
        final_score = max(0, min(100, final_score))

        # Classify confidence level & action gating ladder (W1.2)
        conf_ratio = final_score / 100.0
        if final_score >= 85:
            level = "HIGH"
            action_tier = "FULL"
            action_explanation = "High confidence (≥85%): Authorized for high-impact full intervention and dynamic discounts."
            max_discount_pct = 15.0
        elif final_score >= 60:
            level = "HIGH" if final_score >= 75 else "MEDIUM"
            action_tier = "LOW_COST"
            action_explanation = "Moderate confidence (≥60%): Restricted to low-cost soft nudges or free shipping incentives."
            max_discount_pct = 8.0
        elif final_score >= 35:
            level = "MEDIUM" if final_score >= 45 else "LOW"
            action_tier = "INFO_ONLY"
            action_explanation = "Low-to-medium confidence (≥35%): Restricted to zero-cost informational badges & urgency signals."
            max_discount_pct = 0.0
        else:
            level = "LOW"
            action_tier = "NOOP"
            action_explanation = "Low confidence (<35%): Action gated to NOOP to prevent unnecessary friction and revenue leakage."
            max_discount_pct = 0.0

        # Math formula details
        formula_text = (
            f"C_final = ({self.W_PROB}*C_prob + {self.W_SHAP}*C_shap + "
            f"{self.W_CAUSE}*C_cause + {self.W_SIM}*C_sim + "
            f"{self.W_HIST}*C_hist + {self.W_RULES}*C_rules) * 100"
        )

        return ConfidenceScoreResult(
            confidence_score=final_score,
            confidence_level=level,
            action_tier=action_tier,
            action_explanation=action_explanation,
            max_allowable_discount_pct=max_discount_pct,
            formula_explanation=formula_text,
            breakdown=ConfidenceBreakdown(
                model_probability_certainty=round(c_prob, 4),
                shap_evidence_strength=round(c_shap, 4),
                root_cause_confidence=round(c_cause, 4),
                semantic_similarity=round(c_sim, 4),
                historical_success_rate=round(c_hist, 4),
                business_rule_consistency=round(c_rules, 4),
            ),
        )


# ===========================================================================
# CLI Demo / test run
# ===========================================================================

if __name__ == "__main__":
    import json
    logging.basicConfig(level=logging.INFO)

    engine = ConfidenceEngine()

    # Case 1: High model certainty, strong SHAP features, compliant low-cost rule
    print("\n" + "=" * 60)
    print("CASE 1: STRONG SIGNALS & COMPLIANT RULE")
    print("=" * 60)
    res_1 = engine.compute_score(
        abandonment_probability=0.88,
        top_shap_features=[
            {"feature": "competitor_difference", "importance": 0.65},
            {"feature": "price_sensitivity_score", "importance": 0.55},
            {"feature": "hesitation_score", "importance": 0.40},
        ],
        root_cause_confidence=0.90,
        semantic_similarity=0.85,
        historical_success_rate=0.72,
        business_cost="Low",
    )
    print(json.dumps(res_1.to_dict(), indent=2))

    # Case 2: Ambiguous probability (~0.52), weak SHAP, rule violation (high-cost discount for low risk)
    print("\n" + "=" * 60)
    print("CASE 2: WEAK SIGNALS & RULE VIOLATION")
    print("=" * 60)
    res_2 = engine.compute_score(
        abandonment_probability=0.52,
        top_shap_features=[
            {"feature": "user_gender_Unknown", "importance": 0.02},
            {"feature": "location_tier_Tier 2", "importance": 0.01},
        ],
        root_cause_confidence=0.45,
        semantic_similarity=0.50,
        historical_success_rate=0.60,
        business_cost="Medium (direct discount)",
    )
    print(json.dumps(res_2.to_dict(), indent=2))
