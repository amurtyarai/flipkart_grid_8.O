import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Plus, Minus, Tag, Truck, ShoppingBag, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { Button, Card, Input } from '../components/DesignSystem';

const Cart: React.FC = () => {
  const { cart, changeQuantity, removeFromCart, logEvent } = useStore();
  const navigate = useNavigate();

  // Coupon states
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0); // 0.0 to 1.0 (e.g. 0.10 for 10% off)
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);

  // Log cart page view on mount
  useEffect(() => {
    logEvent('Cart', 'OPEN_CART');
  }, [logEvent]);

  // Calculations
  const subtotal = cart.reduce((acc, item) => {
    const netPrice = item.product.price * (1 - item.product.discount);
    return acc + (netPrice * item.quantity);
  }, 0);

  // Free delivery threshold: ₹500
  const shippingCharges = subtotal >= 500 || subtotal === 0 ? 0 : 40;
  
  const couponDiscountAmount = subtotal * appliedDiscount;
  const grandTotal = subtotal - couponDiscountAmount + shippingCharges;

  // Event handlers
  const handleQuantityIncrease = (productId: string, currentQty: number) => {
    changeQuantity(productId, currentQty + 1);
    logEvent('Cart', 'CHANGE_QUANTITY', { productId, quantity: currentQty + 1 });
  };

  const handleQuantityDecrease = (productId: string, currentQty: number) => {
    if (currentQty > 1) {
      changeQuantity(productId, currentQty - 1);
      logEvent('Cart', 'CHANGE_QUANTITY', { productId, quantity: currentQty - 1 });
    }
  };

  const handleRemove = (productId: string) => {
    removeFromCart(productId);
    logEvent('Cart', 'REMOVE_FROM_CART', { productId });
  };

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError(null);
    setCouponSuccess(null);

    const code = couponCode.trim().toUpperCase();
    if (!code) return;

    if (code === 'FLIPKART50') {
      setAppliedDiscount(0.50);
      setCouponSuccess("FLIPKART50 applied successfully! 50% discount applied.");
      logEvent('Cart', 'APPLY_COUPON', { code, discount: 0.50 });
    } else if (code === 'SAVE10') {
      setAppliedDiscount(0.10);
      setCouponSuccess("SAVE10 applied successfully! 10% discount applied.");
      logEvent('Cart', 'APPLY_COUPON', { code, discount: 0.10 });
    } else {
      setAppliedDiscount(0);
      setCouponError("Invalid coupon code. Try 'FLIPKART50' or 'SAVE10'.");
      logEvent('Cart', 'FAILED_COUPON', { code });
    }
  };

  const handleCheckout = () => {
    logEvent('Cart', 'CHECKOUT', { 
      cartItemsCount: cart.length,
      subtotal,
      grandTotal,
      couponApplied: appliedDiscount > 0
    });
    // Route to AI Dashboard to inspect risk profiles
    navigate('/dashboard');
  };

  if (cart.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="py-24 px-6 max-w-lg mx-auto text-center flex flex-col items-center gap-6"
      >
        <div className="w-16 h-16 rounded-full bg-[#0d1220] flex items-center justify-center border border-white/10 text-[#F8CB2E]">
          <ShoppingBag size={28} />
        </div>
        <h3 className="text-xl font-bold text-white font-ui">Your Cart is Empty</h3>
        <p className="text-xs text-slate-400 font-mono leading-relaxed">
          Add products from the store to test the real-time AI cart abandonment risk indicators.
        </p>
        <Button onClick={() => navigate('/store')} variant="primary" className="font-mono text-xs">
          Browse Store Products
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="py-8 px-4 sm:px-6 max-w-[1400px] mx-auto flex flex-col lg:flex-row gap-8 text-left relative z-10"
    >
      {/* 1. Left Panel: Cart items list */}
      <div className="flex-1 flex flex-col gap-4">
        <h2 className="text-2xl font-bold text-white font-ui mb-1 flex items-center gap-2">
          <span>Shopping Cart</span>
          <span className="text-xs font-mono bg-[#F8CB2E]/10 text-[#F8CB2E] border border-[#F8CB2E]/30 px-2 py-0.5 rounded font-bold">
            {cart.length} ITEMS
          </span>
        </h2>
        
        {cart.map(item => {
          const productPrice = item.product.price * (1 - item.product.discount);
          return (
            <Card key={item.product.id} className="flex gap-4 items-center">
              {/* Product Thumbnail */}
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-950 flex-shrink-0 border border-white/10">
                <img src={item.product.image} alt={item.product.name} className="w-full h-full object-cover" />
              </div>

              {/* Product Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-white truncate font-ui">{item.product.name}</h4>
                  <button
                    onClick={() => handleRemove(item.product.id)}
                    className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-slate-800/60 active:scale-95 transition-all cursor-pointer"
                    title="Remove Item"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="text-[10px] font-mono text-slate-400 mt-0.5">Seller: {item.product.seller}</div>

                <div className="flex items-center justify-between mt-2.5">
                  {/* Price */}
                  <span className="text-sm font-mono font-extrabold text-[#F8CB2E]">
                    ₹{(productPrice * item.quantity).toLocaleString()}
                  </span>

                  {/* Quantity adjustment */}
                  <div className="flex items-center gap-2 border border-white/10 rounded bg-[#0d1220] px-1 font-mono">
                    <button
                      onClick={() => handleQuantityDecrease(item.product.id, item.quantity)}
                      className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      disabled={item.quantity <= 1}
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-xs font-bold text-white px-2 select-none">{item.quantity}</span>
                    <button
                      onClick={() => handleQuantityIncrease(item.product.id, item.quantity)}
                      className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* 2. Right Panel: Order Summary & Coupon Form */}
      <div className="w-full lg:w-96 flex flex-col gap-6">
        <h2 className="text-2xl font-bold text-white font-ui mb-1">Order Summary</h2>

        {/* Coupon Apply Form */}
        <Card className="flex flex-col gap-3">
          <label className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Tag size={14} className="text-[#F8CB2E]" />
            <span>Apply Coupon Code</span>
          </label>
          <form onSubmit={handleApplyCoupon} className="flex gap-2 font-mono">
            <Input
              type="text"
              placeholder="e.g. FLIPKART50"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              className="uppercase font-mono"
            />
            <Button type="submit" variant="secondary" className="font-mono text-xs">Apply</Button>
          </form>
          {couponError && <span className="text-xs font-mono text-rose-500">{couponError}</span>}
          {couponSuccess && <span className="text-xs font-mono text-emerald-400">{couponSuccess}</span>}
        </Card>

        {/* Pricing Summary */}
        <Card className="flex flex-col gap-4 text-sm font-mono text-slate-300">
          <div className="flex justify-between border-b border-white/10 pb-2">
            <span className="text-slate-400">Cart Subtotal</span>
            <span className="font-semibold text-white">₹{subtotal.toLocaleString()}</span>
          </div>

          {appliedDiscount > 0 && (
            <div className="flex justify-between border-b border-white/10 pb-2 text-emerald-400">
              <span>Coupon Discount</span>
              <span>- ₹{couponDiscountAmount.toLocaleString()}</span>
            </div>
          )}

          <div className="flex justify-between border-b border-white/10 pb-2">
            <span className="text-slate-400 flex items-center gap-1">
              <Truck size={14} />
              <span>Shipping Charges</span>
            </span>
            <span className="font-semibold text-white">
              {shippingCharges === 0 ? "FREE" : `₹${shippingCharges}`}
            </span>
          </div>

          <div className="flex justify-between pt-1 text-base font-extrabold text-white">
            <span>Grand Total</span>
            <span className="text-xl text-[#F8CB2E]">
              ₹{grandTotal.toLocaleString()}
            </span>
          </div>

          <Button
            onClick={handleCheckout}
            variant="primary"
            className="w-full py-3 text-sm mt-4 font-mono font-extrabold uppercase tracking-wider group"
          >
            <span>Proceed to Checkout</span>
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Button>
        </Card>
      </div>
    </motion.div>
  );
};

export default Cart;
