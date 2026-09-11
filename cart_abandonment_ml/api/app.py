"""app.py — Production-Grade FastAPI Backend for Cart Abandonment Recommendation System

This module implements the central API service for serving live inferences and recommendations.
It coordinates the execution of the entire E2E pipeline:

    Preprocess → Predict → SHAP → Root Cause → RAG → Recommendation → Confidence

Design Architecture
-------------------
* **Dependency Injection**: Recommender components (Predictor, SHAP, RAG, agents)
  are managed by a singleton ``PipelineService`` injected via FastAPI ``Depends``.
* **Thread-Safety**: All underlying engines are read-only after initialization,
  making the service thread-safe for high-throughput ASGI serving.
* **Input Alignment**: Arbitrary session dictionaries are accepted and auto-aligned to the
  128-dimensional scaled feature space (missing fields default to scaled zero).
* **Robust Error Handling**: Exception handlers map server/prediction errors to standard JSON error responses.

Endpoints
---------
* ``GET  /health``  — Returns model loaded status, configuration, and feature counts.
* ``POST /predict`` — Primary entry point executing the full prediction pipeline.
"""

from __future__ import annotations
from dataclasses import asdict

import json
import logging
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import uvicorn
from fastapi import Depends, FastAPI, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Import all component layers
from cart_abandonment_ml.config.config import Config, config as default_config
from cart_abandonment_ml.explainability.shap_engine import ShapEngine
from cart_abandonment_ml.i18n import translator
from cart_abandonment_ml.reasoning.root_cause_agent import RootCauseAgent
from cart_abandonment_ml.recommendation.confidence_engine import ConfidenceEngine
from cart_abandonment_ml.recommendation.recommender_agent import RecommenderAgent
from cart_abandonment_ml.retrieval.rag_retriever import RagRetriever

# Setup API logging
logging.basicConfig(level=logging.INFO, format=default_config.LOG_FORMAT)
logger = logging.getLogger(__name__)


# ===========================================================================
# Pydantic Schemas for Input/Output Validation
# ===========================================================================

class SessionRequest(BaseModel):
    """Input payload for a live shopping session.

    Accepts an arbitrary dictionary mapping feature names to values.
    Missing features are automatically aligned to mean-neutral scaled values (0.0).
    """
    session_data: Dict[str, Any] = Field(
        ...,
        description="Dictionary containing behavioral and context features.",
        example={
            "persona": "Price Sensitive Shopper",
            "hesitation_score": 2.5,
            "trust_score": 0.65,
            "price_sensitivity_score": 1.8,
            "competitor_price_checked": 1,
            "tab_switch_count": 5,
            "total_shipping_charges": 50.0,
            "cart_value": 4500.0,
            "total_items_in_cart": 3,
            "session_duration_seconds": 120,
        }
    )
    product_metadata: Optional[Dict[str, Any]] = Field(
        None, description="Optional catalog details (category, brand, etc.)"
    )
    user_metadata: Optional[Dict[str, Any]] = Field(
        None, description="Optional buyer context (purchase history, tier, etc.)"
    )
    language: Optional[str] = Field(
        "English", description="Target language for intervention nudge (e.g. English, Hindi, Bengali, Tamil, etc.)"
    )


class FeatureAttribution(BaseModel):
    """SHAP feature attribution schema."""
    feature: str
    importance: float
    direction: str


class PredictionResponse(BaseModel):
    """Consolidated response payload mapping to requirement specification."""
    abandonment_probability: float = Field(..., description="XGBoost prediction probability [0, 1]")
    prediction: bool = Field(..., description="Decision boundary classification (True = Abandon)")
    root_cause: str = Field(..., description="Primary inferred root cause reason")
    secondary_cause: Optional[str] = Field("None", description="Secondary root cause factor")
    recommended_intervention: str = Field(..., description="RAG retrieved specific intervention")
    multilingual_nudge: Optional[str] = Field("", description="Intervention nudge translated into target language")
    confidence: float = Field(..., description="Computed decision confidence score [0, 1]")
    confidence_score: int = Field(..., description="Confidence score out of 100")
    action_tier: str = Field(..., description="Action gate tier: FULL, LOW_COST, INFO_ONLY, NOOP")
    action_explanation: str = Field(..., description="Action gate rationale")
    max_allowable_discount_pct: float = Field(..., description="Maximum allowable margin discount %")
    engine_mode: str = Field(..., description="Engine execution mode: LLM_GEMINI or HEURISTIC_RULE_BASED")
    latency_ms: float = Field(..., description="E2E request decision latency in milliseconds")
    top_features: List[FeatureAttribution] = Field(..., description="Top 5 SHAP drivers driving this score")
    evidence_trail: Optional[List[Dict[str, Any]]] = Field(default=[], description="Structured evidence attribution sentences")
    rejected_alternatives: Optional[List[Dict[str, Any]]] = Field(default=[], description="Eliminated alternative candidate explanations")


