import pandas as pd
import numpy as np
from typing import List

class PersonaEngine:
    """
    Generates base DataFrame, assigns primary keys, and distributes Personas.
    Acts as the root generative node in the pipeline.
    """
    
    def __init__(self, num_sessions: int, personas: List[str], probabilities: List[float]):
        self.n = num_sessions
        self.personas = list(personas)
        self.probs = list(probabilities)

    def generate(self) -> pd.DataFrame:
        """Initialize the dataframe with personas."""
        df = pd.DataFrame()
        
        from ..utils.random_utils import generate_uuids
        df['session_id'] = generate_uuids(self.n)
        
        # Fast user ID generation using random integers
        df['user_id'] = [f"U{i}" for i in np.random.randint(10000, 999999, size=self.n)]
        
        # Assign Personas (Mixture distributions root)
        df['persona'] = np.random.choice(self.personas, size=self.n, p=self.probs)
        
        # Initialize Bot traffic flag early for downstream rules
        from ..config.config import config
        df['is_bot'] = np.random.rand(self.n) < config.BOT_TRAFFIC_RATE
        
        return df
