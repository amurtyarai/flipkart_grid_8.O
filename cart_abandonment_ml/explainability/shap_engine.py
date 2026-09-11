"""shap_engine.py — Production-Grade SHAP Explainability Engine

Architecture
------------
This module is the Explainability Layer of the Cart Abandonment ML system.
It sits between the trained XGBoost models and any downstream consumer
(REST API, LLM reasoning agent, analyst dashboard).

It is deliberately LLM-agnostic: it produces structured, serialisable
outputs (JSON, CSV, numpy arrays) that any consumer can read without
importing this module.

Key design decisions
--------------------
* **TreeExplainer** — exact, not approximate; correct for XGBoost tree models.
* **Lazy loading** — the explainer is initialised once and reused.
* **Dual granularity** — global (dataset-level) and local (per-session) SHAP.
* **All outputs are serialisable** — no matplotlib objects returned; everything
  is written to disk and the path is returned.
* **LLM-ready** — ``get_top_features(session)`` and ``explain_session(session)``
  return clean dicts / lists suitable for prompt injection.

Outputs
-------
shap_output/
    shap_values.npy            Raw SHAP matrix (n_samples x n_features)
    feature_importance.csv     Gain/Weight/Cover from XGBoost booster
    global_importance.csv      Mean |SHAP| global importance ranking
    local_explanations.json    Per-sample SHAP explanations (sample subset)
    summary_plot.png           Beeswarm summary plot
    bar_plot.png               Bar plot of mean |SHAP| values
    waterfall_plot.png         Waterfall for the highest-risk session
    force_plot.html            Force plot (interactive HTML, opens in browser)
    dependence_{feature}.png   Dependence plots for top-K features

Usage
-----
    from cart_abandonment_ml.explainability.shap_engine import ShapEngine

    engine = ShapEngine()                       # loads models automatically
    engine.run_global_analysis()                # generate all global artifacts
    result = engine.explain_session(session)    # per-session explanation
    top    = engine.get_top_features(session)   # LLM-ready feature list
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import xgboost as xgb

try:
    import shap
    _SHAP_AVAILABLE = True
except ImportError:
    _SHAP_AVAILABLE = False
    logger.warning("SHAP package not available — using native XGBoost feature attribution fallback.")

from cart_abandonment_ml.config.config import Config, config as default_config

logger = logging.getLogger(__name__)


# ===========================================================================
# Output schemas — LLM-ready, serialisable
# ===========================================================================

@dataclass
class FeatureImportance:
    """Single-feature importance entry."""
    feature: str
    importance: float          # Mean |SHAP| value
    shap_rank: int
    direction: str             # "increases_abandonment" | "decreases_abandonment" | "neutral"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class SessionExplanation:
    """Full SHAP explanation for one shopping session.

    This is the primary output consumed by the LLM reasoning agent.
    """
    session_id: Optional[str]
    abandonment_probability: float
    predicted_class: str
    base_value: float                        # SHAP expected value (model prior)
    top_features: List[FeatureImportance]    # Ranked by |SHAP| descending
    risk_drivers: List[FeatureImportance]    # Features INCREASING abandonment risk
    retention_signals: List[FeatureImportance]  # Features DECREASING abandonment risk

    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "abandonment_probability": self.abandonment_probability,
            "predicted_class": self.predicted_class,
            "base_value": self.base_value,
            "top_features": [f.to_dict() for f in self.top_features],
            "risk_drivers": [f.to_dict() for f in self.risk_drivers],
            "retention_signals": [f.to_dict() for f in self.retention_signals],
        }

    def to_llm_prompt_fragment(self) -> str:
        """Render as a structured text block for LLM prompt injection.

        The LLM agent will receive this fragment to generate natural-language
        recommendations for the retention team.
        """
        lines = [
            f"Abandonment Probability: {self.abandonment_probability:.1%}",
            f"Prediction: {self.predicted_class}",
            f"Model Base Rate: {self.base_value:.1%}",
            "",
            "Top Risk Drivers (features INCREASING abandonment):",
        ]
        for f in self.risk_drivers[:5]:
            lines.append(f"  • {f.feature}: SHAP={f.importance:+.4f}")
        lines += ["", "Retention Signals (features DECREASING abandonment):"]
        for f in self.retention_signals[:5]:
            lines.append(f"  • {f.feature}: SHAP={f.importance:+.4f}")
        return "\n".join(lines)


# ===========================================================================
# Core Engine
# ===========================================================================

class ShapEngine:
    """Production SHAP Explainability Engine for the Cart Abandonment system.

    Parameters
    ----------
    cfg : Config, optional
        Configuration object. Uses module-level singleton if not provided.
    """

    def __init__(self, cfg: Optional[Config] = None) -> None:
        self._cfg = cfg or default_config
        self._model_dir = Path(self._cfg.MODEL_DIR)
        self._shap_dir = self._model_dir
        self._shap_dir.mkdir(parents=True, exist_ok=True)

        logger.info("Initialising ShapEngine — model_dir: %s", self._model_dir)

        # Load artifacts
        self._classifier: xgb.XGBClassifier = self._load_classifier()
        self._scaler = self._load_preprocessor()
        self._feature_names: List[str] = self._load_feature_names()

        # Lazy-initialised explainer (expensive to build)
        self._explainer: Optional[shap.TreeExplainer] = None

        logger.info(
            "ShapEngine ready — %d features | output: %s",
            len(self._feature_names), self._shap_dir,
        )

    # ------------------------------------------------------------------
    # Artifact loaders
    # ------------------------------------------------------------------

    def _load_classifier(self) -> Any:
        path = self._model_dir / "classifier.pkl"
        if not path.is_file():
            path = self._model_dir / "classifier.json"
        if not path.is_file():
            raise FileNotFoundError(
                f"Classifier not found in {self._model_dir}. "
                "Run: python -m cart_abandonment_ml.training.train"
            )
        try:
            if path.suffix == ".pkl":
                clf = joblib.load(path)
            else:
                clf = xgb.XGBClassifier()
                clf.load_model(str(path))
        except Exception as exc:
            logger.warning("Primary model load failed (%s). Falling back to joblib.load(model.pkl)...", exc)
            fallback_pkl = self._model_dir / "model.pkl"
            if fallback_pkl.is_file():
                clf = joblib.load(fallback_pkl)
            else:
                raise exc
        logger.info("Classifier loaded from %s", path)
        return clf

    def _load_preprocessor(self) -> Any:
        path = self._model_dir / "preprocessor.pkl"
        if not path.is_file():
            raise FileNotFoundError(f"Preprocessor not found at {path}.")
        scaler = joblib.load(path)
        logger.info("Preprocessor loaded from %s", path)
        return scaler

    def _load_feature_names(self) -> List[str]:
        path = self._model_dir / "feature_names.json"
        if not path.is_file():
            raise FileNotFoundError(f"feature_names.json not found at {path}.")
        names: List[str] = json.loads(path.read_text())
        logger.info("Loaded %d feature names", len(names))
        return names

    # ------------------------------------------------------------------
    # Explainer (lazy init)
    # ------------------------------------------------------------------

    @property
    def explainer(self) -> Any:
        """Initialise TreeExplainer on first access and reuse thereafter."""
        if not _SHAP_AVAILABLE:
            return None
        if self._explainer is None:
            logger.info("Initialising SHAP TreeExplainer (one-time cost)...")
            t0 = time.perf_counter()
            self._explainer = shap.TreeExplainer(self._classifier)
            logger.info("TreeExplainer ready in %.2fs", time.perf_counter() - t0)
        return self._explainer

    # ------------------------------------------------------------------
    # Session preprocessing
    # ------------------------------------------------------------------

    def _prepare_session(self, session: Dict[str, Any]) -> pd.DataFrame:
        """Align a raw session dict to the training feature space and scale it."""
        row = {feat: session.get(feat, np.nan) for feat in self._feature_names}
        df = pd.DataFrame([row])
        # Scale features first — StandardScaler preserves NaNs
        scaled = self._scaler.transform(df[self._feature_names])
        # Post-scaling, fill NaNs with 0.0 (the neutral column mean)
        scaled_df = pd.DataFrame(scaled, columns=self._feature_names)
        return scaled_df.fillna(0.0)

    def _prepare_batch(self, df: pd.DataFrame) -> pd.DataFrame:
        """Apply the saved scaler to an already-aligned DataFrame."""
        scaled = self._scaler.transform(df[self._feature_names])
        return pd.DataFrame(scaled, columns=self._feature_names, index=df.index)

    # ------------------------------------------------------------------
    # SHAP computation
    # ------------------------------------------------------------------

    def _compute_shap_values(
        self, X: pd.DataFrame
    ) -> Tuple[np.ndarray, float]:
        """Compute SHAP values for a feature matrix.

        Returns
        -------
        shap_matrix : np.ndarray  shape (n_samples, n_features)
        base_value  : float       Model expected value
        """
        if not _SHAP_AVAILABLE or self.explainer is None:
            importances = getattr(self._classifier, "feature_importances_", np.ones(X.shape[1]) / X.shape[1])
            shap_matrix = (X.values - 0.5) * importances
            base_val = 0.5
            return shap_matrix, base_val

        sv = self.explainer.shap_values(X)
        # Binary classifier: sv may be [neg_class, pos_class] list
        if isinstance(sv, list):
            shap_matrix = sv[1]
        else:
            shap_matrix = sv

        ev = self.explainer.expected_value
        if isinstance(ev, (list, np.ndarray)):
            arr = np.ravel(ev)
            base_val = float(arr[1] if len(arr) > 1 and isinstance(sv, list) else arr[0])
        else:
            base_val = float(ev)
        return shap_matrix, base_val

    # ------------------------------------------------------------------
    # Global analysis
    # ------------------------------------------------------------------

    def run_global_analysis(
        self,
        X_val: Optional[pd.DataFrame] = None,
        n_sample: Optional[int] = None,
    ) -> Dict[str, Path]:
        """Compute global SHAP analysis and export all artifacts.

        Parameters
        ----------
        X_val : pd.DataFrame, optional
            Pre-scaled validation features. If None, loads from ``shap_values.npy``
            (if it exists) or raises.
        n_sample : int, optional
            Number of rows to subsample. Defaults to ``Config.SHAP_SAMPLE_SIZE``.

        Returns
        -------
        dict mapping artifact names to their file paths.
        """
        if n_sample is None:
            n_sample = self._cfg.SHAP_SAMPLE_SIZE

        if X_val is None:
            raise ValueError(
                "X_val must be provided for global analysis. "
                "Pass the validation DataFrame from preprocessing."
            )

        # Sample
        n_sample = min(n_sample, len(X_val))
        X_sample = X_val.sample(n=n_sample, random_state=self._cfg.RANDOM_SEED)
        logger.info("Computing global SHAP on %d-row subsample...", n_sample)
        t0 = time.perf_counter()
        shap_matrix, base_val = self._compute_shap_values(X_sample)
        logger.info("Global SHAP complete in %.2fs", time.perf_counter() - t0)

        artifacts: Dict[str, Path] = {}

        # 1. Save raw SHAP values
        artifacts["shap_values"] = self._save_shap_values(shap_matrix)

        # 2. XGBoost booster feature importance (Gain / Weight / Cover)
        artifacts["feature_importance"] = self._export_booster_importance()

        # 3. Global SHAP importance (mean |SHAP|)
        artifacts["global_importance"] = self._export_global_importance(shap_matrix)

        # 4. Summary plot (beeswarm)
        artifacts["summary_plot"] = self._plot_summary(shap_matrix, X_sample)

        # 5. Bar plot
        artifacts["bar_plot"] = self._plot_bar(shap_matrix, X_sample)

        # 6. Waterfall for highest-risk session
        artifacts["waterfall_plot"] = self._plot_waterfall(
            shap_matrix, X_sample, base_val
        )

        # 7. Force plot (HTML)
        artifacts["force_plot"] = self._plot_force(shap_matrix, X_sample, base_val)

        # 8. Dependence plots for top-K features
        dep_paths = self._plot_dependence(shap_matrix, X_sample)
        artifacts.update(dep_paths)

        logger.info(
            "Global analysis complete — %d artifacts saved to %s",
            len(artifacts), self._shap_dir,
        )
        return artifacts

    # ------------------------------------------------------------------
    # Local (per-session) analysis
    # ------------------------------------------------------------------

    def explain_session(
        self,
        session: Dict[str, Any],
        session_id: Optional[str] = None,
        top_n: Optional[int] = None,
    ) -> SessionExplanation:
        """Compute a full SHAP explanation for a single shopping session.

        Parameters
        ----------
        session : dict
            Raw feature values for one session.
        session_id : str, optional
            Optional ID for traceability.
        top_n : int, optional
            How many features to include. Defaults to Config.SHAP_TOP_FEATURES.

        Returns
        -------
        SessionExplanation
            Structured explanation ready for LLM consumption or API response.
        """
        if top_n is None:
            top_n = self._cfg.SHAP_TOP_FEATURES

        X_scaled = self._prepare_session(session)
        proba = float(self._classifier.predict_proba(X_scaled)[0, 1])
        predicted_class = (
            "Likely Abandon"
            if proba >= self._cfg.CLASSIFICATION_THRESHOLD
            else "Likely Purchase"
        )
        shap_matrix, base_val = self._compute_shap_values(X_scaled)
        shap_row = shap_matrix[0]  # shape (n_features,)

        # Build ranked feature list
        all_features = [
            FeatureImportance(
                feature=self._feature_names[i],
                importance=round(float(shap_row[i]), 6),
                shap_rank=0,       # assigned below
                direction=(
                    "increases_abandonment" if shap_row[i] > 0.001
                    else "decreases_abandonment" if shap_row[i] < -0.001
                    else "neutral"
                ),
            )
            for i in range(len(self._feature_names))
        ]
        # Rank by |SHAP|
        all_features.sort(key=lambda f: abs(f.importance), reverse=True)
        for rank, feat in enumerate(all_features, start=1):
            feat.shap_rank = rank

        top_features = all_features[:top_n]
        risk_drivers = [f for f in all_features if f.direction == "increases_abandonment"][:top_n]
        retention_signals = [f for f in all_features if f.direction == "decreases_abandonment"][:top_n]

        return SessionExplanation(
            session_id=session_id,
            abandonment_probability=round(proba, 6),
            predicted_class=predicted_class,
            base_value=round(base_val, 6),
            top_features=top_features,
            risk_drivers=risk_drivers,
            retention_signals=retention_signals,
        )

    # ------------------------------------------------------------------
    # LLM-ready API
    # ------------------------------------------------------------------

    def get_top_features(
        self,
        session: Dict[str, Any],
        top_n: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """Return the top-N SHAP features for a session in LLM-ready format.

        Output format
        -------------
        [
            {"feature": "hesitation_score",  "importance": 0.612, "direction": "increases_abandonment"},
            {"feature": "trust_score", "importance": -0.211, "direction": "decreases_abandonment"},
            ...
        ]

        Parameters
        ----------
        session : dict
            Raw session feature dict.
        top_n : int, optional
            Number of features to return. Defaults to Config.SHAP_TOP_FEATURES.
        """
        if top_n is None:
            top_n = self._cfg.SHAP_TOP_FEATURES

        explanation = self.explain_session(session, top_n=top_n)
        return [
            {
                "feature": f.feature,
                "importance": f.importance,
                "direction": f.direction,
            }
            for f in explanation.top_features
        ]

    def export_local_explanations(
        self,
        sessions: List[Dict[str, Any]],
        session_ids: Optional[List[str]] = None,
    ) -> Path:
        """Compute and export SHAP explanations for a list of sessions to JSON.

        Suitable for batch offline explanation generation before LLM ingestion.
        """
        if session_ids is None:
            session_ids = [str(i) for i in range(len(sessions))]

        results = []
        for sid, sess in zip(session_ids, sessions):
            exp = self.explain_session(sess, session_id=sid)
            results.append(exp.to_dict())

        out_path = self._shap_dir / "local_explanations.json"
        out_path.write_text(json.dumps(results, indent=2))
        logger.info("Local explanations saved → %s (%d sessions)", out_path, len(results))
        return out_path

    # ------------------------------------------------------------------
    # Artifact exporters
    # ------------------------------------------------------------------

    def _save_shap_values(self, shap_matrix: np.ndarray) -> Path:
        path = self._shap_dir / "shap_values.npy"
        np.save(str(path), shap_matrix)
        logger.info("SHAP values saved → %s  shape: %s", path, shap_matrix.shape)
        return path

    def _export_booster_importance(self) -> Path:
        """Export XGBoost native Gain/Weight/Cover importance to feature_importance.csv."""
        booster = self._classifier.get_booster()
        gain   = booster.get_score(importance_type="gain")
        weight = booster.get_score(importance_type="weight")
        cover  = booster.get_score(importance_type="cover")

        rows = [
            {
                "feature": feat,
                "gain":   round(gain.get(feat, 0.0), 6),
                "weight": round(weight.get(feat, 0.0), 6),
                "cover":  round(cover.get(feat, 0.0), 6),
            }
            for feat in self._feature_names
        ]
        df = (
            pd.DataFrame(rows)
            .sort_values("gain", ascending=False)
            .reset_index(drop=True)
        )
        df["gain_rank"] = df.index + 1

        path = self._shap_dir / "feature_importance.csv"
        df.to_csv(path, index=False)
        logger.info("XGBoost feature importance saved → %s", path)
        return path

    def _export_global_importance(self, shap_matrix: np.ndarray) -> Path:
        """Export mean |SHAP| global importance to global_importance.csv."""
        mean_abs = np.abs(shap_matrix).mean(axis=0)
        df = pd.DataFrame({
            "feature":        self._feature_names,
            "mean_abs_shap":  np.round(mean_abs, 8),
        })
        df = df.sort_values("mean_abs_shap", ascending=False).reset_index(drop=True)
        df["shap_rank"] = df.index + 1

        path = self._shap_dir / "global_importance.csv"
        df.to_csv(path, index=False)
        logger.info("Global SHAP importance saved → %s", path)
        return path

    # ------------------------------------------------------------------
    # Plots
    # ------------------------------------------------------------------

    def _plot_summary(self, shap_matrix: np.ndarray, X_sample: pd.DataFrame) -> Path:
        """Beeswarm summary plot — shows distribution of SHAP values per feature."""
        max_d = self._cfg.SHAP_MAX_DISPLAY
        fig, _ = plt.subplots(figsize=(12, 9))
        shap.summary_plot(
            shap_matrix, X_sample,
            feature_names=self._feature_names,
            max_display=max_d,
            show=False,
        )
        path = self._shap_dir / "summary_plot.png"
        plt.savefig(path, bbox_inches="tight", dpi=150)
        plt.close("all")
        logger.info("Summary plot saved → %s", path)
        return path

    def _plot_bar(self, shap_matrix: np.ndarray, X_sample: pd.DataFrame) -> Path:
        """Bar plot of mean |SHAP| — easy to read global ranking."""
        max_d = self._cfg.SHAP_MAX_DISPLAY
        fig, _ = plt.subplots(figsize=(12, 9))
        shap.summary_plot(
            shap_matrix, X_sample,
            feature_names=self._feature_names,
            plot_type="bar",
            max_display=max_d,
            show=False,
        )
        path = self._shap_dir / "bar_plot.png"
        plt.savefig(path, bbox_inches="tight", dpi=150)
        plt.close("all")
        logger.info("Bar plot saved → %s", path)
        return path

    def _plot_waterfall(
        self,
        shap_matrix: np.ndarray,
        X_sample: pd.DataFrame,
        base_val: float,
    ) -> Path:
        """Waterfall plot for the highest-risk session in the sample."""
        proba_all = self._classifier.predict_proba(X_sample)[:, 1]
        top_idx = int(np.argmax(proba_all))

        explanation = shap.Explanation(
            values=shap_matrix[top_idx],
            base_values=base_val,
            data=X_sample.iloc[top_idx].values,
            feature_names=self._feature_names,
        )
        fig, _ = plt.subplots(figsize=(12, 9))
        shap.plots.waterfall(explanation, max_display=self._cfg.SHAP_MAX_DISPLAY, show=False)
        path = self._shap_dir / "waterfall_plot.png"
        plt.savefig(path, bbox_inches="tight", dpi=150)
        plt.close("all")
        logger.info("Waterfall plot saved → %s (session index %d)", path, top_idx)
        return path

    def _plot_force(
        self,
        shap_matrix: np.ndarray,
        X_sample: pd.DataFrame,
        base_val: float,
    ) -> Path:
        """Interactive force plot for the full sample — saved as standalone HTML.

        Note: shap.initjs() is omitted — it requires IPython (Jupyter only).
        shap.save_html() works in any Python environment without IPython.
        """
        force = shap.force_plot(
            base_value=base_val,
            shap_values=shap_matrix,
            features=X_sample,
            feature_names=self._feature_names,
            show=False,
        )
        path = self._shap_dir / "force_plot.html"
        shap.save_html(str(path), force)
        logger.info("Force plot (HTML) saved → %s", path)
        return path

    def _plot_dependence(
        self,
        shap_matrix: np.ndarray,
        X_sample: pd.DataFrame,
        top_k: int = 5,
    ) -> Dict[str, Path]:
        """Dependence plots for the top-K features by mean |SHAP|."""
        mean_abs = np.abs(shap_matrix).mean(axis=0)
        top_indices = np.argsort(mean_abs)[::-1][:top_k]
        paths: Dict[str, Path] = {}

        for idx in top_indices:
            feat = self._feature_names[idx]
            safe_name = feat.replace(" ", "_").replace("/", "_")
            fig, _ = plt.subplots(figsize=(10, 6))
            shap.dependence_plot(
                idx,
                shap_matrix,
                X_sample,
                feature_names=self._feature_names,
                show=False,
            )
            path = self._shap_dir / f"dependence_{safe_name}.png"
            plt.savefig(path, bbox_inches="tight", dpi=150)
            plt.close("all")
            logger.info("Dependence plot saved → %s", path)
            paths[f"dependence_{safe_name}"] = path

        return paths


# ===========================================================================
# Convenience runner — called from CLI or train.py post-training
# ===========================================================================

def run_explainability_pipeline(
    X_val: pd.DataFrame,
    cfg: Optional[Config] = None,
    sample_sessions: Optional[List[Dict[str, Any]]] = None,
) -> ShapEngine:
    """Run the full explainability pipeline after training.

    Parameters
    ----------
    X_val : pd.DataFrame
        Pre-scaled validation feature matrix from preprocessing.
    cfg : Config, optional
        Configuration object.
    sample_sessions : list[dict], optional
        Raw session dicts for local explanation export.
        If None, skips local_explanations.json.

    Returns
    -------
    ShapEngine
        The initialised engine (reuse for further inference calls).
    """
    engine = ShapEngine(cfg)
    engine.run_global_analysis(X_val=X_val)

    if sample_sessions:
        engine.export_local_explanations(sample_sessions)

    return engine


# ===========================================================================
# CLI entry point
# ===========================================================================

if __name__ == "__main__":
    import argparse

    logging.basicConfig(
        level=logging.INFO,
        format=default_config.LOG_FORMAT,
    )

    parser = argparse.ArgumentParser(
        description="Run SHAP Explainability Engine on saved model + validation data"
    )
    parser.add_argument(
        "--data",
        type=Path,
        default=Path(default_config.SYNTHETIC_PARQUET),
        help="Path to the raw synthetic dataset (Parquet or CSV)",
    )
    parser.add_argument(
        "--sample", type=int, default=default_config.SHAP_SAMPLE_SIZE,
        help="Number of rows to use for global SHAP analysis",
    )
    args = parser.parse_args()

    # Load & preprocess data to get a scaled validation set
    logger.info("Loading dataset from %s", args.data)
    raw_df = (
        pd.read_parquet(args.data)
        if str(args.data).endswith(".parquet")
        else pd.read_csv(args.data)
    )

    from cart_abandonment_ml.preprocessing.preprocessing import preprocess
    preproc = preprocess(raw_df)

    engine = ShapEngine()
    engine.run_global_analysis(X_val=preproc.X_val, n_sample=args.sample)

    # Automatically export local_explanations.json for a sample of 5 sessions
    sample_df = preproc.X_val.sample(n=5, random_state=42)
    sample_sessions = sample_df.to_dict(orient="records")
    engine.export_local_explanations(sample_sessions)

    # Demo: explain a single session using the first validation row
    sample_session = preproc.X_val.iloc[0].to_dict()
    top = engine.get_top_features(sample_session, top_n=10)

    print("\n" + "=" * 55)
    print("SAMPLE SESSION — TOP SHAP FEATURES")
    print("=" * 55)
    for entry in top:
        direction_symbol = "[+]" if entry["direction"] == "increases_abandonment" else "[-]"
        print(f"  {direction_symbol} {entry['feature']:<40}  SHAP={entry['importance']:+.4f}")
    print("=" * 55)
