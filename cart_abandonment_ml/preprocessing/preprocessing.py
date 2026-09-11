"""preprocessing.py

Core preprocessing pipeline for the synthetic cart-abandonment dataset.

The pipeline performs:
1. Missing-value imputation (numeric median, categorical mode).
2. Drop non-predictive ID columns.
3. Categorical one-hot encoding (pd.get_dummies).
4. Numeric coercion and secondary imputation.
5. StandardScaler fit on training features.
6. Stratified train / validation / test split.

Dual-model support
------------------
Both continuous (abandonment_probability) and binary (cart_abandoned) targets are
returned inside PreprocessedData so the classifier and regressor can share the
same preprocessing run without re-processing the data.

The fitted scaler and feature names are also returned so they can be persisted as
model artifacts and loaded at inference time by predict.py.

All behaviour is driven by the central Config dataclass (config/config.py).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from ..config.config import Config

logger = logging.getLogger(__name__)


@dataclass
class PreprocessedData:
    """Container for the split datasets after preprocessing.

    Continuous regression targets (y_*_reg) are used for the XGBRegressor.
    Binary classification targets (y_*_clf) are used for the XGBClassifier.

    Attributes
    ----------
    X_train, X_val, X_test : pd.DataFrame
        Feature matrices — identical for both models.
    y_train_reg, y_val_reg, y_test_reg : pd.Series
        Continuous abandonment_probability targets.
    y_train_clf, y_val_clf, y_test_clf : pd.Series
        Binary cart_abandoned targets.
    feature_names : list[str]
        Ordered list of feature column names after preprocessing.
    scaler : StandardScaler
        Fitted scaler — must be saved as an artifact for inference.
    """

    X_train: pd.DataFrame
    X_val: pd.DataFrame
    X_test: pd.DataFrame

    # Regression targets (XGBRegressor)
    y_train_reg: pd.Series
    y_val_reg: pd.Series
    y_test_reg: pd.Series

    # Classification targets (XGBClassifier)
    y_train_clf: pd.Series
    y_val_clf: pd.Series
    y_test_clf: pd.Series

    # Artifacts needed for inference
    feature_names: List[str]
    scaler: StandardScaler

    # -----------------------------------------------------------------------
    # Backward-compatibility aliases — existing code that reads .y_train etc.
    # continues to work; it gets the regression target by default.
    # -----------------------------------------------------------------------
    @property
    def y_train(self) -> pd.Series:
        return self.y_train_reg

    @property
    def y_val(self) -> pd.Series:
        return self.y_val_reg

    @property
    def y_test(self) -> pd.Series:
        return self.y_test_reg


def _impute_missing(df: pd.DataFrame) -> pd.DataFrame:
    """Impute missing values using simple strategies.

    Numeric columns  — median imputation.
    Categorical columns — mode imputation (fallback: 'missing').
    """
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    cat_cols = df.select_dtypes(exclude=[np.number]).columns

    for col in numeric_cols:
        median = df[col].median()
        df[col] = df[col].fillna(median)
        logger.debug("Imputed numeric '%s' with median %.4f", col, median)

    for col in cat_cols:
        fill_val = df[col].mode().iloc[0] if not df[col].mode().empty else "missing"
        df[col] = df[col].fillna(fill_val)
        logger.debug("Imputed categorical '%s' with mode '%s'", col, fill_val)

    return df


def _encode_categoricals(df: pd.DataFrame, exclude_cols: List[str]) -> pd.DataFrame:
    """One-hot encode all object/category columns, excluding specified columns."""
    cat_cols = [
        c for c in df.select_dtypes(include=["object", "category"]).columns
        if c not in exclude_cols
    ]
    if cat_cols:
        df = pd.get_dummies(df, columns=cat_cols, drop_first=True)
        logger.debug("One-hot encoded %d columns: %s", len(cat_cols), cat_cols)
    return df


def preprocess(df: pd.DataFrame, config: Optional[Config] = None) -> PreprocessedData:
    """Run the full preprocessing pipeline and return split data for both models.

    Parameters
    ----------
    df : pd.DataFrame
        Raw synthetic dataset (output of generate_synthetic_data.py).
    config : Config, optional
        Global configuration object. Instantiates a default Config if not provided.

    Returns
    -------
    PreprocessedData
        Dataclass with train/val/test splits for both regression and classification,
        plus the fitted scaler and feature names for artifact persistence.
    """
    if config is None:
        config = Config()

    logger.info("Starting preprocessing pipeline on %d rows × %d columns", *df.shape)
    df = df.copy()

    # ------------------------------------------------------------------
    # 1. Impute missing values
    # ------------------------------------------------------------------
    df = _impute_missing(df)

    # ------------------------------------------------------------------
    # 2. Drop non-predictive ID / metadata columns
    # ------------------------------------------------------------------
    drop_cols = [c for c in ["user_id", "session_id"] if c in df.columns]
    if drop_cols:
        df = df.drop(columns=drop_cols)
        logger.debug("Dropped ID columns: %s", drop_cols)

    # ------------------------------------------------------------------
    # 3. Validate required target columns exist
    # ------------------------------------------------------------------
    required_targets = {"abandonment_probability", "cart_abandoned"}
    missing_targets = required_targets - set(df.columns)
    if missing_targets:
        raise ValueError(
            f"DataFrame is missing required target columns: {missing_targets}. "
            "Ensure generate_synthetic_data.py has been run successfully."
        )

    # ------------------------------------------------------------------
    # 4. Separate targets before encoding (targets are always numeric)
    # ------------------------------------------------------------------
    y_reg = df["abandonment_probability"].astype(np.float32)   # continuous [0,1]
    y_clf = df["cart_abandoned"].astype(np.int8)               # binary {0,1}

    # ------------------------------------------------------------------
    # 5. Encode categorical feature columns (exclude both targets)
    # ------------------------------------------------------------------
    df = _encode_categoricals(df, exclude_cols=["abandonment_probability", "cart_abandoned"])

    # ------------------------------------------------------------------
    # 6. Drop targets from feature matrix
    # ------------------------------------------------------------------
    feature_cols = [c for c in df.columns if c not in {"abandonment_probability", "cart_abandoned"}]
    X = df[feature_cols]

    # ------------------------------------------------------------------
    # 7. Numeric coercion + secondary imputation for any NaN introduced by dummies
    # ------------------------------------------------------------------
    X = X.apply(pd.to_numeric, errors="coerce")
    X = _impute_missing(X)
    feature_names: List[str] = list(X.columns)
    logger.info("Feature matrix shape: %d rows × %d features", *X.shape)

    # ------------------------------------------------------------------
    # 8. Train / validation / test split (stratify on binary target)
    # ------------------------------------------------------------------
    stratify = y_clf   # Always stratify on binary label for balanced splits
    X_temp, X_test, y_reg_temp, y_reg_test, y_clf_temp, y_clf_test = train_test_split(
        X, y_reg, y_clf,
        test_size=config.TEST_SIZE,
        random_state=config.RANDOM_SEED,
        stratify=stratify,
    )
    val_fraction = config.VAL_SIZE / (1.0 - config.TEST_SIZE)
    X_train, X_val, y_reg_train, y_reg_val, y_clf_train, y_clf_val = train_test_split(
        X_temp, y_reg_temp, y_clf_temp,
        test_size=val_fraction,
        random_state=config.RANDOM_SEED,
        stratify=y_clf_temp,
    )
    logger.info(
        "Split complete — train: %d | val: %d | test: %d",
        len(X_train), len(X_val), len(X_test),
    )
    logger.info(
        "Class balance (cart_abandoned=1) — train: %.2f%% | val: %.2f%% | test: %.2f%%",
        y_clf_train.mean() * 100,
        y_clf_val.mean() * 100,
        y_clf_test.mean() * 100,
    )

    # ------------------------------------------------------------------
    # 9. Scale features — fit on train, transform all splits
    # ------------------------------------------------------------------
    scaler = StandardScaler()
    X_train_scaled = pd.DataFrame(
        scaler.fit_transform(X_train), columns=feature_names, index=X_train.index
    )
    X_val_scaled = pd.DataFrame(
        scaler.transform(X_val), columns=feature_names, index=X_val.index
    )
    X_test_scaled = pd.DataFrame(
        scaler.transform(X_test), columns=feature_names, index=X_test.index
    )
    logger.debug("StandardScaler fitted on training data and applied to all splits")

    return PreprocessedData(
        X_train=X_train_scaled,
        X_val=X_val_scaled,
        X_test=X_test_scaled,
        y_train_reg=y_reg_train,
        y_val_reg=y_reg_val,
        y_test_reg=y_reg_test,
        y_train_clf=y_clf_train,
        y_val_clf=y_clf_val,
        y_test_clf=y_clf_test,
        feature_names=feature_names,
        scaler=scaler,
    )


if __name__ == "__main__":
    import argparse
    from pathlib import Path

    parser = argparse.ArgumentParser(description="Run preprocessing on synthetic CSV data")
    parser.add_argument("csv_path", type=Path, help="Path to the generated dataset CSV")
    args = parser.parse_args()

    raw_df = pd.read_csv(args.csv_path)
    processed = preprocess(raw_df)

    out_dir = Path("data")
    out_dir.mkdir(exist_ok=True)
    processed.X_train.to_csv(out_dir / "X_train.csv", index=False)
    processed.y_train_reg.to_csv(out_dir / "y_train_reg.csv", index=False)
    processed.y_train_clf.to_csv(out_dir / "y_train_clf.csv", index=False)
    processed.X_val.to_csv(out_dir / "X_val.csv", index=False)
    processed.X_test.to_csv(out_dir / "X_test.csv", index=False)
    logger.info("Preprocessing complete — files written to %s", out_dir)
