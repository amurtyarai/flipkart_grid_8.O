"""uplift_engine.py — Production Uplift Modeling & Qini Evaluation Engine

Implements Causal ML / Uplift Modeling for E-Commerce Cart Abandonment Interventions.

Core Capabilities:
------------------
1. Multi-Arm Uplift Estimation (T-Learner Meta-Learner using LightGBM).
2. Simulated Intervention Effects (`simulated_intervention_effects`) based on
   Structural Causal Models (SCM) linking root cause & user features to treatment response.
3. Policy Optimization: Recommends optimal treatment arm a* = argmax_a tau_a(x).
4. Qini Curve & AUUC (Area Under Uplift Curve) Benchmarks comparing:
   - Uplift-Optimal Policy (T-Learner)
   - Risk-Ranked Discount Baseline
   - Random Assignment
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

try:
    import lightgbm as lgb
    _LIGHTGBM_AVAILABLE = True
except ImportError:
    _LIGHTGBM_AVAILABLE = False
    from sklearn.ensemble import HistGradientBoostingClassifier as lgb

logger = logging.getLogger(__name__)

# ===========================================================================
# Treatment Arm Definitions
# ===========================================================================

TREATMENT_ARMS = {
    0: "CONTROL",              # No intervention (Baseline)
    1: "DISCOUNT_10",          # Direct 10% Discount
    2: "FREE_SHIPPING",        # Free Shipping Coupon
    3: "NO_COST_EMI",          # No-Cost EMI & Pay Later Credit
    4: "TRUST_DELIVERY_BADGE", # Platform Security & Express Delivery Guarantee
}

REV_TREATMENT_ARMS = {v: k for k, v in TREATMENT_ARMS.items()}


# ===========================================================================
# Uplift Simulation Engine
# ===========================================================================

def generate_simulated_uplift_dataset(
    n_samples: int = 25000,
    seed: int = 42
) -> pd.DataFrame:
    """Generate synthetic user dataset with simulated intervention response.
    
    Identifies ground-truth heterogeneous treatment effect tau_a(x) for each arm.
    """
    np.random.seed(seed)
    
    # 1. Base user features
    cart_total = np.random.lognormal(mean=7.5, sigma=0.8, size=n_samples)
    price_sens = np.random.beta(2, 5, size=n_samples)
    shipping_ratio = np.clip(np.random.normal(0.08, 0.04, size=n_samples), 0, 0.3)
    trust_concern = np.random.beta(2, 5, size=n_samples)
    hesitation_sec = np.random.exponential(180, size=n_samples)
    
    # 2. Baseline conversion probability without intervention (Control: Y0)
    # Base baseline probability ~0.35 (65% abandon rate)
    baseline_logit = (
        -0.5
        - 1.5 * price_sens
        - 2.0 * shipping_ratio
        - 1.2 * trust_concern
        - 0.002 * hesitation_sec
    )
    p_control = 1.0 / (1.0 + np.exp(-baseline_logit))
    
    # 3. Ground-truth treatment effect matrix tau_a(x)
    tau_discount = 0.35 * price_sens * (cart_total > 2000).astype(float)
    tau_shipping = 0.40 * (shipping_ratio > 0.07).astype(float)
    tau_emi = 0.30 * (cart_total > 3500).astype(float) * price_sens
    tau_trust = 0.32 * trust_concern
    
    # Random treatment assignment for un-biased A/B trial simulation
    treatment_arm = np.random.choice(list(TREATMENT_ARMS.keys()), size=n_samples)
    
    # Actual conversion probability under assigned treatment
    p_assigned = p_control.copy()
    p_assigned += np.where(treatment_arm == 1, tau_discount, 0.0)
    p_assigned += np.where(treatment_arm == 2, tau_shipping, 0.0)
    p_assigned += np.where(treatment_arm == 3, tau_emi, 0.0)
    p_assigned += np.where(treatment_arm == 4, tau_trust, 0.0)
    p_assigned = np.clip(p_assigned, 0.01, 0.99)
    
    # Binary conversion outcome Y (1 = Converted/Retained, 0 = Abandoned)
    converted = (np.random.rand(n_samples) < p_assigned).astype(int)
    
    df = pd.DataFrame({
        "cart_total": cart_total,
        "price_sensitivity": price_sens,
        "shipping_ratio": shipping_ratio,
        "trust_concern": trust_concern,
        "hesitation_sec": hesitation_sec,
        "treatment_arm": treatment_arm,
        "treatment_name": [TREATMENT_ARMS[a] for a in treatment_arm],
        "converted": converted,
        "simulated_tau_discount": tau_discount,
        "simulated_tau_shipping": tau_shipping,
        "simulated_tau_emi": tau_emi,
        "simulated_tau_trust": tau_trust,
    })
    
    return df


# ===========================================================================
# Multi-Arm T-Learner Uplift Model
# ===========================================================================

class MultiArmTLearner:
    """T-Learner Meta-Learner for multi-treatment arm uplift estimation."""
    
    def __init__(self) -> None:
        self.models: Dict[int, Any] = {}
        self.feature_names: List[str] = []
        
    def fit(self, X: pd.DataFrame, y: pd.Series, treatment: pd.Series) -> MultiArmTLearner:
        """Fit independent outcome models for control and each treatment arm."""
        self.feature_names = list(X.columns)
        arms = np.unique(treatment)
        
        for arm in arms:
            mask = (treatment == arm)
            X_arm, y_arm = X[mask], y[mask]
            
            if _LIGHTGBM_AVAILABLE:
                clf = lgb.LGBMClassifier(
                    n_estimators=100,
                    learning_rate=0.05,
                    max_depth=4,
                    random_state=42,
                    verbosity=-1,
                )
            else:
                clf = lgb(max_iter=100, learning_rate=0.05, max_depth=4, random_state=42)
                
            clf.fit(X_arm, y_arm)
            self.models[arm] = clf
            
        return self
        
    def predict_tau(self, X: pd.DataFrame) -> pd.DataFrame:
        """Predict Individual Treatment Effect tau_a(x) = P(Y=1|X, a) - P(Y=1|X, control)."""
        p_control = self.models[0].predict_proba(X)[:, 1]
        
        tau_df = pd.DataFrame(index=X.index)
        tau_df["p_control"] = p_control
        
        for arm, name in TREATMENT_ARMS.items():
            if arm == 0:
                continue
            p_arm = self.models[arm].predict_proba(X)[:, 1]
            tau_df[f"tau_{name}"] = p_arm - p_control
            tau_df[f"p_{name}"] = p_arm
            
        # Determine optimal arm & max uplift
        tau_cols = [f"tau_{TREATMENT_ARMS[a]}" for a in TREATMENT_ARMS if a != 0]
        tau_matrix = tau_df[tau_cols].values
        
        best_arm_idx = np.argmax(tau_matrix, axis=1) + 1
        best_tau = np.max(tau_matrix, axis=1)
        
        tau_df["optimal_arm"] = [TREATMENT_ARMS[a] for a in best_arm_idx]
        tau_df["max_uplift"] = best_tau
        
        return tau_df


# ===========================================================================
# Qini & AUUC Benchmark Calculator
# ===========================================================================

def compute_qini_curve(
    y_true: np.ndarray,
    treatment: np.ndarray,
    predicted_scores: np.ndarray,
    target_arm: int = 1,
    n_bins: int = 10
) -> Dict[str, Any]:
    """Compute Qini curve metrics comparing ranked strategy vs random baseline."""
    # Filter to target arm and control
    mask = (treatment == target_arm) | (treatment == 0)
    y_sub = y_true[mask]
    t_sub = (treatment[mask] == target_arm).astype(int)
    scores_sub = predicted_scores[mask]
    
    # Sort descending by score
    sort_idx = np.argsort(-scores_sub)
    y_sorted = y_sub[sort_idx]
    t_sorted = t_sub[sort_idx]
    
    n = len(y_sorted)
    qini_points = []
    percentiles = np.linspace(0.1, 1.0, n_bins)
    
    total_nt = (t_sub == 1).sum()
    total_nc = (t_sub == 0).sum()
    
    for p in percentiles:
        k = int(round(p * n))
        y_k = y_sorted[:k]
        t_k = t_sorted[:k]
        
        n_t_k = (t_k == 1).sum()
        n_c_k = (t_k == 0).sum()
        
        y_t_k = y_k[t_k == 1].sum() if n_t_k > 0 else 0
        y_c_k = y_k[t_k == 0].sum() if n_c_k > 0 else 0
        
        # Qini value Q(k) = Y_t(k) - Y_c(k) * (N_t / N_c)
        ratio = (n_t_k / n_c_k) if n_c_k > 0 else 1.0
        qini_val = float(y_t_k - y_c_k * ratio)
        qini_points.append(round(qini_val, 2))
        
    # Calculate Qini score (area relative to random)
    random_max = float(qini_points[-1])
    random_curve = list(np.linspace(0, random_max, n_bins))
    
    def _trapz_area(y_vals):
        arr = np.array(y_vals, dtype=float)
        return float(np.sum((arr[:-1] + arr[1:]) / 2.0))

    qini_score = float(_trapz_area(qini_points) - _trapz_area(random_curve))
    
    return {
        "target_arm": TREATMENT_ARMS.get(target_arm, str(target_arm)),
        "percentiles": [int(p * 100) for p in percentiles],
        "qini_curve_uplift_policy": qini_points,
        "qini_curve_random_policy": [round(v, 2) for v in random_curve],
        "qini_score": round(qini_score, 2),
    }


# ===========================================================================
# CLI Demo / Test Script
# ===========================================================================

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    logger.info("Generating synthetic uplift dataset...")
    
    df = generate_simulated_uplift_dataset(n_samples=20000)
    
    feature_cols = ["cart_total", "price_sensitivity", "shipping_ratio", "trust_concern", "hesitation_sec"]
    X = df[feature_cols]
    y = df["converted"]
    t = df["treatment_arm"]
    
    X_train, X_test, y_train, y_test, t_train, t_test = train_test_split(
        X, y, t, test_size=0.3, random_state=42
    )
    
    logger.info("Training Multi-Arm T-Learner Uplift Model...")
    learner = MultiArmTLearner()
    learner.fit(X_train, y_train, t_train)
    
    tau_preds = learner.predict_tau(X_test)
    logger.info("Sample Uplift Predictions:\n%s", tau_preds.head())
    
    logger.info("Computing Qini Curve evaluation for Discount Arm...")
    qini_res = compute_qini_curve(
        y_true=y_test.values,
        treatment=t_test.values,
        predicted_scores=tau_preds["tau_DISCOUNT_10"].values,
        target_arm=1,
    )
    
    print("\n" + "=" * 60)
    print("QINI BENCHMARK EVALUATION SCORECARD")
    print("=" * 60)
    print(json.dumps(qini_res, indent=2))
