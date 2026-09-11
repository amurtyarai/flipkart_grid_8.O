import logging
import os
import sys

# Append parent dir for clean imports
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from cart_abandonment_ml.config.config import config
from cart_abandonment_ml.personas.persona_engine import PersonaEngine
from cart_abandonment_ml.generators.user_generator import UserGenerator
from cart_abandonment_ml.generators.purchase_history_generator import PurchaseHistoryGenerator
from cart_abandonment_ml.generators.session_generator import SessionGenerator
from cart_abandonment_ml.generators.cart_generator import CartGenerator
from cart_abandonment_ml.generators.pricing_generator import PricingGenerator
from cart_abandonment_ml.generators.delivery_generator import DeliveryGenerator
from cart_abandonment_ml.generators.payment_generator import PaymentGenerator
from cart_abandonment_ml.generators.psychology_generator import PsychologyGenerator
from cart_abandonment_ml.generators.embedding_generator import EmbeddingGenerator
from cart_abandonment_ml.label.abandonment_label import AbandonmentLabelGenerator
from cart_abandonment_ml.utils.random_utils import inject_missing_values

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SyntheticDataPipeline:
    """Orchestrates the entire Synthetic Data Generation process."""
    
    def __init__(self):
        self.generators = [
            UserGenerator(),
            PurchaseHistoryGenerator(),
            SessionGenerator(),
            CartGenerator(),
            PricingGenerator(),
            DeliveryGenerator(),
            PaymentGenerator(),
            PsychologyGenerator(),
            EmbeddingGenerator()
        ]
        self.label_generator = AbandonmentLabelGenerator()
        self.persona_engine = PersonaEngine(config.N_SESSIONS, config.PERSONAS, config.PERSONA_PROBABILITIES)

    def run(self):
        logger.info(f"Starting pipeline generation for {config.N_SESSIONS} sessions...")
        
        # 1. Base Setup
        df = self.persona_engine.generate()
        logger.info("Initialized Base Personas.")
        
        # 2. Sequential Generation
        for gen in self.generators:
            name = gen.__class__.__name__
            logger.info(f"Running {name}...")
            df = gen.generate(df)
            
        # 3. Label Generation
        logger.info("Running Label Generation & Simulation...")
        df = self.label_generator.generate(df)
        
        # 4. Missing Values Injection
        logger.info("Injecting Structural Missing Values...")
        
        # MNAR: Age
        age_mask = df['user_age'] > 50
        df = inject_missing_values(df, 'user_age', mask=age_mask, prob=0.3)
        df = inject_missing_values(df, 'user_age', mask=~age_mask, prob=0.05)
        
        # MAR: Mouse speed on mobile
        mobile_mask = df['device_type'].isin(['Mobile', 'Tablet'])
        df = inject_missing_values(df, 'mouse_speed', mask=mobile_mask, prob=1.0) # Always missing on touch
        
        # MCAR: Location Tier
        df = inject_missing_values(df, 'location_tier', prob=config.MISSING_RATES['location_tier'])
        
        # 5. Memory Optimization & Export
        logger.info("Optimizing Memory...")
        for col in df.select_dtypes(include=['float64']).columns:
            df[col] = df[col].astype('float32')
            
        os.makedirs(config.OUTPUT_DIR, exist_ok=True)
        csv_path = os.path.join(config.OUTPUT_DIR, config.CSV_FILENAME)
        parquet_path = os.path.join(config.OUTPUT_DIR, config.PARQUET_FILENAME)
        
        logger.info(f"Exporting Parquet to {parquet_path}")
        df.to_parquet(parquet_path, index=False)
        
        logger.info(f"Exporting CSV to {csv_path} (This might take a while...)")
        df.to_csv(csv_path, index=False)
        
        logger.info(f"Pipeline Complete! Final dataset shape: {df.shape}")
        logger.info(f"Final Cart Abandonment Rate: {df['cart_abandoned'].mean():.2%}")

if __name__ == "__main__":
    import numpy as np
    np.random.seed(config.RANDOM_SEED)
    
    pipeline = SyntheticDataPipeline()
    pipeline.run()