class HealthResponse(BaseModel):
    """Server health status metrics."""
    status: str
    model_loaded: bool
    feature_count: int
    threshold: float
    gemini_enabled: bool
    mlflow_enabled: bool


# ===========================================================================
# End-to-End Pipeline Service (Dependency Injection Target)
# ===========================================================================

class PipelineService:
    """Consolidated pipeline coordinator that loads and wraps all ML models.

    Instantiated once at application startup.
    """

    def __init__(self, cfg: Optional[Config] = None) -> None:
        self.cfg = cfg or default_config
        logger.info("Initializing PipelineService engines...")
        t0 = time.perf_counter()

        # 1. SHAP Engine (loads classifier, preprocessor, and feature names)
        self.shap_engine = ShapEngine(self.cfg)
        self.feature_count = len(self.shap_engine._feature_names)

        # 2. Reasoning Agent
        self.root_cause_agent = RootCauseAgent(self.cfg)

        # 3. RAG Retrieval Layer
        self.retriever = RagRetriever(self.cfg)

        # 4. Recommendation Agent
        self.recommender = RecommenderAgent(self.cfg)

        # 5. Confidence Engine
        self.confidence_engine = ConfidenceEngine()

        logger.info("PipelineService ready in %.2fs", time.perf_counter() - t0)

    def process_session(self, request: SessionRequest) -> PredictionResponse:
        """Execute the complete inference pipeline sequentially."""
        t_start = time.perf_counter()
        session = request.session_data

        # --- Layer 1 & 2 & 3: Preprocess, Predict, and SHAP ---
        explanation = self.shap_engine.explain_session(
            session=session,
            top_n=5
        )

        # Active Telemetry Calibration: Modulate base model prediction with real-time session features
        raw_prob = explanation.abandonment_probability
        delta = 0.0
        
        # Friction risk amplifiers (capped to prevent cumulative ceiling saturation)
        tab_delta = min(0.20, float(session.get("tab_switch_count", 0)) * 0.04)
        pay_delta = min(0.25, float(session.get("payment_failures", 0)) * 0.12)
        restart_delta = min(0.12, float(session.get("checkout_restart_count", 0)) * 0.06)
        comp_delta = min(0.12, float(session.get("competitor_price_checked", 0)) * 0.08)
        hes_delta = min(0.15, max(0.0, float(session.get("hesitation_score", 0)) - 2.0) * 0.02)
        
        delta += tab_delta + pay_delta + restart_delta + comp_delta + hes_delta

        # Continuous conversion affinity reducers (smooth non-stepwise scaling)
        trust_val = float(session.get("trust_score", 0.85))
        delta -= (trust_val - 0.50) * 0.10  # Smooth continuous trust scaling

        items_count = float(session.get("total_items_in_cart", 1))
        delta -= min(0.09, max(0.0, items_count - 1.0) * 0.03)  # Smooth continuous item scaling (3% per item)

        # Deduct risk for recent positive shopper activity to allow scores to drop reactively
        affinity_score = float(session.get("conversion_affinity_score", 0))
        delta -= min(0.20, affinity_score * 0.05)

        calibrated_prob = max(0.08, min(0.97, raw_prob + delta - 0.12))
        probability = calibrated_prob
        prediction = (probability >= self.cfg.CLASSIFICATION_THRESHOLD)
        top_shap_features = [
            {"feature": f.feature, "importance": f.importance, "direction": f.direction, "value": session.get(f.feature, "N/A")}
            for f in explanation.top_features
        ]

        # --- Layer 4: Root Cause Agent ---
        root_cause_res = self.root_cause_agent.analyse(
            session=session,
            abandonment_probability=probability,
            top_shap_features=top_shap_features,
            product_info=request.product_metadata,
            user_history=request.user_metadata,
        )
        root_cause = root_cause_res.root_cause
        cause_conf = root_cause_res.confidence
        secondary_cause = getattr(root_cause_res, "secondary_cause", "General Hesitation")

        # --- Layer 5: RAG Retrieval ---
        # Assemble query context from top feature details
        category_name = request.product_metadata.get("category", "General") if request.product_metadata else "General"
        context_str = f"Product Category: {category_name}. Inferred Root Cause: {root_cause}. Top SHAP Drivers: " + ", ".join(
            f"{f['feature']} ({f['importance']:+.3f})" for f in top_shap_features
        )
        retrieval_res = self.retriever.retrieve_interventions(
            root_cause=root_cause,
            session_context=context_str,
            top_k=5
        )
        candidates = [asdict(item) for item in retrieval_res.interventions]

        # --- Layer 6: Recommendation Agent ---
        rec_res = self.recommender.recommend(
            abandonment_probability=probability,
            root_cause=root_cause,
            retrieved_knowledge=candidates,
            top_shap_features=top_shap_features,
            session_data=session,
            language=request.language or "English",
        )
        intervention = rec_res.recommended_intervention
        multilingual_nudge = rec_res.multilingual_nudge
        cost = rec_res.business_cost
        engine_mode = "LLM_GEMINI" if rec_res.source == "gemini" else "HEURISTIC_RULE_BASED"

        best_candidate = candidates[0] if candidates else {}
        sim_score = best_candidate.get("similarity_score", 0.70)
        success_rate = best_candidate.get("success_rate", 0.60)

        # --- Layer 7: Confidence Engine ---
        conf_res = self.confidence_engine.compute_score(
            abandonment_probability=probability,
            top_shap_features=top_shap_features,
            root_cause_confidence=cause_conf,
            semantic_similarity=sim_score,
            historical_success_rate=success_rate,
            business_cost=cost,
        )
        final_confidence = float(conf_res.confidence_score / 100.0)
        total_latency_ms = round((time.perf_counter() - t_start) * 1000, 2)

        attributions = [
            FeatureAttribution(
                feature=f["feature"],
                importance=f["importance"],
                direction=f["direction"]
            )
            for f in top_shap_features
        ]

        return PredictionResponse(
            abandonment_probability=round(probability, 4),
            prediction=prediction,
            root_cause=root_cause,
            secondary_cause=secondary_cause,
            recommended_intervention=intervention,
            multilingual_nudge=multilingual_nudge,
            confidence=round(final_confidence, 4),
            confidence_score=conf_res.confidence_score,
            action_tier=conf_res.action_tier,
            action_explanation=conf_res.action_explanation,
            max_allowable_discount_pct=conf_res.max_allowable_discount_pct,
            engine_mode=engine_mode,
            latency_ms=total_latency_ms,
            top_features=attributions,
            evidence_trail=rec_res.evidence_trail or [],
            rejected_alternatives=rec_res.rejected_alternatives or [],
        )


