"""rag_retriever.py — Production-Grade RAG Retrieval Layer using ChromaDB

Architecture
------------
This module acts as the semantic retrieval layer for Flipkart's Cart Abandonment
Recommendation System. It manages the indexing of the 200-document knowledge base
in ChromaDB and exposes a semantic search interface for retrieval.

Key Design Decisions
--------------------
* **ChromaDB indexing**: Uses a local, persistent SQLite-based ChromaDB collection
  under ``models/chroma_db/``.
* **Embedding Function**: Uses ChromaDB's default embedding function
  (based on ONNX all-MiniLM-L6-v2) for low-latency, CPU-optimized vector generation
  without requiring PyTorch/sentence-transformers.
* **Hybrid Retrieval (Metadata + Semantic)**: Filters by `root_cause` metadata
  first, then performs semantic similarity matching on `session_context`.
* **Robust Fallback Engine**: If ChromaDB fails to load or ONNX runtime crashes,
  the retriever falls back to a clean Jaccard token-overlap similarity calculation
  to prevent pipeline blockages.

Usage
-----
    from cart_abandonment_ml.retrieval.rag_retriever import RagRetriever

    retriever = RagRetriever()
    result = retriever.retrieve_interventions(
        root_cause="Price Sensitive",
        session_context="Premium user browsing high-value Electronics with competitor comparisons"
    )
    print(result["interventions"])  # list of top 5 interventions
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

from cart_abandonment_ml.config.config import Config, config as default_config

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Optional ChromaDB import — graceful fallback if installation fails
# ---------------------------------------------------------------------------
try:
    import chromadb
    from chromadb.utils import embedding_functions
    _CHROMADB_AVAILABLE = True
except ImportError:
    _CHROMADB_AVAILABLE = False
    logger.warning("ChromaDB not available — falling back to keyword-based retrieval.")


# ===========================================================================
# Structured Output Schema
# ===========================================================================

@dataclass
class RetrievedIntervention:
    """A single retrieved intervention with score."""
    document_id: str
    recommended_intervention: str
    business_cost: str
    success_rate: float
    risk_level: str
    similarity_score: float
    explanation: str


@dataclass
class RetrievalResult:
    """Structured output returned by the retrieve_interventions API."""
    query_root_cause: str
    query_context: str
    interventions: List[RetrievedIntervention]
    source: str  # "chromadb" or "fallback_keyword"
    latency_ms: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "query_root_cause": self.query_root_cause,
            "query_context": self.query_context,
            "interventions": [asdict(i) for i in self.interventions],
            "source": self.source,
            "latency_ms": self.latency_ms,
        }


# ===========================================================================
# Fallback Retrieval Engine (Jaccard similarity on tokens)
# ===========================================================================

class KeywordFallbackRetriever:
    """Graceful fallback that matches query tokens against KB document fields.

    Calculates a hybrid Jaccard score based on word overlaps in behavior_pattern
    and explanations.
    """

    def __init__(self, kb_path: Path) -> None:
        self._kb_path = kb_path
        self._docs = self._load_kb()

    def _load_kb(self) -> List[Dict[str, Any]]:
        try:
            if self._kb_path.is_file():
                return json.loads(self._kb_path.read_text())
        except Exception as exc:
            logger.error("Failed to load KB JSON for fallback: %s", exc)
        return []

    def retrieve(
        self, root_cause: str, session_context: str, top_k: int = 5
    ) -> List[RetrievedIntervention]:
        # Filter by root cause
        filtered = [d for d in self._docs if d.get("root_cause") == root_cause]
        if not filtered:
            # Fallback to all docs if no root cause matched
            filtered = self._docs

        # Normalise and tokenize query
        query_words = set(session_context.lower().split())

        scored_docs = []
        for doc in filtered:
            doc_text = (
                f"{doc.get('behavior_pattern', '')} {doc.get('explanation', '')}"
            ).lower()
            doc_words = set(doc_text.split())

            intersection = query_words.intersection(doc_words)
            union = query_words.union(doc_words)
            jaccard = len(intersection) / len(union) if union else 0.0

            scored_docs.append((jaccard, doc))

        # Sort descending by score
        scored_docs.sort(key=lambda x: x[0], reverse=True)

        results = []
        for score, doc in scored_docs[:top_k]:
            results.append(
                RetrievedIntervention(
                    document_id=doc.get("document_id", "UNKNOWN"),
                    recommended_intervention=doc.get("recommended_intervention", ""),
                    business_cost=doc.get("business_cost", ""),
                    success_rate=float(doc.get("success_rate", 0.0)),
                    risk_level=doc.get("risk_level", ""),
                    # Fallback scores scaled to look like cosine distances
                    similarity_score=round(0.5 + score * 0.5, 4),
                    explanation=doc.get("explanation", ""),
                )
            )
        return results


# ===========================================================================
# RAG Retriever
# ===========================================================================

class RagRetriever:
    """Vector search RAG retriever for Flipkart Cart Abandonment recommendations.

    Manages persistent ChromaDB vector index and queries. Handles local caching.

    Parameters
    ----------
    cfg : Config, optional
        Configuration object.
    """

    def __init__(self, cfg: Optional[Config] = None) -> None:
        self._cfg = cfg or default_config
        self._db_path = Path(self._cfg.MODEL_DIR) / "chroma_db"
        self._kb_path = Path(self._cfg.OUTPUT_DIR).parent / "cart_abandonment_ml" / "knowledge" / "knowledge_base.json"

        # Initialize fallback retriever in case ChromaDB setup fails
        self._fallback = KeywordFallbackRetriever(self._kb_path)
        self._client: Optional[chromadb.ClientAPI] = None
        self._collection: Optional[chromadb.Collection] = None

        if _CHROMADB_AVAILABLE:
            self._init_chromadb()
        else:
            logger.warning("Using keyword fallback engine for retrieval.")

    def _init_chromadb(self) -> None:
        """Initialize ChromaDB client and load/index KB if missing."""
        try:
            self._db_path.parent.mkdir(parents=True, exist_ok=True)
            # SQLite persistent client
            self._client = chromadb.PersistentClient(path=str(self._db_path))

            # Lightweight ONNX all-MiniLM-L6-v2 embedding model (Chroma default)
            emb_fn = embedding_functions.DefaultEmbeddingFunction()

            # Create or get collection
            self._collection = self._client.get_or_create_collection(
                name="cart_abandonment_interventions",
                embedding_function=emb_fn,
                metadata={"hnsw:space": "cosine"},
            )

            # Check if we need to index documents (only if empty)
            if self._collection.count() == 0:
                self._index_knowledge_base()

        except Exception as exc:
            logger.error("ChromaDB initialization failed: %s. Falling back to keyword engine.", exc)
            self._client = None
            self._collection = None

    def _index_knowledge_base(self) -> None:
        """Load documents from JSON and add them to the vector store."""
        if not self._kb_path.is_file():
            raise FileNotFoundError(
                f"Knowledge base JSON not found at {self._kb_path}. "
                "Run the KB generator first."
            )

        logger.info("Indexing knowledge base into ChromaDB at %s...", self._db_path)
        with open(self._kb_path) as f:
            docs = json.load(f)

        ids = []
        documents = []
        metadatas = []

        for doc in docs:
            ids.append(doc["document_id"])
            # Index the text behavior pattern for semantic matching
            documents.append(doc["behavior_pattern"])
            # Metadata for filtering and details retrieval
            metadatas.append({
                "root_cause": doc["root_cause"],
                "recommended_intervention": doc["recommended_intervention"],
                "business_cost": doc["business_cost"],
                "success_rate": doc["success_rate"],
                "risk_level": doc["risk_level"],
                "alternative_intervention": doc["alternative_intervention"],
                "explanation": doc["explanation"],
            })

        # Add to ChromaDB in batches
        batch_size = 100
        for i in range(0, len(ids), batch_size):
            self._collection.add(
                ids=ids[i : i + batch_size],
                documents=documents[i : i + batch_size],
                metadatas=metadatas[i : i + batch_size],
            )
        logger.info("Indexed %d documents successfully.", self._collection.count())

    def retrieve_interventions(
        self, root_cause: str, session_context: str, top_k: int = 5
    ) -> RetrievalResult:
        """Find the top-5 relevant interventions based on root cause and context.

        Parameters
        ----------
        root_cause : str
            Allowed root cause (Price Sensitive, Technical Problem, etc.).
        session_context : str
            Query string containing SHAP values, session description, or features.
        top_k : int, default 5
            Number of recommendations to retrieve.

        Returns
        -------
        RetrievalResult
            Top-5 matched interventions with similarity scores and explanations.
        """
        t0 = time.perf_counter()

        # Fallback path if ChromaDB setup failed
        if self._collection is None:
            fallback_res = self._fallback.retrieve(root_cause, session_context, top_k)
            latency_ms = (time.perf_counter() - t0) * 1000
            return RetrievalResult(
                query_root_cause=root_cause,
                query_context=session_context,
                interventions=fallback_res,
                source="fallback_keyword",
                latency_ms=round(latency_ms, 2),
            )

        # ChromaDB path
        try:
            # Query with metadata filter matching root cause and semantic search query
            results = self._collection.query(
                query_texts=[session_context],
                n_results=top_k,
                where={"root_cause": root_cause},
            )

            retrieved = []
            if results and results["ids"] and results["ids"][0]:
                ids = results["ids"][0]
                metadatas = results["metadatas"][0]
                # Cosine distance in ChromaDB: smaller distance = more similar
                # We convert distance to similarity score = 1.0 - distance
                distances = results["distances"][0] if results["distances"] else [0.0] * len(ids)

                for doc_id, meta, dist in zip(ids, metadatas, distances):
                    similarity = round(1.0 - max(0.0, min(1.0, float(dist))), 4)
                    retrieved.append(
                        RetrievedIntervention(
                            document_id=doc_id,
                            recommended_intervention=str(meta.get("recommended_intervention", "")),
                            business_cost=str(meta.get("business_cost", "")),
                            success_rate=float(meta.get("success_rate", 0.0)),
                            risk_level=str(meta.get("risk_level", "")),
                            similarity_score=similarity,
                            explanation=str(meta.get("explanation", "")),
                        )
                    )

            latency_ms = (time.perf_counter() - t0) * 1000
            return RetrievalResult(
                query_root_cause=root_cause,
                query_context=session_context,
                interventions=retrieved,
                source="chromadb",
                latency_ms=round(latency_ms, 2),
            )

        except Exception as exc:
            logger.error("ChromaDB query failed: %s. Trying fallback.", exc)
            fallback_res = self._fallback.retrieve(root_cause, session_context, top_k)
            latency_ms = (time.perf_counter() - t0) * 1000
            return RetrievalResult(
                query_root_cause=root_cause,
                query_context=session_context,
                interventions=fallback_res,
                source="fallback_keyword",
                latency_ms=round(latency_ms, 2),
            )


# ===========================================================================
# CLI Demo / test run
# ===========================================================================

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format=default_config.LOG_FORMAT)

    retriever = RagRetriever()

    # Query 1: Price Sensitive shopping scenario
    cause_1 = "Price Sensitive"
    context_1 = "Premium plus user comparing electronics items with competitor checks on mobile web"
    print("\n" + "=" * 60)
    print("QUERY 1: PRICE SENSITIVE ABANDONMENT")
    print(f"Context: {context_1}")
    print("=" * 60)
    res_1 = retriever.retrieve_interventions(cause_1, context_1)
    print(json.dumps(res_1.to_dict(), indent=2))

    # Query 2: Payment Friction shopping scenario
    cause_2 = "Payment Friction"
    context_2 = "OTP timeout and bank gateway failure during mobile app transaction checkout restarts"
    print("\n" + "=" * 60)
    print("QUERY 2: PAYMENT FRICTION ABANDONMENT")
    print(f"Context: {context_2}")
    print("=" * 60)
    res_2 = retriever.retrieve_interventions(cause_2, context_2)
    print(json.dumps(res_2.to_dict(), indent=2))
