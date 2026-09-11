"""train.py — Production ML Training Pipeline for Cart Abandonment Prediction

Architecture
------------
Two XGBoost models are trained on the same preprocessed feature matrix:

  Model 1 — XGBClassifier  (PRODUCTION)
    Target  : cart_abandoned  {0, 1}
    Output  : predict_proba()[:,1]  →  abandonment_probability
    Purpose : Primary production model served by predict.py

  Model 2 — XGBRegressor  (RESEARCH / CALIBRATION)
    Target  : abandonment_probability  [0.0, 1.0]
    Output  : direct continuous prediction
    Purpose : Calibration baseline, comparison, and research validation

Both models share the same preprocessing pipeline (StandardScaler + feature engineering)
and are evaluated on both the validation and test sets.

Artifacts saved to models/
--------------------------
  classifier.xgb          Native XGBoost binary format
  classifier.pkl          Joblib pickle (Python convenience)
  regressor.xgb
  regressor.pkl
  preprocessor.pkl        Fitted StandardScaler
  feature_names.json      Ordered feature name list
  training_metrics.json   All evaluation metrics
  training_config.json    Hyperparameters used for this run
  class_mapping.json      {0: "Retained", 1: "Abandoned"}

SHAP artifacts saved to shap_output/
-------------------------------------
  shap_values_classifier.npy
  shap_summary_classifier.csv
  shap_bar_classifier.png
  shap_beeswarm_classifier.png
  shap_waterfall_classifier.png

Run
---
  python -m cart_abandonment_ml.training.train
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
import tracemalloc
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend — safe for server environments
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.calibration import calibration_curve
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    log_loss,
    mean_absolute_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
    root_mean_squared_error,
)

try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False

from cart_abandonment_ml.training.mlflow_utils import log_training_run

from cart_abandonment_ml.config.config import Config, config as default_config
from cart_abandonment_ml.preprocessing.preprocessing import PreprocessedData, preprocess

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format=default_config.LOG_FORMAT)
logger = logging.getLogger(__name__)


# ===========================================================================
# Dataclasses for structured results
# ===========================================================================

@dataclass
class ClassifierMetrics:
    """All evaluation metrics for the XGBClassifier."""
    accuracy: float
    precision: float
    recall: float
    f1: float
    roc_auc: float
    pr_auc: float
    log_loss_score: float
    brier_score: float
    confusion_matrix: List[List[int]]

    def log(self, prefix: str) -> None:
        logger.info(
            "%s — Accuracy: %.4f | Precision: %.4f | Recall: %.4f | F1: %.4f",
            prefix, self.accuracy, self.precision, self.recall, self.f1,
        )
        logger.info(
            "%s — ROC-AUC: %.4f | PR-AUC: %.4f | Log-Loss: %.4f | Brier: %.4f",
            prefix, self.roc_auc, self.pr_auc, self.log_loss_score, self.brier_score,
        )
        logger.info("%s — Confusion Matrix:\n%s", prefix, np.array(self.confusion_matrix))


@dataclass
class RegressorMetrics:
    """All evaluation metrics for the XGBRegressor."""
    rmse: float
    mae: float
    r2: float

    def log(self, prefix: str) -> None:
        logger.info(
            "%s — RMSE: %.4f | MAE: %.4f | R²: %.4f",
            prefix, self.rmse, self.mae, self.r2,
        )


@dataclass
class ModelArtifacts:
    """Paths to all persisted model artifacts."""
    classifier_xgb: Path
    classifier_pkl: Path
    regressor_xgb: Path
    regressor_pkl: Path
    preprocessor_pkl: Path
    feature_names_json: Path
    training_metrics_json: Path
    training_config_json: Path
    class_mapping_json: Path
    feature_importance_clf_csv: Path
    feature_importance_reg_csv: Path


@dataclass
class TrainingResult:
    """Structured return value from the training pipeline."""
    classifier: xgb.XGBClassifier
    regressor: xgb.XGBRegressor
    val_clf_metrics: ClassifierMetrics
    test_clf_metrics: ClassifierMetrics
    val_reg_metrics: RegressorMetrics
    test_reg_metrics: RegressorMetrics
    artifacts: ModelArtifacts
    training_time_seconds: float


# ===========================================================================
# Data Loading
# ===========================================================================

def load_synthetic_data(cfg: Config) -> pd.DataFrame:
    """Load the synthetic dataset — prefers Parquet for speed, falls back to CSV."""
    parquet_path = Path(cfg.SYNTHETIC_PARQUET)
    csv_path = Path(cfg.SYNTHETIC_CSV)

    if parquet_path.is_file():
        logger.info("Loading synthetic data from %s", parquet_path)
        df = pd.read_parquet(parquet_path)
    elif csv_path.is_file():
        logger.info("Loading synthetic data from %s", csv_path)
        df = pd.read_csv(csv_path)
    else:
        raise FileNotFoundError(
            f"Synthetic data not found.\n"
            f"  Parquet: {parquet_path}\n"
            f"  CSV    : {csv_path}\n"
            "Run: python generate_synthetic_data.py"
        )
    logger.info("Loaded dataset — shape: %s | memory: %.1f MB",
                df.shape, df.memory_usage(deep=True).sum() / 1e6)
    return df


# ===========================================================================
# Model Training
# ===========================================================================

def train_classifier(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_val: pd.DataFrame,
    y_val: pd.Series,
    cfg: Config,
) -> xgb.XGBClassifier:
    """Train the production XGBClassifier on binary cart_abandoned target.

    Uses predict_proba()[:,1] for abandonment_probability at inference time.
    """
    clf_cfg = cfg.CLASSIFIER
    model = xgb.XGBClassifier(
        objective=clf_cfg.objective,
        eval_metric=clf_cfg.eval_metric,
        learning_rate=clf_cfg.learning_rate,
        max_depth=clf_cfg.max_depth,
        n_estimators=clf_cfg.n_estimators,
        subsample=clf_cfg.subsample,
        colsample_bytree=clf_cfg.colsample_bytree,
        min_child_weight=clf_cfg.min_child_weight,
        gamma=clf_cfg.gamma,
        reg_alpha=clf_cfg.reg_alpha,
        reg_lambda=clf_cfg.reg_lambda,
        scale_pos_weight=clf_cfg.scale_pos_weight,
        early_stopping_rounds=clf_cfg.early_stopping_rounds,
        tree_method=clf_cfg.tree_method,
        random_state=cfg.RANDOM_SEED,
        verbosity=clf_cfg.verbosity,
    )
    logger.info("Training XGBClassifier — n_estimators=%d | lr=%.3f | max_depth=%d",
                clf_cfg.n_estimators, clf_cfg.learning_rate, clf_cfg.max_depth)
    t0 = time.perf_counter()
    model.fit(
        X_train, y_train,
        eval_set=[(X_train, y_train), (X_val, y_val)],
        verbose=False,
    )
    elapsed = time.perf_counter() - t0
    logger.info("XGBClassifier trained — best_iteration: %d | time: %.1fs",
                model.best_iteration, elapsed)
    return model


def train_regressor(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_val: pd.DataFrame,
    y_val: pd.Series,
    cfg: Config,
) -> xgb.XGBRegressor:
    """Train the research XGBRegressor on continuous abandonment_probability target."""
    reg_cfg = cfg.REGRESSOR
    model = xgb.XGBRegressor(
        objective=reg_cfg.objective,
        eval_metric=reg_cfg.eval_metric,
        learning_rate=reg_cfg.learning_rate,
        max_depth=reg_cfg.max_depth,
        n_estimators=reg_cfg.n_estimators,
        subsample=reg_cfg.subsample,
        colsample_bytree=reg_cfg.colsample_bytree,
        min_child_weight=reg_cfg.min_child_weight,
        gamma=reg_cfg.gamma,
        reg_alpha=reg_cfg.reg_alpha,
        reg_lambda=reg_cfg.reg_lambda,
        early_stopping_rounds=reg_cfg.early_stopping_rounds,
        tree_method=reg_cfg.tree_method,
        random_state=cfg.RANDOM_SEED,
        verbosity=reg_cfg.verbosity,
    )
    logger.info("Training XGBRegressor — n_estimators=%d | lr=%.3f | max_depth=%d",
                reg_cfg.n_estimators, reg_cfg.learning_rate, reg_cfg.max_depth)
    t0 = time.perf_counter()
    model.fit(
        X_train, y_train,
        eval_set=[(X_train, y_train), (X_val, y_val)],
        verbose=False,
    )
    elapsed = time.perf_counter() - t0
    logger.info("XGBRegressor trained — best_iteration: %d | time: %.1fs",
                model.best_iteration, elapsed)
    return model


# ===========================================================================
# Evaluation
# ===========================================================================

def evaluate_classifier(
    model: xgb.XGBClassifier,
    X: pd.DataFrame,
    y_true: pd.Series,
    threshold: float,
    split_name: str,
) -> ClassifierMetrics:
    """Compute full classifier evaluation metrics."""
    proba = model.predict_proba(X)[:, 1]
    y_pred = (proba >= threshold).astype(int)

    metrics = ClassifierMetrics(
        accuracy=float(accuracy_score(y_true, y_pred)),
        precision=float(precision_score(y_true, y_pred, zero_division=0)),
        recall=float(recall_score(y_true, y_pred, zero_division=0)),
        f1=float(f1_score(y_true, y_pred, zero_division=0)),
        roc_auc=float(roc_auc_score(y_true, proba)),
        pr_auc=float(average_precision_score(y_true, proba)),
        log_loss_score=float(log_loss(y_true, proba)),
        brier_score=float(brier_score_loss(y_true, proba)),
        confusion_matrix=confusion_matrix(y_true, y_pred).tolist(),
    )
    metrics.log(f"Classifier [{split_name}]")
    return metrics


def evaluate_regressor(
    model: xgb.XGBRegressor,
    X: pd.DataFrame,
    y_true: pd.Series,
    split_name: str,
) -> RegressorMetrics:
    """Compute full regressor evaluation metrics."""
    preds = model.predict(X)
    metrics = RegressorMetrics(
        rmse=float(root_mean_squared_error(y_true, preds)),
        mae=float(mean_absolute_error(y_true, preds)),
        r2=float(r2_score(y_true, preds)),
    )
    metrics.log(f"Regressor [{split_name}]")
    return metrics


# ===========================================================================
# Feature Importance
# ===========================================================================

def export_feature_importance(
    model: Any,
    feature_names: List[str],
    model_name: str,
    model_dir: Path,
) -> Path:
    """Export feature importance CSV with Gain, Weight, Cover, and Rank."""
    booster = model.get_booster()
    gain   = booster.get_score(importance_type="gain")
    weight = booster.get_score(importance_type="weight")
    cover  = booster.get_score(importance_type="cover")

    rows = []
    for feat in feature_names:
        rows.append({
            "feature": feat,
            "gain":    gain.get(feat, 0.0),
            "weight":  weight.get(feat, 0.0),
            "cover":   cover.get(feat, 0.0),
        })
    df_imp = pd.DataFrame(rows).sort_values("gain", ascending=False).reset_index(drop=True)
    df_imp["rank"] = df_imp.index + 1

    out_path = model_dir / f"feature_importance_{model_name}.csv"
    df_imp.to_csv(out_path, index=False)
    logger.info("Feature importance saved → %s", out_path)
    return out_path


# ===========================================================================
# SHAP Analysis
# ===========================================================================

def run_shap_analysis(
    model: xgb.XGBClassifier,
    X_val: pd.DataFrame,
    feature_names: List[str],
    cfg: Config,
    model_name: str = "classifier",
) -> Optional[Path]:
    """Compute SHAP values and save global interpretability artifacts."""
    if not SHAP_AVAILABLE:
        logger.warning("SHAP not installed — skipping SHAP analysis")
        return None

    shap_dir = Path(cfg.SHAP_DIR)
    shap_dir.mkdir(parents=True, exist_ok=True)

    # Sample for speed
    n_sample = min(cfg.SHAP_SAMPLE_SIZE, len(X_val))
    X_sample = X_val.sample(n=n_sample, random_state=cfg.RANDOM_SEED)
    logger.info("Computing SHAP values on %d-row subsample...", n_sample)

    t0 = time.perf_counter()
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_sample)
    logger.info("SHAP computation complete — %.1fs", time.perf_counter() - t0)

    # Handle binary classifier: shap_values may be list [neg_class, pos_class]
    if isinstance(shap_values, list):
        sv = shap_values[1]
    else:
        sv = shap_values

    # Save raw SHAP values
    npy_path = shap_dir / f"shap_values_{model_name}.npy"
    np.save(str(npy_path), sv)
    logger.info("SHAP values saved → %s", npy_path)

    # Summary CSV (mean |SHAP| per feature)
    mean_shap = np.abs(sv).mean(axis=0)
    df_shap = pd.DataFrame({
        "feature": feature_names,
        "mean_abs_shap": mean_shap,
    }).sort_values("mean_abs_shap", ascending=False).reset_index(drop=True)
    df_shap["rank"] = df_shap.index + 1
    csv_path = shap_dir / f"shap_summary_{model_name}.csv"
    df_shap.to_csv(csv_path, index=False)
    logger.info("SHAP summary CSV → %s", csv_path)

    # --- Plots ---
    max_display = cfg.SHAP_MAX_DISPLAY

    # Bar plot (mean |SHAP|)
    fig, ax = plt.subplots(figsize=(10, 8))
    shap.summary_plot(sv, X_sample, plot_type="bar", max_display=max_display, show=False)
    bar_path = shap_dir / f"shap_bar_{model_name}.png"
    plt.savefig(bar_path, bbox_inches="tight", dpi=150)
    plt.close("all")
    logger.info("SHAP bar plot → %s", bar_path)

    # Beeswarm plot
    fig, ax = plt.subplots(figsize=(10, 8))
    shap.summary_plot(sv, X_sample, max_display=max_display, show=False)
    beeswarm_path = shap_dir / f"shap_beeswarm_{model_name}.png"
    plt.savefig(beeswarm_path, bbox_inches="tight", dpi=150)
    plt.close("all")
    logger.info("SHAP beeswarm plot → %s", beeswarm_path)

    # Waterfall plot — single representative sample (highest predicted probability)
    proba = model.predict_proba(X_sample)[:, 1]
    top_idx = int(np.argmax(proba))
    explanation = explainer(X_sample.iloc[[top_idx]])
    if isinstance(explanation.values, list):
        exp_values = explanation.values[0]
    else:
        exp_values = explanation.values[0]
    shap_exp = shap.Explanation(
        values=exp_values,
        base_values=explainer.expected_value[1] if isinstance(explainer.expected_value, list) else explainer.expected_value,
        data=X_sample.iloc[top_idx].values,
        feature_names=feature_names,
    )
    fig, ax = plt.subplots(figsize=(10, 8))
    shap.plots.waterfall(shap_exp, max_display=max_display, show=False)
    waterfall_path = shap_dir / f"shap_waterfall_{model_name}.png"
    plt.savefig(waterfall_path, bbox_inches="tight", dpi=150)
    plt.close("all")
    logger.info("SHAP waterfall plot → %s", waterfall_path)

    return shap_dir


# ===========================================================================
# Artifact Persistence
# ===========================================================================

def save_artifacts(
    classifier: xgb.XGBClassifier,
    regressor: xgb.XGBRegressor,
    scaler: Any,
    feature_names: List[str],
    val_clf_metrics: ClassifierMetrics,
    test_clf_metrics: ClassifierMetrics,
    val_reg_metrics: RegressorMetrics,
    test_reg_metrics: RegressorMetrics,
    cfg: Config,
) -> ModelArtifacts:
    """Persist all model artifacts required for inference and reproducibility."""
    model_dir = Path(cfg.MODEL_DIR)
    model_dir.mkdir(parents=True, exist_ok=True)

    # Models
    # Use .json extension — XGBoost native JSON format, no UBJSON warning
    clf_xgb = model_dir / "classifier.json"
    clf_pkl = model_dir / "classifier.pkl"
    reg_xgb = model_dir / "regressor.json"
    reg_pkl = model_dir / "regressor.pkl"
    pre_pkl = model_dir / "preprocessor.pkl"

    classifier.save_model(str(clf_xgb))
    joblib.dump(classifier, clf_pkl)
    regressor.save_model(str(reg_xgb))
    joblib.dump(regressor, reg_pkl)
    joblib.dump(scaler, pre_pkl)
    logger.info("Models & preprocessor saved to %s", model_dir)

    # Feature names
    feat_json = model_dir / "feature_names.json"
    feat_json.write_text(json.dumps(feature_names, indent=2))

    # Class mapping
    class_map = {0: "Retained", 1: "Abandoned"}
    class_json = model_dir / "class_mapping.json"
    class_json.write_text(json.dumps(class_map, indent=2))

    # Training metrics
    metrics_payload = {
        "classifier": {
            "validation": {
                "accuracy": val_clf_metrics.accuracy,
                "precision": val_clf_metrics.precision,
                "recall": val_clf_metrics.recall,
                "f1": val_clf_metrics.f1,
                "roc_auc": val_clf_metrics.roc_auc,
                "pr_auc": val_clf_metrics.pr_auc,
                "log_loss": val_clf_metrics.log_loss_score,
                "brier_score": val_clf_metrics.brier_score,
                "confusion_matrix": val_clf_metrics.confusion_matrix,
            },
            "test": {
                "accuracy": test_clf_metrics.accuracy,
                "precision": test_clf_metrics.precision,
                "recall": test_clf_metrics.recall,
                "f1": test_clf_metrics.f1,
                "roc_auc": test_clf_metrics.roc_auc,
                "pr_auc": test_clf_metrics.pr_auc,
                "log_loss": test_clf_metrics.log_loss_score,
                "brier_score": test_clf_metrics.brier_score,
                "confusion_matrix": test_clf_metrics.confusion_matrix,
            },
        },
        "regressor": {
            "validation": {"rmse": val_reg_metrics.rmse, "mae": val_reg_metrics.mae, "r2": val_reg_metrics.r2},
            "test": {"rmse": test_reg_metrics.rmse, "mae": test_reg_metrics.mae, "r2": test_reg_metrics.r2},
        },
    }
    metrics_json = model_dir / "training_metrics.json"
    metrics_json.write_text(json.dumps(metrics_payload, indent=2))
    logger.info("Training metrics saved → %s", metrics_json)

    # Training config
    config_payload = {
        "classifier": asdict(cfg.CLASSIFIER),
        "regressor": asdict(cfg.REGRESSOR),
        "random_seed": cfg.RANDOM_SEED,
        "test_size": cfg.TEST_SIZE,
        "val_size": cfg.VAL_SIZE,
        "classification_threshold": cfg.CLASSIFICATION_THRESHOLD,
        "n_features": len(feature_names),
    }
    config_json = model_dir / "training_config.json"
    config_json.write_text(json.dumps(config_payload, indent=2))
    logger.info("Training config saved → %s", config_json)

    return ModelArtifacts(
        classifier_xgb=clf_xgb,   # now .json format
        classifier_pkl=clf_pkl,
        regressor_xgb=reg_xgb,    # now .json format
        regressor_pkl=reg_pkl,
        preprocessor_pkl=pre_pkl,
        feature_names_json=feat_json,
        training_metrics_json=metrics_json,
        training_config_json=config_json,
        class_mapping_json=class_json,
        feature_importance_clf_csv=model_dir / "feature_importance_classifier.csv",
        feature_importance_reg_csv=model_dir / "feature_importance_regressor.csv",
    )


# ===========================================================================
# MLflow Integration
# ===========================================================================

# _log_to_mlflow removed — all MLflow logic is now in mlflow_utils.py


# ===========================================================================
# Main Pipeline
# ===========================================================================

def main(cfg: Config = None) -> TrainingResult:
    """Execute the full dual-model training pipeline.

    Parameters
    ----------
    cfg : Config, optional
        Configuration object. Uses the module-level singleton if not provided.

    Returns
    -------
    TrainingResult
        Structured object containing trained models, metrics, and artifact paths.
    """
    if cfg is None:
        cfg = default_config

    tracemalloc.start()
    pipeline_start = time.perf_counter()

    # -----------------------------------------------------------------------
    # 1. Load raw data
    # -----------------------------------------------------------------------
    raw_df = load_synthetic_data(cfg)
    logger.info("Dataset: %d rows × %d columns", *raw_df.shape)

    # -----------------------------------------------------------------------
    # 2. Preprocess
    # -----------------------------------------------------------------------
    logger.info("Running preprocessing pipeline...")
    preproc: PreprocessedData = preprocess(raw_df, cfg)
    logger.info("Feature count: %d", len(preproc.feature_names))

    # -----------------------------------------------------------------------
    # 3. Train classifier (PRODUCTION model)
    # -----------------------------------------------------------------------
    logger.info("=" * 60)
    logger.info("Training Model 1: XGBClassifier (PRODUCTION)")
    classifier = train_classifier(
        preproc.X_train, preproc.y_train_clf,
        preproc.X_val, preproc.y_val_clf,
        cfg,
    )

    # -----------------------------------------------------------------------
    # 4. Train regressor (RESEARCH / CALIBRATION model)
    # -----------------------------------------------------------------------
    logger.info("=" * 60)
    logger.info("Training Model 2: XGBRegressor (RESEARCH)")
    regressor = train_regressor(
        preproc.X_train, preproc.y_train_reg,
        preproc.X_val, preproc.y_val_reg,
        cfg,
    )

    # -----------------------------------------------------------------------
    # 5. Evaluate both models on validation and test sets
    # -----------------------------------------------------------------------
    logger.info("=" * 60)
    logger.info("Evaluating models...")
    threshold = cfg.CLASSIFICATION_THRESHOLD

    val_clf_metrics  = evaluate_classifier(classifier, preproc.X_val,  preproc.y_val_clf,  threshold, "Val")
    test_clf_metrics = evaluate_classifier(classifier, preproc.X_test, preproc.y_test_clf, threshold, "Test")
    val_reg_metrics  = evaluate_regressor(regressor,  preproc.X_val,  preproc.y_val_reg,  "Val")
    test_reg_metrics = evaluate_regressor(regressor,  preproc.X_test, preproc.y_test_reg, "Test")

    # -----------------------------------------------------------------------
    # 6. Feature importance
    # -----------------------------------------------------------------------
    model_dir = Path(cfg.MODEL_DIR)
    model_dir.mkdir(parents=True, exist_ok=True)
    export_feature_importance(classifier, preproc.feature_names, "classifier", model_dir)
    export_feature_importance(regressor,  preproc.feature_names, "regressor",  model_dir)

    # -----------------------------------------------------------------------
    # 7. SHAP analysis (classifier only — this is the production model)
    # -----------------------------------------------------------------------
    logger.info("=" * 60)
    logger.info("Running SHAP analysis...")
    run_shap_analysis(classifier, preproc.X_val, preproc.feature_names, cfg, "classifier")

    # -----------------------------------------------------------------------
    # 8. Save all artifacts
    # -----------------------------------------------------------------------
    logger.info("=" * 60)
    logger.info("Saving model artifacts...")
    artifacts = save_artifacts(
        classifier=classifier,
        regressor=regressor,
        scaler=preproc.scaler,
        feature_names=preproc.feature_names,
        val_clf_metrics=val_clf_metrics,
        test_clf_metrics=test_clf_metrics,
        val_reg_metrics=val_reg_metrics,
        test_reg_metrics=test_reg_metrics,
        cfg=cfg,
    )

    # -----------------------------------------------------------------------
    # 9. Log to MLflow (always safe — never crashes the pipeline)
    # -----------------------------------------------------------------------
    pipeline_time = time.perf_counter() - pipeline_start
    mlflow_status = log_training_run(
        cfg=cfg,
        val_clf=val_clf_metrics,
        test_clf=test_clf_metrics,
        val_reg=val_reg_metrics,
        test_reg=test_reg_metrics,
        artifacts=artifacts,
        classifier=classifier,
        regressor=regressor,
        training_time=pipeline_time,
    )

    # -----------------------------------------------------------------------
    # 10. Final resource summary
    # -----------------------------------------------------------------------
    current_mem, peak_mem = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    clf_model_size = Path(artifacts.classifier_xgb).stat().st_size / 1e6
    reg_model_size = Path(artifacts.regressor_xgb).stat().st_size / 1e6

    sep = "-" * 55
    logger.info(sep)
    logger.info("Training Complete")
    logger.info(sep)
    logger.info("  Classifier Saved   : %s", artifacts.classifier_xgb)
    logger.info("  Regressor Saved    : %s", artifacts.regressor_xgb)
    logger.info("  Preprocessor Saved : %s", artifacts.preprocessor_pkl)
    logger.info("  Metrics Saved      : %s", artifacts.training_metrics_json)
    logger.info("  Configuration Saved: %s", artifacts.training_config_json)
    logger.info("  Feature Importance : classifier + regressor CSVs")
    logger.info("  SHAP Artifacts     : %s", cfg.SHAP_DIR)
    logger.info("  MLflow             : %s", mlflow_status)
    logger.info("  Training Time      : %.1f sec", pipeline_time)
    logger.info("  Peak Memory        : %.1f MB", peak_mem / 1e6)
    logger.info("  Classifier Size    : %.2f MB", clf_model_size)
    logger.info("  Regressor Size     : %.2f MB", reg_model_size)
    logger.info(sep)

    return TrainingResult(
        classifier=classifier,
        regressor=regressor,
        val_clf_metrics=val_clf_metrics,
        test_clf_metrics=test_clf_metrics,
        val_reg_metrics=val_reg_metrics,
        test_reg_metrics=test_reg_metrics,
        artifacts=artifacts,
        training_time_seconds=pipeline_time,
    )


if __name__ == "__main__":
    main()