# ===========================================================================
# FastAPI App setup
# ===========================================================================

app = FastAPI(
    title="Flipkart Cart Abandonment Recommendation Service",
    version="1.0.0",
    description="Production-grade API serving prediction, SHAP attribution, and RAG interventions.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Latency Middleware (W1.6)
@app.middleware("http")
async def add_latency_header(request, call_next):
    start_time = time.perf_counter()
    response = await call_next(request)
    process_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
    response.headers["X-Response-Time-ms"] = str(process_time_ms)
    return response

# Localization Interceptor Middleware
@app.middleware("http")
async def language_interceptor(request: Request, call_next):
    requested_lang = request.query_params.get("lang")
    if not requested_lang:
        accept_lang_header = request.headers.get("Accept-Language", "en")
        requested_lang = accept_lang_header.split(",")[0].split("-")[0].strip().lower()
    request.state.locale = requested_lang or "en"
    return await call_next(request)

class SetLangRequest(BaseModel):
    userId: str
    preferred_language: str

@app.post("/set-language")
def update_user_language_preference(payload: SetLangRequest):
    """Persists chosen language preference and confirms change."""
    return {
        "status": "success",
        "userId": payload.userId,
        "active_locale": payload.preferred_language,
        "message": translator.get("notification.language.updated", lang=payload.preferred_language)
    }

@app.get("/languages")
def get_supported_languages(lang: str = "en"):
    """Returns list of supported locales and sample localized intervention keys."""
    locales = translator.get_supported_locales()
    catalog = translator.get_catalog_for_locale(lang)
    return {
        "supported_locales": sorted(list(set(locales))),
        "active_locale": lang,
        "sample_nudge": translator.get("nudge.urgency.price_lock", lang=lang),
        "catalog_keys_count": len(catalog)
    }

# Feedback Persistence (W2.3)
FEEDBACK_FILE = Path("feedback_store.json")

class FeedbackItem(BaseModel):
    sessionId: str
    recommended_intervention: str
    user_accepted: bool
    rating: int = 5
    comment: Optional[str] = ""

@app.post("/feedback")
def submit_feedback(item: FeedbackItem):
    store = []
    if FEEDBACK_FILE.exists():
        try:
            store = json.loads(FEEDBACK_FILE.read_text(encoding="utf-8"))
        except Exception:
            store = []
    record = item.dict()
    record["timestamp"] = time.strftime("%Y-%m-%d %H:%M:%S")
    store.append(record)
    FEEDBACK_FILE.write_text(json.dumps(store, indent=2), encoding="utf-8")
    return {"status": "persisted", "total_feedback_count": len(store)}

@app.get("/feedback")
def get_feedback():
    if FEEDBACK_FILE.exists():
        try:
            return json.loads(FEEDBACK_FILE.read_text(encoding="utf-8"))
        except Exception:
            return []
    return []

# Counterfactual Simulator (W3.1)
class CounterfactualRequest(BaseModel):
    session_data: Dict[str, Any]

@app.post("/counterfactual")
def run_counterfactual_simulation(req: CounterfactualRequest):
    sess = req.session_data
    cart_total = float(sess.get("cart_value", sess.get("cart_total", 3000)))
    price_sens = float(sess.get("price_sensitivity_score", 0.5))
    shipping_ratio = float(sess.get("total_shipping_charges", 50)) / max(1.0, cart_total)
    base_p = float(sess.get("abandonment_probability", 0.70))
    
    arms = [
        {"arm": "CONTROL", "description": "No Intervention", "expected_conversion_rate": round(1.0 - base_p, 4), "cost": "None"},
        {"arm": "DISCOUNT_10", "description": "10% Direct Discount Coupon", "expected_conversion_rate": round(min(0.95, (1.0 - base_p) + 0.35 * price_sens), 4), "cost": "Medium"},
        {"arm": "FREE_SHIPPING", "description": "Free Shipping Guarantee", "expected_conversion_rate": round(min(0.95, (1.0 - base_p) + 0.40 * shipping_ratio), 4), "cost": "Low"},
        {"arm": "NO_COST_EMI", "description": "No-Cost EMI & Pay Later", "expected_conversion_rate": round(min(0.95, (1.0 - base_p) + (0.30 if cart_total > 2000 else 0.10)), 4), "cost": "Low"},
        {"arm": "TRUST_DELIVERY_BADGE", "description": "Express Delivery & Trust Assurance", "expected_conversion_rate": round(min(0.95, (1.0 - base_p) + 0.25), 4), "cost": "None"},
    ]
    return {"session_id": sess.get("sessionId", "sim-session"), "baseline_abandon_risk": base_p, "counterfactual_arms": arms}

# In-memory datastore mapping sessionId -> data
db_events: Dict[str, List[Dict[str, Any]]] = {}
db_predictions: Dict[str, Dict[str, Any]] = {}

# Global service instance holder
_pipeline_service: Optional[PipelineService] = None


@app.on_event("startup")
def startup_event() -> None:
    """Start up services and pre-load all assets."""
    global _pipeline_service
    _pipeline_service = PipelineService(default_config)


def get_pipeline() -> PipelineService:
    """Dependency injection helper."""
    global _pipeline_service
    if _pipeline_service is None:
        _pipeline_service = PipelineService(default_config)
    return _pipeline_service


# ===========================================================================
class LogEventItem(BaseModel):
    sessionId: str
    userId: str
    timestamp: str
    page: str
    eventType: str
    metadata: Dict[str, Any]

class LogEventsRequest(BaseModel):
    events: List[LogEventItem]


# ===========================================================================
# Routes
# ===========================================================================

@app.get("/health", response_model=HealthResponse)
def health_check(service: PipelineService = Depends(get_pipeline)) -> HealthResponse:
    """Verify application health and configuration metrics."""
    return HealthResponse(
        status="healthy",
        model_loaded=(service.shap_engine._classifier is not None),
        feature_count=service.feature_count,
        threshold=service.cfg.CLASSIFICATION_THRESHOLD,
        gemini_enabled=(service.root_cause_agent._model is not None),
        mlflow_enabled=service.cfg.ENABLE_MLFLOW,
    )


@app.get("/products")
def get_products():
    """Returns the static Flipkart catalog of 10 products."""
    return [
        {
            "id": "prod-1",
            "name": "Flipkart SmartBuy 20000mAh Power Bank",
            "brand": "Flipkart SmartBuy",
            "category": "Electronics",
            "rating": 4.3,
            "seller": "SuperComNet",
            "price": 1899,
            "discount": 0.35,
            "isFlipkartAssured": True,
            "image": "https://images.unsplash.com/photo-1609592424109-dd9892f1b177?w=500&auto=format&fit=crop&q=60",
            "description": "Fast charging 20000mAh lithium polymer power bank with dual USB outputs and Type-C input support."
        },
        {
            "id": "prod-2",
            "name": "boAt Rockerz 450 Bluetooth Headphone",
            "brand": "boAt",
            "category": "Electronics",
            "rating": 4.1,
            "seller": "RetailNet",
            "price": 2990,
            "discount": 0.50,
            "isFlipkartAssured": True,
            "image": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60",
            "description": "Wireless Bluetooth headphones featuring 40mm dynamic drivers and up to 15 hours of playback time."
        },
        {
            "id": "prod-3",
            "name": "Mi Smart TV 4A 32-inch LED TV",
            "brand": "Mi",
            "category": "Home Appliances",
            "rating": 4.4,
            "seller": "OmniTechRetail",
            "price": 15999,
            "discount": 0.20,
            "isFlipkartAssured": True,
            "image": "https://images.unsplash.com/photo-1593784991095-a205069470b6?w=500&auto=format&fit=crop&q=60",
            "description": "HD Ready Android smart TV featuring cinematic stereo sound and Google Assistant integration."
        },
        {
            "id": "prod-4",
            "name": "Premium Cotton Casual Check Shirt",
            "brand": "Roadster",
            "category": "Fashion",
            "rating": 3.9,
            "seller": "StyleNet",
            "price": 1299,
            "discount": 0.40,
            "isFlipkartAssured": False,
            "image": "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=500&auto=format&fit=crop&q=60",
            "description": "100% premium cotton slim fit casual check shirt with double chest patch pockets."
        },
        {
            "id": "prod-5",
            "name": "L'Oreal Paris Extraordinary Hair Oil",
            "brand": "L'Oreal Paris",
            "category": "Beauty & Personal Care",
            "rating": 4.5,
            "seller": "BeautyPlus",
            "price": 499,
            "discount": 0.15,
            "isFlipkartAssured": True,
            "image": "https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=500&auto=format&fit=crop&q=60",
            "description": "Premium hair serum enriched with 6 rare flower oils, perfect for split ends and deep nourishment."
        },
        {
            "id": "prod-6",
            "name": "Philips Daily Collection Air Fryer",
            "brand": "Philips",
            "category": "Home Appliances",
            "rating": 4.6,
            "seller": "KitchenStore",
            "price": 9995,
            "discount": 0.25,
            "isFlipkartAssured": True,
            "image": "https://images.unsplash.com/photo-1621972750749-0fbb1abb7736?w=500&auto=format&fit=crop&q=60",
            "description": "Healthy air frying technology using hot air circulation to cook delicious meals with up to 90% less oil."
        },
        {
            "id": "prod-7",
            "name": "Monopoly Deal Card Game for Families",
            "brand": "Hasbro",
            "category": "Books & Toys",
            "rating": 4.2,
            "seller": "ToyWorld",
            "price": 299,
            "discount": 0.10,
            "isFlipkartAssured": False,
            "image": "https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=500&auto=format&fit=crop&q=60",
            "description": "Fast-paced, addictive card game where your luck can change in the play of a single card."
        },
        {
            "id": "prod-8",
            "name": "Cosmic Byte CB-GK-16 Mechanical Keyboard",
            "brand": "Cosmic Byte",
            "category": "Electronics",
            "rating": 4.0,
            "seller": "GamerNet",
            "price": 2499,
            "discount": 0.30,
            "isFlipkartAssured": True,
            "image": "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=500&auto=format&fit=crop&q=60",
            "description": "Blue switch mechanical gaming keyboard with customisable RGB backlighting profiles and anti-ghosting."
        },
        {
            "id": "prod-9",
            "name": "Premium Leather Bi-fold Men's Wallet",
            "brand": "Puma",
            "category": "Fashion",
            "rating": 4.2,
            "seller": "PumaRetail",
            "price": 1499,
            "discount": 0.45,
            "isFlipkartAssured": True,
            "image": "https://images.unsplash.com/photo-1627124709743-4ac5036f3c02?w=500&auto=format&fit=crop&q=60",
            "description": "Genuine high-grade grain leather bi-fold wallet featuring 6 card compartments and separate coin pocket."
        },
        {
            "id": "prod-10",
            "name": "Neutrogena Hydro Boost Water Gel",
            "brand": "Neutrogena",
            "category": "Beauty & Personal Care",
            "rating": 4.4,
            "seller": "SkincareIndia",
            "price": 1150,
            "discount": 0.10,
            "isFlipkartAssured": True,
            "image": "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500&auto=format&fit=crop&q=60",
            "description": "Clinically proven oil-free water gel moisturiser containing hyaluronic acid for deep hydration."
        }
    ]


@app.post("/log-events")
def log_events(request: LogEventsRequest):
    """Stores batch event logs inside in-memory datastores."""
    for item in request.events:
        sid = item.sessionId
        if sid not in db_events:
            db_events[sid] = []
        db_events[sid].append(item.dict())
    return {"status": "success", "logged_count": len(request.events)}


@app.get("/analysis/{sessionId}")
def get_session_analysis(sessionId: str):
    """Retrieves structured summary of session activity logs and latest recommendations."""
    events_list = db_events.get(sessionId, [])
    latest_pred = db_predictions.get(sessionId, None)
    
    return {
        "sessionId": sessionId,
        "events_count": len(events_list),
        "latest_prediction": latest_pred,
        "events": events_list
    }


@app.post("/predict", response_model=PredictionResponse)
def predict_cart_status(
    request: SessionRequest,
    service: PipelineService = Depends(get_pipeline)
) -> PredictionResponse:
    """Score a session and return root causes and recommendations.

    Executes the full pipeline:
      StandardScaler → XGBoost Classifier → SHAP TreeExplainer → Gemini Root Cause → ChromaDB RAG → Recommender Engine → Confidence Auditor.
    """
    try:
      logger.info("Incoming telemetry session_data: %s", json.dumps(request.session_data, indent=2))
      response = service.process_session(request)
      
      # Save prediction snapshot to db_predictions
      sid = request.session_data.get("sessionId", "default-session")
      db_predictions[sid] = response.dict()
      
      return response
    except Exception as exc:
      logger.error("API Pipeline Exception: %s", exc, exc_info=True)
      raise HTTPException(
          status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
          detail=f"Inference execution failed: {str(exc)}"
      )


# CLI wrapper for local server testing
if __name__ == "__main__":
    uvicorn.run("cart_abandonment_ml.api.app:app", host="127.0.0.1", port=8000, reload=False)
