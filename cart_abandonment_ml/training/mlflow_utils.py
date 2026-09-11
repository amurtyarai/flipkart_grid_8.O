"""mlflow_utils.py — Isolated MLflow experiment tracking utilities.

All MLflow logic lives here so that training code is never polluted with
tracking concerns, and the pipeline is always safe to run regardless of
whether MLflow is installed or configured.

Design contract
---------------
* Every public function is a no-op (and logs a WARNING) when:
    - ``config.ENABLE_MLFLOW`` is False, OR
    - MLflow is not installed, OR
    - Any MLflow call raises an exception.
* Training code calls exactly ONE function: ``log_training_run(...)``.
  It never needs to call ``mlflow.*`` directly.

Usage in train.py
-----------------
    from cart_abandonment_ml.training.mlflow_utils import log_training_run

    log_training_run(
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
"""

from __future__ import annotations

import logging
from dataclasses import asdict
from pathlib import Path
from typing import TYPE_CHECKING, Any, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Optional MLflow import — graceful degradation if not installed
# ---------------------------------------------------------------------------
try:
    import mlflow
    import mlflow.xgboost
    _MLFLOW_INSTALLED = True
except ImportError:
    _MLFLOW_INSTALLED = False
    logger.warning("MLflow is not installed. Experiment tracking will be skipped.")

if TYPE_CHECKING:
    import xgboost as xgb
    from cart_abandonment_ml.config.config import Config
    from cart_abandonment_ml.training.train import (
        ClassifierMetrics,
        ModelArtifacts,
        RegressorMetrics,
    )


# ===========================================================================
# Internal helpers
# ===========================================================================

def _is_enabled(cfg: "Config") -> bool:
    """Return True only when MLflow is installed AND enabled in config."""
    if not _MLFLOW_INSTALLED:
        return False
    if not getattr(cfg, "ENABLE_MLFLOW", False):
        return False
    return True


def initialize_mlflow(cfg: "Config") -> bool:
    """Configure the MLflow tracking URI and experiment.

    Returns True on success, False on any failure.
    """
    if not _is_enabled(cfg):
        return False
    try:
        mlflow.set_tracking_uri(cfg.MLFLOW_TRACKING_URI)
        mlflow.set_experiment(cfg.MLFLOW_EXPERIMENT_NAME)
        logger.info("MLflow initialised — URI: %s | Experiment: %s",
                    cfg.MLFLOW_TRACKING_URI, cfg.MLFLOW_EXPERIMENT_NAME)
        return True
    except Exception as exc:
        logger.warning("MLflow initialisation failed (%s). Skipping experiment tracking.", exc)
        return False


def log_parameters(cfg: "Config") -> None:
    """Log classifier and regressor hyperparameters to the active MLflow run."""
    try:
        mlflow.log_params({f"clf_{k}": v for k, v in asdict(cfg.CLASSIFIER).items()})
        mlflow.log_params({f"reg_{k}": v for k, v in asdict(cfg.REGRESSOR).items()})
        mlflow.log_param("random_seed", cfg.RANDOM_SEED)
        mlflow.log_param("classification_threshold", cfg.CLASSIFICATION_THRESHOLD)
    except Exception as exc:
        logger.warning("MLflow parameter logging failed: %s", exc)


