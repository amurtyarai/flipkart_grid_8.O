import pandas as pd
import numpy as np
from .base_generator import BaseGenerator
from ..utils.distributions import generate_lognormal, generate_pareto_outliers

class CartGenerator(BaseGenerator):
    """Generates Cart features including item counts and total value."""

    def generate(self, df: pd.DataFrame) -> pd.DataFrame:
        n = len(df)
        is_corp = df['persona'] == "Corporate Buyer"
        
        df['total_items_in_cart'] = np.random.poisson(lam=2, size=n) + 1
        df['unique_categories_in_cart'] = np.clip(np.random.poisson(lam=1, size=n) + 1, 1, df['total_items_in_cart'])
        
        # Heavy-tailed value generation
        base_cart_val = generate_lognormal(mean=7.5, sigma=1.2, size=n) 
        corp_cart_val = generate_pareto_outliers(alpha=1.5, multiplier=20000, size=is_corp.sum())
        
        df['cart_value'] = base_cart_val
        df.loc[is_corp, 'cart_value'] = corp_cart_val
        df['cart_value'] = df['cart_value'].round(2)
        
        df['min_item_price'] = df['cart_value'] / df['total_items_in_cart'] * np.random.uniform(0.1, 0.5, size=n)
        df['max_item_price'] = df['cart_value'] / df['total_items_in_cart'] * np.random.uniform(1.2, 2.0, size=n)
        
        df['is_gift_wrap_requested'] = (np.random.rand(n) < 0.05).astype(int)
        df['out_of_stock_items_in_cart'] = np.random.poisson(lam=0.1, size=n)
        
        return df
