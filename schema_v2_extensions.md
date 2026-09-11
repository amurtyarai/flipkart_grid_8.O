# Schema Design Review & Extensions: Cart Abandonment Prediction

This document serves as an architectural design review and extension of the existing ~200 feature schema. It introduces production-grade ML engineering concepts, advanced feature engineering, and robust synthetic data generation strategies to mirror real-world systems at Flipkart.

---

## CHANGE 1: Separate Static Features and Dynamic Features

### 1. Why this change is needed
In production architectures, features are served from completely different infrastructure depending on their volatility. Separating them in the schema aligns the ML design with the data engineering pipeline.
*   **Static Features** are pre-computed in batch (e.g., Spark/Airflow) and served from low-latency Key-Value stores (like Redis or Aerospike).
*   **Dynamic Features** are computed in real-time via stream processing engines (e.g., Apache Flink or Kafka Streams) using sliding windows over the active session.

### 2. Schema Reorganization (Conceptual)

**STATIC FEATURES LAYER (Batch / KV Store)**
*   *User Profile*: `user_age`, `is_premium_member`, `location_tier`
*   *Purchase History*: `total_historical_spend`, `previous_abandonment_rate`, `days_since_last_purchase`
*   *Trust/Metadata (Pre-computed)*: `seller_trust_score`, `brand_popularity_score`

**DYNAMIC FEATURES LAYER (Streaming / In-memory)**
*   *Session & Gesture Behaviour*: `mouse_speed`, `tab_switch_count`, `idle_time_seconds`
*   *Cart Information*: `cart_value`, `out_of_stock_items_in_cart`
*   *Temporal Behaviour*: `time_since_cart_created`, `late_night_session`
*   *Checkout Friction*: `payment_failures`, `checkout_restart_count`
*   *Engineered Scores*: `hesitation_score` (computed real-time on windowed data)

### 3. Best Practices from Production ML Systems
*   **Feature Store Integration**: Documenting features as Static vs. Dynamic allows seamless integration with Feature Stores (e.g., Feast, Hopsworks, or internal Flipkart tools) which handle the offline-to-online sync.

---

## CHANGE 2: Add Sequential Behaviour Features

### 1. Why this change is needed
XGBoost, being a tree-based tabular model, treats all features as independent columns and natively ignores the *order* of events. Real-world intent is highly sequential (e.g., viewing a cart *then* searching for a coupon vs. searching for a coupon *then* viewing the cart). Engineering sequence transitions into tabular features acts as a bridge, giving XGBoost RNN-like context.

### 2. Newly Added Features
| Feature Name | Data Type | Description | Expected Correlation |
| :--- | :--- | :--- | :--- |
| `last_action` | Categorical | The final event before session end/checkout | High |
| `first_action` | Categorical | Entry point (Search, Direct, Ad click) | Low |
| `second_last_action` | Categorical | Penultimate event | High |
| `checkout_before_review` | Boolean | Did they try to pay, fail, then read reviews? | Strong Positive |
| `review_after_cart` | Boolean | Seeking validation after adding to cart | Moderate Positive |
| `cart_after_search` | Boolean | Added directly from search results (High intent) | Strong Negative |
| `action_transition_count`| Integer | Total state changes (e.g., Search -> Product -> Cart) | Moderate Positive |
| `time_between_cart_and_checkout`| Integer | Speed of decision making | Strong Positive |
| `checkout_loop_count` | Integer | (Checkout -> Cart -> Checkout) loops | Strong Positive |
| `navigation_pattern` | Categorical | Extracted motifs (e.g., "linear", "circular", "erratic") | Contextual |
| `action_entropy` | Float | Measure of randomness in the session | Strong Positive |

### 3. Mathematical Formulas
**Action Entropy ($H$)** calculates how scattered a user's session is. A user bouncing randomly between Home, Cart, and Search has high entropy.
$$ H = -\sum_{i=1}^{N} P(x_i) \log_2 P(x_i) $$
*Where $P(x_i)$ is the proportion of total session actions that fall into category $x_i$ (e.g., 50% scrolling, 30% searching, 20% cart views).*

### 4. Best Practices
*   Use N-gram extraction on the session clickstream logs to dynamically generate the most common transition Boolean features (like `review_after_cart`).

---

## CHANGE 3: Root Cause Alignment Features

### 1. Why this change is needed
While XGBoost excels at predicting *if* a cart will be abandoned, downstream systems (like LLMs or rule engines) need to know *why* to take action. Should we offer a 10% discount, trigger a customer support chat, or send an email reminder? Grouping behavioral features into distinct causal vectors enables explainability and targeted interventions.

### 2. Root Cause Mapping