def log_metrics(
    val_clf: "ClassifierMetrics",
    test_clf: "ClassifierMetrics",
    val_reg: "RegressorMetrics",
    test_reg: "RegressorMetrics",
    training_time: float,
) -> None:
    """Log all evaluation metrics to the active MLflow run."""
    try:
        mlflow.log_metrics({
            # Classifier — validation
            "val_clf_accuracy":   val_clf.accuracy,
            "val_clf_precision":  val_clf.precision,
            "val_clf_recall":     val_clf.recall,
            "val_clf_f1":         val_clf.f1,
            "val_clf_roc_auc":    val_clf.roc_auc,
            "val_clf_pr_auc":     val_clf.pr_auc,
            "val_clf_log_loss":   val_clf.log_loss_score,
            "val_clf_brier":      val_clf.brier_score,
            # Classifier — test
            "test_clf_accuracy":  test_clf.accuracy,
            "test_clf_precision": test_clf.precision,
            "test_clf_recall":    test_clf.recall,
            "test_clf_f1":        test_clf.f1,
            "test_clf_roc_auc":   test_clf.roc_auc,
            "test_clf_pr_auc":    test_clf.pr_auc,
            "test_clf_log_loss":  test_clf.log_loss_score,
            "test_clf_brier":     test_clf.brier_score,
            # Regressor — validation
            "val_reg_rmse":       val_reg.rmse,
            "val_reg_mae":        val_reg.mae,
            "val_reg_r2":         val_reg.r2,
            # Regressor — test
            "test_reg_rmse":      test_reg.rmse,
            "test_reg_mae":       test_reg.mae,
            "test_reg_r2":        test_reg.r2,
            # Pipeline
            "training_time_seconds": training_time,
        })
    except Exception as exc:
        logger.warning("MLflow metric logging failed: %s", exc)


def log_artifacts(artifacts: "ModelArtifacts") -> None:
    """Log artifact files (JSONs, CSVs) to the active MLflow run."""
    try:
        for path in [
            artifacts.feature_names_json,
            artifacts.training_metrics_json,
            artifacts.training_config_json,
            artifacts.class_mapping_json,
            artifacts.feature_importance_clf_csv,
            artifacts.feature_importance_reg_csv,
        ]:
            if Path(path).is_file():
                mlflow.log_artifact(str(path))
    except Exception as exc:
        logger.warning("MLflow artifact logging failed: %s", exc)


def log_models(classifier: Any, regressor: Any) -> None:
    """Register both models with MLflow's XGBoost flavour."""
    try:
        mlflow.xgboost.log_model(classifier, artifact_path="classifier")
        mlflow.xgboost.log_model(regressor, artifact_path="regressor")
    except Exception as exc:
        logger.warning("MLflow model logging failed: %s", exc)


def close_run() -> None:
    """End the current MLflow run gracefully."""
    try:
        mlflow.end_run()
    except Exception as exc:
        logger.warning("MLflow run could not be closed cleanly: %s", exc)


# ===========================================================================
# Public entry point — call this from train.py
# ===========================================================================

def log_training_run(
    cfg: "Config",
    val_clf: "ClassifierMetrics",
    test_clf: "ClassifierMetrics",
    val_reg: "RegressorMetrics",
    test_reg: "RegressorMetrics",
    artifacts: "ModelArtifacts",
    classifier: Any,
    regressor: Any,
    training_time: float,
) -> str:
    """Log a complete training run to MLflow.

    This is the ONLY function that train.py needs to call.
    It is completely safe: it never raises, never crashes the pipeline.

    Returns
    -------
    str
        A human-readable status string for the training summary log:
        e.g. "Enabled (run logged)" or "Disabled" or "Failed (warning logged)".
    """
    if not _is_enabled(cfg):
        logger.info("MLflow: Disabled (ENABLE_MLFLOW=False in config)")
        return "Disabled"

    try:
        ok = initialize_mlflow(cfg)
        if not ok:
            return "Skipped (init failed)"

        with mlflow.start_run(run_name="cart_abandonment_dual_model"):
            log_parameters(cfg)
            log_metrics(val_clf, test_clf, val_reg, test_reg, training_time)
            log_artifacts(artifacts)
            log_models(classifier, regressor)

        logger.info("MLflow run logged successfully — experiment: %s",
                    cfg.MLFLOW_EXPERIMENT_NAME)
        return f"Enabled — run logged to {cfg.MLFLOW_TRACKING_URI}"

    except Exception as exc:
        logger.warning(
            "MLflow unavailable. Skipping experiment tracking. Reason: %s", exc
        )
        return f"Failed ({type(exc).__name__})"
