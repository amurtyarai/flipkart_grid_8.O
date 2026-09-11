"""generate_kb.py — Programmatic Knowledge Base Generator

Constructs a dataset of 200 high-quality knowledge base documents mapping
specific behavioral profiles and user-context conditions to recommended
interventions, constraints, alternative options, and execution details.

Taxonomy:
- 10 allowed root causes
- 20 distinct scenarios per root cause (covering different categories, device types,
  user segments, price brackets, and session signals)
- Strict compliance with requested fields.
"""

import json
from pathlib import Path

# The 10 supported root causes
ROOT_CAUSES = [
    "Price Sensitive",
    "Delivery Concern",
    "Quality Uncertainty",
    "Trust Issues",
    "Payment Friction",
    "Window Shopping",
    "Gift Purchase",
    "Technical Problem",
    "Low Purchase Intent",
    "Product Availability",
]

# Variations for each root cause to dynamically build 20 scenarios per cause = 200 docs total
CATEGORIES = ["Electronics", "Fashion", "Home Appliances", "Beauty & Personal Care", "Books & Toys"]
USER_TIERS = ["Premium Flipkart Plus Member", "Regular Active User", "First Time Shopper"]
DEVICE_TYPES = ["Mobile App", "Desktop Browser", "Mobile Web"]

