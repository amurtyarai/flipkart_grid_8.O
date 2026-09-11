import pandas as pd
import numpy as np
from .base_generator import BaseGenerator
from ..utils.distributions import generate_bounded_normal

class UserGenerator(BaseGenerator):
    """Generates Static User Profile & Demographic features."""

    def generate(self, df: pd.DataFrame) -> pd.DataFrame:
        n = len(df)
        
        # Age distributions differ by persona
        base_age = generate_bounded_normal(28, 10, n, lower=13, upper=80)
        df['user_age'] = base_age.astype(float)
        
        is_corp = df['persona'] == "Corporate Buyer"
        df.loc[is_corp, 'user_age'] = generate_bounded_normal(35, 8, is_corp.sum(), lower=20, upper=70).astype(float)
        
        # Gender
        df['user_gender'] = np.random.choice(['M', 'F', 'Other', 'Unknown'], size=n, p=[0.45, 0.45, 0.05, 0.05])
        
        # Account Age (Loyal = Older, First Time = 0)
        df['account_age_days'] = np.random.exponential(500, size=n).astype(int)
        df.loc[df['persona'] == "First Time User", 'account_age_days'] = 0
        df.loc[df['persona'] == "Loyal Customer", 'account_age_days'] += 1000
        df['account_age_days'] = np.clip(df['account_age_days'], 0, 5000)
        
        # Premium membership
        df['is_premium_member'] = (np.random.rand(n) < 0.15).astype(int)
        df.loc[df['persona'] == "Loyal Customer", 'is_premium_member'] = 1
        df.loc[df['persona'] == "First Time User", 'is_premium_member'] = 0
        
        # Location
        df['location_tier'] = np.random.choice(['Tier 1', 'Tier 2', 'Tier 3', 'Rural'], size=n, p=[0.4, 0.3, 0.2, 0.1])
        df['default_address_type'] = np.random.choice(['Home', 'Office'], size=n, p=[0.8, 0.2])
        df.loc[is_corp, 'default_address_type'] = 'Office'
        
        return df
