import pandas as pd
import numpy as np
from ..config.config import config

class AbandonmentLabelGenerator:
    """Simulates the final probability and binary target with noise & logic."""

    def generate(self, df: pd.DataFrame) -> pd.DataFrame:
        n = len(df)
        
        # Base Log-Odds Intercept
        Z = np.full(n, -1.0)
        
        # Weight application from scores
        Z += -1.5 * df['purchase_intent_score']
        Z += 2.5 * df['hesitation_score']
        Z += 1.2 * df['quality_uncertainty_score']
        Z += 0.8 * df['price_sensitivity_score'] * np.where(df['competitor_difference'] < 0, 1, 0)
        Z += -2.0 * df['trust_score']
        Z += 1.5 * (df['total_shipping_charges'] / 100.0)
        Z += 1.0 * df['checkout_restart_count']
        Z += 0.5 * df['payment_failures']
        
        # Dealbreakers (Hard rules overriding soft intent)
        Z = np.where(df['delivery_unavailable_items'] > 0, Z + 10.0, Z)
        Z = np.where(df['otp_timeout'] == 1, Z + 4.0, Z)
        Z = np.where(df['is_bot'] == True, 15.0, Z)
        
        # Persona biases
        Z = np.where(df['persona'] == "Price Sensitive Shopper", Z + 1.5, Z)
        Z = np.where(df['persona'] == "Loyal Customer", Z - 2.0, Z)
        
        # Gaussian Noise Simulation
        noise = np.random.normal(0, 0.5, size=n)
        Z_final = Z + noise
        
        # Convert Log-Odds to Probability
        df['abandonment_probability'] = 1 / (1 + np.exp(-Z_final))
        
        # Probabilistic Sampling (Bernoulli Draw)
        df['cart_abandoned'] = np.random.binomial(1, df['abandonment_probability'])
        
        # Irrational Noise Injection (Flipping sure bets to simulate human unpredictability)
        irrational_purchase = (df['abandonment_probability'] > 0.8) & (np.random.rand(n) < config.IRRATIONAL_PURCHASE_RATE)
        irrational_abandon = (df['abandonment_probability'] < 0.2) & (np.random.rand(n) < config.IRRATIONAL_ABANDON_RATE)
        
        df.loc[irrational_purchase, 'cart_abandoned'] = 0
        df.loc[irrational_abandon, 'cart_abandoned'] = 1
        
        return df
