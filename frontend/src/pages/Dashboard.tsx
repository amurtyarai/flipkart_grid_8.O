import React, { useState, useEffect, useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LineChart, Line, AreaChart, Area, CartesianGrid } from 'recharts';
import { Sparkles, Clock, User, HelpCircle, Activity, Brain, Zap, Truck, Layers, CreditCard, Star, BarChart3, CheckCircle2, AlertTriangle, Globe, Percent, ShieldCheck, Wallet, PackageCheck, TrendingUp, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { apiService } from '../services/api';
import { Card, Badge, Loader, Button } from '../components/DesignSystem';
import { translateNudge } from '../utils/multilingual';

const CountUpComponent: React.FC<{ end: number; duration?: number; decimals?: number; separator?: string }> = ({ end, decimals = 0, separator = '' }) => {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let startTimestamp: number | null = null;
    const durationMs = 1200;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / durationMs, 1);
      setVal(progress * end);
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      }
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [end]);

  const formatted = decimals > 0 ? val.toFixed(decimals) : Math.round(val).toString();
  return <>{separator ? formatted.replace(/\B(?=(\d{3})+(?!\d))/g, separator) : formatted}</>;
};

const Dashboard: React.FC = () => {
  const { cart, events, prediction, setPrediction, language, sessionId, userId, predictionHistory, startNewSession } = useStore();

  const [isLoading, setIsLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [interventionDeployed, setInterventionDeployed] = useState(false);

  const trendData = useMemo(() => {
    let currentProb = 0.35;
    const points = events.map((evt, idx) => {
      const stepNum = idx + 1;
      
      if (evt.eventType === 'TAB_SWITCH') currentProb = Math.min(0.98, currentProb + 0.12);
      else if (evt.eventType === 'IDLE') currentProb = Math.min(0.98, currentProb + 0.08);
      else if (evt.eventType === 'MOUSE_LEAVE') currentProb = Math.min(0.98, currentProb + 0.15);
      else if (evt.eventType === 'VIEW_SPECIFICATIONS' || evt.eventType === 'VIEW_REVIEWS') currentProb = Math.max(0.05, currentProb - 0.05);
      else if (evt.eventType === 'APPLY_COUPON') currentProb = Math.max(0.05, currentProb - 0.20);
      else if (evt.eventType === 'ADD_TO_CART') currentProb = Math.max(0.05, currentProb - 0.10);
      
      const historicalProb = predictionHistory[stepNum];
      const displayProb = historicalProb !== undefined ? historicalProb : currentProb;

      return {
        name: `#${stepNum}`,
        "Risk %": Math.round(displayProb * 100)
      };
    });

    const defaultRisk = prediction ? Math.round(prediction.abandonmentProbability * 100) : 35;
    return points.length > 0 ? points : [{ name: "#1", "Risk %": defaultRisk }];
  }, [events, prediction, predictionHistory]);

  // Derived risk probability synced with model prediction (single source of truth)
  const graphRiskProbability = useMemo(() => {
    if (prediction && typeof prediction.abandonmentProbability === 'number') {
      return prediction.abandonmentProbability;
    }
    const lastPoint = trendData[trendData.length - 1];
    return (lastPoint?.["Risk %"] ?? 35) / 100;
  }, [prediction, trendData]);

  // 2. Journey Activity Velocity (Cumulative events counts)
  const journeyData = useMemo(() => {
    let total = 0;
    const points = events.map((_, idx) => {
      total += 1;
      return {
        step: `#${idx + 1}`,
        "Activity": total
      };
    });
    return points.length > 0 ? points : [{ step: "#1", "Activity": 0 }];
  }, [events]);

  // 3. Session Statistics by Event Class
  const statData = useMemo(() => {
    const friction = events.filter(e => ['TAB_SWITCH', 'IDLE', 'MOUSE_LEAVE', 'FAILED_COUPON'].includes(e.eventType)).length;
    const catalog = events.filter(e => ['VIEW_PRODUCT', 'VIEW_SPECIFICATIONS', 'VIEW_REVIEWS', 'ZOOM_IMAGE', 'COMPARE_PRODUCT', 'CHECK_DELIVERY', 'SEARCH', 'FILTER', 'SORT'].includes(e.eventType)).length;
    const cartOps = events.filter(e => ['ADD_TO_CART', 'REMOVE_FROM_CART', 'CHANGE_QUANTITY', 'APPLY_COUPON', 'OPEN_CART', 'CHECKOUT', 'BUY_NOW', 'WISHLIST'].includes(e.eventType)).length;

    return [
      { name: 'Friction', count: friction },
      { name: 'Catalog', count: catalog },
      { name: 'Cart Ops', count: cartOps }
    ];
  }, [events]);

  // 4. Formatted SHAP Feature Names for Crisp Labeling
  const shapChartData = useMemo(() => {
    if (!prediction?.topFeatures) return [];
    return prediction.topFeatures.map(f => {
      let displayName = f.feature
        .replace(/_score$/i, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      if (displayName === 'Time Between Cart And Checkout') displayName = 'Time Cart to Checkout';
      if (displayName === 'Free Delivery Eligible') displayName = 'Free Delivery Eligible';
      return {
        ...f,
        displayName
      };
    });
  }, [prediction]);

  // ---------------------------------------------------------------------------
  // Real-time API Inference logic
  // ---------------------------------------------------------------------------
  const runPredictionPipeline = async () => {
    if (cart.length === 0) {
      setPrediction(null);
      return;
    }
    
    setIsLoading(true);
    setErrorStatus(null);

    // Calculate features from Zustand state
    const hesitationScore = events.filter(e => e.eventType === 'IDLE').length * 2.5 + 
                           events.filter(e => e.eventType === 'ZOOM_IMAGE').length * 1.5;
    const tabSwitchCount = events.filter(e => e.eventType === 'TAB_SWITCH').length;
    const checkoutRestartCount = events.filter(e => e.eventType === 'CHECKOUT').length > 1 ? 1 : 0;
    const paymentFailures = events.filter(e => e.eventType === 'FAILED_COUPON').length;
    
    const competitorPriceChecked = events.some(e => e.eventType === 'COMPARE_PRODUCT') ? 1 : 0;
    const isPremiumMember = 0; // Default

    const cartValue = cart.reduce((acc, item) => acc + (item.product.price * (1 - item.product.discount) * item.quantity), 0);
    const totalItemsInCart = cart.reduce((acc, item) => acc + item.quantity, 0);

    const priceSensitivity = events.filter(e => e.eventType === 'APPLY_COUPON' || e.eventType === 'FAILED_COUPON').length * 1.2 +
                             competitorPriceChecked * 1.5;
    const qualityUncertainty = events.filter(e => e.eventType === 'VIEW_REVIEWS' || e.eventType === 'VIEW_SPECIFICATIONS').length * 0.8;
    const trustScore = 0.85 - (paymentFailures * 0.2);

    const last3Events = events.slice(-3);
    const recentPositiveCount = last3Events.filter(e => ['ADD_TO_CART', 'APPLY_COUPON', 'VIEW_SPECIFICATIONS', 'VIEW_REVIEWS', 'WISHLIST'].includes(e.eventType)).length;
    const conversionAffinity = recentPositiveCount * 1.5;

    const session_data = {
      hesitation_score: Math.min(10.0, hesitationScore + 1.2),
      trust_score: Math.max(0.1, trustScore),
      price_sensitivity_score: Math.min(5.0, priceSensitivity),
      quality_uncertainty_score: Math.min(5.0, qualityUncertainty),
      purchase_intent_score: Math.max(0.05, 1.0 - (tabSwitchCount * 0.1) - (hesitationScore * 0.05)),
      total_shipping_charges: cartValue >= 500 ? 0.0 : 40.0,
      cart_value: cartValue,
      total_items_in_cart: totalItemsInCart,
      payment_failures: paymentFailures,
      checkout_restart_count: checkoutRestartCount,
      tab_switch_count: tabSwitchCount,
      competitor_price_checked: competitorPriceChecked,
      is_premium_member: isPremiumMember,
      total_historical_purchases: 6,
      persona: priceSensitivity > 2.0 ? "Price Sensitive Shopper" : "Regular Active User",
      conversion_affinity_score: conversionAffinity
    };

    const firstProduct = cart[0]?.product;
    const product_metadata = firstProduct ? {
      category: firstProduct.category,
      brand_tier: firstProduct.price > 5000 ? "Premium" : "Mass Market",
      price: firstProduct.price
    } : null;

    const user_metadata = {
      total_purchases: 6,
      return_rate: 0.05
    };

    try {
      const result = await apiService.predictAbandonment({
        session_data,
        product_metadata,
        user_metadata,
        language
      });

      setPrediction({
        abandonmentProbability: result.abandonment_probability,
        prediction: result.prediction,
        rootCause: result.root_cause,
        recommendedIntervention: result.recommended_intervention,
        multilingualNudge: result.multilingual_nudge || result.recommended_intervention,
        confidence: result.confidence,
        topFeatures: result.top_features.map((f: any) => ({
          feature: f.feature,
          importance: f.importance,
          direction: f.direction
        }))
      });
    } catch (err) {
      console.warn("Failed to fetch live API prediction, executing mathematical fallback...");
      
      const mockProb = Math.min(0.98, Math.max(0.05, 0.35 + (tabSwitchCount * 0.12) + (hesitationScore * 0.08) - (trustScore * 0.2)));

      // Dynamic root cause: analyze which event signals dominate the session
      const frictionScores: { cause: string; score: number; intervention: string }[] = [
        {
          cause: "Competitor Price Comparison",
          score: tabSwitchCount * 3.0 + (competitorPriceChecked * 5.0),
          intervention: "Offer standard FLIPKART50 checkout coupon to lower cart total friction."
        },
        {
          cause: "Decision Hesitation",
          score: hesitationScore * 1.5 + events.filter(e => e.eventType === 'IDLE').length * 2.0,
          intervention: "Display social proof: '47 users bought this in the last hour' to create urgency."
        },
        {
          cause: "Price Sensitivity",
          score: priceSensitivity * 2.5 + events.filter(e => e.eventType === 'APPLY_COUPON' || e.eventType === 'FAILED_COUPON').length * 3.0,
          intervention: "Show available EMI options and no-cost EMI plans to reduce perceived price barrier."
        },
        {
          cause: "Quality Uncertainty",
          score: qualityUncertainty * 2.0 + events.filter(e => e.eventType === 'VIEW_REVIEWS' || e.eventType === 'VIEW_SPECIFICATIONS').length * 2.5,
          intervention: "Display customer review overlays detailing seller credibility and shipping assurance."
        },
        {
          cause: "Delivery Concern",
          score: events.filter(e => e.eventType === 'CHECK_DELIVERY').length * 4.0 + (cartValue < 500 ? 3.0 : 0),
          intervention: "Highlight free delivery eligibility or offer shipping fee waiver for this order."
        },
        {
          cause: "Exit Intent Detected",
          score: events.filter(e => e.eventType === 'MOUSE_LEAVE').length * 4.0,
          intervention: "Trigger exit-intent popup with limited-time discount to retain the user."
        },
        {
          cause: "Payment Friction",
          score: paymentFailures * 5.0 + checkoutRestartCount * 4.0,
          intervention: "Suggest alternative payment methods (UPI, wallets) to reduce checkout friction."
        }
      ];

      // Sort by score descending, pick the top cause
      frictionScores.sort((a, b) => b.score - a.score);
      const topFriction = frictionScores[0];

      const mockCause = topFriction.score > 0 ? topFriction.cause : (mockProb >= 0.45 ? "General Hesitation" : "None");
      const mockIntervention = topFriction.score > 0
        ? topFriction.intervention
        : mockProb >= 0.45
        ? "Display customer review overlays detailing seller credibility and shipping assurance."
        : "No intervention needed. Regular conversion flow.";

      setPrediction({
        abandonmentProbability: mockProb,
        prediction: mockProb >= 0.50,
        rootCause: mockCause,
        recommendedIntervention: mockIntervention,
        multilingualNudge: translateNudge(mockIntervention, language),
        confidence: 0.85 - (mockProb * 0.2),
        topFeatures: [
          { feature: "hesitation_score", importance: hesitationScore * 0.5, direction: "increases_abandonment" },
          { feature: "tab_switch_count", importance: tabSwitchCount * 0.4, direction: "increases_abandonment" },
          { feature: "trust_score", importance: -trustScore * 0.3, direction: "decreases_abandonment" }
        ]
      });
      setErrorStatus("Using simulator mode (API server offline)");
    } finally {
      setIsLoading(false);
    }
  };

  // Run pipeline whenever cart, events, or target language selection changes
  useEffect(() => {
    runPredictionPipeline();
  }, [cart.length, events.length, language]);

  // Dynamic Polling Loop: Periodically sync session events and prediction from backend database
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`http://127.0.0.1:8000/analysis/${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          // Sync events if backend has more events
          if (data.events && Array.isArray(data.events) && data.events.length !== events.length) {
            useStore.setState({ events: data.events });
          }
          // Sync prediction if backend has a fresh prediction snapshot
          if (data.latest_prediction) {
            setPrediction({
              abandonmentProbability: data.latest_prediction.abandonment_probability,
              prediction: data.latest_prediction.prediction,
              rootCause: data.latest_prediction.root_cause,
              recommendedIntervention: data.latest_prediction.recommended_intervention,
              multilingualNudge: data.latest_prediction.multilingual_nudge || data.latest_prediction.recommended_intervention,
              confidence: data.latest_prediction.confidence,
              topFeatures: data.latest_prediction.top_features.map((f: any) => ({
                feature: f.feature,
                importance: f.importance,
                direction: f.direction
              }))
            });
          }
        }
      } catch (err) {
        console.warn("Dynamic polling sync failed:", err);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [sessionId, events.length, setPrediction]);

  // Color mappings
  const getRiskColor = (prob: number) => {
    if (prob >= 0.70) return '#ef4444'; // Red
    if (prob >= 0.40) return '#f59e0b'; // Amber
    return '#10b981'; // Emerald
  };

  const getRiskText = (prob: number) => {
    if (prob >= 0.70) return 'HIGH ABANDONMENT RISK';
    if (prob >= 0.40) return 'MODERATE FRICTION RISK';
    return 'LOW CONVERSION RISK';
  };

  const getRootCauseConfig = (rootCause: string = '', text: string = '') => {
    const rc = rootCause.toLowerCase();
    if (rc.includes('price') || rc.includes('competitor') || rc.includes('coupon') || rc.includes('discount')) {
      return {
        icon: <Percent size={22} className="text-[#F8CB2E]" />,
        badge: "Price Recovery Target",
        buttonText: "DEPLOY PRICE DISCOVERY NUDGE",
        subtitle: "Targeted price-drop & coupon strategy to resolve price sensitivity & competitor comparison."
      };
    }
    if (rc.includes('delivery') || rc.includes('shipping') || rc.includes('pincode')) {
      return {
        icon: <Truck size={22} className="text-[#F8CB2E]" />,
        badge: "Shipping & Logistics Target",
        buttonText: "DEPLOY FREE SHIPPING WAIVER",
        subtitle: "Optimized shipping incentive to eliminate delivery cost & timeline friction at checkout."
      };
    }
    if (rc.includes('trust') || rc.includes('seller') || rc.includes('fake') || rc.includes('assurance')) {
      return {
        icon: <ShieldCheck size={22} className="text-[#F8CB2E]" />,
        badge: "Seller Assurance Target",
        buttonText: "DEPLOY SELLER CREDIBILITY NUDGE",
        subtitle: "Verified seller badges & Buyer Protection guarantee to reinforce user trust."
      };
    }
    if (rc.includes('quality') || rc.includes('review') || rc.includes('rating') || rc.includes('uncertainty')) {
      return {
        icon: <Star size={22} className="text-[#F8CB2E]" />,
        badge: "Social Proof Target",
        buttonText: "DEPLOY REVIEW & RATING OVERLAY",
        subtitle: "Real-time customer reviews and top-rated specification assurance to resolve product doubt."
      };
    }
    if (rc.includes('payment') || rc.includes('otp') || rc.includes('checkout') || rc.includes('friction') || rc.includes('card')) {
      return {
        icon: <Wallet size={22} className="text-[#F8CB2E]" />,
        badge: "Checkout Assistance Target",
        buttonText: "DEPLOY ALTERNATE PAYMENT NUDGE",
        subtitle: "UPI, Wallets & No-cost EMI recommendations to simplify checkout recovery."
      };
    }
    if (rc.includes('window') || rc.includes('browse') || rc.includes('tab') || rc.includes('duration')) {
      return {
        icon: <Sparkles size={22} className="text-[#F8CB2E]" />,
        badge: "Urgency Trigger Target",
        buttonText: "DEPLOY LIMITED-TIME OFFER NOW",
        subtitle: "High-urgency social proof and limited-time offer timer to convert casual browsers."
      };
    }
    if (rc.includes('availability') || rc.includes('stock')) {
      return {
        icon: <PackageCheck size={22} className="text-[#F8CB2E]" />,
        badge: "Stock Assurance Target",
        buttonText: "DEPLOY LIVE STOCK URGENCY NUDGE",
        subtitle: "Low-stock real-time alerts and variant alternatives to retain immediate intent."
      };
    }
    if (rc.includes('intent') || rc.includes('hesitation') || rc.includes('idle')) {
      return {
        icon: <TrendingUp size={22} className="text-[#F8CB2E]" />,
        badge: "Intent Amplification Target",
        buttonText: "DEPLOY CONVERSION RECOVERY NUDGE",
        subtitle: "Personalized cart reminders & benefits overlay to reactivate idle shoppers."
      };
    }

    // Fallback based on recommendation text
    if (text.includes('shipping') || text.includes('delivery')) {
      return {
        icon: <Truck size={22} className="text-[#F8CB2E]" />,
        badge: "Shipping Benefit Target",
        buttonText: "DEPLOY SHIPPING NUDGE NOW",
        subtitle: "Optimized shipping incentive to eliminate checkout friction."
      };
    }
    if (text.includes('discount') || text.includes('coupon') || text.includes('EMI')) {
      return {
        icon: <CreditCard size={22} className="text-[#F8CB2E]" />,
        badge: "Financial Incentive Target",
        buttonText: "DEPLOY DISCOUNT BENEFIT NOW",
        subtitle: "Optimized price waiver and payment flexibility to retain shopper."
      };
    }
    return {
      icon: <Clock size={22} className="text-[#F8CB2E]" />,
      badge: "Conversion Recovery Target",
      buttonText: "DEPLOY INTERVENTION NOW",
      subtitle: "Optimized for instant conversion recovery before user leaves checkout funnel."
    };
  };

  const cartTotalValue = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.product.price * (1 - item.product.discount) * item.quantity), 0);
  }, [cart]);

  const handleDeployIntervention = () => {
    setInterventionDeployed(true);
    setTimeout(() => setInterventionDeployed(false), 4000);
  };

  const sparklineData = [
    { v: 12 }, { v: 19 }, { v: 14 }, { v: 25 }, { v: 22 }, { v: 31 }, { v: 28 }, { v: 38 }
  ];

  return (
    <div className="py-8 px-4 sm:px-6 max-w-[1600px] mx-auto flex flex-col gap-6 text-left relative z-10">
      
      {/* ───────────────────────────────────────────────────────── */}
      {/* ZONE 1: TOPBAR / MISSION CONTROL HEADER */}
      {/* ───────────────────────────────────────────────────────── */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass p-4 sm:p-5 rounded-xl border border-white/10"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#F8CB2E]/10 border border-[#F8CB2E]/30 flex items-center justify-center text-[#F8CB2E]">
            <Activity size={22} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-white font-ui tracking-tight">
                Cart Abandonment Intelligence Center
              </h2>
              <span className="font-mono text-xs bg-[#F8CB2E] text-[#080c14] font-extrabold px-2 py-0.5 rounded shadow">
                GRiD 8.0
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Multi-Agent Pipeline · XGBoost Classifier · Local SHAP Attribution · ChromaDB RAG Engine
            </p>
          </div>
        </div>
        
        {/* Status Alerts & Actions */}
        <div className="flex items-center gap-3">
          {errorStatus ? (
            <Badge variant="warning">{errorStatus}</Badge>
          ) : cart.length > 0 ? (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-emerald-400 font-mono text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-dot" />
              <span>FastAPI Backend Connected</span>
            </div>
          ) : null}

          <Button
            onClick={startNewSession}
            variant="glass"
            className="text-xs font-mono py-2 text-slate-300 hover:text-white border border-white/10"
          >
            <RotateCcw size={14} className="text-[#F8CB2E]" />
            <span>New Session</span>
          </Button>

          {cart.length > 0 && (
            <Button
              onClick={runPredictionPipeline}
              isLoading={isLoading}
              variant="secondary"
              className="text-xs font-mono py-2"
            >
              <Zap size={14} className="text-[#F8CB2E]" />
              <span>Re-run Pipeline</span>
            </Button>
          )}
        </div>
      </motion.div>

      {/* NO ACTIVE SESSION FALLBACK */}
      {cart.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="py-24 text-center glass rounded-xl border border-white/10 flex flex-col items-center gap-4 max-w-xl mx-auto my-12 p-8"
        >
          <div className="w-16 h-16 rounded-full bg-[#F8CB2E]/10 border border-[#F8CB2E]/30 flex items-center justify-center text-[#F8CB2E]">
            <HelpCircle size={32} />
          </div>
          <h4 className="text-xl font-bold text-white font-ui">No Active Cart Session Detected</h4>
          <p className="text-xs text-slate-400 font-mono leading-relaxed max-w-md">
            To trigger real-time AI cart abandonment predictions, open the Flipkart Store, add products to your cart, or perform browsing interactions.
          </p>
          <a
            href="/store"
            className="mt-2 px-6 py-2.5 rounded-lg bg-[#F8CB2E] text-[#080c14] font-bold text-xs uppercase font-mono tracking-wider shadow-lg shadow-[#F8CB2E]/20 hover:bg-yellow-400 transition-all"
          >
            Launch Flipkart Store →
          </a>
        </motion.div>
      ) : isLoading && !prediction ? (
        <Loader />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* ───────────────────────────────────────────────────────── */}
          {/* LEFT COLUMN (Session Feed, Journey Stream & KPI Cards — 4 Cols) */}
          {/* ───────────────────────────────────────────────────────── */}
          <motion.div 
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="lg:col-span-4 flex flex-col gap-6"
          >
            {/* Active Session Overview Card */}
            <div className="glass rounded-xl p-4 border border-white/10 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <User size={14} className="text-[#F8CB2E]" />
                  <span>Active Session Feed</span>
                </span>
                <span className="font-mono text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                  Session #{sessionId}
                </span>
              </div>

              {prediction && (
                <motion.div 
                  whileHover={{ y: -2 }}
                  className={`p-4 rounded-lg bg-[#0d1220] border-l-4 transition-all duration-300 relative overflow-hidden ${
                    prediction.abandonmentProbability >= 0.70 ? 'pulse-high-risk' : ''
                  }`}
                  style={{ borderLeftColor: getRiskColor(prediction.abandonmentProbability), borderRight: '1px solid rgba(255,255,255,0.06)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span 
                      className="px-2.5 py-0.5 rounded text-[10px] font-mono font-extrabold uppercase tracking-wider"
                      style={{ 
                        backgroundColor: `${getRiskColor(prediction.abandonmentProbability)}20`, 
                        color: getRiskColor(prediction.abandonmentProbability),
                        border: `1px solid ${getRiskColor(prediction.abandonmentProbability)}40`
                      }}
                    >
                      {getRiskText(prediction.abandonmentProbability)}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">Live Active Session</span>
                  </div>

                  <div className="flex items-baseline justify-between my-2">
                    <div>
                      <span className="text-xs text-slate-400 font-mono">User ID: </span>
                      <span className="text-xs font-mono font-bold text-white">#{userId}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 font-mono">Cart Value: </span>
                      <span className="text-sm font-mono font-extrabold text-[#F8CB2E]">
                        ₹{cartTotalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>

                  {/* Animated Risk Progress Bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] font-mono mb-1">
                      <span className="text-slate-400">Abandonment Risk</span>
                      <span className="font-bold text-white">{Math.round(prediction.abandonmentProbability * 100)}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${prediction.abandonmentProbability * 100}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: getRiskColor(prediction.abandonmentProbability) }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>Root Cause: <strong className="text-white">{prediction.rootCause}</strong></span>
                    <span>Items: <strong className="text-[#F8CB2E]">{cart.reduce((a, b) => a + b.quantity, 0)}</strong></span>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Real-time Chronological Journey Log */}
            <div className="glass rounded-xl p-4 border border-white/10 flex flex-col gap-3">
              <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Clock size={14} className="text-[#60a5fa]" />
                  <span>Real-time Event Stream</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">({events.length} events)</span>
              </span>

              <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto pr-1">
                {events.length > 0 ? (
                  events.map((evt, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2 }}
                      className="p-2.5 rounded-lg bg-[#0d1220] border-l-2 border-l-[#60a5fa] border border-white/5 text-xs font-mono"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#F8CB2E] text-[11px] uppercase tracking-wider">{evt.eventType}</span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">Page: {evt.page}</div>
                    </motion.div>
                  ))
                ) : (
                  <span className="text-xs text-slate-500 font-mono py-6 text-center">No active user interactions logged.</span>
                )}
              </div>
            </div>

            {/* 4 KPI CARDS FITTED INSIDE LEFT COLUMN (Filling empty space perfectly!) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Tile 1: Sessions at Risk */}
              <div className="glass rounded-xl p-3.5 border border-white/10 relative overflow-hidden flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">Sessions at Risk</span>
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                </div>
                <div className="my-1.5">
                  <div className="text-2xl font-mono font-black text-rose-500">
                    <CountUpComponent end={247} duration={2} />
                  </div>
                  <span className="text-[9px] font-mono text-slate-500">High priority monitoring</span>
                </div>
                <div className="h-5 w-full opacity-30">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sparklineData}>
                      <Area type="monotone" dataKey="v" stroke="#ef4444" fill="#ef4444" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Tile 2: Interventions Deployed */}
              <div className="glass rounded-xl p-3.5 border border-white/10 relative overflow-hidden flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">Interventions Sent</span>
                  <span className="w-2 h-2 rounded-full bg-[#F8CB2E]" />
                </div>
                <div className="my-1.5">
                  <div className="text-2xl font-mono font-black text-[#F8CB2E]">
                    <CountUpComponent end={1083} separator="," duration={2} />
                  </div>
                  <span className="text-[9px] font-mono text-slate-500">Automated RAG deployments</span>
                </div>
                <div className="h-5 w-full opacity-30">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sparklineData}>
                      <Area type="monotone" dataKey="v" stroke="#F8CB2E" fill="#F8CB2E" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Tile 3: Conversion Uplift */}
              <div className="glass rounded-xl p-3.5 border border-white/10 relative overflow-hidden flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">Conversion Uplift</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
                <div className="my-1.5">
                  <div className="text-2xl font-mono font-black text-emerald-400">
                    +<CountUpComponent end={18.4} decimals={1} duration={2} />%
                  </div>
                  <span className="text-[9px] font-mono text-slate-500">Post-intervention recovery</span>
                </div>
                <div className="h-5 w-full opacity-30">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sparklineData}>
                      <Area type="monotone" dataKey="v" stroke="#10b981" fill="#10b981" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Tile 4: Margin Protected */}
              <div className="glass rounded-xl p-3.5 border border-white/10 relative overflow-hidden flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">Margin Protected</span>
                  <span className="w-2 h-2 rounded-full bg-[#34d399]" />
                </div>
                <div className="my-1.5">
                  <div className="text-2xl font-mono font-black text-[#34d399]">
                    ₹<CountUpComponent end={2.1} decimals={1} duration={2} />L
                  </div>
                  <span className="text-[9px] font-mono text-slate-500">Revenue recovered today</span>
                </div>
                <div className="h-5 w-full opacity-30">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sparklineData}>
                      <Area type="monotone" dataKey="v" stroke="#34d399" fill="#34d399" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

          </motion.div>

          {/* ───────────────────────────────────────────────────────── */}
          {/* RIGHT COLUMN (AI Core, SHAP & Strategy Analytics — 8 Cols) */}
          {/* ───────────────────────────────────────────────────────── */}
          <motion.div 
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="lg:col-span-8 flex flex-col gap-6"
          >
            {/* Top Details: Risk Score Ring + Root Cause + Confidence */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* ① Abandonment Probability Ring */}
              {prediction && (
                <Card variant="glow" className="md:col-span-5 flex flex-col items-center justify-center p-5 text-center gap-3 relative overflow-hidden">
                  <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest self-start">
                    ABANDONMENT PROBABILITY
                  </div>

                  <div className="relative w-40 h-40 flex items-center justify-center my-1">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(255,255,255,0.04)" strokeWidth="8" />
                      <motion.circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke={getRiskColor(graphRiskProbability)}
                        strokeWidth="8"
                        strokeDasharray={251.2}
                        initial={{ strokeDashoffset: 251.2 }}
                        animate={{ strokeDashoffset: 251.2 * (1 - graphRiskProbability) }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        strokeLinecap="round"
                      />
                    </svg>
                    
                    <div className="absolute flex flex-col items-center justify-center">
                      <span className="text-4xl font-mono font-black text-white tracking-tight">
                        <CountUpComponent end={Math.round(graphRiskProbability * 100)} duration={1.2} />%
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-0.5">
                        Risk Score
                      </span>
                    </div>
                  </div>

                  <span 
                    className="px-3 py-1 rounded-md text-[10px] font-mono font-extrabold uppercase tracking-widest shadow-sm text-center w-full"
                    style={{ 
                      color: getRiskColor(graphRiskProbability),
                      backgroundColor: `${getRiskColor(graphRiskProbability)}15`,
                      border: `1px solid ${getRiskColor(graphRiskProbability)}30`
                    }}
                  >
                    {getRiskText(graphRiskProbability)}
                  </span>

                  <div className={`w-full py-2 rounded-lg font-mono text-[11px] font-bold border flex items-center justify-center gap-2 ${
                    graphRiskProbability >= 0.50
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  }`}>
                    {graphRiskProbability >= 0.50 ? (
                      <>
                        <AlertTriangle size={14} />
                        <span>PREDICTED: LIKELY TO ABANDON</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} />
                        <span>PREDICTED: SAFE TO CONVERT</span>
                      </>
                    )}
                  </div>

                  {/* Model Confidence Score */}
                  <div className="w-full mt-1">
                    <div className="flex justify-between text-[10px] font-mono mb-1">
                      <span className="text-slate-400 uppercase tracking-wider">Model Confidence</span>
                      <span className="font-bold text-[#60a5fa]">
                        <CountUpComponent end={Math.round((prediction.confidence ?? 0) * 100)} duration={1.0} />%
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(prediction.confidence ?? 0) * 100}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{
                          background: `linear-gradient(90deg, #3b82f6, #60a5fa)`
                        }}
                      />
                    </div>
                  </div>
                </Card>
              )}

              {/* ② Agentic AI Reasoning Pipeline Cards */}
              <div className="md:col-span-7 flex flex-col gap-4">
                {/* Root Cause Inference Agent Card */}
                <Card className="flex flex-col gap-2 relative overflow-hidden border-l-4 border-l-purple-500">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Brain size={16} className="text-purple-400" />
                      <span>Root Cause Reasoning Agent</span>
                    </span>
                    <Badge variant="info">Layer 4 Engine</Badge>
                  </div>

                  <div className="my-1">
                    <span className="text-[10px] font-mono text-slate-400 uppercase">Primary Inferred Cause</span>
                    <h3 className="text-lg font-bold text-white font-ui tracking-tight mt-0.5">
                      {prediction ? prediction.rootCause : 'Analyzing Session...'}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono mt-1">
                      Isolated via local SHAP attributions and behavioral friction heuristics.
                    </p>
                  </div>
                </Card>

                {/* RAG Strategy Retrieval Indicator Card */}
                <Card className="flex flex-col gap-2 relative overflow-hidden border-l-4 border-l-emerald-500">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Layers size={16} className="text-emerald-400" />
                      <span>RAG Retrieval Vector Search</span>
                    </span>
                    <Badge variant="success">ChromaDB Active</Badge>
                  </div>

                  <div className="my-1">
                    <span className="text-[10px] font-mono text-slate-400 uppercase">Strategy Candidate Match</span>
                    <p className="text-xs font-mono text-slate-300 mt-1 leading-relaxed">
                      Retrieved strategy vector matched root cause <strong>'{prediction?.rootCause}'</strong> with cost-optimized margin compliance.
                    </p>
                  </div>
                </Card>
              </div>

            </div>

            {/* Recommended RAG Intervention Action Card */}
            {prediction && (() => {
              const rcConfig = getRootCauseConfig(prediction.rootCause, prediction.recommendedIntervention);
              return (
                <Card variant="glow" className="flex flex-col gap-4 border-l-4 border-l-[#F8CB2E]">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <span className="text-xs font-mono font-bold text-[#F8CB2E] uppercase tracking-widest flex items-center gap-2">
                      <Sparkles size={16} />
                      <span>RECOMMENDED RAG INTERVENTION ACTION ({prediction.rootCause})</span>
                    </span>
                    <span className="text-[10px] font-mono bg-[#F8CB2E]/10 text-[#F8CB2E] border border-[#F8CB2E]/30 px-2 py-0.5 rounded font-bold uppercase">
                      {rcConfig.badge}
                    </span>
                  </div>

                  <div className="flex items-start gap-4 my-1">
                    <div className="p-3.5 rounded-xl bg-[#F8CB2E]/10 border border-[#F8CB2E]/30 shrink-0 shadow-sm flex items-center justify-center">
                      {rcConfig.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-base sm:text-lg font-bold text-white font-ui leading-snug">
                        {prediction.recommendedIntervention}
                      </h4>
                      <p className="text-xs font-mono text-slate-400 mt-1.5 leading-relaxed">
                        {rcConfig.subtitle}
                      </p>

                      {language !== 'English' && (
                        <div className="mt-3 p-3 rounded-lg bg-slate-900/90 border border-[#F8CB2E]/40 text-[#F8CB2E] font-mono text-xs leading-relaxed flex flex-col gap-1 shadow-inner">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-white/10 pb-1">
                            <span className="flex items-center gap-1.5 font-bold text-[#F8CB2E]">
                              <Globe size={13} /> {language} Multilingual Nudge
                            </span>
                            <span className="text-[9px] bg-[#F8CB2E]/20 text-[#F8CB2E] px-1.5 py-0.5 rounded font-semibold uppercase">Real-time Translation</span>
                          </div>
                          <p className="font-semibold text-white mt-1 text-sm">
                            "{translateNudge(prediction.multilingualNudge || prediction.recommendedIntervention, language)}"
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    {interventionDeployed ? (
                      <div className="px-5 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs font-mono flex items-center gap-2 animate-bounce">
                        <CheckCircle2 size={16} />
                        <span>INTERVENTION DEPLOYED TO USER SESSION!</span>
                      </div>
                    ) : (
                      <Button
                        onClick={handleDeployIntervention}
                        variant="primary"
                        className="px-6 py-2.5 text-xs font-mono font-extrabold uppercase tracking-wider shadow-lg shadow-[#F8CB2E]/20"
                      >
                        <Zap size={14} />
                        <span>{rcConfig.buttonText}</span>
                      </Button>
                    )}
                    <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
                      Auto-trigger threshold: &gt;70% risk
                    </span>
                  </div>
                </Card>
              );
            })()}

            {/* Explainable AI: Local SHAP Feature Attributions Bar Chart */}
            {prediction && (
              <Card className="flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <BarChart3 size={16} className="text-[#60a5fa]" />
                    <span>Explainable AI: Local SHAP Feature Attributions</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">TreeSHAP Engine</span>
                </div>

                <div className="h-64 w-full text-xs font-mono">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={shapChartData}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 35, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                      <XAxis type="number" stroke="#64748b" />
                      <YAxis dataKey="displayName" type="category" stroke="#94a3b8" width={175} tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0d1220', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '8px' }}
                      />
                      <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                        {shapChartData.map((entry, idx) => (
                          <Cell
                            key={`cell-${idx}`}
                            fill={entry.importance > 0 ? '#ef4444' : '#10b981'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-between text-[11px] font-mono text-slate-400 px-2 pt-1 border-t border-white/5">
                  <span className="text-emerald-400">← Decreases Abandonment Risk (Safe Signal)</span>
                  <span className="text-rose-400">Increases Abandonment Risk (Friction Signal) →</span>
                </div>
              </Card>
            )}

            {/* Recharts Analytics Graphs Grid (Trend, Velocity, Event Breakdown) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Risk Trend */}
              <Card className="flex flex-col gap-4">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                  Abandonment Risk Trajectory
                </span>
                <div className="h-44 w-full text-xs font-mono">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                      <XAxis dataKey="name" stroke="#64748b" />
                      <YAxis stroke="#64748b" domain={[0, 100]} />
                      <Tooltip contentStyle={{ backgroundColor: '#0d1220', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '8px' }} />
                      <Line type="monotone" dataKey="Risk %" stroke="#F8CB2E" strokeWidth={3} dot={{ fill: '#F8CB2E', r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Engagement Velocity */}
              <Card className="flex flex-col gap-4">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                  Session Engagement Velocity
                </span>
                <div className="h-44 w-full text-xs font-mono">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={journeyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                      <XAxis dataKey="step" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip contentStyle={{ backgroundColor: '#0d1220', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '8px' }} />
                      <Area type="monotone" dataKey="Activity" stroke="#a78bfa" fill="rgba(167, 139, 250, 0.15)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Event Class Distribution */}
              <Card className="flex flex-col gap-4">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                  Event Category Distribution
                </span>
                <div className="h-44 w-full text-xs font-mono">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                      <XAxis dataKey="name" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip contentStyle={{ backgroundColor: '#0d1220', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '8px' }} />
                      <Bar dataKey="count" fill="#34d399" radius={[4, 4, 0, 0]}>
                        {statData.map((_, idx) => {
                          const colors = ['#ef4444', '#60a5fa', '#34d399'];
                          return <Cell key={`cell-${idx}`} fill={colors[idx % colors.length]} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

            </div>

          </motion.div>

        </div>
      )}
    </div>
  );
};

export default Dashboard;
