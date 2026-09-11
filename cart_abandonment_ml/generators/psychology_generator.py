import pandas as pd
import numpy as np
from .base_generator import BaseGenerator

class PsychologyGenerator(BaseGenerator):
    """Calculates engineered psychological root cause scores."""

    def generate(self, df: pd.DataFrame) -> pd.DataFrame:
        pv_safe = np.where(df['page_views'] == 0, 1, df['page_views'])
        dur_safe = np.where(df['session_duration_seconds'] == 0, 1, df['session_duration_seconds'])
        
        df['review_visit_ratio'] = (df['positive_reviews_read'] + df['negative_reviews_read']) / pv_safe
        df['purchase_intent_score'] = (df['total_items_in_cart'] + df['action_transition_count']) / dur_safe
        df['hesitation_score'] = (df['idle_time_seconds'] + df['time_between_cart_and_checkout']) / dur_safe
        
        df['quality_uncertainty_score'] = (
            df['negative_reviews_read'] * 0.5 + 
            df['zoomed_images_count'] * 0.2 + 
            (df['return_policy_days'] == 0) * 0.3
        )
        
        df['price_sensitivity_score'] = (
            df['coupon_error_count'] * 0.3 + 
            df['tab_switch_count'] * 0.1 + 
            (df['persona'] == "Price Sensitive Shopper") * 0.5
        )
        
        df['trust_score'] = (
            df['seller_trust_score'] / 5.0 * 0.6 + 
            df['is_flipkart_assured'] * 0.4 - 
            df['fake_review_probability']
        )
        
        df['impulse_buy_score'] = (
            np.where(df['session_duration_seconds'] < 120, 1.0, 0.0) + 
            (df['persona'] == "Impulse Buyer") * 0.5
        )
        
        return df
