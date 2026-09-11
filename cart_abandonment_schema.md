# Synthetic Dataset Design: Cart Abandonment Prediction (Expanded)

As a Senior Machine Learning Engineer designing a high-fidelity synthetic dataset for Flipkart's cart abandonment model, the goal is to ensure the XGBoost model learns meaningful, real-world behavioral patterns rather than noise. 

This expanded document outlines a robust schema of ~200 features categorized into 17 logical groups, including advanced signals like Mouse Gestures, Price Intelligence, Trust Features, and deep User Psychology metrics. The schema is built to be rich, relying on the fact that XGBoost naturally prunes weak features, but cannot learn from signals that aren't there.

---

## 1. Complete Dataset Schema & Feature Importance

### 1. User Profile
| Feature Name | Data Type | Description | Expected Correlation | Importance |
| :--- | :--- | :--- | :--- | :--- |
| `user_id` | String | Unique identifier | None | None |
| `user_age` | Integer | 13 - 80 | Weak Negative | Low |
| `user_gender` | Categorical | M, F, Other, Unknown | Weak | Low |
| `account_age_days` | Integer | 0 - 5000 | Moderate Negative | Medium |
| `is_premium_member` | Boolean | Flipkart Plus member | Strong Negative | High |
| `location_tier` | Categorical | Tier 1, 2, 3, Rural | Moderate Positive | Medium |
| `default_address_type` | Categorical | Home, Office | Weak Positive | Low |

### 2. Purchase History
| Feature Name | Data Type | Description | Expected Correlation | Importance |
| :--- | :--- | :--- | :--- | :--- |
| `total_historical_purchases` | Integer | Total past orders | Strong Negative | High |
| `total_historical_spend` | Float | Lifetime value in INR | Strong Negative | High |
| `historical_return_rate` | Float | Rate of product returns | Moderate Positive | Medium |
| `previous_abandoned_carts` | Integer | Habitual abandoner count | Strong Positive | High |
| `previous_abandonment_rate` | Float | Historical abandonment ratio | Strong Positive | High |
| `days_since_last_purchase` | Integer | Recency of purchase | Moderate Positive | Medium |
| `average_order_value` | Float | Average cart value historically | Weak | Low |

### 3. Temporal Behaviour
| Feature Name | Data Type | Description | Expected Correlation | Importance |
| :--- | :--- | :--- | :--- | :--- |
| `time_since_cart_created` | Integer | Seconds since cart was created | Strong Positive | High |
| `time_since_last_action` | Integer | Idle time before checkout/abandon | Strong Positive | High |
| `days_until_salary` | Integer | Estimated days to 1st of month | Moderate Positive | Medium |
| `is_festival_season` | Boolean | e.g. Big Billion Days | Strong Negative | High |
| `is_weekend` | Boolean | Saturday/Sunday | Weak Negative | Low |
| `is_office_hours` | Boolean | Weekdays 9 AM - 6 PM | Moderate Positive | Medium |
| `late_night_session` | Boolean | 11 PM - 4 AM browsing | Strong Positive | High |

### 4. Multi-session Behaviour
| Feature Name | Data Type | Description | Expected Correlation | Importance |
| :--- | :--- | :--- | :--- | :--- |
| `visited_same_product_last_week`| Boolean | High intent signal | Strong Negative | High |
| `cart_restored` | Boolean | Returning to old cart | Moderate Negative | Medium |
| `days_since_first_view` | Integer | Deliberation time | Moderate | Medium |
| `sessions_for_same_product` | Integer | Count of sessions looking at item | Moderate Positive | Medium |
| `previous_price_seen` | Float | Price anchor from last visit | Moderate | Medium |
| `repeat_product_views` | Integer | Total views of same item | Moderate Negative | High |

### 5. Cart Information
| Feature Name | Data Type | Description | Expected Correlation | Importance |
| :--- | :--- | :--- | :--- | :--- |
| `cart_id` | String | Unique cart ID | None | None |
| `total_items_in_cart` | Integer | 1 - 50 | Moderate Positive | Medium |
| `unique_categories_in_cart` | Integer | Scattered intent vs focused | Moderate Positive | Medium |
| `cart_value` | Float | Total INR value | Strong Positive | High |
| `min_item_price` | Float | Cheapest item | Weak Negative | Low |
| `max_item_price` | Float | Anchor item price | Moderate Positive | Medium |
| `is_gift_wrap_requested` | Boolean | Gifting intent | Strong Negative | High |
| `out_of_stock_items_in_cart` | Integer | Frustration signal | Strong Positive | High |

