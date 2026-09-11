import pandas as pd
import numpy as np
from .base_generator import BaseGenerator
from ..utils.distributions import generate_lognormal

class PurchaseHistoryGenerator(BaseGenerator):
    """Generates Static Purchase History & Lifetime Value metrics."""

    def generate(self, df: pd.DataFrame) -> pd.DataFrame:
        n = len(df)
        is_first = df['persona'] == "First Time User"
        is_loyal = df['persona'] == "Loyal Customer"
        
        df['total_historical_purchases'] = np.random.poisson(lam=10, size=n)
        df.loc[is_first, 'total_historical_purchases'] = 0
        df.loc[is_loyal, 'total_historical_purchases'] = np.random.poisson(lam=50, size=is_loyal.sum())
        
        # Spend = purchases * AOV
        df['total_historical_spend'] = df['total_historical_purchases'] * generate_lognormal(mean=7, sigma=1, size=n)
        
        df['historical_return_rate'] = np.clip(np.random.normal(0.1, 0.05, size=n), 0, 1)
        df['previous_abandoned_carts'] = np.random.poisson(lam=5, size=n)
        df['previous_abandonment_rate'] = np.clip(np.random.beta(2, 5, size=n), 0, 1)
        
        df['days_since_last_purchase'] = generate_lognormal(mean=4, sigma=1, size=n).astype(int)
        df.loc[is_first, 'days_since_last_purchase'] = -1
        
        # Derived historical AOV
        df['average_order_value'] = np.where(df['total_historical_purchases'] > 0, 
                                             df['total_historical_spend'] / df['total_historical_purchases'], 
                                             0)
        
        return df
