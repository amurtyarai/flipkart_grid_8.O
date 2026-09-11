"""predict.py — Production Inference API for Cart Abandonment Prediction

This module exposes a stateless prediction function suitable for integration with:
- REST API endpoints (FastAPI / Flask)
- LLM + RAG reasoning agents
- Batch scoring pipelines

Architecture
------------
The prediction pipeline loads three artifacts at startup:
  1. preprocessor.pkl    — Fitted StandardScaler
  2. classifier.pkl      — Trained XGBClassifier
  3. feature_names.json  — Ordered feature list

For a given shopping session (dict), it:
  1. Aligns the session dict to the trained feature space
  2. Applies the StandardScaler transformation
  3. Calls predict_proba()[:,1] for abandonment_probability
  4. Optionally computes per-instance SHAP values for top feature attribution
  5. Returns a structured PredictionResult

Output Schema
-------------
{
    "abandonment_probability": 0.8734,
    "prediction": true,
    "predicted_class": "Likely Abandon",
    "confidence": 0.8734,
    "top_features": [
        {"feature": "hesitation_score",  "shap_value": 0.312, "raw_value": 1.45},
        {"feature": "trust_score",       "shap_value": -0.24, "raw_value": 0.35},
        ...
    ]
}

Usage
-----
  from cart_abandonment_ml.training.predict import Predictor

  predictor = Predictor()
  result = predictor.predict(session_dict)

Or as CLI (sample prediction):
  python -m cart_abandonment_ml.training.predict
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb

try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False

from cart_abandonment_ml.config.config import Config, config as default_config

logger = logging.getLogger(__name__)


# ===========================================================================
# Output schema
# ===========================================================================

@dataclass
class FeatureContribution:
    """SHAP-based feature contribution for a single prediction."""
    feature: str
    shap_value: float
    raw_value: float


@dataclass
class PredictionResult:
    """Structured output from the Predictor.

    Attributes
    ----------
    abandonment_probability : float
        Calibrated probability in [0.0, 1.0]. Primary output for downstream systems.
    prediction : bool
        True if abandonment_probability >= classification_threshold.
    predicted_class : str
        Human-readable label: "Likely Abandon" or "Likely Purchase".
    confidence : float
        Distance from 0.5 — higher means more confident.
    top_features : list[FeatureContribution]
        SHAP-based attribution of the top-N features driving this prediction.
    inference_time_ms : float
        Wall-clock time for this prediction in milliseconds.
    """
    abandonment_probability: float
    prediction: bool
    predicted_class: str
    confidence: float
    top_features: List[FeatureContribution]
    inference_time_ms: float

    def to_dict(self) -> Dict[str, Any]:
        """Serialise to a plain dict suitable for JSON responses."""
        return {
            "abandonment_probability": self.abandonment_probability,
            "prediction": self.prediction,
            "predicted_class": self.predicted_class,
            "confidence": self.confidence,
            "top_features": [asdict(f) for f in self.top_features],
            "inference_time_ms": self.inference_time_ms,
        }


# ===========================================================================
# Predictor class
# ===========================================================================

class Predictor:
    """Production inference class for cart abandonment scoring.

    Loads model artifacts once at construction and reuses them across calls.
    Thread-safe for read-only prediction; do not modify state after __init__.

    Parameters
    ----------
    cfg : Config, optional
        Configuration object. Loads artifacts from cfg.MODEL_DIR.
    """

    def __init__(self, cfg: Optional[Config] = None) -> None:
        self._cfg = cfg or default_config
        self._model_dir = Path(self._cfg.MODEL_DIR)
        self._threshold = self._cfg.CLASSIFICATION_THRESHOLD
        self._top_n = self._cfg.SHAP_TOP_FEATURES

        logger.info("Loading model artifacts from %s", self._model_dir)
        self._classifier: xgb.XGBClassifier = self._load_classifier()
        self._scaler = self._load_preprocessor()
        self._feature_names: List[str] = self._load_feature_names()
        self._class_mapping: Dict[int, str] = self._load_class_mapping()

        # Lazy-load SHAP explainer on first use
        self._explainer: Optional[Any] = None
        logger.info(
            "Predictor ready — %d features | threshold=%.2f",
            len(self._feature_names), self._threshold,
        )

    # ------------------------------------------------------------------
    # Artifact loaders
    # ------------------------------------------------------------------

    def _load_classifier(self) -> xgb.XGBClassifier:
        path = self._model_dir / "classifier.pkl"
        if not path.is_file():
            raise FileNotFoundError(
                f"Classifier not found at {path}. "
                "Run: python -m cart_abandonment_ml.training.train"
            )
        clf = joblib.load(path)
        logger.info("Classifier loaded from %s", path)
        return clf

    def _load_preprocessor(self) -> Any:
        path = self._model_dir / "preprocessor.pkl"
        if not path.is_file():
            raise FileNotFoundError(f"Preprocessor (scaler) not found at {path}.")
        scaler = joblib.load(path)
        logger.info("Preprocessor (StandardScaler) loaded from %s", path)
        return scaler

    def _load_feature_names(self) -> List[str]:
        path = self._model_dir / "feature_names.json"
        if not path.is_file():
            raise FileNotFoundError(f"feature_names.json not found at {path}.")
        names = json.loads(path.read_text())
        logger.info("Feature names loaded — %d features", len(names))
        return names

    def _load_class_mapping(self) -> Dict[int, str]:
        path = self._model_dir / "class_mapping.json"
        if not path.is_file():
            return {0: "Likely Purchase", 1: "Likely Abandon"}
        raw = json.loads(path.read_text())
        return {int(k): v for k, v in raw.items()}

    # ------------------------------------------------------------------
    # Preprocessing
    # ------------------------------------------------------------------

    def _prepare_session(self, session: Dict[str, Any]) -> pd.DataFrame:
        """Align a raw session dict to the trained feature space.

        Missing features are filled with 0 (post-scaling neutral value).
        Extra features not seen during training are silently dropped.
        """
        row = {feat: session.get(feat, np.nan) for feat in self._feature_names}
        df = pd.DataFrame([row])
        # Apply StandardScaler — NaN values become the column mean (0 post-scale)
        df = df.fillna(0.0)
        scaled = self._scaler.transform(df[self._feature_names])
        return pd.DataFrame(scaled, columns=self._feature_names)

    # ------------------------------------------------------------------
    # SHAP attribution
    # ------------------------------------------------------------------

    def _get_shap_explainer(self) -> Any:
        """Lazy-initialise the SHAP TreeExplainer on first call."""
        if self._explainer is None:
            if not SHAP_AVAILABLE:
                return None
            self._explainer = shap.TreeExplainer(self._classifier)
            logger.info("SHAP TreeExplainer initialised")
        return self._explainer

    def _compute_top_features(
        self, X_scaled: pd.DataFrame
    ) -> List[FeatureContribution]:
        """Return top-N SHAP feature contributions for this session."""
        explainer = self._get_shap_explainer()
        if explainer is None:
            return []

        try:
            sv = explainer.shap_values(X_scaled)
            # Binary classifier: sv is a list [neg_class, pos_class]
            if isinstance(sv, list):
                sv = sv[1]
            shap_row = sv[0]

            contributions = [
                FeatureContribution(
                    feature=feat,
                    shap_value=round(float(shap_row[i]), 6),
                    raw_value=round(float(X_scaled.iloc[0, i]), 6),
                )
                for i, feat in enumerate(self._feature_names)
            ]
            contributions.sort(key=lambda x: abs(x.shap_value), reverse=True)
            return contributions[: self._top_n]
        except Exception as exc:  # noqa: BLE001
            logger.warning("SHAP computation failed: %s", exc)
            return []

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def predict(self, session: Dict[str, Any], explain: bool = True) -> PredictionResult:
        """Score a single shopping session for cart abandonment risk.

        Parameters
        ----------
        session : dict
            Raw feature values for one shopping session.
            Keys should match the feature names seen during training.
        explain : bool, default True
            Whether to compute SHAP-based top feature attributions.
            Set to False for lower-latency scoring when explanations are not needed.

        Returns
        -------
        PredictionResult
            Structured prediction output.
        """
        t0 = time.perf_counter()

        X_scaled = self._prepare_session(session)
        proba = float(self._classifier.predict_proba(X_scaled)[0, 1])
        is_abandon = proba >= self._threshold

        predicted_class_label = (
            self._class_mapping.get(1, "Likely Abandon") if is_abandon
            else self._class_mapping.get(0, "Likely Purchase")
        )
        confidence = round(abs(proba - 0.5) * 2, 6)   # Distance from decision boundary [0,1]

        top_features = self._compute_top_features(X_scaled) if explain else []
        inference_ms = round((time.perf_counter() - t0) * 1000, 3)

        result = PredictionResult(
            abandonment_probability=round(proba, 6),
            prediction=bool(is_abandon),
            predicted_class=predicted_class_label,
            confidence=confidence,
            top_features=top_features,
            inference_time_ms=inference_ms,
        )
        logger.debug(
            "Prediction: prob=%.4f | class=%s | inference=%.1fms",
            proba, predicted_class_label, inference_ms,
        )
        return result

    def predict_batch(
        self, sessions: List[Dict[str, Any]], explain: bool = False
    ) -> List[PredictionResult]:
        """Score multiple sessions in batch.

        Parameters
        ----------
        sessions : list[dict]
            List of raw session dicts.
        explain : bool, default False
            Explanations are disabled by default in batch mode for speed.
        """
        return [self.predict(s, explain=explain) for s in sessions]


# ===========================================================================
# CLI entry point — sample prediction using a minimal synthetic session
# ===========================================================================

def _build_sample_session() -> Dict[str, Any]:
    """Build a minimal sample session for CLI testing."""
    return {
        "hesitation_score": 2.5,
        "trust_score": 0.3,
        "price_sensitivity_score": 1.8,
        "total_shipping_charges": 100.0,
        "checkout_restart_count": 2,
        "payment_failures": 1,
        "session_duration_seconds": 45,
        "page_views": 12,
        "cart_value": 4500.0,
        "total_items_in_cart": 3,
        "is_premium_member": 0,
        "product_rating": 3.8,
        "seller_trust_score": 2.5,
    }


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format=default_config.LOG_FORMAT,
    )
    predictor = Predictor()
    sample = _build_sample_session()
    result = predictor.predict(sample, explain=True)
    print("\n" + "=" * 60)
    print("CART ABANDONMENT PREDICTION RESULT")
    print("=" * 60)
    print(json.dumps(result.to_dict(), indent=2))
    print("=" * 60)
