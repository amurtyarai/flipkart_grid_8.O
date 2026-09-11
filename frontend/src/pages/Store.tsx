import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Heart, ShoppingCart, X } from 'lucide-react';
import { useStore, type Product } from '../store/useStore';

const Store: React.FC = () => {
  const { products, wishlist, toggleWishlist, addToCart, logEvent } = useStore();
  const navigate = useNavigate();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [assuredOnly, setAssuredOnly] = useState(false);
  const [sortBy, setSortBy] = useState<string>('featured');
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  // Log store view
  useEffect(() => {
    logEvent('Store', 'VIEW_STORE');
  }, [logEvent]);

  // Sidebar Categories Configuration matching reference screenshot
  const categoriesList = [
    'All',
    'Smartphones',
    'Laptops',
    'Electronics',
    'Home Appliances',
    'Fashion',
    'Beauty & Personal Care',
    'Books & Toys'
  ];

  // Filter and sort computation
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // 1. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        p => p.name.toLowerCase().includes(q) || 
             p.brand.toLowerCase().includes(q) ||
             p.category.toLowerCase().includes(q) ||
             (p.seller && p.seller.toLowerCase().includes(q))
      );
    }

    // 2. Category Filter
    if (selectedCategory !== 'All') {
      result = result.filter(p => p.category === selectedCategory);
    }

    // 3. Flipkart Assured Filter
    if (assuredOnly) {
      result = result.filter(p => p.isFlipkartAssured);
    }

    // 4. Sorting
    if (sortBy === 'price-asc') {
      result.sort((a, b) => (a.price * (1 - a.discount)) - (b.price * (1 - b.discount)));
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => (b.price * (1 - b.discount)) - (a.price * (1 - a.discount)));
    } else if (sortBy === 'rating-desc') {
      result.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'discount-desc') {
      result.sort((a, b) => b.discount - a.discount);
    }

    return result;
  }, [products, searchQuery, selectedCategory, assuredOnly, sortBy]);

  // Event handlers
  const handleSearch = (val: string) => {
    setSearchQuery(val);
    if (val.trim()) {
      logEvent('Store', 'SEARCH', { query: val });
    }
  };

  const handleCategorySelect = (cat: string) => {
    setSelectedCategory(cat);
    logEvent('Store', 'FILTER', { type: 'category', value: cat });
  };

  const handleAddCart = (product: Product) => {
    addToCart(product);
    logEvent('Store', 'ADD_TO_CART', { productId: product.id, price: product.price });
  };

  const handleWishlistToggle = (productId: string) => {
    toggleWishlist(productId);
    const active = wishlist.includes(productId);
    logEvent('Store', 'WISHLIST', { productId, action: active ? 'remove' : 'add' });
  };

  const handleProductClick = (productId: string) => {
    logEvent('Store', 'VIEW_PRODUCT_DETAILS', { productId });
    navigate(`/product/${productId}`);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-[#080c14] text-slate-100 font-ui py-8 px-4 sm:px-6 max-w-[1600px] mx-auto flex flex-col md:flex-row gap-8 text-left relative z-10"
    >
      
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 1. LEFT SIDEBAR: CATALOG FILTERS */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="w-full md:w-64 flex-shrink-0 bg-[#0d1220] rounded-xl border border-white/10 p-5 flex flex-col gap-6 shadow-xl h-fit">
        
        {/* Title */}
        <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wider border-b border-white/10 pb-3">
          CATALOG FILTERS
        </h2>

        {/* Category List */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-widest">
            CATEGORY
          </label>
          <div className="flex flex-col gap-1.5 mt-1 font-mono">
            {categoriesList.map(cat => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => handleCategorySelect(cat)}
                  className={`text-left px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#F8CB2E]/10 text-[#F8CB2E] border border-[#F8CB2E]/40 font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Flipkart Assured Checkbox */}
        <div className="flex items-center gap-3 pt-4 border-t border-white/10">
          <input
            type="checkbox"
            id="assured-checkbox"
            checked={assuredOnly}
            onChange={(e) => {
              setAssuredOnly(e.target.checked);
              logEvent('Store', 'FILTER', { type: 'assured_only', value: e.target.checked });
            }}
            className="w-4 h-4 rounded border-white/20 bg-[#080c14] text-[#F8CB2E] focus:ring-0 cursor-pointer"
          />
          <label htmlFor="assured-checkbox" className="text-xs font-mono font-bold text-slate-200 cursor-pointer select-none">
            Flipkart Assured Only
          </label>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 2. MAIN CATALOG CONTENT AREA */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-6">
        
        {/* Header Tools: Search & Sort By */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Search Bar */}
          <div className="relative w-full sm:w-96 flex items-center">
            <Search size={16} className="absolute left-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search product, category, or seller..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full bg-[#0d1220] border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-[#F8CB2E] focus:ring-1 focus:ring-[#F8CB2E]/30"
            />
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end font-mono text-xs">
            <span className="text-slate-400 whitespace-nowrap">Sort By</span>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                logEvent('Store', 'SORT', { type: 'sort_by', value: e.target.value });
              }}
              className="bg-[#0d1220] border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#F8CB2E] cursor-pointer"
            >
              <option value="featured">Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating-desc">Customer Rating</option>
              <option value="discount-desc">Highest Discount</option>
            </select>
          </div>

        </div>

        {/* 3-Column Product Cards Grid */}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map(product => {
              const isWished = wishlist.includes(product.id);
              const discountedPrice = Math.round(product.price * (1 - product.discount));

              return (
                <motion.div
                  key={product.id}
                  whileHover={{ y: -4 }}
                  className="bg-[#0d1220] rounded-xl border border-white/10 overflow-hidden shadow-xl flex flex-col justify-between relative group hover:border-[#F8CB2E]/40 transition-all text-left"
                >
                  {/* Product Image Area */}
                  <div 
                    onClick={() => handleProductClick(product.id)}
                    className="relative w-full h-52 bg-slate-950 p-4 flex items-center justify-center overflow-hidden cursor-pointer"
                  >
                    <img 
                      src={product.image} 
                      alt={product.name} 
                      className="max-h-40 object-contain group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Flipkart Assured Badge */}
                    {product.isFlipkartAssured && (
                      <span className="absolute top-3 left-3 bg-[#F8CB2E] text-[#080c14] font-extrabold text-[9px] uppercase px-1.5 py-0.5 rounded-sm tracking-wider shadow-sm">
                        ASSURED
                      </span>
                    )}

                    {/* Wishlist Button */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleWishlistToggle(product.id);
                      }}
                      className="absolute top-3 right-3 p-1.5 rounded-full bg-slate-900/60 border border-white/10 text-slate-400 hover:text-[#ff3d5a] transition-colors cursor-pointer"
                      title="Add to Wishlist"
                    >
                      <Heart size={15} className={isWished ? 'text-[#ff3d5a] fill-[#ff3d5a]' : ''} />
                    </button>
                  </div>

                  {/* Product Metadata & Price Details */}
                  <div className="p-4 flex flex-col gap-2">
                    
                    {/* Brand & Rating Row */}
                    <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                      <span>{product.brand}</span>
                      <span className="text-[#F8CB2E] font-bold flex items-center gap-0.5">
                        ★ {product.rating}
                      </span>
                    </div>

                    {/* Product Name */}
                    <h3 
                      onClick={() => handleProductClick(product.id)}
                      className="font-bold text-xs sm:text-sm text-white font-ui line-clamp-1 cursor-pointer hover:text-[#F8CB2E] transition-colors"
                    >
                      {product.name}
                    </h3>

                    {/* Seller Name */}
                    <div className="text-[11px] font-mono text-slate-500">
                      Seller: {product.seller || 'SuperComNet'}
                    </div>

                    {/* Price Row */}
                    <div className="flex items-baseline gap-2 font-mono mt-1">
                      <span className="text-sm sm:text-base font-black text-white">
                        ₹{discountedPrice.toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-500 line-through">
                        ₹{product.price.toLocaleString()}
                      </span>
                      <span className="text-xs text-[#10b981] font-bold">
                        {Math.round(product.discount * 100)}% off
                      </span>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="flex items-center gap-2 pt-3 mt-1 border-t border-white/5 font-mono text-xs">
                      <button 
                        onClick={() => handleAddCart(product)}
                        className="bg-[#F8CB2E] hover:bg-amber-400 text-[#080c14] font-extrabold text-xs py-2.5 px-3 rounded-lg shadow-sm flex items-center justify-center gap-1.5 flex-1 cursor-pointer transition-colors"
                      >
                        <ShoppingCart size={14} /> Add Cart
                      </button>
                      <button 
                        onClick={() => handleProductClick(product.id)}
                        className="bg-[#090d16] hover:bg-slate-800 border border-white/15 text-slate-300 font-bold text-xs py-2.5 px-4 rounded-lg cursor-pointer transition-colors"
                      >
                        View
                      </button>
                    </div>

                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="p-16 rounded-xl bg-[#0d1220] border border-white/10 text-center font-mono text-xs text-slate-400">
            No matching products found in catalog.
          </div>
        )}

      </div>

      {/* Quick View Modal */}
      <AnimatePresence>
        {quickViewProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0d1220] max-w-xl w-full p-6 rounded-2xl border border-white/15 relative text-left flex flex-col gap-5 shadow-2xl font-mono"
            >
              <button 
                onClick={() => setQuickViewProduct(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
                <div className="w-full h-48 bg-slate-950 p-4 rounded-xl flex items-center justify-center border border-white/10">
                  <img src={quickViewProduct.image} alt={quickViewProduct.name} className="max-h-40 object-contain" />
                </div>

                <div className="flex flex-col gap-2 text-xs">
                  <span className="text-slate-400">{quickViewProduct.brand} • {quickViewProduct.category}</span>
                  <h3 className="text-base font-bold text-white font-ui">{quickViewProduct.name}</h3>
                  <div className="text-slate-400">Seller: {quickViewProduct.seller || 'SuperComNet'}</div>

                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-black text-white">₹{Math.round(quickViewProduct.price * (1 - quickViewProduct.discount)).toLocaleString()}</span>
                    <span className="text-slate-500 line-through">₹{quickViewProduct.price.toLocaleString()}</span>
                    <span className="text-[#10b981] font-bold">{Math.round(quickViewProduct.discount * 100)}% off</span>
                  </div>

                  <div className="flex items-center gap-2 pt-3 mt-2 border-t border-white/10">
                    <button 
                      onClick={() => { handleAddCart(quickViewProduct); setQuickViewProduct(null); }}
                      className="bg-[#F8CB2E] hover:bg-amber-400 text-[#080c14] font-extrabold text-xs py-2.5 px-4 rounded-lg flex-1 cursor-pointer"
                    >
                      Add to Cart
                    </button>
                    <button 
                      onClick={() => { handleAddCart(quickViewProduct); setQuickViewProduct(null); navigate('/cart'); }}
                      className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-2.5 px-4 rounded-lg cursor-pointer"
                    >
                      Buy Now
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
};

export default Store;
