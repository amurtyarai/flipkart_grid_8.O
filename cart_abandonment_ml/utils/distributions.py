import numpy as np

def generate_bounded_normal(mean: float, std_dev: float, size: int, lower: float = None, upper: float = None) -> np.ndarray:
    """Generate normal distribution values clipped within bounds."""
    vals = np.random.normal(mean, std_dev, size)
    if lower is not None or upper is not None:
        vals = np.clip(vals, lower, upper)
    return vals

def generate_lognormal(mean: float, sigma: float, size: int) -> np.ndarray:
    """Generate lognormal values (e.g. for time/money)."""
    return np.random.lognormal(mean, sigma, size)

def generate_pareto_outliers(alpha: float, multiplier: float, size: int) -> np.ndarray:
    """Generate extreme right-tail outliers using a Pareto distribution."""
    return (np.random.pareto(alpha, size) + 1) * multiplier
