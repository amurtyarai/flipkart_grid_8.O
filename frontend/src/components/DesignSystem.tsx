import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Heart, ShoppingCart, Star, RefreshCw, X } from 'lucide-react';
import type { Product } from '../store/useStore';

// ===========================================================================
// Button Component
// ===========================================================================
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'glass';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  isLoading = false,
  className = '',
  ...props
}) => {
  const base = "relative px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 select-none active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer";
  
  const variants = {
    primary: "bg-[#F8CB2E] hover:bg-yellow-400 text-[#080c14] font-bold shadow-lg shadow-[#F8CB2E]/15 hover:shadow-[#F8CB2E]/30",
    secondary: "bg-[#111827] border border-white/10 hover:bg-[#1a2236] text-slate-200 hover:border-white/20",
    glass: "glass text-white hover:bg-slate-800/60 border border-white/10"
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={isLoading}
      {...props}
    >
      {isLoading ? (
        <RefreshCw size={16} className="animate-spin text-current" />
      ) : (
        children
      )}
    </button>
  );
};


// ===========================================================================
// Card Component
// ===========================================================================
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glow';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  className = '',
  ...props
}) => {
  const panelClass = variant === 'glow' 
    ? 'glass border-[#F8CB2E]/30 shadow-[0_0_20px_rgba(248,203,46,0.1)]' 
    : 'glass border-white/10 hover:border-white/20 transition-all duration-300';
  return (
    <div
      className={`rounded-xl p-5 ${panelClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};


// ===========================================================================
// Badge Component
// ===========================================================================
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'success' | 'warning' | 'info';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'primary',
  className = '',
  ...props
}) => {
  const colors = {
    primary: "bg-[#F8CB2E]/10 text-[#F8CB2E] border border-[#F8CB2E]/30",
    success: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    info: "bg-purple-500/10 text-purple-400 border border-purple-500/20"
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold ${colors[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};


// ===========================================================================
// Modal Component
// ===========================================================================
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay background */}
          <motion.div
            className="absolute inset-0 bg-[#080c14]/80 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          
          {/* Modal Container */}
          <motion.div
            className="relative w-full max-w-lg rounded-xl glass border border-white/15 p-6 shadow-2xl z-10 text-left overflow-hidden"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <h3 className="text-lg font-bold text-white font-ui">{title}</h3>
              <button
                onClick={onClose}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95 transition-all"
              >
                <X size={18} />
              </button>
            </div>
            
            {/* Body */}
            <div className="pt-4 max-h-[70svh] overflow-y-auto pr-1">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};


// ===========================================================================
// Loader Component
// ===========================================================================
export const Loader: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3 font-mono">
      <motion.div
        className="w-10 h-10 rounded-full border-2 border-[#F8CB2E] border-t-transparent shadow-[0_0_12px_rgba(248,203,46,0.3)]"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, ease: "linear", duration: 0.8 }}
      />
      <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Running AI Inference Engine...</span>
    </div>
  );
};


// ===========================================================================
// Input Component
// ===========================================================================
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className = '',
  ...props
}) => {
  return (
    <div className="flex flex-col gap-1.5 w-full text-left">
      {label && <label className="text-xs font-semibold text-slate-400 font-mono">{label}</label>}
      <input
        className={`px-4 py-2.5 rounded-lg bg-[#0d1220] border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F8CB2E] focus:ring-1 focus:ring-[#F8CB2E]/30 transition-all ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-rose-500">{error}</span>}
    </div>
  );
};


// ===========================================================================
// Search Bar Component
// ===========================================================================
interface SearchBarProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onSearch?: (val: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  className = '',
  ...props
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onSearch) onSearch(e.target.value);
  };

  return (
    <div className="relative w-full">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
      <input
        type="text"
        placeholder="Search product, category, or seller..."
        onChange={handleChange}
        className={`w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#0d1220]/80 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F8CB2E] focus:ring-1 focus:ring-[#F8CB2E]/30 transition-all ${className}`}
        {...props}
      />
    </div>
  );
};


