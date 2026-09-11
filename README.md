# Flipkart Cart Abandonment ML & Multi-Agent RAG Platform

> **Flipkart Grid 7.0 Enterprise Solution**  
> An end-to-end Machine Learning, Explainable AI (SHAP), Multi-Agent RAG, and Statistical A/B Testing platform designed to predict, diagnose, and prevent e-commerce cart abandonment in real-time.

---

## ⚡ Quick Start

### 1. Boot Entire Platform (Orchestrator + Pre-flight + FastAPI)
```bash
# Install requirements (if not done)
pip install -r requirements.txt

# Boot project dependencies & API server
python index.py
```

### 2. Launch React Dashboard
```bash
cd frontend
npm install
npm run dev
```

### 3. Launch Streamlit Interactive UI
```bash
streamlit run app_ui.py
```

### 4. Run A/B Testing Simulations & Build Reports
```bash
python ab_testing.py
python system_agent_ab_testing.py
python build_ab_reports.py
```

---

## 📖 Complete Documentation

For the full, detailed technical architecture, 200-feature schema breakdown, 7-layer agent pipeline explanation, statistical formulas, API specifications, and benchmark metrics, please read:

👉 **[PROJECT_DOCUMENTATION.md](file:///c:/Users/Meet/Downloads/new%20flip/PROJECT_DOCUMENTATION.md)**

---

## 🏗️ 7-Layer System Architecture

1. **Layer 1: Feature Preprocessing & Alignment** — Normalizes 128-dimensional continuous and categorical behavioral features.
2. **Layer 2: XGBoost Classifier & Regressor** — Predicts abandonment probability $P(\text{Abandon})$ and expected recovery value.
3. **Layer 3: SHAP Explainability Engine** — Calculates exact Shapley values to pinpoint top friction factors.
4. **Layer 4: Root Cause Reasoning Agent** — Categorizes primary cause (e.g. *Unexpected Shipping Fee*, *Trust Deficit*, *Sticker Shock*).
5. **Layer 5: RAG Retrieval (ChromaDB)** — Queries 200 vector strategy documents for semantic match.
6. **Layer 6: Recommender Agent (Gemini LLM)** — Generates persona-tailored nudges and interventions.
7. **Layer 7: Confidence Engine & Risk Auditor** — Computes multi-factor decision confidence score $[0, 100\%]$.

---

## 📊 Benchmark Results

| Variant | Architecture | Conversion Rate | Precision | Revenue Lift | Margin Saved |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A** | Rule-Based Baseline | 12.4% | 58.2% | Baseline | ₹0 |
| **B** | Standalone XGBoost | 18.7% | 84.1% | +18.5% | ₹1.2M |
| **C** | XGBoost + SHAP | 22.1% | 88.6% | +26.3% | ₹2.8M |
| **D** | **Full Multi-Agent Pipeline** | **29.4%** | **94.2%** | **+41.8%** | **₹5.4M** |

---
*Created for Flipkart Grid Platform.*
