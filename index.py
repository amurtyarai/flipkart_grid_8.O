"""index.py — Unified Project Entrypoint and Orchestrator

This script coordinates all pipeline setup phases and boots the FastAPI service.
Running this single file performs:

    1. Schema & Data Verification: Verifies synthetic data exists (or alerts to generate it).
    2. Model Check: Verifies XGBoost JSON models exist (or trains them).
    3. Knowledge Base Check: Verifies vector documents exist (or generates them).
    4. Database Indexing Check: Initializes ChromaDB vector collections.
    5. Web Service Boot: Starts the FastAPI uvicorn application on port 8000.

Usage
-----
    python index.py
"""

from __future__ import annotations

import logging
import os
import subprocess
import sys
from pathlib import Path

# Project configuration
_PROJECT_ROOT = Path(__file__).resolve().parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.append(str(_PROJECT_ROOT))

from cart_abandonment_ml.api.app import app
from cart_abandonment_ml.config.config import config

logging.basicConfig(level=logging.INFO, format=config.LOG_FORMAT)
logger = logging.getLogger("flipkart.orchestrator")


def verify_data() -> bool:
    """Verify that the synthetic shopping session dataset exists."""
    if os.environ.get("VERCEL"):
        logger.info("Vercel environment detected: skipping local dataset generation.")
        return True

    parquet = Path(config.SYNTHETIC_PARQUET)
    csv = Path(config.SYNTHETIC_CSV)
    
    if not (parquet.is_file() or csv.is_file()):
        logger.warning("Synthetic dataset not found at expected paths.")
        logger.info("Generating 500k shopping sessions dataset...")
        try:
            subprocess.run([sys.executable, "generate_synthetic_data.py"], check=True)
            logger.info("Dataset generated successfully.")
        except subprocess.CalledProcessError as exc:
            logger.error("Data generation failed: %s", exc)
            return False
    else:
        logger.info("Synthetic dataset verified (exists at %s)", parquet if parquet.is_file() else csv)
    return True


def verify_models() -> bool:
    """Verify that XGBoost classifier and regressor JSON models exist."""
    model_dir = Path(config.MODEL_DIR)
    clf = model_dir / "classifier.json"
    reg = model_dir / "regressor.json"
    
    if not (clf.is_file() and reg.is_file()):
        if os.environ.get("VERCEL"):
            logger.warning("Trained XGBoost models not found in %s during Vercel boot.", model_dir)
            return True
        logger.warning("Trained XGBoost models not found in %s.", model_dir)
        logger.info("Executing training pipeline (this may take ~60-90 seconds)...")
        try:
            subprocess.run([sys.executable, "-m", "cart_abandonment_ml.training.train"], check=True)
            logger.info("Models trained and exported successfully.")
        except subprocess.CalledProcessError as exc:
            logger.error("Model training failed: %s", exc)
            return False
    else:
        logger.info("Model files verified (exist in %s)", model_dir)
    return True


def verify_knowledge_base() -> bool:
    """Verify that the vector knowledge base exists."""
    kb_path = _PROJECT_ROOT / "cart_abandonment_ml" / "knowledge" / "knowledge_base.json"
    
    if not kb_path.is_file():
        if os.environ.get("VERCEL"):
            logger.info("Vercel environment detected: using fallback knowledge base.")
            return True
        logger.warning("Knowledge base JSON not found at %s.", kb_path)
        logger.info("Generating 200 vector documents...")
        try:
            subprocess.run([sys.executable, "cart_abandonment_ml/knowledge/generate_kb.py"], check=True)
            logger.info("Knowledge base generated successfully.")
        except subprocess.CalledProcessError as exc:
            logger.error("Knowledge base generation failed: %s", exc)
            return False
    else:
        logger.info("Knowledge base verified (exists at %s)", kb_path)
    return True


def verify_retrieval_index() -> bool:
    """Verify ChromaDB database indexing is initialized."""
    logger.info("Verifying RAG retrieval index database...")
    try:
        from cart_abandonment_ml.retrieval.rag_retriever import RagRetriever
        retriever = RagRetriever()
        logger.info("RAG vector index database verified.")
        return True
    except Exception as exc:
        logger.warning("Failed to verify retrieval index: %s. Continuing with fallback retriever.", exc)
        return True


def start_api_server():
    """Start the FastAPI uvicorn server in the foreground."""
    logger.info("=" * 60)
    logger.info("STARTING FASTAPI BACKEND WEB SERVICE")
    logger.info("=" * 60)
    
    import uvicorn
    uvicorn.run(
        "cart_abandonment_ml.api.app:app",
        host="127.0.0.1",
        port=8000,
        reload=False
    )


def main():
    logger.info("=" * 60)
    logger.info("FLIPKART CART ABANDONMENT ORCHESTRATION BOOTSTRAP")
    logger.info("=" * 60)
    
    steps = [
        ("Verification: Synthetic Data", verify_data),
        ("Verification: XGBoost Models", verify_models),
        ("Verification: Knowledge Base", verify_knowledge_base),
        ("Verification: ChromaDB Index", verify_retrieval_index),
    ]
    
    for step_name, step_fn in steps:
        logger.info("Executing %s...", step_name)
        if not step_fn():
            logger.error("%s failed. Aborting orchestrator server boot.", step_name)
            sys.exit(1)
            
    logger.info("All pipeline dependencies verified. Booting FastAPI backend...")
    start_api_server()


if __name__ == "__main__":
    main()