### 6. Product Metadata
| Feature Name | Data Type | Description | Expected Correlation | Importance |
| :--- | :--- | :--- | :--- | :--- |
| `product_rating` | Float | 1.0 - 5.0 | Strong Negative | High |
| `rating_count` | Integer | Number of reviews | Moderate Negative | Medium |
| `brand_popularity_score` | Float | Established vs unknown brand | Moderate Negative | Medium |
| `return_policy_days` | Integer | 0, 7, 30 | Strong Negative | High |
| `replacement_available` | Boolean | Reduces risk | Strong Negative | High |
| `warranty_months` | Integer | Reduces risk | Moderate Negative | Medium |
| `is_flipkart_assured` | Boolean | Trust badge | Strong Negative | High |
| `is_best_seller` | Boolean | Social proof | Strong Negative | High |
| `discount_percentage` | Float | Deal attractiveness | Strong Negative | High |

### 7. Trust Features
| Feature Name | Data Type | Description | Expected Correlation | Importance |
| :--- | :--- | :--- | :--- | :--- |
| `seller_changed` | Boolean | Seller changed after cart add | Strong Positive | High |
| `seller_trust_score` | Float | Flipkart internal seller rating | Strong Negative | High |
| `seller_age_months` | Integer | Established seller | Moderate Negative | Medium |
| `fake_review_probability` | Float | Inferred from review text ML | Strong Positive | High |
| `delivery_confidence` | Float | Historical delivery success rate | Strong Negative | High |
| `product_quality_score` | Float | Inferred from low returns | Strong Negative | High |
| `verified_review_percentage` | Float | Authenticity of reviews | Strong Negative | Medium |

### 8. Session Behaviour
| Feature Name | Data Type | Description | Expected Correlation | Importance |
| :--- | :--- | :--- | :--- | :--- |
| `session_duration_seconds` | Integer | Total active time | Moderate Positive | Medium |
| `page_views` | Integer | Total pages | Moderate Positive | Medium |
| `time_on_product_pages` | Integer | Reading specs | Moderate Negative | Medium |
| `time_on_cart_page` | Integer | Sticker shock hesitation | Strong Positive | High |
| `time_on_checkout_page` | Integer | Friction at payment | Strong Positive | High |
| `idle_time_seconds` | Integer | Distraction | Strong Positive | High |

### 9. Mouse & Gesture Behaviour
| Feature Name | Data Type | Description | Expected Correlation | Importance |
| :--- | :--- | :--- | :--- | :--- |
| `mouse_hover_time` | Float | Hovering over buy/price | Moderate Negative | Medium |
| `mouse_speed` | Float | Erratic vs calm | Weak Positive | Low |
| `rapid_scroll_count` | Integer | Scanning, lack of focus | Moderate Positive | Medium |
| `scroll_depth` | Float | 0.0 - 1.0 | Strong Negative | Medium |
| `back_button_count` | Integer | Indecision | Strong Positive | High |
| `tab_switch_count` | Integer | Comparison shopping | Strong Positive | High |
| `browser_minimized` | Boolean | Distracted | Strong Positive | High |
| `copy_product_title` | Boolean | Checking reviews/price elsewhere | Strong Positive | High |
| `copy_product_description` | Boolean | Researching | Moderate Positive | Medium |
| `share_product` | Boolean | High intent (asking spouse/friend) | Strong Negative | High |
| `open_new_tab_count` | Integer | Parallel browsing | Moderate Positive | Medium |
| `focus_lost_count` | Integer | Checking other apps (e.g. Amazon) | Strong Positive | High |

### 10. Product & Review Behaviour
| Feature Name | Data Type | Description | Expected Correlation | Importance |
| :--- | :--- | :--- | :--- | :--- |
| `unique_products_viewed` | Integer | Window shopping | Moderate Positive | Medium |
| `similar_products_viewed` | Integer | Comparison | Strong Positive | High |
| `product_images_viewed` | Integer | Visual confirmation | Moderate Negative | Medium |
| `zoomed_images_count` | Integer | Scrutiny | Moderate | Low |
| `size_chart_views` | Integer | Fit check | Moderate Positive | Medium |
| `positive_reviews_read` | Integer | Building confidence | Strong Negative | High |
| `negative_reviews_read` | Integer | Searching for dealbreakers | Strong Positive | High |
| `review_read_time` | Integer | Deep research | Moderate | Medium |
| `review_helpful_clicked` | Boolean | High engagement | Weak Negative | Low |
| `review_sorting_used` | Boolean | Looking for "recent" or "worst" | Moderate Positive | Medium |
| `review_language` | Categorical | Native language checks | Weak Negative | Low |
| `review_summary_opened` | Boolean | AI summary reading | Moderate Negative | Medium |

