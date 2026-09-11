import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Star, Truck, Heart, ShoppingCart, BarChart2, 
  ThumbsUp, Sparkles, Filter, CheckCircle2, ChevronRight, Eye, Layers 
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { Button, Badge, Input, Modal, ProductCard } from '../components/DesignSystem';
import { getRecommendedProducts } from '../data/productsData';

const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { products, wishlist, toggleWishlist, addToCart, logEvent, showToast } = useStore();

  // Find product dynamically by ID
  const product = useMemo(() => {
    return products.find(p => p.id === id) || products[0];
  }, [products, id]);

  // Local UI States
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [zoomImage, setZoomImage] = useState(false);
  const [pinCode, setPinCode] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'specs' | 'reviews'>('specs');
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  // Review Filters & Sort States
  const [starFilter, setStarFilter] = useState<number | 'all'>('all');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [withImagesOnly, setWithImagesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'helpful' | 'recent' | 'highest' | 'lowest'>('helpful');
  const [helpfulCounts, setHelpfulCounts] = useState<Record<string, number>>({});
  const [visibleReviewsCount, setVisibleReviewsCount] = useState<number>(6);

  // Bundle Frequently Bought Together state
  const [selectedBundleItems, setSelectedBundleItems] = useState<Record<string, boolean>>({});

  // Recently Viewed State
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>([]);

  // Reset product details state whenever product ID changes
  useEffect(() => {
    if (!product) return;

    // Reset gallery image and active tab to specs on product change
    setSelectedImage(product.images?.[0] || product.image);
    setZoomImage(false);
    setActiveTab('specs');
    setVisibleReviewsCount(6);

    // Initialize bundle selections
    const initialBundle: Record<string, boolean> = {};
    product.frequentlyBoughtTogether?.forEach(item => {
      initialBundle[item.id] = item.defaultSelected !== false;
    });
    setSelectedBundleItems(initialBundle);

    // Update Recently Viewed in LocalStorage
    try {
      const stored = localStorage.getItem('flipkart_recently_viewed');
      let list: string[] = stored ? JSON.parse(stored) : [];
      list = [product.id, ...list.filter(item => item !== product.id)].slice(0, 8);
      localStorage.setItem('flipkart_recently_viewed', JSON.stringify(list));
      setRecentlyViewedIds(list);
    } catch {
      // Fallback if localStorage blocked
    }

    // Log page view event for AI engine
    logEvent('ProductDetails', 'VIEW_PRODUCT', { productId: product.id, name: product.name });

    // Scroll window smoothly to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [product?.id, logEvent]);

  if (!product) {
    return (
      <div className="py-20 text-center font-mono">
        <h3 className="text-xl font-bold text-white font-ui">Product Not Found</h3>
        <Button onClick={() => navigate('/store')} className="mt-4 font-mono text-xs">Back to Catalog</Button>
      </div>
    );
  }

  // Derived pricing calculations
  const discountedPrice = Math.round(product.price * (1 - product.discount));
  const originalPrice = product.originalPrice || product.price;

  // Calculate Similar Products using Recommendation Logic (40% Category, 25% Brand, 20% Price, 10% Rating, 5% Popularity)
  const similarProducts = getRecommendedProducts(product, products, 6);

  // Filter Recently Viewed Products (excluding current product)
  const recentlyViewedProducts = products.filter(
    p => p.id !== product.id && recentlyViewedIds.includes(p.id)
  ).slice(0, 6);

  // Rating Distribution Calculation
  const totalReviewsCount = product.ratingCount || 1243;
  const ratingDist = {
    5: Math.round(totalReviewsCount * 0.62),
    4: Math.round(totalReviewsCount * 0.22),
    3: Math.round(totalReviewsCount * 0.09),
    2: Math.round(totalReviewsCount * 0.04),
    1: Math.round(totalReviewsCount * 0.03),
  };

  // Filter & Sort Reviews
  const filteredReviews = useMemo(() => {
    let reviewsList = [...(product.reviews || [])];

    if (starFilter !== 'all') {
      reviewsList = reviewsList.filter(r => r.rating === starFilter);
    }
    if (verifiedOnly) {
      reviewsList = reviewsList.filter(r => r.verifiedPurchase);
    }
    if (withImagesOnly) {
      reviewsList = reviewsList.filter(r => r.images && r.images.length > 0);
    }

    reviewsList.sort((a, b) => {
      const countA = (helpfulCounts[a.reviewId] !== undefined ? helpfulCounts[a.reviewId] : a.helpfulCount);
      const countB = (helpfulCounts[b.reviewId] !== undefined ? helpfulCounts[b.reviewId] : b.helpfulCount);

      if (sortBy === 'helpful') return countB - countA;
      if (sortBy === 'highest') return b.rating - a.rating;
      if (sortBy === 'lowest') return a.rating - b.rating;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    return reviewsList;
  }, [product.reviews, starFilter, verifiedOnly, withImagesOnly, sortBy, helpfulCounts]);

  // Event Handlers
  const handleZoomToggle = () => {
    const nextState = !zoomImage;
    setZoomImage(nextState);
    logEvent('ProductDetails', 'ZOOM_IMAGE', { productId: product.id, zoomed: nextState });
  };

  const handleDeliveryCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinCode.trim()) return;
    
    logEvent('ProductDetails', 'CHECK_DELIVERY', { productId: product.id, pinCode });
    if (pinCode.startsWith('11') || pinCode.startsWith('40') || pinCode.startsWith('56')) {
      setDeliveryStatus("Standard Delivery by Tuesday — FREE");
    } else if (pinCode.length !== 6 || isNaN(Number(pinCode))) {
      setDeliveryStatus("Invalid Pin Code format. Enter 6 digits.");
    } else {
      setDeliveryStatus("Delivery available in 3-5 business days (Shipping: ₹40)");
    }
  };

  const handleWishlistToggle = () => {
    toggleWishlist(product.id);
    const active = wishlist.includes(product.id);
    logEvent('ProductDetails', 'WISHLIST', { productId: product.id, action: active ? 'remove' : 'add' });
  };

  const handleAddCart = () => {
    addToCart(product);
    logEvent('ProductDetails', 'ADD_TO_CART', { productId: product.id, price: discountedPrice });
  };

  const handleBuyNow = () => {
    addToCart(product);
    logEvent('ProductDetails', 'BUY_NOW', { productId: product.id, price: discountedPrice });
    navigate('/cart');
  };

  const handleProductSelect = (targetId: string) => {
    logEvent('ProductDetails', 'NAVIGATE_SIMILAR_PRODUCT', { fromId: product.id, toId: targetId });
    navigate(`/product/${targetId}`);
  };

  const handleHelpfulClick = (reviewId: string, currentVal: number) => {
    setHelpfulCounts(prev => ({
      ...prev,
      [reviewId]: (prev[reviewId] !== undefined ? prev[reviewId] : currentVal) + 1
    }));
    showToast("Thank you for your feedback!", "success");
  };

  // Bundle Total Calculation
  const bundleAccessories = product.frequentlyBoughtTogether || [];
  const selectedBundleTotal = useMemo(() => {
    let total = discountedPrice;
    bundleAccessories.forEach(item => {
      if (selectedBundleItems[item.id]) {
        total += item.price;
      }
    });
    return total;
  }, [discountedPrice, bundleAccessories, selectedBundleItems]);

  const handleAddBundleToCart = () => {
    addToCart(product);
    bundleAccessories.forEach(item => {
      if (selectedBundleItems[item.id]) {
        addToCart({
          id: item.id,
          name: item.name,
          brand: product.brand,
          category: product.category,
          rating: 4.5,
          ratingCount: 500,
          reviewCount: 100,
          seller: product.seller,
          price: item.price,
          originalPrice: item.originalPrice,
          discount: 0,
          isFlipkartAssured: true,
          image: item.image,
          images: [item.image],
          description: `Accessory for ${product.name}`,
          offers: [],
          specifications: {},
          reviews: [],
          aiSummary: { overall: '', positive: [], negative: [] },
          frequentlyBoughtTogether: []
        });
      }
    });
    showToast("Bundle items added to cart successfully!", "success");
    logEvent('ProductDetails', 'ADD_BUNDLE_TO_CART', { productId: product.id, bundleTotal: selectedBundleTotal });
  };

  return (
    <motion.div 
      key={product.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="py-8 px-4 sm:px-6 max-w-[1400px] mx-auto flex flex-col gap-10 text-left relative z-10"
    >
      {/* Top Breadcrumb / Back button */}
      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={() => navigate('/store')} className="font-mono text-xs">
          ← Back to Catalog
        </Button>
        <div className="text-xs font-mono text-slate-400 flex items-center gap-1">
          <span>{product.category}</span>
          <ChevronRight size={12} />
          <span>{product.brand}</span>
          <ChevronRight size={12} />
          <span className="text-[#F8CB2E] truncate max-w-[200px]">{product.name}</span>
        </div>
      </div>

      {/* SECTION 1: DYNAMIC PRODUCT DETAILS MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Left Column: Main Image + Thumbnail Gallery */}
        <div className="flex flex-col gap-4">
          <div
            onClick={handleZoomToggle}
            className="relative rounded-xl overflow-hidden glass aspect-square max-h-[480px] cursor-zoom-in flex items-center justify-center bg-slate-900/60 border border-white/10"
          >
            <motion.img
              src={selectedImage}
              alt={product.name}
              className="w-full h-full object-cover"
              animate={{ scale: zoomImage ? 1.5 : 1 }}
              transition={{ type: 'spring', stiffness: 120 }}
            />
            
            <div className="absolute bottom-4 right-4 bg-[#080c14]/80 backdrop-blur-sm text-xs font-mono px-3 py-1.5 rounded border border-white/10 text-slate-300">
              {zoomImage ? "Tap to fit" : "Tap to zoom"}
            </div>
            
            {product.isFlipkartAssured && (
              <Badge variant="primary" className="absolute top-4 left-4 px-2.5 py-1 text-[10px] font-mono tracking-widest bg-[#F8CB2E] text-[#080c14] font-black border-none shadow-lg">
                Assured
              </Badge>
            )}
          </div>

          {/* Thumbnail Gallery */}
          {product.images && product.images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2 font-mono">
              {product.images.map((imgUrl, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(imgUrl)}
                  className={`w-20 h-20 rounded-lg overflow-hidden border transition-all cursor-pointer flex-shrink-0 ${
                    selectedImage === imgUrl 
                      ? 'border-[#F8CB2E] ring-2 ring-[#F8CB2E]/30 scale-105' 
                      : 'border-white/10 hover:border-white/30 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={imgUrl} alt={`${product.name} thumbnail ${idx}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Title, Ratings, Pricing, Offers, Pincode & Core Actions */}
        <div className="flex flex-col gap-6">
          <div>
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">{product.brand}</span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-1 leading-tight font-ui">{product.name}</h1>
            
            {/* Rating Stars & Count */}
            <div className="flex items-center gap-3 mt-3 font-mono">
              <span className="flex items-center gap-1 text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-0.5 rounded text-xs font-bold">
                <Star size={12} fill="currentColor" />
                <span>{product.rating}</span>
              </span>
              <span className="text-xs text-slate-400">
                ({totalReviewsCount.toLocaleString()} Ratings & {(product.reviewCount || 342).toLocaleString()} Reviews)
              </span>
              <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                In Stock
              </span>
            </div>
          </div>

          {/* Pricing Summary */}
          <div className="p-4 bg-[#0d1220] rounded-xl border border-white/10 flex items-baseline gap-3.5 font-mono">
            <span className="text-3xl font-extrabold text-[#F8CB2E]">
              ₹{discountedPrice.toLocaleString('en-IN')}
            </span>
            {product.discount > 0 && (
              <>
                <span className="text-sm text-slate-500 line-through">₹{originalPrice.toLocaleString('en-IN')}</span>
                <span className="text-sm text-emerald-400 font-bold">{Math.round(product.discount * 100)}% off</span>
              </>
            )}
          </div>

          {/* Dynamic Available Offers */}
          <div className="flex flex-col gap-2 font-mono">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Available Offers</h4>
            <div className="flex flex-col gap-2 text-xs text-slate-300">
              {product.offers && product.offers.length > 0 ? (
                product.offers.map((off, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30 flex-shrink-0">
                      {off.type}
                    </span>
                    <span><strong>{off.title}</strong> — {off.detail}</span>
                  </div>
                ))
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">Bank Offer</span>
                    <span>5% Unlimited Cashback on Flipkart Axis Bank Credit Card.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/30">Financing</span>
                    <span>No Cost EMI available. Credit options from Flipkart Pay Later.</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Delivery Check Form */}
          <form onSubmit={handleDeliveryCheck} className="flex flex-col gap-2.5 pt-4 border-t border-white/10 font-mono">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Truck size={14} className="text-[#F8CB2E]" />
              <span>Check Delivery & Fulfillment Details</span>
            </label>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Enter 6-digit pincode (e.g. 560001)"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                maxLength={6}
                className="max-w-[280px] font-mono"
              />
              <Button type="submit" variant="secondary" className="font-mono text-xs">Check</Button>
            </div>
            {deliveryStatus && (
              <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span>{deliveryStatus}</span>
              </div>
            )}
          </form>

          {/* Core Action Buttons */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-white/10 font-mono">
            <Button
              onClick={handleAddCart}
              className="flex-1 py-3 text-sm font-bold uppercase tracking-wider"
              variant="primary"
            >
              <ShoppingCart size={18} />
              <span>Add to Cart</span>
            </Button>
            <Button
              onClick={handleBuyNow}
              className="flex-1 py-3 text-sm font-bold bg-[#F8CB2E] hover:bg-yellow-400 text-[#080c14] border-none uppercase tracking-wider shadow-lg shadow-[#F8CB2E]/20"
            >
              <span>Buy Now</span>
            </Button>
            <button
              onClick={handleWishlistToggle}
              className={`p-3 rounded-lg border text-sm font-semibold active:scale-95 transition-all cursor-pointer ${
                wishlist.includes(product.id)
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                  : 'border-white/10 text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title="Add to Wishlist"
            >
              <Heart size={18} fill={wishlist.includes(product.id) ? "currentColor" : "none"} />
            </button>
            <Button variant="secondary" onClick={() => setIsCompareOpen(true)} className="px-3" title="Compare Product">
              <BarChart2 size={18} />
            </Button>
          </div>
        </div>
      </div>

      {/* TABBED SPECIFICATIONS & REVIEWS SECTION */}
      <div className="mt-8 flex flex-col gap-6">
        <div className="flex gap-6 border-b border-white/10 font-mono">
          <button
            onClick={() => setActiveTab('specs')}
            className={`pb-3 font-semibold text-sm transition-all relative cursor-pointer ${
              activeTab === 'specs' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Product Specifications
            {activeTab === 'specs' && (
              <motion.div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F8CB2E]" layoutId="detailsTabLine" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`pb-3 font-semibold text-sm transition-all relative cursor-pointer ${
              activeTab === 'reviews' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Customer Reviews ({(product.reviewCount || 342).toLocaleString()})
            {activeTab === 'reviews' && (
              <motion.div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F8CB2E]" layoutId="detailsTabLine" />
            )}
          </button>
        </div>

        <div>
          {activeTab === 'specs' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl text-sm font-mono">
              {Object.entries(product.specifications || {}).map(([key, val]) => (
                <div key={key} className="flex border-b border-white/5 pb-2.5">
                  <span className="w-1/3 text-slate-400 font-medium">{key}</span>
                  <span className="w-2/3 text-slate-200">{val}</span>
                </div>
              ))}
              <div className="flex border-b border-white/5 pb-2.5">
                <span className="w-1/3 text-slate-400 font-medium">Seller Account</span>
                <span className="w-2/3 text-slate-200">{product.seller} ({product.sellerRating || '4.5 / 5'})</span>
              </div>
              <div className="flex border-b border-white/5 pb-2.5">
                <span className="w-1/3 text-slate-400 font-medium">Description</span>
                <span className="w-2/3 text-slate-200">{product.description}</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {/* SECTION 3: AI REVIEW SUMMARY CARD */}
              <div className="p-5 rounded-xl glass border border-[#F8CB2E]/30 bg-[#F8CB2E]/5 flex flex-col gap-3 font-mono">
                <div className="flex items-center gap-2 text-[#F8CB2E] font-bold text-sm font-ui">
                  <Sparkles size={18} />
                  <span>AI Review Summary & Sentiment Analysis</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {product.aiSummary?.overall || "Customers highly appreciate the build quality, performance, and overall value. Most negative feedback relates to slight packaging wear during transit."}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs mt-1">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg">
                    <span className="font-bold text-emerald-400 block mb-1">👍 High Customer Appreciation:</span>
                    <ul className="list-disc list-inside text-slate-300 space-y-0.5">
                      {(product.aiSummary?.positive || ["Superior sound clarity & bass", "Long-lasting battery life", "Ergonomic fit"]).map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg">
                    <span className="font-bold text-rose-400 block mb-1">👎 Noted Concerns:</span>
                    <ul className="list-disc list-inside text-slate-300 space-y-0.5">
                      {(product.aiSummary?.negative || ["Outer box dented during shipping", "Tight fit initially"]).map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* SECTION 2: DYNAMIC CUSTOMER REVIEWS & SUMMARY */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Rating Distribution Summary */}
                <div className="p-5 bg-[#0d1220] rounded-xl border border-white/10 flex flex-col gap-4 font-mono h-fit">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overall Rating Summary</h4>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-white">{product.rating}</span>
                    <span className="text-amber-400 text-lg">★★★★☆</span>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">Based on {totalReviewsCount.toLocaleString()} Ratings</span>

                  {/* Rating Distribution Bars */}
                  <div className="flex flex-col gap-2 text-xs pt-2 border-t border-white/10">
                    {[5, 4, 3, 2, 1].map(stars => {
                      const count = ratingDist[stars as keyof typeof ratingDist];
                      const pct = Math.round((count / totalReviewsCount) * 100);
                      return (
                        <div key={stars} className="flex items-center gap-2">
                          <span className="w-6 text-slate-400">{stars}★</span>
                          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-[#F8CB2E]" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-8 text-right text-slate-500">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Review Filters & Review List */}
                <div className="md:col-span-2 flex flex-col gap-5 font-mono">
                  {/* Filter Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#0d1220] rounded-xl border border-white/10 text-xs">
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <Filter size={14} className="text-slate-400 mr-1" />
                      <button
                        onClick={() => setStarFilter('all')}
                        className={`px-2.5 py-1 rounded cursor-pointer ${starFilter === 'all' ? 'bg-[#F8CB2E] text-[#080c14] font-bold' : 'bg-slate-800 text-slate-300'}`}
                      >
                        All
                      </button>
                      {[5, 4, 3, 2, 1].map(s => (
                        <button
                          key={s}
                          onClick={() => setStarFilter(s)}
                          className={`px-2.5 py-1 rounded cursor-pointer ${starFilter === s ? 'bg-[#F8CB2E] text-[#080c14] font-bold' : 'bg-slate-800 text-slate-300'}`}
                        >
                          {s}★
                        </button>
                      ))}
                      <button
                        onClick={() => setVerifiedOnly(!verifiedOnly)}
                        className={`px-2.5 py-1 rounded cursor-pointer ${verifiedOnly ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'}`}
                      >
                        ✓ Verified Purchase
                      </button>
                      <button
                        onClick={() => setWithImagesOnly(!withImagesOnly)}
                        className={`px-2.5 py-1 rounded cursor-pointer ${withImagesOnly ? 'bg-purple-500 text-white font-bold' : 'bg-slate-800 text-slate-300'}`}
                      >
                        📷 With Images
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="bg-slate-800 border border-white/10 text-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none"
                      >
                        <option value="helpful">Most Helpful</option>
                        <option value="recent">Most Recent</option>
                        <option value="highest">Highest Rating</option>
                        <option value="lowest">Lowest Rating</option>
                      </select>
                    </div>
                  </div>

                  {/* Review Cards */}
                  <div className="flex flex-col gap-4">
                    {filteredReviews.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 bg-[#0d1220] rounded-xl border border-white/10">
                        No reviews matching selected filters.
                      </div>
                    ) : (
                      filteredReviews.slice(0, visibleReviewsCount).map((rev) => {
                        const currentHelpful = (helpfulCounts[rev.reviewId] !== undefined ? helpfulCounts[rev.reviewId] : rev.helpfulCount);
                        return (
                          <div key={rev.reviewId} className="p-4 bg-[#0d1220] rounded-xl border border-white/10 flex flex-col gap-2.5 text-xs">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded font-bold ${rev.rating >= 4 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                                  {rev.rating} ★
                                </span>
                                <span className="font-bold text-slate-200 text-sm">{rev.title}</span>
                              </div>
                              <span className="text-slate-500">{rev.date}</span>
                            </div>

                            <p className="text-slate-300 leading-relaxed">{rev.comment}</p>

                            {/* Optional Review Images */}
                            {rev.images && rev.images.length > 0 && (
                              <div className="flex gap-2 my-1">
                                {rev.images.map((img, i) => (
                                  <img key={i} src={img} alt="User review" className="w-16 h-16 rounded-lg object-cover border border-white/10" />
                                ))}
                              </div>
                            )}

                            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/5">
                              <div className="flex items-center gap-3">
                                <span>{rev.userName}</span>
                                {rev.verifiedPurchase && (
                                  <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                                    <CheckCircle2 size={12} /> Verified Purchase
                                  </span>
                                )}
                                {rev.productVariant && <span className="text-slate-500">| {rev.productVariant}</span>}
                              </div>

                              <button
                                onClick={() => handleHelpfulClick(rev.reviewId, rev.helpfulCount)}
                                className="flex items-center gap-1.5 text-slate-400 hover:text-[#F8CB2E] transition-colors cursor-pointer bg-slate-800/60 px-2 py-1 rounded"
                              >
                                <ThumbsUp size={12} />
                                <span>Helpful ({currentHelpful})</span>
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}

                    {/* Load More Reviews Button */}
                    {filteredReviews.length > visibleReviewsCount && (
                      <div className="pt-2 text-center">
                        <Button
                          variant="secondary"
                          onClick={() => setVisibleReviewsCount(prev => prev + 10)}
                          className="w-full py-2.5 text-xs font-bold font-mono tracking-wider"
                        >
                          Load More Customer Reviews (+{filteredReviews.length - visibleReviewsCount} remaining)
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 7: FREQUENTLY BOUGHT TOGETHER */}
      {bundleAccessories.length > 0 && (
        <div className="mt-8 flex flex-col gap-4 font-mono">
          <div className="flex items-center gap-2">
            <Layers className="text-[#F8CB2E]" size={20} />
            <h3 className="text-xl font-bold text-white font-ui">Frequently Bought Together</h3>
          </div>

          <div className="p-6 bg-[#0d1220] rounded-xl border border-white/10 flex flex-col lg:flex-row items-center gap-6 justify-between">
            <div className="flex flex-wrap items-center gap-4">
              {/* Main Product Box */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/80 border border-[#F8CB2E]/30 max-w-[220px]">
                <img src={product.image} alt={product.name} className="w-14 h-14 object-cover rounded-md" />
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-white line-clamp-1">{product.name}</span>
                  <span className="text-xs font-extrabold text-[#F8CB2E]">₹{discountedPrice.toLocaleString()}</span>
                </div>
              </div>

              {bundleAccessories.map((acc) => {
                const isChecked = selectedBundleItems[acc.id] !== false;
                return (
                  <React.Fragment key={acc.id}>
                    <span className="text-xl font-bold text-slate-500">+</span>
                    <div 
                      onClick={() => setSelectedBundleItems(prev => ({ ...prev, [acc.id]: !isChecked }))}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer max-w-[240px] ${
                        isChecked ? 'bg-slate-900/80 border-emerald-500/40' : 'bg-slate-950/40 border-white/5 opacity-60'
                      }`}
                    >
                      <input type="checkbox" checked={isChecked} onChange={() => {}} className="accent-[#F8CB2E] cursor-pointer" />
                      <img src={acc.image} alt={acc.name} className="w-12 h-12 object-cover rounded-md" />
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-semibold text-slate-200 line-clamp-1">{acc.name}</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xs font-bold text-emerald-400">₹{acc.price.toLocaleString()}</span>
                          <span className="text-[10px] text-slate-500 line-through">₹{acc.originalPrice.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Bundle Price & Add All Button */}
            <div className="flex flex-col items-center lg:items-end gap-2 border-t lg:border-t-0 lg:border-l border-white/10 pt-4 lg:pt-0 lg:pl-6 w-full lg:w-auto">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Bundle Price</span>
              <span className="text-2xl font-extrabold text-[#F8CB2E]">₹{selectedBundleTotal.toLocaleString('en-IN')}</span>
              <Button onClick={handleAddBundleToCart} variant="primary" className="py-2.5 text-xs uppercase tracking-wider">
                <ShoppingCart size={16} />
                <span>Add Selected Bundle to Cart</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4 & 5: SIMILAR PRODUCTS SECTION (RECOMMENDATION ALGORITHM) */}
      <div className="mt-8 flex flex-col gap-4 font-mono">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white font-ui flex items-center gap-2">
            <span>Similar Products You May Like</span>
            <span className="text-xs font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-white/5">
              AI Recommendation Match
            </span>
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {similarProducts.map((simProd) => (
            <ProductCard
              key={simProd.id}
              product={simProd}
              onAddCart={(p) => {
                addToCart(p);
                logEvent('ProductDetails', 'ADD_SIMILAR_TO_CART', { productId: p.id });
              }}
              onToggleWish={(id) => toggleWishlist(id)}
              isWished={wishlist.includes(simProd.id)}
              onViewDetails={handleProductSelect}
            />
          ))}
        </div>
      </div>

      {/* SECTION 8: RECENTLY VIEWED PRODUCTS */}
      {recentlyViewedProducts.length > 0 && (
        <div className="mt-8 flex flex-col gap-4 font-mono border-t border-white/10 pt-8">
          <h3 className="text-xl font-bold text-white font-ui flex items-center gap-2">
            <Eye size={20} className="text-[#F8CB2E]" />
            <span>Recently Viewed Products</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {recentlyViewedProducts.map((recentProd) => (
              <ProductCard
                key={recentProd.id}
                product={recentProd}
                onAddCart={(p) => addToCart(p)}
                onToggleWish={(id) => toggleWishlist(id)}
                isWished={wishlist.includes(recentProd.id)}
                onViewDetails={handleProductSelect}
              />
            ))}
          </div>
        </div>
      )}

      {/* Comparison Modal */}
      <Modal isOpen={isCompareOpen} onClose={() => setIsCompareOpen(false)} title="Product Comparison Matrix">
        <div className="flex flex-col gap-4 text-sm font-mono text-slate-300">
          <div className="grid grid-cols-3 gap-2 font-bold border-b border-white/10 pb-2">
            <span>Metric</span>
            <span>This Product</span>
            <span>Competitor alternative</span>
          </div>
          <div className="grid grid-cols-3 gap-2 border-b border-white/5 pb-2">
            <span className="text-slate-400">Name</span>
            <span className="font-bold text-white line-clamp-1">{product.name}</span>
            <span className="text-slate-400">Alternative {product.category}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 border-b border-white/5 pb-2">
            <span className="text-slate-400">Customer Rating</span>
            <span className="text-amber-400 font-bold">{product.rating} ★</span>
            <span className="text-slate-400">3.8 ★</span>
          </div>
          <div className="grid grid-cols-3 gap-2 border-b border-white/5 pb-2">
            <span className="text-slate-400">Price (Net)</span>
            <span className="font-bold text-[#F8CB2E]">₹{discountedPrice.toLocaleString()}</span>
            <span className="text-slate-400">₹{Math.round(discountedPrice * 1.1).toLocaleString()}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 pb-2">
            <span className="text-slate-400">Seller Rating</span>
            <span className="text-emerald-400 font-bold">{product.sellerRating || '4.5 / 5'}</span>
            <span className="text-slate-400">3.8 / 5</span>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
};

export default ProductDetails;
