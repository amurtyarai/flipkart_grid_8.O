import pandas as pd
import numpy as np
from .base_generator import BaseGenerator

class PaymentGenerator(BaseGenerator):
    """Generates Payment friction, Network, and Device context."""

    def generate(self, df: pd.DataFrame) -> pd.DataFrame:
        n = len(df)
        
        df['device_type'] = np.random.choice(['Mobile', 'Desktop', 'Tablet'], size=n, p=[0.7, 0.25, 0.05])
        df['network_type'] = np.random.choice(['WiFi', '4G', '5G', '3G'], size=n, p=[0.4, 0.4, 0.15, 0.05])
        df['battery_level'] = np.random.randint(1, 101, size=n)
        
        # Friction
        df['payment_failures'] = np.random.poisson(lam=0.1, size=n)
        df['checkout_restart_count'] = np.random.poisson(lam=0.1, size=n)
        df['otp_timeout'] = (np.random.rand(n) < 0.02).astype(int)
        
        # Correlation: Mobile on 3G fails more
        bad_conn = (df['device_type'] == 'Mobile') & (df['network_type'] == '3G')
        df.loc[bad_conn, 'payment_failures'] += np.random.poisson(lam=1, size=bad_conn.sum())
        
        # Gestures (Adding missing mouse metrics required down pipeline)
        df['rapid_scroll_count'] = np.random.poisson(lam=2, size=n)
        df['zoomed_images_count'] = np.random.poisson(lam=1, size=n)
        is_qual = df['persona'] == "Quality Conscious"
        df.loc[is_qual, 'zoomed_images_count'] += np.random.poisson(lam=3, size=is_qual.sum())
        
        df['mouse_speed'] = np.random.lognormal(mean=2, sigma=0.5, size=n)
        is_bot = df.get('is_bot', np.zeros(n, dtype=bool))
        df.loc[is_bot, 'mouse_speed'] = 999.9
        
        df['idle_time_seconds'] = df['session_duration_seconds'] * np.random.uniform(0, 0.5, size=n)
        
        return df
