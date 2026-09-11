import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Store from './pages/Store';
import ProductDetails from './pages/ProductDetails';
import Cart from './pages/Cart';
import Dashboard from './pages/Dashboard';
import { useStore } from './store/useStore';
import './App.css';

const ActivityTracker: React.FC = () => {
  const location = useLocation();
  const { logEvent } = useStore();
  const prevPathRef = React.useRef(location.pathname);

  // Track transition to Mission Control
  useEffect(() => {
    if (prevPathRef.current !== '/dashboard' && location.pathname === '/dashboard') {
      logEvent(prevPathRef.current, 'MOUSE_LEAVE', { destination: 'Mission Control' });
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname, logEvent]);

  useEffect(() => {
    // Pause background listeners (mousemove, idle timers) inside Mission Control itself
    if (location.pathname === '/dashboard') {
      return;
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        logEvent(location.pathname, 'TAB_SWITCH');
      }
    };

    const handleMouseLeave = () => {
      logEvent(location.pathname, 'MOUSE_LEAVE');
    };

    let idleTimer: number;
    const resetIdleTimer = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        logEvent(location.pathname, 'IDLE');
      }, 15000);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('keydown', resetIdleTimer);
    resetIdleTimer();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('keydown', resetIdleTimer);
      window.clearTimeout(idleTimer);
    };
  }, [location.pathname, logEvent]);

  return null;
};

const App: React.FC = () => {
  const { theme, toast, hideToast } = useStore();

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.style.backgroundColor = '#080c14';
    } else {
      root.classList.remove('dark');
      root.style.backgroundColor = '#ffffff';
    }
  }, [theme]);

  // Toast automatic removal timer
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        hideToast();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast, hideToast]);

  return (
    <Router>
      <ActivityTracker />
      
      {/* Toast notifications */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 150 }}
            className="fixed top-20 right-6 z-[100] px-4 py-3 rounded-lg border shadow-xl flex items-center gap-2.5 max-w-sm glass-panel border-ai-blue/30 text-xs font-semibold text-white bg-slate-950/80"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-ai-blue animate-ping" />
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`min-h-screen transition-colors duration-300 ${
        theme === 'dark' ? 'bg-[#080c14] text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}>
        <Navbar />
        <main className="w-full">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/store" element={<Store />} />
            <Route path="/product/:id" element={<ProductDetails />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