### 11. Search Behaviour
| Feature Name | Data Type | Description | Expected Correlation | Importance |
| :--- | :--- | :--- | :--- | :--- |
| `search_queries_count` | Integer | Trouble finding item | Moderate Positive | Medium |
| `filters_used_count` | Integer | High specificity | Moderate Negative | Medium |
| `sorted_by_price_flag` | Boolean | Price sensitivity | Strong Positive | High |
| `sorted_by_rating_flag` | Boolean | Quality sensitivity | Weak Negative | Low |
| `zero_results_searches` | Integer | Frustration | Strong Positive | High |

### 12. Price Intelligence
| Feature Name | Data Type | Description | Expected Correlation | Importance |
| :--- | :--- | :--- | :--- | :--- |
| `total_discount_amount` | Float | FOMO trigger | Strong Negative | High |
| `coupon_applied_flag` | Boolean | Gamified win | Strong Negative | High |
| `coupon_error_count` | Integer | Frustration | Strong Positive | High |
| `price_checked_multiple_times`| Boolean | Reloading for price drop | Strong Positive | Medium |
| `price_history_opened` | Boolean | Checking if it's a real deal | Strong Positive | High |
| `price_drop_notification_enabled`| Boolean | Waiting for sale | Strong Positive | High |
| `waiting_for_sale` | Boolean | Behavioral flag | Strong Positive | High |
| `competitor_price_checked` | Boolean | Inferred from fast tab switches | Strong Positive | High |
| `competitor_difference` | Float | Negative = competitor cheaper | Strong Positive | High |
| `bank_offer_checked` | Boolean | Conditional intent | Moderate Negative | Medium |
| `cashback_offer_checked` | Boolean | Deal hunting | Moderate Negative | Medium |
| `emi_options_compared` | Boolean | Affordability check | Moderate Negative | Medium |

### 13. Delivery Behaviour
| Feature Name | Data Type | Description | Expected Correlation | Importance |
| :--- | :--- | :--- | :--- | :--- |
| `estimated_delivery_days` | Integer | Slowness kills impulse | Strong Positive | High |
| `express_delivery_available` | Boolean | Speed converts | Strong Negative | High |
| `free_delivery_eligible` | Boolean | Major decision factor | Strong Negative | High |
| `total_shipping_charges` | Float | Sticker shock | Strong Positive | High |
| `delivery_unavailable_items` | Integer | Dealbreaker | Strong Positive | High |

### 14. Checkout Friction (Payment)
| Feature Name | Data Type | Description | Expected Correlation | Importance |
| :--- | :--- | :--- | :--- | :--- |
| `payment_page_reached` | Boolean | High intent | Strong Negative | High |
| `payment_attempts` | Integer | Trying multiple cards | Moderate Positive | Medium |
| `payment_failures` | Integer | Bank/Gateway error | Strong Positive | High |
| `shipping_address_changed` | Boolean | Friction step | Moderate Positive | Low |
| `payment_method_changed` | Boolean | Card declined, trying UPI | Moderate Positive | Medium |
| `upi_selected` | Boolean | High success rate | Strong Negative | High |
| `cod_selected` | Boolean | Highest success rate | Strong Negative | High |
| `card_selected` | Boolean | Medium success rate | Weak | Medium |
| `wallet_selected` | Boolean | Medium success rate | Weak | Medium |
| `checkout_back_pressed` | Boolean | Second thoughts at payment | Strong Positive | High |
| `checkout_restart_count` | Integer | Loop of failures/re-thinks | Strong Positive | High |
| `otp_timeout` | Boolean | Technical block | Strong Positive | High |
| `payment_loading_time` | Float | Spinning wheel of death | Strong Positive | High |

### 15. Device & Context
| Feature Name | Data Type | Description | Expected Correlation | Importance |
| :--- | :--- | :--- | :--- | :--- |
| `device_type` | Categorical | Mobile checkouts face more friction | Moderate Positive | Medium |
| `network_type` | Categorical | Poor network = timeouts | Moderate Positive | Low |
| `battery_level` | Integer | Low battery = rush/abandon | Weak Positive | Low |
| `is_low_power_mode` | Boolean | Dim screen, lag | Weak Positive | Low |

### 16. Product Embeddings (ML Features)
| Feature Name | Data Type | Description | Expected Correlation | Importance |
| :--- | :--- | :--- | :--- | :--- |
| `product_embedding_1...16` | Float | Dense vector of product properties| Contextual | High |
| `category_embedding_1...8` | Float | Dense vector of category space | Contextual | Medium |
| `brand_embedding_1...8` | Float | Dense vector of brand identity | Contextual | Medium |

### 17. User Psychology (Engineered Scores)
These aren't directly observed but calculated from the raw features above.