| Root Cause | Behavioural Features | Engineered Features | Correlation with Abandonment |
| :--- | :--- | :--- | :--- |
| **Price Sensitivity** | `sorted_by_price`, `coupon_error_count`, `tab_switch_count`, `bank_offer_checked` | `price_sensitivity_score`, `competitor_difference` | Strong Positive if conditions unmet |
| **Product Quality Uncertainty**| `zoomed_images_count`, `negative_reviews_read`, `size_chart_views` | `quality_uncertainty_score`, `review_visit_ratio` | Strong Positive |
| **Delivery Concern** | `estimated_delivery_days`, `delivery_unavailable_items` | `delivery_confidence_score` | Strong Positive |
| **Payment Friction** | `payment_failures`, `checkout_restart_count`, `otp_timeout` | `payment_success_rate` | Strong Positive |
| **Trust Issues** | `seller_changed`, `review_language` | `trust_score`, `fake_review_prob` | Strong Positive |
| **Window Shopping** | `unique_categories_in_cart`, `page_views` | `exploration_score`, `action_entropy` | Strong Positive |
| **Gift Purchase** | `is_gift_wrap_requested`, `address_changes` | `purchase_intent_score` | Strong Negative |
| **Impulse Buying** | `time_since_cart_created` (Low), `time_between_cart_and_checkout` (Low) | `impulse_buy_score` | Strong Negative |
| **Product Availability** | `out_of_stock_items_in_cart`, `zero_results_searches` | N/A | Strong Positive |
| **Technical Problems** | `payment_loading_time`, `rapid_scroll_count` (frustration), `browser_minimized` | N/A | Strong Positive |

### 3. Best Practices
*   Pass these Root Cause groupings directly to the LLM agent alongside SHAP values. If SHAP highlights `coupon_error_count`, the LLM instantly maps this to "Price Sensitivity" and suggests a discount intervention.

---

## CHANGE 4: Inject Human Behaviour Noise

### 1. Why this change is needed
If the synthetic dataset is purely deterministic (Equation X yields Probability Y), the model will learn a rigid set of rules and overfit. Real human behavior involves misclicks, falling asleep, getting distracted by a phone call, or irrational impulses. Injecting noise forces XGBoost to learn generalizable boundaries rather than memorizing exact thresholds.

### 2. Noise Injection Strategy
*   **Irrational Purchases (5%)**: Randomly select 5% of rows that should have been abandoned (Probability > 0.8) and flip their label to 0. *(Simulates impulse buys despite high friction).*
*   **Irrational Abandonment (7%)**: Randomly flip 7% of likely purchases to 1. *(Simulates getting distracted, closing the tab accidentally, or boss walking in).*
*   **Bot Traffic (2%)**: Inject sessions with superhuman `mouse_speed`, zero `idle_time`, 500+ `page_views`, and a 100% abandonment rate.
*   **Feature Jitter**: Add Gaussian noise to continuous variables. E.g., `idle_time_seconds = True_Idle_Time + N(0, 30)` to simulate measurement inaccuracies in web tracking.

### 3. Best Practices
*   Apply noise *after* all logical features are generated, but *before* saving the dataset. Ensure the random seed is logged so the dataset can be deterministically recreated.

---

## CHANGE 5: Missing Values Strategy

### 1. Why this change is needed
In real production environments, telemetry is lost. Ad-blockers block tracking scripts, mobile apps fail to send location data due to permissions, and legacy databases have null fields. XGBoost natively handles `NaN` values by learning the optimal split direction for missing data. Imputing with mean/median destroys this signal.

