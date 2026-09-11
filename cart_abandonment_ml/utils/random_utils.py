import numpy as np
import pandas as pd
import uuid

def generate_uuids(size: int) -> list:
    """Generate unique session IDs quickly."""
    return [str(uuid.uuid4()) for _ in range(size)]

def inject_missing_values(df: pd.DataFrame, column: str, mask: np.ndarray = None, prob: float = 0.1) -> pd.DataFrame:
    """
    Inject missing values natively (np.nan) for XGBoost sparsity handling.
    If mask is provided, inject missing values only where mask is True (MAR/MNAR).
    If no mask, inject uniformly (MCAR).
    """
    n = len(df)
    if mask is None:
        drop_mask = np.random.rand(n) < prob
    else:
        # Scale probability so that it applies *only* to the masked group
        drop_mask = mask & (np.random.rand(n) < prob)
        
    df.loc[drop_mask, column] = np.nan
    return df
