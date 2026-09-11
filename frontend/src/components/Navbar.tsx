import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart, LayoutDashboard, Store as StoreIcon, Sun, Moon, Cpu, Globe } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion } from 'framer-motion';
import { t } from '../utils/multilingual';

const Navbar: React.FC = () => {
  const { cart, theme, toggleTheme, language, setLanguage } = useStore();
  const location = useLocation();
  
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

  const linkClass = (path: string) => {
    const active = location.pathname === path;
    return `flex items-center gap-1.5 px-3.5 py-1.5 rounded-md font-medium text-xs transition-all duration-200 ${
      active 
        ? 'bg-[#F8CB2E]/10 text-[#F8CB2E] border border-[#F8CB2E]/30 shadow-[0_0_12px_rgba(248,203,46,0.15)] font-semibold' 
        : 'text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent'
    }`;
  };

  return (
    <motion.nav 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="sticky top-0 z-50 w-full glass border-b border-white/10 px-4 sm:px-6 py-2.5 flex items-center justify-between backdrop-blur-md"
    >
      {/* Brand Logo & Tag */}
      <Link to="/" className="flex items-center gap-3 select-none group">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#F8CB2E] text-[#080c14] font-black text-lg shadow-md shadow-[#F8CB2E]/20">
          F
        </div>
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-base leading-none text-white tracking-tight font-ui">Flipkart</span>
            <span className="font-mono text-[10px] text-[#F8CB2E] bg-[#F8CB2E]/10 border border-[#F8CB2E]/30 px-1.5 py-0.5 rounded font-semibold tracking-wider">GRiD 8.0</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono tracking-wider mt-0.5">Cart Abandonment Intervention System</span>
        </div>
      </Link>

      {/* Center: Live Session Monitoring Indicator */}
      <div className="hidden lg:flex items-center gap-2 bg-[#0d1220] border border-white/10 px-3 py-1 rounded-full text-xs font-mono">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]" />
        <span className="text-emerald-400 font-semibold">LIVE</span>
        <span className="text-slate-500">|</span>
        <span className="text-slate-300">{t("Monitoring Active Shopping Sessions", language)}</span>
      </div>

      {/* Navigation Options & Agent Status Indicators */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Agent Health Dots */}
        <div className="hidden xl:flex items-center gap-2 mr-2 bg-slate-900/60 px-2.5 py-1 rounded-md border border-white/5 font-mono text-[11px]">
          <Cpu size={12} className="text-slate-400" />
          <span title="Feature Agent Active" className="flex items-center gap-1 text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-[#60a5fa] shadow-[0_0_6px_#60a5fa]" /> {t("Feature", language)}
          </span>
          <span title="Reasoning Agent Active" className="flex items-center gap-1 text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] shadow-[0_0_6px_#a78bfa]" /> {t("Reasoning", language)}
          </span>
          <span title="Recommendation Agent Active" className="flex items-center gap-1 text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] shadow-[0_0_6px_#34d399]" /> {t("Recommend", language)}
          </span>
        </div>

        {/* Multilingual Recommendation Selector */}
        <div className="flex items-center gap-1 bg-slate-900/80 border border-white/10 px-2 py-1 rounded-md text-xs font-mono text-slate-300">
          <Globe size={13} className="text-[#F8CB2E]" />
          <select 
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-transparent text-slate-200 text-xs font-mono focus:outline-none cursor-pointer pr-1"
          >
            <option value="English" className="bg-slate-900 text-white">English</option>
            <option value="Hindi" className="bg-slate-900 text-white">Hindi (हिंदी)</option>
            <option value="Bengali" className="bg-slate-900 text-white">Bengali (বাংলা)</option>
            <option value="Tamil" className="bg-slate-900 text-white">Tamil (தமிழ்)</option>
            <option value="Telugu" className="bg-slate-900 text-white">Telugu (తెలుగు)</option>
            <option value="Kannada" className="bg-slate-900 text-white">Kannada (ಕನ್ನಡ)</option>
            <option value="Marathi" className="bg-slate-900 text-white">Marathi (मराठी)</option>
            <option value="Gujarati" className="bg-slate-900 text-white">Gujarati (ગુજરાતી)</option>
          </select>
        </div>

        <Link to="/store" className={linkClass('/store')}>
          <StoreIcon size={14} />
          <span className="hidden sm:inline">{t("Store", language)}</span>
        </Link>
        
        <Link to="/cart" className={linkClass('/cart')}>
          <div className="relative flex items-center gap-1.5">
            <ShoppingCart size={14} />
            <span className="hidden sm:inline">{t("Cart", language)}</span>
            {totalItems > 0 && (
              <span className="absolute -top-3.5 -right-2 flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-[#F8CB2E] text-[#080c14] shadow-sm">
                {totalItems}
              </span>
            )}
          </div>
        </Link>

        <Link to="/dashboard" className={linkClass('/dashboard')}>
          <LayoutDashboard size={14} />
          <span className="hidden sm:inline font-mono">{t("Mission Control", language)}</span>
        </Link>

        {/* Theme toggle switch */}
        <button
          onClick={toggleTheme}
          className="ml-1 p-1.5 rounded-md border border-white/10 text-slate-400 hover:text-white hover:bg-slate-800/60 active:scale-95 transition-all"
          title="Toggle Light/Dark Theme"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </motion.nav>
  );
};

export default Navbar;