### 2. Missing Value Implementation
| Feature | Missing Rate | Type | Why / Mechanism |
| :--- | :--- | :--- | :--- |
| `user_age` | 15% | MNAR (Missing Not At Random) | Older users or privacy-conscious users actively refuse to provide it. |
| `user_gender`| 10% | MNAR | Prefer not to say. |
| `network_type`| 20% | MAR (Missing At Random) | Web browsers often restrict APIs that expose network telemetry compared to native apps. |
| `battery_level`| 35% | MAR | Battery Status API is deprecated/blocked on many modern desktop browsers (Safari/Firefox). |
| `location_tier`| 5% | MCAR (Missing Completely At Random) | Occasional IP lookup API failures or timeouts. |
| `mouse_speed` | 40% | MAR | Missing entirely for mobile app users (touch interfaces don't have mouse hover/speed). |

### 3. Best Practices
*   Leave missing values as true `NaN` (or `np.nan` in pandas). Let XGBoost's sparsity-aware split finding algorithm determine if "missingness" itself is a predictor of abandonment (which it often is—e.g., ad-blocker users are often more tech-savvy and price-sensitive).

---

## CHANGE 6: Outlier Injection Strategy

### 1. Why this change is needed
E-commerce data is notoriously heavy-tailed. A model trained only on "average" users (₹1000 carts, 5 min sessions) will fail catastrophically during edge cases like B2B bulk purchases or viral product drops.

### 2. Outlier Strategy & Distributions
*   **Cart Value (The ₹7 Lakh Cart)**: Use a **Pareto Distribution** (80/20 rule) for financial metrics. This naturally creates extreme right-tail outliers simulating luxury purchases (MacBooks, jewelry) or corporate bulk orders.
*   **Page Views & Session Duration**: Use a heavily skewed **Log-Normal Distribution**. This generates the occasional 8-hour browsing session or 500 page-view session (often users leaving a tab open overnight, or obsessive comparison shoppers).
*   **Review Visits (100+)**: Driven by high `quality_uncertainty_score`.
*   **Customer Demographics**: Allow natural outliers in normal distributions (e.g., the 79-year-old customer using a tablet).

### 3. Best Practices
*   Do *not* clip or cap outliers during synthetic generation. Let the dataset reflect reality. Tree models are naturally robust to monotonic outliers.

---

## CHANGE 7: Improve Label Generation (Persona-Based Simulator)

### 1. Why this change is needed
A single global formula for $P(abandon)$ assumes all humans weight variables equally. In reality, a "Price Sensitive" user will abandon over a ₹50 shipping fee, while a "Premium Buyer" won't even notice it. Mixture modeling via Personas creates highly realistic, complex decision boundaries.

### 2. Persona Definitions (Mixture Model)

1.  **Price Sensitive Shopper (20%)**: High weight on `total_shipping_charges`, `competitor_difference`, `coupon_error_count`. Highly reactive to discounts. Base abandonment: High (75%).
2.  **Quality Conscious (15%)**: High weight on `fake_review_probability`, `product_rating`, `return_policy_days`. Ignores shipping cost. Base abandonment: Medium (60%).
3.  **Loyal Customer (Flipkart Plus) (10%)**: High trust, low friction. Heavily relies on `is_premium_member`. Base abandonment: Low (20%).
4.  **Impulse Buyer (10%)**: Very short `time_since_cart_created`. High weight on `express_delivery_available`. Base abandonment: Low (30%).
5.  **Window Shopper (15%)**: High `exploration_score`, low `purchase_intent_score`. High `tab_switch_count`. Base abandonment: Very High (95%).
6.  **Corporate Buyer (5%)**: Extreme cart values. Needs invoice/GST. Base abandonment: Medium (50%).
7.  **First Time User (10%)**: High `trust_score` sensitivity. High friction at checkout. Base abandonment: High (80%).
8.  **Research Driven Buyer (15%)**: Extreme `review_read_time`, high `comparison_ratio`. Takes days to convert. Base abandonment: Medium (65%).

### 3. Mathematical Combining Function
First, assign a Persona to the user. Then, calculate their specific log-odds:

$$ Z_{user} = \beta_{persona} + \sum (W_{persona, i} \times Feature_i) + Dealbreakers $$

Add noise specific to the persona (Impulse buyers have higher variance):
$$ P(abandon) = \sigma(Z_{user} + \mathcal{N}(0, \sigma_{persona})) $$

Finally, use **Probabilistic Sampling** instead of a hard threshold:
$$ \text{cart\_abandoned} \sim \text{Bernoulli}(P(abandon)) $$
*(If $P = 0.8$, they have an 80% chance of generating a 1. This is much more realistic than saying anyone > 0.55 abandons).*

---

## CHANGE 8: Continuous Target Variable

### 1. Why this change is needed
Binary targets (`cart_abandoned` $\in \{0,1\}$) are required for classification loss functions (Binary Cross Entropy). However, retaining the *true* underlying synthetic probability (`abandonment_probability` $\in [0.0, 1.0]$) is invaluable for an ML Engineering team.

### 2. Schema Addition
| Feature Name | Data Type | Description | Usage |
| :--- | :--- | :--- | :--- |
| `cart_abandoned` | Integer (0/1) | The binary outcome (Sampled) | Used as the `y_true` target for XGBoost training. |
| `abandonment_probability` | Float (0.0 - 1.0) | The unobserved true propensity | Used for model calibration, evaluation, and distillation. |

### 3. Production Use Cases for Continuous Target
*   **Calibration Testing**: You can map XGBoost's `predict_proba()` against the synthetic dataset's true `abandonment_probability` to generate perfect Reliability Diagrams (Brier Score analysis).
*   **Knowledge Distillation**: You can train smaller, faster models (like LightGBM or simple MLPs) using Mean Squared Error against the continuous `abandonment_probability` rather than the noisy 0/1 labels.
*   **SHAP Explanations**: Evaluating feature importance against the continuous probability yields cleaner insights than evaluating against the noisy binary label.
*   **Business Dashboards**: Allows analysts to query the dataset to see "What is the average true propensity of iOS users?" without noise variance.
