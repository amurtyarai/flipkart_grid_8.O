import numpy as np
import pandas as pd
from scipy import stats
import uuid
import os

np.random.seed(42)
N_SESSIONS = int(os.environ.get("N_SESSIONS", "500000"))

def generate_data(n=N_SESSIONS):
    print(f"Generating {n} synthetic cart abandonment sessions...")
    df = pd.DataFrame()
    
    # ---------------------------------------------------------
    # 0. BASE PERSONA & IDS
    # ---------------------------------------------------------
    df['session_id'] = [str(uuid.uuid4()) for _ in range(n)]
    df['user_id'] = [f"U{np.random.randint(10000, 999999)}" for _ in range(n)]
    
    personas = [
        "Price Sensitive Shopper", "Quality Conscious", "Loyal Customer",
        "Impulse Buyer", "Window Shopper", "Corporate Buyer", 
        "First Time User", "Research Driven Buyer"
    ]
    probs = [0.20, 0.15, 0.10, 0.10, 0.15, 0.05, 0.10, 0.15]
    df['persona'] = np.random.choice(personas, size=n, p=probs)
    
    # Vectorized boolean masks for personas for faster assignment
    is_price_sens = df['persona'] == "Price Sensitive Shopper"
    is_qual = df['persona'] == "Quality Conscious"
    is_loyal = df['persona'] == "Loyal Customer"
    is_impulse = df['persona'] == "Impulse Buyer"
    is_window = df['persona'] == "Window Shopper"
    is_corp = df['persona'] == "Corporate Buyer"
    is_first = df['persona'] == "First Time User"
    is_research = df['persona'] == "Research Driven Buyer"

    # ---------------------------------------------------------
    # 1. USER PROFILE (STATIC)
    # ---------------------------------------------------------
    df['user_age'] = np.clip(np.random.normal(28, 10, n), 13, 80).astype(float)
    # Corporate buyers might be slightly older
    df.loc[is_corp, 'user_age'] = np.clip(np.random.normal(35, 8, is_corp.sum()), 20, 70).astype(float)
    
    df['user_gender'] = np.random.choice(['M', 'F', 'Other', 'Unknown'], size=n, p=[0.45, 0.45, 0.05, 0.05])
    
    # Account age: loyal are old, first time are 0
    df['account_age_days'] = np.random.exponential(500, size=n).astype(int)
    df.loc[is_first, 'account_age_days'] = 0
    df.loc[is_loyal, 'account_age_days'] += 1000
    df['account_age_days'] = np.clip(df['account_age_days'], 0, 5000)
    
    df['is_premium_member'] = (np.random.rand(n) < 0.15).astype(int)
    df.loc[is_loyal, 'is_premium_member'] = 1  # Loyal always premium
    df.loc[is_first, 'is_premium_member'] = 0
    
    df['location_tier'] = np.random.choice(['Tier 1', 'Tier 2', 'Tier 3', 'Rural'], size=n, p=[0.4, 0.3, 0.2, 0.1])
    df['default_address_type'] = np.random.choice(['Home', 'Office'], size=n, p=[0.8, 0.2])
    df.loc[is_corp, 'default_address_type'] = 'Office'

    # ---------------------------------------------------------
    # 2. PURCHASE HISTORY (STATIC)
    # ---------------------------------------------------------
    df['total_historical_purchases'] = np.random.poisson(lam=10, size=n)
    df.loc[is_first, 'total_historical_purchases'] = 0
    df.loc[is_loyal, 'total_historical_purchases'] = np.random.poisson(lam=50, size=is_loyal.sum())
    
    df['total_historical_spend'] = df['total_historical_purchases'] * np.random.lognormal(mean=7, sigma=1, size=n)
    df['historical_return_rate'] = np.clip(np.random.normal(0.1, 0.05, size=n), 0, 1)
    df['previous_abandoned_carts'] = np.random.poisson(lam=5, size=n)
    df['previous_abandonment_rate'] = np.clip(np.random.beta(2, 5, size=n), 0, 1)
    df['days_since_last_purchase'] = np.random.lognormal(mean=4, sigma=1, size=n).astype(int)
    df.loc[is_first, 'days_since_last_purchase'] = -1
    
    df['average_order_value'] = np.where(df['total_historical_purchases'] > 0, 
                                         df['total_historical_spend'] / df['total_historical_purchases'], 
                                         0)

    # ---------------------------------------------------------
    # 3. TEMPORAL BEHAVIOUR (DYNAMIC)
    # ---------------------------------------------------------
    df['time_since_cart_created'] = np.random.lognormal(mean=6, sigma=1.5, size=n).astype(int)
    df.loc[is_impulse, 'time_since_cart_created'] = np.random.exponential(60, size=is_impulse.sum()).astype(int)
    
    df['time_since_last_action'] = np.random.exponential(120, size=n).astype(int)
    df['days_until_salary'] = np.random.randint(0, 31, size=n)
    df['is_festival_season'] = (np.random.rand(n) < 0.1).astype(int)
    df['is_weekend'] = (np.random.rand(n) < 0.28).astype(int)
    df['is_office_hours'] = (np.random.rand(n) < 0.4).astype(int)
    df['late_night_session'] = (np.random.rand(n) < 0.15).astype(int)

    # ---------------------------------------------------------
    # 4. MULTI-SESSION BEHAVIOUR
    # ---------------------------------------------------------
    df['visited_same_product_last_week'] = (np.random.rand(n) < 0.3).astype(int)
    df['cart_restored'] = (np.random.rand(n) < 0.1).astype(int)
    df['days_since_first_view'] = np.random.poisson(lam=3, size=n)
    df['sessions_for_same_product'] = np.random.poisson(lam=2, size=n)
    df['repeat_product_views'] = np.random.poisson(lam=4, size=n)

    # ---------------------------------------------------------
    # 5. CART INFORMATION
    # ---------------------------------------------------------
    df['total_items_in_cart'] = np.random.poisson(lam=2, size=n) + 1
    df['unique_categories_in_cart'] = np.clip(np.random.poisson(lam=1, size=n) + 1, 1, df['total_items_in_cart'])
    
    # Cart Value with Pareto Outliers
    base_cart_val = np.random.lognormal(mean=7.5, sigma=1.2, size=n) 
    corp_cart_val = (np.random.pareto(a=1.5, size=is_corp.sum()) + 1) * 20000
    df['cart_value'] = base_cart_val
    df.loc[is_corp, 'cart_value'] = corp_cart_val
    df['cart_value'] = df['cart_value'].round(2)
    
    df['min_item_price'] = df['cart_value'] / df['total_items_in_cart'] * np.random.uniform(0.1, 0.5, size=n)
    df['max_item_price'] = df['cart_value'] / df['total_items_in_cart'] * np.random.uniform(1.2, 2.0, size=n)
    df['is_gift_wrap_requested'] = (np.random.rand(n) < 0.05).astype(int)
    df['out_of_stock_items_in_cart'] = np.random.poisson(lam=0.1, size=n)

    # ---------------------------------------------------------
    # 6. PRODUCT METADATA & TRUST
    # ---------------------------------------------------------
    df['product_rating'] = np.clip(np.random.normal(4.2, 0.6, size=n), 1.0, 5.0)
    df['rating_count'] = np.random.lognormal(mean=6, sigma=2, size=n).astype(int)
    df['brand_popularity_score'] = np.clip(np.random.normal(0.7, 0.2, size=n), 0, 1)
    df['return_policy_days'] = np.random.choice([0, 7, 10, 30], size=n, p=[0.1, 0.4, 0.3, 0.2])
    df['replacement_available'] = (np.random.rand(n) < 0.8).astype(int)
    df['is_flipkart_assured'] = (np.random.rand(n) < 0.6).astype(int)
    df['is_best_seller'] = (np.random.rand(n) < 0.1).astype(int)
    df['discount_percentage'] = np.clip(np.random.normal(0.2, 0.15, size=n), 0, 0.9)
    
    df['seller_changed'] = (np.random.rand(n) < 0.02).astype(int)
    df['seller_trust_score'] = np.clip(np.random.normal(4.0, 0.8, size=n), 1, 5)
    df['fake_review_probability'] = np.clip(np.random.beta(2, 10, size=n), 0, 1)
    df['delivery_confidence'] = np.clip(np.random.beta(8, 2, size=n), 0, 1)
    df['product_quality_score'] = np.clip(np.random.beta(7, 3, size=n), 0, 1)
    df['verified_review_percentage'] = np.clip(np.random.beta(8, 2, size=n), 0, 1)

    # ---------------------------------------------------------
    # 7. SESSION, MOUSE & GESTURE BEHAVIOUR
    # ---------------------------------------------------------
    df['session_duration_seconds'] = np.random.lognormal(mean=5.5, sigma=1.2, size=n).astype(int)
    df['page_views'] = np.clip(np.random.poisson(lam=15, size=n), 1, 500)
    
    # Inject bots (2% noise)
    is_bot = np.random.rand(n) < 0.02
    df.loc[is_bot, 'page_views'] = np.random.randint(200, 600, size=is_bot.sum())
    df.loc[is_bot, 'session_duration_seconds'] = np.random.randint(10, 60, size=is_bot.sum())
    
    df['idle_time_seconds'] = df['session_duration_seconds'] * np.random.uniform(0, 0.5, size=n)
    df['mouse_hover_time'] = df['session_duration_seconds'] * np.random.uniform(0.1, 0.4, size=n)
    df['mouse_speed'] = np.random.lognormal(mean=2, sigma=0.5, size=n)
    df.loc[is_bot, 'mouse_speed'] = 999.9 
    
    df['rapid_scroll_count'] = np.random.poisson(lam=2, size=n)
    df['scroll_depth'] = np.clip(np.random.normal(0.6, 0.2, size=n), 0, 1)
    df['back_button_count'] = np.random.poisson(lam=3, size=n)
    df['tab_switch_count'] = np.random.poisson(lam=1.5, size=n)
    df.loc[is_window, 'tab_switch_count'] += np.random.poisson(lam=5, size=is_window.sum())
    
    df['browser_minimized'] = (np.random.rand(n) < 0.1).astype(int)
    df['copy_product_title'] = (np.random.rand(n) < 0.05).astype(int)
    df.loc[is_price_sens, 'copy_product_title'] = (np.random.rand(is_price_sens.sum()) < 0.3).astype(int)
    df['focus_lost_count'] = np.random.poisson(lam=1, size=n)

    # ---------------------------------------------------------
    # 8. SEQUENTIAL BEHAVIOUR (MARKOV PROXIES)
    # ---------------------------------------------------------
    actions = ['Search', 'Product', 'Cart', 'Checkout', 'Review', 'Home']
    df['last_action'] = np.random.choice(actions, size=n)
    df['first_action'] = np.random.choice(actions, size=n)
    df['checkout_before_review'] = (np.random.rand(n) < 0.05).astype(int)
    df['review_after_cart'] = (np.random.rand(n) < 0.15).astype(int)
    df['cart_after_search'] = (np.random.rand(n) < 0.2).astype(int)
    df['action_transition_count'] = np.random.poisson(lam=df['page_views']*0.8)
    df['time_between_cart_and_checkout'] = np.random.exponential(120, size=n).astype(int)
    df['checkout_loop_count'] = np.random.poisson(lam=0.2, size=n)
    
    # Action entropy calculation (Dirichlet proxy)
    action_probs = np.random.dirichlet(np.ones(len(actions)), size=n)
    df['action_entropy'] = -np.sum(action_probs * np.log2(action_probs + 1e-9), axis=1)

    # ---------------------------------------------------------
    # 9. PRODUCT & REVIEW BEHAVIOUR
    # ---------------------------------------------------------
    df['unique_products_viewed'] = np.clip(np.random.poisson(lam=4, size=n), 1, None)
    df['similar_products_viewed'] = np.random.poisson(lam=2, size=n)
    df['zoomed_images_count'] = np.random.poisson(lam=1, size=n)
    df.loc[is_qual, 'zoomed_images_count'] += np.random.poisson(lam=3, size=is_qual.sum())
    
    df['positive_reviews_read'] = np.random.poisson(lam=3, size=n)
    df['negative_reviews_read'] = np.random.poisson(lam=1, size=n)
    df.loc[is_qual, 'negative_reviews_read'] += np.random.poisson(lam=4, size=is_qual.sum())
    df.loc[is_research, 'negative_reviews_read'] += 5

    # ---------------------------------------------------------
    # 10. PRICE INTELLIGENCE
    # ---------------------------------------------------------
    df['total_discount_amount'] = df['cart_value'] * df['discount_percentage']
    df['coupon_error_count'] = np.random.poisson(lam=0.2, size=n)
    df['price_history_opened'] = (np.random.rand(n) < 0.05).astype(int)
    df.loc[is_price_sens, 'price_history_opened'] = (np.random.rand(is_price_sens.sum()) < 0.4).astype(int)
    
    df['competitor_price_checked'] = ((df['tab_switch_count'] > 2) & (df['copy_product_title'] == 1)).astype(int)
    df['competitor_difference'] = np.random.normal(0, 10, size=n) 

    # ---------------------------------------------------------
    # 11. DELIVERY & CHECKOUT FRICTION
    # ---------------------------------------------------------
    df['estimated_delivery_days'] = np.random.poisson(lam=3, size=n)
    df.loc[df['is_premium_member'] == 1, 'estimated_delivery_days'] = np.random.poisson(lam=1, size=df['is_premium_member'].sum())
    
    df['free_delivery_eligible'] = (df['is_premium_member'] == 1) | (df['cart_value'] > 500)
    df['total_shipping_charges'] = np.where(df['free_delivery_eligible'], 0, np.random.choice([40, 50, 100], size=n))
    df['delivery_unavailable_items'] = (np.random.rand(n) < 0.01).astype(int) 
    
    df['payment_failures'] = np.random.poisson(lam=0.1, size=n)
    df['checkout_restart_count'] = np.random.poisson(lam=0.1, size=n)
    df['otp_timeout'] = (np.random.rand(n) < 0.02).astype(int)
    
    df['device_type'] = np.random.choice(['Mobile', 'Desktop', 'Tablet'], size=n, p=[0.7, 0.25, 0.05])
    df['network_type'] = np.random.choice(['WiFi', '4G', '5G', '3G'], size=n, p=[0.4, 0.4, 0.15, 0.05])
    df['battery_level'] = np.random.randint(1, 101, size=n)
    
    bad_conn = (df['device_type'] == 'Mobile') & (df['network_type'] == '3G')
    df.loc[bad_conn, 'payment_failures'] += np.random.poisson(lam=1, size=bad_conn.sum())

    # ---------------------------------------------------------
    # 12. EMBEDDINGS (8 Dim Product, 4 Dim Category)
    # ---------------------------------------------------------
    print("Generating Vector Embeddings...")
    for i in range(1, 9):
        df[f'product_embedding_{i}'] = np.random.normal(0, 1, size=n).astype(np.float32)
    for i in range(1, 5):
        df[f'category_embedding_{i}'] = np.random.normal(0, 1, size=n).astype(np.float32)

    # ---------------------------------------------------------
    # 13. ENGINEERED PSYCHOLOGY SCORES
    # ---------------------------------------------------------
    print("Calculating Psychological Scores...")
    pv_safe = np.where(df['page_views'] == 0, 1, df['page_views'])
    dur_safe = np.where(df['session_duration_seconds'] == 0, 1, df['session_duration_seconds'])
    
    df['review_visit_ratio'] = (df['positive_reviews_read'] + df['negative_reviews_read']) / pv_safe
    df['purchase_intent_score'] = (df['total_items_in_cart'] + df['action_transition_count']) / dur_safe
    df['hesitation_score'] = (df['idle_time_seconds'] + df['time_between_cart_and_checkout']) / dur_safe
    
    df['quality_uncertainty_score'] = df['negative_reviews_read'] * 0.5 + df['zoomed_images_count'] * 0.2 + (df['return_policy_days']==0)*0.3
    df['price_sensitivity_score'] = df['coupon_error_count'] * 0.3 + df['tab_switch_count'] * 0.1 + (df['persona']=="Price Sensitive Shopper")*0.5
    df['trust_score'] = df['seller_trust_score']/5.0 * 0.6 + df['is_flipkart_assured'] * 0.4 - df['fake_review_probability']
    df['impulse_buy_score'] = np.where(df['session_duration_seconds'] < 120, 1.0, 0.0) + (df['persona']=="Impulse Buyer")*0.5

    # ---------------------------------------------------------
    # 14. TARGET VARIABLE SIMULATION (LOG-ODDS + NOISE)
    # ---------------------------------------------------------
    print("Simulating Target Labels...")
    Z = -1.0 
    
    Z += -1.5 * df['purchase_intent_score']
    Z += 2.5 * df['hesitation_score']
    Z += 1.2 * df['quality_uncertainty_score']
    Z += 0.8 * df['price_sensitivity_score'] * np.where(df['competitor_difference'] < 0, 1, 0)
    Z += -2.0 * df['trust_score']
    Z += 1.5 * (df['total_shipping_charges'] / 100.0)
    Z += 1.0 * df['checkout_restart_count']
    Z += 0.5 * df['payment_failures']
    
    # Dealbreakers
    Z = np.where(df['delivery_unavailable_items'] > 0, Z + 10.0, Z)
    Z = np.where(df['otp_timeout'] == 1, Z + 4.0, Z)
    Z = np.where(is_bot, 15.0, Z)
    
    Z = np.where(is_price_sens, Z + 1.5, Z)
    Z = np.where(is_loyal, Z - 2.0, Z)
    
    # Noise & Prob
    noise = np.random.normal(0, 0.5, size=n)
    Z_final = Z + noise
    df['abandonment_probability'] = 1 / (1 + np.exp(-Z_final))
    
    # Bernoulli sampling
    df['cart_abandoned'] = np.random.binomial(1, df['abandonment_probability'])
    
    # Irrational Noise
    irrational_purchase = (df['abandonment_probability'] > 0.8) & (np.random.rand(n) < 0.05)
    irrational_abandon = (df['abandonment_probability'] < 0.2) & (np.random.rand(n) < 0.07)
    df.loc[irrational_purchase, 'cart_abandoned'] = 0
    df.loc[irrational_abandon, 'cart_abandoned'] = 1

    # ---------------------------------------------------------
    # 15. MISSING VALUES INJECTION (MCAR, MAR, MNAR)
    # ---------------------------------------------------------
    print("Injecting Missing Values...")
    hide_age_prob = np.where(df['user_age'] > 50, 0.3, 0.05)
    df.loc[np.random.rand(n) < hide_age_prob, 'user_age'] = np.nan
    
    df.loc[df['device_type'] == 'Mobile', 'mouse_speed'] = np.nan
    df.loc[df['device_type'] == 'Tablet', 'mouse_speed'] = np.nan
    
    df.loc[np.random.rand(n) < 0.05, 'location_tier'] = np.nan

    # Memory optimization
    for col in df.select_dtypes(include=['float64']).columns:
        df[col] = df[col].astype('float32')
        
    return df

if __name__ == "__main__":
    df = generate_data(N_SESSIONS)
    
    print("\nDataset Generation Complete!")
    print(f"Shape: {df.shape}")
    print(f"Overall Abandonment Rate: {df['cart_abandoned'].mean():.2%}")
    
    csv_path = "synthetic_cart_abandonment_500k.csv"
    parquet_path = "synthetic_cart_abandonment_500k.parquet"
    
    print(f"Exporting to {parquet_path}...")
    df.to_parquet(parquet_path, index=False)
    
    print(f"Exporting to {csv_path} (This might take a minute)...")
    df.to_csv(csv_path, index=False)
    
    print("Done!")
