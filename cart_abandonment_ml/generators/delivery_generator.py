import pandas as pd
import numpy as np
from .base_generator import BaseGenerator

class DeliveryGenerator(BaseGenerator):
    """Generates Delivery logistics and Seller metrics."""

    def generate(self, df: pd.DataFrame) -> pd.DataFrame:
        n = len(df)
        is_premium = df['is_premium_member'] == 1
        
        df['estimated_delivery_days'] = np.random.poisson(lam=3, size=n)
        df.loc[is_premium, 'estimated_delivery_days'] = np.random.poisson(lam=1, size=is_premium.sum())
        
        df['free_delivery_eligible'] = is_premium | (df['cart_value'] > 500)
        df['total_shipping_charges'] = np.where(df['free_delivery_eligible'], 0, np.random.choice([40, 50, 100], size=n))
        
        # Hard dealbreaker logic simulated
        df['delivery_unavailable_items'] = (np.random.rand(n) < 0.01).astype(int) 
        
        # Seller Trust Variables
        df['is_flipkart_assured'] = (np.random.rand(n) < 0.6).astype(int)
        df['seller_trust_score'] = np.clip(np.random.normal(4.0, 0.8, size=n), 1, 5)
        df['fake_review_probability'] = np.clip(np.random.beta(2, 10, size=n), 0, 1)
        
        return df