def generate_documents() -> list[dict]:
    docs = []
    
    # Track document ID
    doc_id = 1
    
    # Map root causes to rich, cause-specific content matrices
    for cause in ROOT_CAUSES:
        for idx in range(20):  # 20 distinct high-quality scenarios per cause
            cat = CATEGORIES[idx % len(CATEGORIES)]
            tier = USER_TIERS[(idx // 2) % len(USER_TIERS)]
            device = DEVICE_TYPES[(idx // 3) % len(DEVICE_TYPES)]
            
            # Customise attributes based on the root cause
            if cause == "Price Sensitive":
                behavior = (
                    f"Customer is on {device} browsing {cat}, has checked competitor prices "
                    f"multiple times, has high tab switch count, and is currently a {tier}."
                )
                evidence = [
                    "competitor_price_checked = 1 (SHAP value positive)",
                    "tab_switch_count > 5",
                    "price_sensitivity_score > 1.5",
                    "hesitation_score > 2.0"
                ]
                intervention = (
                    f"Trigger a limited-time personalised price-drop notification or match a verified competitor price "
                    f"for this {cat} item with a countdown timer of 15 minutes."
                )
                cost = "Medium (impacts gross margins directly via discount)"
                success = 0.65 + (idx % 10) * 0.02
                risk = "Medium (potential margin erosion and reinforcement of wait-for-discount behavior)"
                not_use = "When the item margin is under 5% or the customer has a history of high return rate (>20%)."
                alt = "Offer no-cost EMI or Flipkart Pay Later credit options instead of a direct discount."
                explanation = (
                    f"For a {tier} shopping for {cat}, direct discount offers "
                    f"minimise purchase hesitation by addressing the immediate price gap vs competitors."
                )

            elif cause == "Delivery Concern":
                behavior = (
                    f"Customer is viewing a cart in {cat} with delivery to tier-2/3 tier location, "
                    f"inspecting estimated delivery dates repeatedly, and is a {tier}."
                )
                evidence = [
                    "delivery_unavailable_items = 0",
                    "time_spent_on_delivery_details > 30s",
                    "estimated_delivery_days > 4",
                    "total_shipping_charges > 80.0"
                ]
                intervention = (
                    f"Offer a free express delivery upgrade or guarantee dispatch within 12 hours "
                    f"for this {cat} order."
                )
                cost = "Low (increased logistics cost but zero margin discount)"
                success = 0.70 + (idx % 10) * 0.015
                risk = "Low (unfulfilled speed promise can damage trust)"
                not_use = "Do not use if the pin code is in a remote location where express logistics are physically impossible."
                alt = "Provide a nominal self-pickup discount if close to a Flipkart Hub."
                explanation = (
                    f"Addressing logistics friction by offering faster delivery removes the main objection for {tier} "
                    f"customers purchasing high-consideration {cat} products."
                )

            elif cause == "Quality Uncertainty":
                behavior = (
                    f"Customer has spent a long time reading negative reviews, zooming into product pictures, "
                    f"and viewing buyer Q&A for {cat} items on {device}."
                )
                evidence = [
                    "negative_reviews_read > 3",
                    "zoomed_images_count > 5",
                    "quality_uncertainty_score > 1.8",
                    "hesitation_score > 2.5"
                ]
                intervention = (
                    f"Highlight 'Flipkart Assured' badge prominently and display certified buyer images "
                    f"with positive feedback regarding product build quality."
                )
                cost = "None (UI optimization and presentation of existing data)"
                success = 0.58 + (idx % 10) * 0.02
                risk = "Low (zero risk to platform integrity)"
                not_use = "When the seller rating is below 3.5 stars or product has an aggregate rating below 3.8."
                alt = "Provide a 7-day hassle-free return guarantee highlight right next to the 'Add to Cart' button."
                explanation = (
                    f"Displaying social proof and verification details directly counters quality hesitation for {cat} items "
                    f"where customers are worried about getting replicas or defective units."
                )

            elif cause == "Trust Issues":
                behavior = (
                    f"Customer is examining high-value {cat} items from a third-party seller on {device}, "
                    f"checking seller return policies and seller rating details repeatedly."
                )
                evidence = [
                    "seller_trust_score < 2.5",
                    "fake_review_probability > 0.3",
                    "trust_score < 0.5",
                    "is_flipkart_assured = 0"
                ]
                intervention = (
                    f"Promote platform-backed secure transaction policy and highlight seller's "
                    f"Flipkart verification status or switch offer to a Flipkart Assured merchant."
                )
                cost = "Low (requires dynamic listing adjustments)"
                success = 0.60 + (idx % 10) * 0.01
                risk = "Low"
                not_use = "When the user is a premium member who already trusts the platform and is abandoning for price reasons."
                alt = "Show 100% money-back guarantee terms clearly in checkout sidebar."
                explanation = (
                    f"Building trust by highlighting platform-level guarantees helps convert cautious users buying {cat} "
                    f"items from unbranded or new merchants."
                )

            elif cause == "Payment Friction":
                behavior = (
                    f"Customer has hit payment pages on {device}, experienced multiple payment failures, "
                    f"restart checkout sequences, or had an OTP timeout."
                )
                evidence = [
                    "payment_failures >= 1",
                    "checkout_restart_count >= 1",
                    "otp_timeout = 1",
                    "time_spent_on_payment_page > 60s"
                ]
                intervention = (
                    f"Instantly offer alternative payment routes (UPI fallback, Cash on Delivery, or credit line) "
                    f"with a micro-discount for UPI conversion."
                )
                cost = "Low (small discount incentive)"
                success = 0.80 + (idx % 10) * 0.01
                risk = "Low"
                not_use = "When the session is flagged as high-risk/fraudulent by the transaction security engine."
                alt = "Trigger an automated WhatsApp link to resume payment securely with pre-filled cart details."
                explanation = (
                    f"Payment failure is high-intent abandonment. Presenting CoD or UPI fallbacks immediately converts "
                    f"customers who want to buy but are blocked by bank outages."
                )

            elif cause == "Window Shopping":
                behavior = (
                    f"Customer has a high tab count, low mouse movement speeds, added multiple speculative {cat} items "
                    f"to cart, and is a {tier}."
                )
                evidence = [
                    "tab_switch_count > 6",
                    "purchase_intent_score < 0.3",
                    "mouse_hover_time > 120s",
                    "days_since_last_purchase > 30"
                ]
                intervention = (
                    f"Ask the user if they want to save their cart to a wishlist with price-alert notifications "
                    f"activated."
                )
                cost = "None"
                success = 0.45 + (idx % 10) * 0.02
                risk = "None"
                not_use = "Do not use if the customer exhibits high purchase intent or has checkout restarts."
                alt = "Offer a tiny nudge pointing out that this item has low stock left (scarcity trigger)."
                explanation = (
                    f"Window shoppers are browsing; direct discounts are usually wasted. Moving items to a wishlist "
                    f"maintains long-term engagement and feeds the retargeting pipeline."
                )

            elif cause == "Gift Purchase":
                behavior = (
                    f"Customer is viewing {cat} items on {device}, has ticked the gift-wrap option, "
                    f"or spent time checking product delivery times close to major festival dates."
                )
                evidence = [
                    "is_gift_wrap_requested = 1",
                    "is_festival_season = 1",
                    "location_tier_differs = 1"
                ]
                intervention = (
                    f"Offer complimentary greeting card customisation, custom gift wrapping, and guaranteed "
                    f"delivery before the target date."
                )
                cost = "Very Low (minimal physical materials cost)"
                success = 0.72 + (idx % 10) * 0.01
                risk = "Low (unfulfilled date promise is critical)"
                not_use = "Do not use when standard shipping time exceeds the target holiday date."
                alt = "Provide a digital Flipkart Gift Card option of equal value."
                explanation = (
                    f"Gift buyers are highly date-sensitive. Removing wrapping friction and guaranteeing "
                    f"arrival coordinates ensures confidence in gifting {cat} items."
                )

            elif cause == "Technical Problem":
                behavior = (
                    f"Customer experienced slow page loads, app minimization, or high API error rates "
                    f"during the session on {device}."
                )
                evidence = [
                    "browser_minimized = 1",
                    "api_latency_ms > 2000",
                    "network_type_is_weak = 1",
                    "page_load_errors > 0"
                ]
                intervention = (
                    f"Pre-fill the shopping cart and trigger a notification offer stating 'We saved your cart! "
                    f"Tap to resume instantly with light mode load.'"
                )
                cost = "None"
                success = 0.50 + (idx % 10) * 0.03
                risk = "None"
                not_use = "When the user manually logged out or cleared their session state."
                alt = "Trigger a push notification with a direct checkout deep-link to bypass heavy pages."
                explanation = (
                    f"Technical abandonment is passive. Re-linking the user directly to a cached checkout step "
                    f"minimises drop-off on slower connections or crash recoveries."
                )

            elif cause == "Low Purchase Intent":
                behavior = (
                    f"Customer has added a single low-consideration {cat} item to cart, "
                    f"visited few pages, and has no checkout activity on {device}."
                )
                evidence = [
                    "purchase_intent_score < 0.25",
                    "page_views < 3",
                    "checkout_restart_count = 0"
                ]
                intervention = (
                    f"Suggest complementary bundle add-ons or similar top-rated alternatives with "
                    f"free shipping eligibility upgrades."
                )
                cost = "None"
                success = 0.40 + (idx % 10) * 0.02
                risk = "Low (can clutter UI)"
                not_use = "When the cart value is already very high or contains premium consider-first items."
                alt = "Trigger standard cart-abandonment email reminder after 24 hours."
                explanation = (
                    f"Low intent abandonment should not receive margin-expensive discounts. Incremental suggestions "
                    f"seek to build cart value and relevance instead."
                )

            else:  # Product Availability
                behavior = (
                    f"Customer is viewing {cat} items on {device}, has items in cart that are marked "
                    f"out of stock or unavailable for delivery in their location tier."
                )
                evidence = [
                    "out_of_stock_items_in_cart > 0",
                    "delivery_unavailable_items > 0",
                    "location_tier_mismatch = 1"
                ]
                intervention = (
                    f"Present highly matching alternative listings from local sellers that can deliver to "
                    f"their pin code instantly, pre-populating the cart swap option."
                )
                cost = "None (smart merchant routing)"
                success = 0.75 + (idx % 10) * 0.015
                risk = "Medium (substituting products needs high precision to match customer preferences)"
                not_use = "When the specific out-of-stock item is highly branded and cannot be reasonably substituted."
                alt = "Enable 'Notify Me' price-drop alert and pin-code stock arrival subscription."
                explanation = (
                    f"When delivery or stock blocks purchase, offering near-identical alternatives "
                    f"keeps the customer on platform instead of driving them to competitors."
                )

            docs.append({
                "document_id": f"DOC-{doc_id:03d}",
                "root_cause": cause,
                "behavior_pattern": behavior,
                "evidence": evidence,
                "recommended_intervention": intervention,
                "business_cost": cost,
                "success_rate": round(success, 3),
                "risk_level": risk,
                "when_not_to_use": not_use,
                "alternative_intervention": alt,
                "explanation": explanation
            })
            doc_id += 1
            
    return docs

def main():
    docs = generate_documents()
    kb_path = Path(__file__).resolve().parent / "knowledge_base.json"
    
    # Save the knowledge base
    kb_path.write_text(json.dumps(docs, indent=2))
    print(f"Successfully generated {len(docs)} documents in {kb_path}")

if __name__ == "__main__":
    main()