| Feature Name | Data Type | Formula/Definition | Expected Correlation | Importance |
| :--- | :--- | :--- | :--- | :--- |
| `purchase_intent_score` | Float | `(searches + cart_adds) / duration` | Strong Negative | High |
| `hesitation_score` | Float | `(time_cart + time_checkout) / duration`| Strong Positive | High |
| `quality_uncertainty_score` | Float | `negative_reviews_read + zoomed_images`| Strong Positive | High |
| `price_sensitivity_score` | Float | Uses sorting, coupon usage, bank offers | Moderate Positive | High |
| `delivery_confidence_score`| Float | Trust in logistics | Strong Negative | High |
| `trust_score` | Float | `seller_trust * flipkart_assured` | Strong Negative | High |
| `urgency_score` | Float | Inferred from rapid navigation, express delivery| Strong Negative | High |
| `exploration_score` | Float | `unique_categories / page_views` | Strong Positive | Medium |
| `decision_confidence_score`| Float | Inverse of back_button/tab switches | Strong Negative | High |
| `impulse_buy_score` | Float | Short session + high cart value | Strong Negative | High |

### 18. Target Variable
| Feature Name | Data Type | Description |
| :--- | :--- | :--- |
| `cart_abandoned` | Integer | 0 = Purchased, 1 = Abandoned (Within 24h) |

---

## 2. Recommended Data Distributions

To make the dataset realistic, sample features from specific statistical distributions:

1. **`total_historical_purchases` & `page_views`**: **Poisson Distribution**.
   *Why*: Count data representing independent events over a period. 
2. **`session_duration_seconds` & `cart_value`**: **Log-normal Distribution**.
   *Why*: Time and monetary values cannot be negative and are heavily right-skewed.
3. **Psychology Scores (e.g. `hesitation_score`)**: **Beta Distribution**.
   *Why*: Bounded between 0 and 1, highly flexible shape parameters.
4. **Embeddings (`product_embedding_N`)**: **Multivariate Normal**.
   *Why*: Dense latent representations generally follow Gaussian distributions.

---

## 3. Conceptual Correlation Matrix (Interactions)

Real-world datasets have multicollinearity and complex interactions. Your generator should enforce these:

*   **`tab_switch_count` + `copy_product_title`** = Strong signal of `competitor_price_checked`.
*   **`negative_reviews_read` (High) + `trust_score` (Low)** = High `quality_uncertainty_score`.
*   **`payment_failures` > 0 + `checkout_restart_count` > 0** = Differentiates payment friction from price hesitation.
*   **Late Night Session + `device_type` (Mobile) + `battery_level` (< 10%)** = Massive spike in abandonment.
*   **`is_festival_season` (True) + `days_until_salary` (< 3)** = Very high conversion rate.

---

## 4. Label Generation Logic (Mathematical Formula)

Do **not** use a simple `if/else` block. Use a **Logistic Function with Gumbel/Gaussian noise** to simulate probabilistic human behavior. 

### Step 1: Base Log-Odds ($Z$)
Calculate a continuous propensity score $Z$ using weighted psychological scores and hard dealbreakers.

$$
\begin{align*}
Z = \beta_0 & - 1.5 \times (\text{purchase\_intent\_score}) \\
            & + 2.5 \times (\text{hesitation\_score}) \\
            & + 1.2 \times (\text{quality\_uncertainty\_score}) \\
            & + 1.8 \times (\text{price\_sensitivity\_score} \times \text{competitor\_difference}) \\
            & - 2.0 \times (\text{trust\_score}) \\
            & + 1.5 \times (\text{total\_shipping\_charges} / 100) \\
            & + 1.0 \times (\text{checkout\_restart\_count})
\end{align*}
$$

### Step 2: Non-Linear Interactions & Dealbreakers
Add non-linear jumps to $Z$ based on specific conditions:
*   If `delivery_unavailable_items` > 0: $Z = Z + 10.0$ *(Almost certain abandonment)*
*   If `otp_timeout` == True: $Z = Z + 4.0$
*   If `competitor_difference` < -5.0 (Competitor is >5% cheaper) & `tab_switch_count` > 3: $Z = Z + 3.0$
*   If `share_product` == True AND `time_since_cart_created` < 3600: $Z = Z - 3.0$ *(Waiting for spouse approval, high intent)*

### Step 3: Probabilistic Conversion & Noise
Add noise to simulate human unpredictability, then map to a probability.

$$ Z_{final} = Z + \epsilon \quad \text{where } \epsilon \sim \mathcal{N}(0, 0.5) $$
$$ P(\text{abandon}) = \frac{1}{1 + e^{-Z_{final}}} $$

### Step 4: Final Label Assignment
$$
\text{cart\_abandoned} = 
\begin{cases} 
1 & \text{if } P(\text{abandon}) > 0.55 \\
0 & \text{otherwise} 
\end{cases}
$$