// ===========================================================================
// Product Card Component
// ===========================================================================
interface ProductCardProps {
  product: Product;
  onAddCart: (p: Product) => void;
  onToggleWish: (id: string) => void;
  isWished: boolean;
  onViewDetails: (id: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddCart,
  onToggleWish,
  isWished,
  onViewDetails
}) => {
  return (
    <div className="rounded-xl p-4 glass border border-white/10 hover:border-[#F8CB2E]/30 transition-all duration-300 flex flex-col justify-between text-left h-full select-none hover:-translate-y-1">
      {/* Wishlist and Header details */}
      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-slate-900/80 mb-4 group cursor-pointer" onClick={() => onViewDetails(product.id)}>
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        
        {/* Assured Badge */}
        {product.isFlipkartAssured && (
          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[8px] font-black bg-[#F8CB2E] text-[#080c14] font-mono tracking-widest uppercase shadow">
            Assured
          </div>
        )}

        {/* Wishlist toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleWish(product.id);
          }}
          className={`absolute top-2 right-2 p-1.5 rounded-md backdrop-blur-md transition-all ${
            isWished 
              ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30' 
              : 'bg-slate-950/40 text-slate-400 hover:text-white border border-white/10'
          }`}
        >
          <Heart size={14} fill={isWished ? "currentColor" : "none"} />
        </button>
      </div>

      {/* Product Details */}
      <div className="flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-1">
            <span>{product.brand}</span>
            <span className="flex items-center gap-0.5 text-amber-400">
              <Star size={10} fill="currentColor" />
              <span className="font-bold">{product.rating}</span>
            </span>
          </div>

          <h4
            onClick={() => onViewDetails(product.id)}
            className="font-bold text-sm text-white line-clamp-1 cursor-pointer hover:text-[#F8CB2E] transition-colors mb-1"
          >
            {product.name}
          </h4>
          
          <div className="text-[10px] text-slate-500 mb-3 flex items-center gap-1 font-mono">
            <span>Seller: {product.seller}</span>
          </div>
        </div>

        {/* Prices and Action */}
        <div>
          <div className="flex items-baseline gap-1.5 mb-4">
            <span className="text-base font-mono font-extrabold text-white">₹{(product.price * (1 - product.discount)).toLocaleString('en-IN', {maximumFractionDigits: 0})}</span>
            {product.discount > 0 && (
              <>
                <span className="text-xs font-mono text-slate-500 line-through">₹{product.price.toLocaleString('en-IN')}</span>
                <span className="text-xs font-mono text-emerald-400 font-bold">{Math.round(product.discount * 100)}% off</span>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => onAddCart(product)}
              className="flex-1 py-2"
              variant="primary"
            >
              <ShoppingCart size={14} />
              <span>Add Cart</span>
            </Button>
            <Button
              onClick={() => onViewDetails(product.id)}
              className="px-3"
              variant="secondary"
            >
              View
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};


// ===========================================================================
// Dashboard Card Component
// ===========================================================================
interface DashboardCardProps {
  title: string;
  value: string | number;
  subLabel?: string;
  trendText?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
}

export const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  value,
  subLabel,
  trendText,
  trendDirection = 'neutral'
}) => {
  const directions = {
    up: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    down: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    neutral: "text-slate-400 bg-slate-500/10 border-slate-500/20"
  };

  return (
    <div className="rounded-xl p-5 glass border-l-4 border-l-[#F8CB2E] text-left flex flex-col justify-between h-full min-h-[120px]">
      <div>
        <div className="text-xs font-mono font-semibold text-slate-400 tracking-wider uppercase mb-2">{title}</div>
        <div className="text-3xl font-mono font-bold text-white tracking-tight">{value}</div>
      </div>
      {(subLabel || trendText) && (
        <div className="flex items-center justify-between mt-3 text-xs">
          {subLabel && <span className="text-slate-400">{subLabel}</span>}
          {trendText && (
            <span className={`px-2 py-0.5 rounded font-mono font-bold border ${directions[trendDirection]}`}>
              {trendText}
            </span>
          )}
        </div>
      )}
    </div>
  );
};


// ===========================================================================
// Sidebar Component
// ===========================================================================
interface SidebarContainerProps {
  title: string;
  children: React.ReactNode;
}

export const SidebarContainer: React.FC<SidebarContainerProps> = ({
  title,
  children
}) => {
  return (
    <div className="w-full md:w-64 rounded-xl glass p-5 text-left border border-white/10">
      <h3 className="text-base font-bold text-white border-b border-white/10 pb-3 mb-4 uppercase tracking-wider font-mono">{title}</h3>
      <div className="flex flex-col gap-5">
        {children}
      </div>
    </div>
  );
};
