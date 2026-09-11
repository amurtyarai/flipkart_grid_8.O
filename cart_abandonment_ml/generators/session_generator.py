import pandas as pd
import numpy as np
from .base_generator import BaseGenerator
from ..utils.distributions import generate_lognormal

class SessionGenerator(BaseGenerator):
    """Generates Temporal, Sequential, and Session browsing features."""

    def generate(self, df: pd.DataFrame) -> pd.DataFrame:
        n = len(df)
        is_impulse = df['persona'] == "Impulse Buyer"
        is_bot = df['is_bot']
        
        # Temporal constraints
        df['time_since_cart_created'] = generate_lognormal(mean=6, sigma=1.5, size=n).astype(int)
        df.loc[is_impulse, 'time_since_cart_created'] = np.random.exponential(60, size=is_impulse.sum()).astype(int)
        
        df['time_since_last_action'] = np.random.exponential(120, size=n).astype(int)
        df['days_until_salary'] = np.random.randint(0, 31, size=n)
        df['is_festival_season'] = (np.random.rand(n) < 0.1).astype(int)
        df['is_weekend'] = (np.random.rand(n) < 0.28).astype(int)
        df['is_office_hours'] = (np.random.rand(n) < 0.4).astype(int)
        df['late_night_session'] = (np.random.rand(n) < 0.15).astype(int)
        
        # Multi-session tracking
        df['visited_same_product_last_week'] = (np.random.rand(n) < 0.3).astype(int)
        df['cart_restored'] = (np.random.rand(n) < 0.1).astype(int)
        df['days_since_first_view'] = np.random.poisson(lam=3, size=n)
        df['sessions_for_same_product'] = np.random.poisson(lam=2, size=n)
        df['repeat_product_views'] = np.random.poisson(lam=4, size=n)
        
        # Browsing duration & depth
        df['session_duration_seconds'] = generate_lognormal(mean=5.5, sigma=1.2, size=n).astype(int)
        df['page_views'] = np.clip(np.random.poisson(lam=15, size=n), 1, 500)
        
        # Bot override
        df.loc[is_bot, 'page_views'] = np.random.randint(200, 600, size=is_bot.sum())
        df.loc[is_bot, 'session_duration_seconds'] = np.random.randint(10, 60, size=is_bot.sum())
        
        # Sequential Markov Proxies
        actions = ['Search', 'Product', 'Cart', 'Checkout', 'Review', 'Home']
        df['last_action'] = np.random.choice(actions, size=n)
        df['first_action'] = np.random.choice(actions, size=n)
        df['checkout_before_review'] = (np.random.rand(n) < 0.05).astype(int)
        df['review_after_cart'] = (np.random.rand(n) < 0.15).astype(int)
        df['cart_after_search'] = (np.random.rand(n) < 0.2).astype(int)
        df['action_transition_count'] = np.random.poisson(lam=df['page_views']*0.8)
        df['time_between_cart_and_checkout'] = np.random.exponential(120, size=n).astype(int)
        df['checkout_loop_count'] = np.random.poisson(lam=0.2, size=n)
        
        # Entropy computation for session sequence chaos
        action_probs = np.random.dirichlet(np.ones(len(actions)), size=n)
        df['action_entropy'] = -np.sum(action_probs * np.log2(action_probs + 1e-9), axis=1)
        
        return df
