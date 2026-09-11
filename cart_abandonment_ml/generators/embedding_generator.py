import pandas as pd
import numpy as np
from .base_generator import BaseGenerator

class EmbeddingGenerator(BaseGenerator):
    """Generates synthetic dense vector embeddings."""

    def generate(self, df: pd.DataFrame) -> pd.DataFrame:
        n = len(df)
        
        # Product Embeddings (16D)
        for i in range(1, 17):
            df[f'product_embedding_{i}'] = np.random.normal(0, 1, size=n).astype(np.float32)
            
        # Category Embeddings (8D)
        for i in range(1, 9):
            df[f'category_embedding_{i}'] = np.random.normal(0, 1, size=n).astype(np.float32)
            
        return df
