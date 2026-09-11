import pandas as pd
from abc import ABC, abstractmethod

class BaseGenerator(ABC):
    """Abstract base class for all feature generators."""
    
    @abstractmethod
    def generate(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Takes the current DataFrame, generates new specific features via 
        vectorized NumPy/Pandas operations, and returns the mutated DataFrame.
        """
        pass
