import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Cpu, TrendingUp, BrainCircuit, BookOpen, Layers, ShieldCheck, 
  ArrowRight, CheckCircle2, ChevronRight, BarChart3, Zap, 
  Globe, User, ExternalLink, Share2, MessageSquare, 
  X, Play, RefreshCw
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

// ─────────────────────────────────────────────────────────────────────────────
// 3D CANVAS AI ORB COMPONENT (60fps interactive particle sphere with mouse reactivity)
// ─────────────────────────────────────────────────────────────────────────────
const SphereCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 500);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 500);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    // Mouse tracking for parallax
    let mouseX = 0;
    let mouseY = 0;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = (e.clientX - rect.left - width / 2) * 0.0005;
      mouseY = (e.clientY - rect.top - height / 2) * 0.0005;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Create particles on sphere surface
    const particleCount = 220;
    const radius = Math.min(width, height) * 0.32;
    const particles: { x: number; y: number; z: number; baseAngleX: number; baseAngleY: number; speed: number; color: string }[] = [];

    const colors = ['#ff3d5a', '#8b5cf6', '#06b6d4', '#ffffff'];

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.acos(2 * Math.random() - 1);
      const phi = 2 * Math.PI * Math.random();
      particles.push({
        x: radius * Math.sin(theta) * Math.cos(phi),
        y: radius * Math.sin(theta) * Math.sin(phi),
        z: radius * Math.cos(theta),
        baseAngleX: theta,
        baseAngleY: phi,
        speed: (Math.random() - 0.5) * 0.015,
        color: colors[i % colors.length]
      });
    }

    let angleX = 0;
    let angleY = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      angleX += 0.005 + mouseY;
      angleY += 0.008 + mouseX;

      const centerX = width / 2;
      const centerY = height / 2;

      // Draw ambient glowing core
      const gradient = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, radius * 1.2);
      gradient.addColorStop(0, 'rgba(139, 92, 246, 0.25)');
      gradient.addColorStop(0.5, 'rgba(6, 182, 212, 0.15)');
      gradient.addColorStop(1, 'rgba(255, 61, 90, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.3, 0, Math.PI * 2);
      ctx.fill();

      // Project particles to 2D
      const projected: { x: number; y: number; z: number; color: string }[] = [];

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.baseAngleY += p.speed;

        // Rotation matrices
        const x1 = p.x * Math.cos(angleY) - p.z * Math.sin(angleY);
        const z1 = p.x * Math.sin(angleY) + p.z * Math.cos(angleY);

        const y2 = p.y * Math.cos(angleX) - z1 * Math.sin(angleX);
        const z2 = p.y * Math.sin(angleX) + z1 * Math.cos(angleX);

        // Perspective scale factor
        const fov = 400;
        const scale = fov / (fov + z2);
        const projX = centerX + x1 * scale;
        const projY = centerY + y2 * scale;

        projected.push({ x: projX, y: projY, z: z2, color: p.color });
      }

      // Sort by depth for correct rendering
      projected.sort((a, b) => b.z - a.z);

      // Draw connecting lines between nearby points
      ctx.lineWidth = 0.5;
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j += 4) {
          const dx = projected[i].x - projected[j].x;
          const dy = projected[i].y - projected[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 65) {
            const alpha = (1 - dist / 65) * 0.25;
            ctx.strokeStyle = `rgba(139, 92, 246, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(projected[i].x, projected[i].y);
            ctx.lineTo(projected[j].x, projected[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw particle points
      for (let i = 0; i < projected.length; i++) {
        const p = projected[i];
        const alpha = Math.max(0.2, (p.z + radius) / (radius * 2));
        const size = Math.max(1, ((p.z + radius) / (radius * 2)) * 3.5);

        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1.0;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div className="relative w-full h-[450px] sm:h-[550px] flex items-center justify-center">
      <canvas ref={canvasRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      {/* Overlay Glow Rings */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-72 h-72 rounded-full border border-cyan-500/20 animate-ping opacity-25" />
        <div className="w-96 h-96 rounded-full border border-purple-500/20 animate-pulse opacity-30" />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE INDIA MAP WITH AI JOB-RISK HEATMAP (Mouse Reactive 3D Parallax Tilt)
// ─────────────────────────────────────────────────────────────────────────────
const InteractiveIndiaHeatmap: React.FC<{ onReskillClick: () => void }> = ({ onReskillClick }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const cities = [
    {
      id: 'bengaluru',
      name: 'Bengaluru',
      state: 'Karnataka',
      x: 42,
      y: 70,
      riskScore: 68,
      workforce: '1.8M Tech Professionals',
      topRisk: 'Automated Code Generation & Legacy Backend ETL',
      shieldSkill: 'Agentic AI Systems & Multi-Agent Orchestration',
      reskillPathway: 'GenAI System Architecture (ChromaDB + LangChain)',
      color: '#ff3d5a'
    },
    {
      id: 'hyderabad',
      name: 'Hyderabad',
      state: 'Telangana',
      x: 48,
      y: 58,
      riskScore: 54,
      workforce: '1.2M Engineers',
      topRisk: 'Manual QA Automation & Cloud Maintenance',
      shieldSkill: 'Neural MLOps & Autonomous Pipeline Governance',
      reskillPathway: 'Cloud Native AI Infrastructure & Kubernetes MLOps',
      color: '#f59e0b'
    },
    {
      id: 'pune',
      name: 'Pune',
      state: 'Maharashtra',
      x: 34,
      y: 55,
      riskScore: 62,
      workforce: '850K Engineers',
      topRisk: 'Legacy Java Monoliths & Automated Refactoring',
      shieldSkill: 'Fullstack AI Agent Deployment',
      reskillPathway: 'Modern React 19 + AI API Middleware Stack',
      color: '#ff3d5a'
    },
    {
      id: 'ncr',
      name: 'NCR (Gurugram/Noida)',
      state: 'Delhi NCR',
      x: 42,
      y: 28,
      riskScore: 73,
      workforce: '1.5M Professionals',
      topRisk: 'Customer Support BPO & Financial Document Processing',
      shieldSkill: 'Domain-Specific LLM Fine-tuning & RAG Pipelines',
      reskillPathway: 'Enterprise AI Strategy & RAG Retrieval Optimization',
      color: '#ff3d5a'
    },
    {
      id: 'mumbai',
      name: 'Mumbai',
      state: 'Maharashtra',
      x: 32,
      y: 52,
      riskScore: 44,
      workforce: '1.1M BFSI & Tech',
      topRisk: 'Basic Algorithmic Trading & Excel Analytics',
      shieldSkill: 'Deep Quant ML & Fraud Neural Intelligence',
      reskillPathway: 'AI Fraud Detection & Real-time Risk Telemetry',
      color: '#06b6d4'
    },
    {
      id: 'chennai',
      name: 'Chennai',
      state: 'Tamil Nadu',
      x: 50,
      y: 75,
      riskScore: 58,
      workforce: '950K Tech Professionals',
      topRisk: 'Embedded Software Testing & Legacy SaaS Ops',
      shieldSkill: 'Edge AI Inference & Autonomous IoT Engineering',
      reskillPathway: 'Edge AI Deployment & Embedded Neural Networks',
      color: '#f59e0b'
    }
  ];

  const [activeCity, setActiveCity] = useState(cities[0]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    
    // Smooth 3D parallax tilt calculation based on mouse coordinate position
    const tiltX = -(y / (rect.height / 2)) * 14;
    const tiltY = (x / (rect.width / 2)) * 14;
    setTilt({ x: tiltX, y: tiltY });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  return (
    <section className="py-24 px-4 sm:px-8 max-w-7xl mx-auto text-left relative z-10">
      <div className="flex flex-col items-center text-center gap-4 mb-14">
        <div className="inline-flex items-center gap-2 bg-[#ff3d5a]/10 border border-[#ff3d5a]/30 px-3.5 py-1 rounded-full text-xs font-mono text-[#ff3d5a]">
          ✦ LIVE GEOGRAPHIC DISPLACEMENT RADAR
        </div>
        <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight font-ui">
          Interactive India AI Job-Risk Heatmap
        </h2>
        <p className="text-slate-400 text-sm sm:text-base font-mono max-w-2xl">
          Move your mouse across the 3D map to tilt the perspective dynamically and inspect real-time AI automation risk telemetry across Indian tech hubs.
        </p>
      </div>

      <div 
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="glass-mirage-glow p-6 sm:p-10 rounded-3xl border border-[#8b5cf6]/30 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative overflow-hidden transition-transform duration-200 ease-out shadow-2xl"
        style={{
          transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transformStyle: 'preserve-3d'
        }}
      >
        {/* Background Radial Glow */}
        <div className="absolute inset-0 bg-gradient-to-tr from-[#ff3d5a]/10 via-transparent to-[#06b6d4]/10 pointer-events-none" />

        {/* Left Side: 3D Interactive Vector India Map */}
        <div className="lg:col-span-7 relative h-[480px] sm:h-[540px] bg-[#050914] rounded-2xl border border-white/10 p-4 flex items-center justify-center overflow-hidden group shadow-inner">
          
          {/* India Geographic Outline SVG */}
          <svg className="w-full h-full opacity-40 filter drop-shadow-[0_0_20px_rgba(139,92,246,0.35)]" viewBox="0 0 500 550" fill="none">
            <path 
              d="M180,40 Q220,20 260,50 Q310,40 330,80 Q370,120 400,160 Q450,200 420,260 Q400,310 380,360 Q340,420 280,480 Q240,520 220,530 Q200,480 180,420 Q160,360 140,320 Q100,280 80,240 Q60,180 110,140 Q150,90 180,40 Z" 
              fill="url(#indiaGradient)" 
              stroke="rgba(6, 182, 212, 0.5)" 
              strokeWidth="2" 
              strokeDasharray="4 2"
            />
            <defs>
              <linearGradient id="indiaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1e1b4b" stopOpacity="0.85" />
                <stop offset="50%" stopColor="#0f172a" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#030712" stopOpacity="0.95" />
              </linearGradient>
            </defs>
          </svg>

          {/* Neural Connection Lines between Hubs */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <line x1="42%" y1="70%" x2="48%" y2="58%" stroke="rgba(139,92,246,0.4)" strokeWidth="1.5" strokeDasharray="3 3" />
            <line x1="48%" y1="58%" x2="42%" y2="28%" stroke="rgba(6,182,212,0.4)" strokeWidth="1.5" strokeDasharray="3 3" />
            <line x1="42%" y1="70%" x2="34%" y2="55%" stroke="rgba(255,61,90,0.4)" strokeWidth="1.5" strokeDasharray="3 3" />
            <line x1="34%" y1="55%" x2="32%" y2="52%" stroke="rgba(139,92,246,0.4)" strokeWidth="1.5" />
          </svg>

          {/* Interactive City Nodes */}
          {cities.map((city) => {
            const isSelected = activeCity.id === city.id;
            return (
              <div 
                key={city.id}
                onClick={() => setActiveCity(city)}
                onMouseEnter={() => setActiveCity(city)}
                className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 group/node"
                style={{ left: `${city.x}%`, top: `${city.y}%` }}
              >
                {/* Pulsing Radar Ring */}
                <div 
                  className={`w-10 h-10 rounded-full absolute -inset-2 animate-ping opacity-35 ${
                    city.riskScore >= 65 ? 'bg-[#ff3d5a]' : city.riskScore >= 50 ? 'bg-amber-400' : 'bg-[#06b6d4]'
                  }`}
                />

                {/* Inner Glowing Orb */}
                <div 
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                    isSelected 
                      ? 'scale-125 border-white shadow-[0_0_20px_rgba(255,255,255,0.9)]' 
                      : 'border-white/40 hover:scale-110'
                  }`}
                  style={{ backgroundColor: city.color }}
                >
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                </div>

                {/* City Label Badge */}
                <div className={`mt-1 px-2.5 py-0.5 rounded text-[10px] font-mono font-bold whitespace-nowrap transition-all shadow-lg ${
                  isSelected 
                    ? 'bg-white text-slate-950 scale-105' 
                    : 'bg-slate-900/90 text-slate-200 border border-white/10 group-hover/node:border-purple-500'
                }`}>
                  {city.name} ({city.riskScore}%)
                </div>
              </div>
            );
          })}

          <div className="absolute bottom-4 left-4 text-[11px] font-mono text-slate-400 flex items-center gap-3 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-white/10">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#ff3d5a]" /> High Risk (&gt;60%)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Moderate (50-60%)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#06b6d4]" /> Low Risk (&lt;50%)</span>
          </div>
        </div>

        {/* Right Side: Selected City Detailed AI Risk Inspection Panel */}
        <div className="lg:col-span-5 flex flex-col gap-5 text-left">
          <div className="glass-mirage p-6 rounded-2xl border border-white/10 flex flex-col gap-4">
            
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Active City Telemetry</span>
                <h3 className="text-2xl font-black text-white font-ui">{activeCity.name}</h3>
                <span className="text-xs font-mono text-slate-400">{activeCity.state} • {activeCity.workforce}</span>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-mono text-slate-400 uppercase">Automation Risk</span>
                <div 
                  className="text-3xl font-black font-mono"
                  style={{ color: activeCity.color }}
                >
                  {activeCity.riskScore}%
                </div>
              </div>
            </div>

            {/* Risk Gauge Bar */}
            <div>
              <div className="flex justify-between text-xs font-mono text-slate-400 mb-1">
                <span>Vulnerability Score</span>
                <span className="font-bold text-white">{activeCity.riskScore}/100</span>
              </div>
              <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-white/5">
                <motion.div 
                  key={activeCity.id}
                  initial={{ width: 0 }}
                  animate={{ width: `${activeCity.riskScore}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: activeCity.color }}
                />
              </div>
            </div>

            {/* Inferred Displacement Risk & Shield Skill */}
            <div className="flex flex-col gap-3 font-mono text-xs pt-1">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <span className="text-[10px] text-rose-400 uppercase font-bold">Top Threat Factor:</span>
                <p className="text-slate-200 mt-0.5 leading-relaxed">{activeCity.topRisk}</p>
              </div>

              <div className="p-3 rounded-xl bg-[#06b6d4]/10 border border-[#06b6d4]/20">
                <span className="text-[10px] text-[#06b6d4] uppercase font-bold">Recommended Career Shield:</span>
                <p className="text-slate-200 mt-0.5 leading-relaxed">{activeCity.shieldSkill}</p>
              </div>
            </div>

            {/* Action CTA */}
            <button 
              onClick={onReskillClick}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#ff3d5a] via-[#8b5cf6] to-[#06b6d4] text-white font-mono font-bold text-xs hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-500/20 mt-1"
            >
              <Zap size={14} />
              <span>Reskill for {activeCity.name} Tech Market</span>
            </button>

          </div>
        </div>

      </div>
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN LANDING PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const SkillsMirageLanding: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'risk' | 'trends' | 'gap'>('risk');
  const selectedRole = 'Data Architect';
  const [isAnalyzerOpen, setIsAnalyzerOpen] = useState(false);
  const [userRoleInput, setUserRoleInput] = useState('');
  const [userExpInput, setUserExpInput] = useState('5 Years');
  const [userCityInput, setUserCityInput] = useState('Bengaluru');
  const [analyzedResult, setAnalyzedResult] = useState<any | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Mock dashboard analytics data
  const trendsChartData = [
    { month: 'Jan', AI_Vulnerability: 42, Market_Demand: 85, Automation_Speed: 30 },
    { month: 'Feb', AI_Vulnerability: 48, Market_Demand: 82, Automation_Speed: 38 },
    { month: 'Mar', AI_Vulnerability: 55, Market_Demand: 79, Automation_Speed: 45 },
    { month: 'Apr', AI_Vulnerability: 62, Market_Demand: 74, Automation_Speed: 52 },
    { month: 'May', AI_Vulnerability: 68, Market_Demand: 70, Automation_Speed: 64 },
    { month: 'Jun', AI_Vulnerability: 74, Market_Demand: 68, Automation_Speed: 76 },
  ];

  const skillGapData = [
    { skill: 'GenAI & LLMs', current: 35, required: 92 },
    { skill: 'Cloud Architecture', current: 75, required: 88 },
    { skill: 'Neural Analytics', current: 40, required: 85 },
    { skill: 'Automated MLOps', current: 50, required: 90 },
    { skill: 'AI Governance', current: 20, required: 80 },
  ];

  const handleRunAnalysis = () => {
    if (!userRoleInput.trim()) return;
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
      setAnalyzedResult({
        role: userRoleInput,
        riskScore: Math.floor(Math.random() * 45) + 35, // 35% to 80%
        topRiskFactor: "LLM Code Generation & Automated ETL Displacement",
        recommendedSkill: "Agentic AI Architecture & Vector Database Design",
        timeWindow: "18 Months",
        salaryUplift: "+32%"
      });
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 font-ui relative overflow-x-hidden selection:bg-[#ff3d5a] selection:text-white">
      
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 1: STICKY TRANSPARENT NAVIGATION */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 w-full glass-mirage border-b border-white/10 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#ff3d5a] via-[#8b5cf6] to-[#06b6d4] p-[1px] shadow-lg shadow-purple-500/20">
            <div className="w-full h-full bg-[#080c14] rounded-[11px] flex items-center justify-center text-white">
              <BrainCircuit size={20} className="text-[#06b6d4]" />
            </div>
          </div>
          <div className="flex flex-col text-left">
            <span className="font-extrabold text-lg tracking-tight text-white flex items-center gap-1.5 font-ui">
              Skills Mirage <span className="text-[10px] font-mono bg-purple-500/20 text-[#8b5cf6] border border-purple-500/40 px-1.5 py-0.5 rounded font-semibold">AI 2.0</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">Workforce Intelligence</span>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center gap-8 font-mono text-xs text-slate-300">
          <a href="#dashboard-preview" className="hover:text-[#06b6d4] transition-colors flex items-center gap-1.5">
            <BarChart3 size={14} className="text-[#06b6d4]" /> Dashboard
          </a>
          <button onClick={() => setIsAnalyzerOpen(true)} className="hover:text-[#ff3d5a] transition-colors flex items-center gap-1.5 cursor-pointer">
            <Zap size={14} className="text-[#ff3d5a]" /> Risk Analyzer
          </button>
          <a href="#workflow" className="hover:text-[#8b5cf6] transition-colors flex items-center gap-1.5">
            <Cpu size={14} className="text-[#8b5cf6]" /> AI Assistant
          </a>
          <a href="#features" className="hover:text-slate-100 transition-colors">
            Features
          </a>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsAnalyzerOpen(true)}
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-mono font-medium text-slate-300 hover:text-white hover:bg-slate-900 border border-white/10 transition-all"
          >
            Login
          </button>
          <button 
            onClick={() => setIsAnalyzerOpen(true)}
            className="px-5 py-2.5 rounded-lg text-xs font-mono font-extrabold text-white bg-gradient-to-r from-[#ff3d5a] via-[#8b5cf6] to-[#06b6d4] hover:opacity-95 shadow-lg shadow-purple-500/25 transition-all flex items-center gap-2 group cursor-pointer"
          >
            <span>Get Started</span>
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </nav>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 2: HERO SECTION */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="relative pt-12 pb-24 px-4 sm:px-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        
        {/* Left Column: Heading & CTAs */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="lg:col-span-7 text-left flex flex-col gap-6 z-10"
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2.5 bg-gradient-to-r from-[#ff3d5a]/10 via-[#8b5cf6]/10 to-[#06b6d4]/10 border border-[#8b5cf6]/30 px-3.5 py-1.5 rounded-full text-xs font-mono self-start shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#ff3d5a] animate-pulse shadow-[0_0_8px_#ff3d5a]" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff3d5a] via-[#8b5cf6] to-[#06b6d4] font-bold">
              ✦ India's #1 Workforce Intelligence Platform
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.1] font-ui">
            India's Jobs Are Changing. <br />
            <span className="text-gradient-mirage">Is Yours Ready?</span>
          </h1>

          {/* Subtitle */}
          <p className="text-slate-400 text-base sm:text-lg leading-relaxed font-mono max-w-2xl">
            AI-powered workforce intelligence that predicts automation risk, recommends personalized reskilling, and helps professionals stay ahead.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-4 pt-3">
            <button 
              onClick={() => setIsAnalyzerOpen(true)}
              className="px-8 py-4 rounded-xl text-sm font-mono font-extrabold text-white bg-gradient-to-r from-[#ff3d5a] via-[#8b5cf6] to-[#06b6d4] hover:shadow-xl hover:shadow-[#ff3d5a]/20 transition-all flex items-center gap-2.5 group cursor-pointer"
            >
              <Zap size={18} className="text-white fill-white" />
              <span>Analyze My Career</span>
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>

            <a 
              href="#dashboard-preview"
              className="px-8 py-4 rounded-xl text-sm font-mono font-bold text-slate-200 glass-mirage hover:bg-slate-900 border border-white/15 transition-all flex items-center gap-2"
            >
              <Play size={16} className="text-[#06b6d4] fill-[#06b6d4]" />
              <span>Explore Dashboard</span>
            </a>
          </div>

          {/* Live Micro Indicator */}
          <div className="flex items-center gap-4 text-xs font-mono text-slate-400 pt-4 border-t border-white/10">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-400" />
              <span>40M+ Roles Modeled</span>
            </div>
            <span className="text-slate-600">•</span>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-[#06b6d4]" />
              <span>Real-time SHAP Attributions</span>
            </div>
          </div>
        </motion.div>

        {/* Right Column: Interactive 3D Sphere & Holographic Risk Mockup */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="lg:col-span-5 relative flex flex-col items-center justify-center"
        >
          {/* 3D Canvas AI Sphere */}
          <SphereCanvas />

          {/* Floating Holographic Card Over Canvas */}
          <motion.div 
            whileHover={{ y: -4 }}
            className="absolute bottom-4 left-2 right-2 sm:left-4 sm:right-4 glass-mirage-glow p-5 rounded-2xl border border-[#8b5cf6]/30 text-left flex flex-col gap-3 shadow-2xl backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#06b6d4] animate-ping" />
                <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">Live AI Risk Assessment</span>
              </div>
              <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">
                Low Vulnerability
              </span>
            </div>

            <div className="flex items-center justify-between font-mono my-1">
              <div>
                <span className="text-[10px] text-slate-400 uppercase">Target Role</span>
                <div className="text-sm font-bold text-white flex items-center gap-1.5">
                  <User size={14} className="text-[#8b5cf6]" />
                  <span>{selectedRole}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase">Automation Risk</span>
                <div className="text-xl font-black text-[#06b6d4]">24%</div>
              </div>
            </div>

            {/* Interactive Progress Bar */}
            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '24%' }}
                transition={{ duration: 1 }}
                className="h-full bg-gradient-to-r from-[#06b6d4] to-[#8b5cf6] rounded-full" 
              />
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1">
              <span>Primary Shield: <strong>Agentic MLOps</strong></span>
              <span className="text-[#ff3d5a] font-bold">Reskill Urgency: Low</span>
            </div>
          </motion.div>
        </motion.div>

      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 3: ANIMATED STATISTICS */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="py-16 px-4 sm:px-8 max-w-7xl mx-auto border-y border-white/10 relative">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          
          {[
            { value: "40M+", label: "Professionals", sub: "Roles Analyzed across India", color: "text-[#06b6d4]" },
            { value: "20+", label: "Cities", sub: "Tier 1 & Tier 2 Tech Hubs", color: "text-[#8b5cf6]" },
            { value: "500+", label: "Courses", sub: "AI & Domain Reskilling Modules", color: "text-[#ff3d5a]" },
            { value: "87%", label: "Prediction Accuracy", sub: "SHAP & XGBoost Validated", color: "text-emerald-400" }
          ].map((stat, idx) => (
            <motion.div 
              key={idx}
              whileHover={{ y: -4 }}
              className="glass-mirage p-6 rounded-2xl border border-white/10 flex flex-col gap-1 text-left relative overflow-hidden group"
            >
              <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/5 group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
              <div className={`text-4xl sm:text-5xl font-black font-mono tracking-tight ${stat.color}`}>
                {stat.value}
              </div>
              <div className="text-base font-bold text-white font-ui mt-1">{stat.label}</div>
              <div className="text-xs font-mono text-slate-400">{stat.sub}</div>
            </motion.div>
          ))}

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 3.5: INTERACTIVE INDIA AI JOB-RISK HEATMAP (Mouse Reactive 3D Tilt) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <InteractiveIndiaHeatmap onReskillClick={() => setIsAnalyzerOpen(true)} />

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 4: FEATURES GRID (6 Premium Glass Cards) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-4 sm:px-8 max-w-7xl mx-auto text-left relative">
        <div className="flex flex-col items-center text-center gap-4 mb-16">
          <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 px-3.5 py-1 rounded-full text-xs font-mono text-[#8b5cf6]">
            ✦ INTELLIGENCE ENGINE FEATURES
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight font-ui max-w-3xl leading-tight">
            Engineered for Precision Workforce Transformation
          </h2>
          <p className="text-slate-400 text-sm sm:text-base font-mono max-w-2xl">
            A 6-layer intelligence framework combining real-time market signals, TreeSHAP attributions, and ChromaDB vector recommendations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          
          {[
            {
              icon: <TrendingUp className="text-[#06b6d4]" size={24} />,
              title: "Market Intelligence",
              desc: "Monitors real-time Indian tech hiring trends, displacement rates, and emerging skill demands across top Indian enterprises.",
              badge: "Real-time Telemetry"
            },
            {
              icon: <Cpu className="text-[#ff3d5a]" size={24} />,
              title: "AI Risk Prediction",
              desc: "XGBoost classifier estimates your 3-year job vulnerability score based on tool automation velocity and task complexity.",
              badge: "Predictive Analytics"
            },
            {
              icon: <BrainCircuit className="text-[#8b5cf6]" size={24} />,
              title: "Root Cause Analysis",
              desc: "Local SHAP feature attributions isolate the exact skill friction causing high automation risk in your specific role.",
              badge: "Explainable AI"
            },
            {
              icon: <BookOpen className="text-emerald-400" size={24} />,
              title: "Personalized Reskilling",
              desc: "ChromaDB RAG Engine matches your exact skill gap with targeted learning pathways to future-proof your career trajectory.",
              badge: "Vector RAG Match"
            },
            {
              icon: <Layers className="text-amber-400" size={24} />,
              title: "Synthetic Workforce Simulation",
              desc: "Simulate enterprise-wide organizational reskilling outcomes and measure ROI before deploying training capital.",
              badge: "Agentic Simulator"
            },
            {
              icon: <ShieldCheck className="text-[#06b6d4]" size={24} />,
              title: "Explainable AI Dashboard",
              desc: "Transparent model confidence scores, feature importance trees, and audited decision logs for complete organizational trust.",
              badge: "Transparent Audit"
            }
          ].map((feature, idx) => (
            <motion.div 
              key={idx}
              whileHover={{ y: -6, scale: 1.01 }}
              transition={{ duration: 0.2 }}
              className="glass-mirage p-8 rounded-2xl border border-white/10 flex flex-col justify-between gap-6 relative overflow-hidden group hover:border-[#8b5cf6]/40 hover:shadow-xl hover:shadow-purple-500/10"
            >
              <div className="flex items-center justify-between">
                <div className="p-3.5 rounded-xl bg-slate-900 border border-white/10 group-hover:border-purple-500/30 transition-colors">
                  {feature.icon}
                </div>
                <span className="text-[10px] font-mono bg-white/5 border border-white/10 text-slate-300 px-2.5 py-1 rounded-full uppercase tracking-wider">
                  {feature.badge}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-xl font-bold text-white font-ui">{feature.title}</h3>
                <p className="text-xs font-mono text-slate-400 leading-relaxed">{feature.desc}</p>
              </div>

              <div className="pt-4 border-t border-white/5 flex items-center text-xs font-mono font-semibold text-[#06b6d4] group-hover:translate-x-1 transition-transform">
                <span>Explore Technical Specs</span>
                <ChevronRight size={14} />
              </div>
            </motion.div>
          ))}

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 5: INTERACTIVE DASHBOARD PREVIEW */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section id="dashboard-preview" className="py-24 px-4 sm:px-8 max-w-7xl mx-auto text-left relative">
        <div className="glass-mirage-glow p-6 sm:p-10 rounded-3xl border border-[#8b5cf6]/30 flex flex-col gap-8">
          
          {/* Header Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="text-2xl font-bold text-white font-ui">Interactive Intelligence Dashboard</h3>
              </div>
              <p className="text-xs font-mono text-slate-400 mt-1">
                Real-time risk scoring, sector vulnerability heatmaps, and skill gap attributions.
              </p>
            </div>

            {/* Tab Switches */}
            <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-xl border border-white/10 font-mono text-xs">
              <button 
                onClick={() => setActiveTab('risk')}
                className={`px-4 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTab === 'risk' ? 'bg-[#ff3d5a] text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Risk Score
              </button>
              <button 
                onClick={() => setActiveTab('trends')}
                className={`px-4 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTab === 'trends' ? 'bg-[#8b5cf6] text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Job Trends
              </button>
              <button 
                onClick={() => setActiveTab('gap')}
                className={`px-4 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTab === 'gap' ? 'bg-[#06b6d4] text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Skill Gap
              </button>
            </div>
          </div>

          {/* Interactive Content View */}
          {activeTab === 'risk' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-5 flex flex-col gap-6">
                <div className="bg-slate-950 p-6 rounded-2xl border border-white/10 flex flex-col gap-4">
                  <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Calculated Role Vulnerability</span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-5xl font-black font-mono text-[#ff3d5a]">64%</span>
                    <span className="text-xs font-mono bg-[#ff3d5a]/20 text-[#ff3d5a] border border-[#ff3d5a]/30 px-2.5 py-1 rounded font-bold">
                      MODERATE DISPLACEMENT RISK
                    </span>
                  </div>
                  <p className="text-xs font-mono text-slate-400 leading-relaxed">
                    Based on 14 skill signals including code synthesis, automated testing, and cloud infrastructure management.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 font-mono text-xs">
                  <div className="bg-slate-950 p-4 rounded-xl border border-white/10">
                    <div className="text-slate-400">Confidence Meter</div>
                    <div className="text-xl font-bold text-[#06b6d4] mt-1">94.2%</div>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-xl border border-white/10">
                    <div className="text-slate-400">Reskill Window</div>
                    <div className="text-xl font-bold text-[#8b5cf6] mt-1">12 Months</div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 h-72 w-full font-mono text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendsChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="month" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip contentStyle={{ backgroundColor: '#090d16', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }} />
                    <Area type="monotone" dataKey="AI_Vulnerability" stroke="#ff3d5a" fill="rgba(255,61,90,0.2)" strokeWidth={3} />
                    <Area type="monotone" dataKey="Market_Demand" stroke="#06b6d4" fill="rgba(6,182,212,0.1)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === 'trends' && (
            <div className="h-80 w-full font-mono text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendsChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip contentStyle={{ backgroundColor: '#090d16', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }} />
                  <Bar dataKey="AI_Vulnerability" fill="#ff3d5a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Automation_Speed" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {activeTab === 'gap' && (
            <div className="h-80 w-full font-mono text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={skillGapData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" stroke="#64748b" />
                  <YAxis dataKey="skill" type="category" stroke="#94a3b8" width={140} />
                  <Tooltip contentStyle={{ backgroundColor: '#090d16', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }} />
                  <Bar dataKey="current" fill="#64748b" radius={[0, 4, 4, 0]} name="Current Proficiency" />
                  <Bar dataKey="required" fill="#06b6d4" radius={[0, 4, 4, 0]} name="Market Benchmark" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 6: AI WORKFLOW TIMELINE */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section id="workflow" className="py-24 px-4 sm:px-8 max-w-7xl mx-auto text-left relative">
        <div className="flex flex-col items-center text-center gap-4 mb-16">
          <div className="inline-flex items-center gap-2 bg-[#06b6d4]/10 border border-[#06b6d4]/30 px-3.5 py-1 rounded-full text-xs font-mono text-[#06b6d4]">
            ✦ 6-STEP INTELLIGENCE PIPELINE
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight font-ui">
            How Skills Mirage Shields Your Career
          </h2>
          <p className="text-slate-400 text-sm sm:text-base font-mono max-w-2xl">
            From raw behavioral & career telemetry to AI-guided reskilling pathways.
          </p>
        </div>

        {/* Horizontal/Vertical Connected Beam Timeline */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 relative">
          
          {[
            { step: "01", title: "Collect Session Data", desc: "Ingests career history & skill telemetry." },
            { step: "02", title: "Analyze Behaviour", desc: "Evaluates tool usage & automation trends." },
            { step: "03", title: "Root Cause Detection", desc: "TreeSHAP maps local friction drivers." },
            { step: "04", title: "Generate Risk", desc: "XGBoost predicts 3-year displacement." },
            { step: "05", title: "Recommend Paths", desc: "ChromaDB RAG retrieves curated modules." },
            { step: "06", title: "Personalized Reskill", desc: "Continuous learning & career shield." }
          ].map((item, idx) => (
            <motion.div 
              key={idx}
              whileHover={{ y: -6 }}
              className="glass-mirage p-6 rounded-2xl border border-white/10 flex flex-col justify-between gap-4 relative group hover:border-[#06b6d4]/40"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-[#ff3d5a] to-[#8b5cf6]">
                  {item.step}
                </span>
                <span className="w-2 h-2 rounded-full bg-[#06b6d4] group-hover:scale-150 transition-transform" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white font-ui">{item.title}</h4>
                <p className="text-xs font-mono text-slate-400 mt-1 leading-relaxed">{item.desc}</p>
              </div>
            </motion.div>
          ))}

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 7: TESTIMONIALS */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-8 max-w-7xl mx-auto text-left relative">
        <div className="flex flex-col items-center text-center gap-4 mb-16">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight font-ui">
            Trusted by India's Top Tech Leaders
          </h2>
          <p className="text-slate-400 text-sm sm:text-base font-mono max-w-xl">
            See how professionals and enterprise engineering teams use Skills Mirage to stay ahead.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {[
            {
              name: "Ananya Sharma",
              role: "Lead Data Architect",
              company: "Bengaluru Tech Labs",
              quote: "Skills Mirage predicted automated ETL displacement in my domain 14 months before it happened. The recommended RAG learning path helped me transition into Agentic MLOps seamlessly.",
              avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80"
            },
            {
              name: "Vikramaditya Roy",
              role: "VP of Engineering",
              company: "FinPay India",
              quote: "The synthetic workforce simulation gave us 87% accuracy when planning our 500-person engineering reskilling strategy. Essential tool for modern Indian tech leadership.",
              avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
            },
            {
              name: "Priya Sundaram",
              role: "AI Research Specialist",
              company: "Hyderabad Hub",
              quote: "The SHAP root cause breakdown is a game changer. It doesn't just give a vague risk score—it pinpoints the exact skills you need to learn this weekend.",
              avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80"
            }
          ].map((t, idx) => (
            <motion.div 
              key={idx}
              whileHover={{ y: -6 }}
              className="glass-mirage p-8 rounded-2xl border border-white/10 flex flex-col justify-between gap-6 text-left"
            >
              <p className="text-xs font-mono text-slate-300 leading-relaxed italic">
                "{t.quote}"
              </p>
              
              <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                <img src={t.avatar} alt={t.name} className="w-11 h-11 rounded-full object-cover border border-[#8b5cf6]/40" />
                <div>
                  <div className="text-sm font-bold text-white font-ui">{t.name}</div>
                  <div className="text-xs font-mono text-slate-400">{t.role} • {t.company}</div>
                </div>
              </div>
            </motion.div>
          ))}

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 8: TRUSTED BY (Infinite Marquee) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="py-12 border-y border-white/10 bg-slate-950/50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 mb-6 text-center text-xs font-mono text-slate-500 uppercase tracking-widest">
          Empowering Workforce Strategy across Leading Tech Enterprises
        </div>
        <div className="w-full overflow-hidden whitespace-nowrap flex">
          <div className="animate-marquee flex items-center justify-around gap-12 sm:gap-24 font-mono font-bold text-xl text-slate-400">
            <span>TATA CONSULTANCY</span>
            <span className="text-[#ff3d5a]">INFOSYS</span>
            <span>FLIPKART</span>
            <span className="text-[#06b6d4]">WIPRO</span>
            <span>RAZORPAY</span>
            <span className="text-[#8b5cf6]">MICROSOFT</span>
            <span>GOOGLE CLOUD</span>
            <span>SWIGGY</span>
            {/* Duplicate for seamless infinite scroll loop */}
            <span>TATA CONSULTANCY</span>
            <span className="text-[#ff3d5a]">INFOSYS</span>
            <span>FLIPKART</span>
            <span className="text-[#06b6d4]">WIPRO</span>
            <span>RAZORPAY</span>
            <span className="text-[#8b5cf6]">MICROSOFT</span>
            <span>GOOGLE CLOUD</span>
            <span>SWIGGY</span>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 9: CALL TO ACTION (CTA) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-8 max-w-5xl mx-auto text-center relative">
        <div className="glass-mirage-glow p-10 sm:p-16 rounded-3xl border border-[#ff3d5a]/30 relative overflow-hidden flex flex-col items-center gap-6 shadow-2xl">
          
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ff3d5a] via-[#8b5cf6] to-[#06b6d4] p-[1px] mb-2 shadow-xl shadow-purple-500/30">
            <div className="w-full h-full bg-[#080c14] rounded-[15px] flex items-center justify-center text-white">
              <Zap size={32} className="text-[#06b6d4]" />
            </div>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight font-ui max-w-2xl leading-tight">
            Future-proof Your Career Today
          </h2>

          <p className="text-slate-300 text-sm sm:text-base font-mono max-w-xl leading-relaxed">
            Join over 40,000+ Indian tech professionals using AI workforce intelligence to stay irreplaceable.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button 
              onClick={() => setIsAnalyzerOpen(true)}
              className="px-9 py-4 rounded-xl text-sm font-mono font-extrabold text-white bg-gradient-to-r from-[#ff3d5a] via-[#8b5cf6] to-[#06b6d4] hover:scale-105 transition-all shadow-xl shadow-purple-500/25 flex items-center gap-2 cursor-pointer"
            >
              <span>Start Free</span>
              <ArrowRight size={16} />
            </button>
            <button 
              onClick={() => setIsAnalyzerOpen(true)}
              className="px-9 py-4 rounded-xl text-sm font-mono font-bold text-slate-200 glass-mirage hover:bg-slate-900 border border-white/15 transition-all cursor-pointer"
            >
              View Demo
            </button>
          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 10: FOOTER */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <footer className="glass-mirage border-t border-white/10 pt-16 pb-12 px-4 sm:px-8 max-w-7xl mx-auto text-left relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10 pb-12 border-b border-white/10">
          
          {/* Brand Info */}
          <div className="md:col-span-2 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff3d5a] to-[#06b6d4] p-[1px]">
                <div className="w-full h-full bg-[#080c14] rounded-[7px] flex items-center justify-center text-white">
                  <BrainCircuit size={18} className="text-[#06b6d4]" />
                </div>
              </div>
              <span className="font-extrabold text-lg tracking-tight text-white font-ui">Skills Mirage</span>
            </div>
            <p className="text-xs font-mono text-slate-400 max-w-sm leading-relaxed">
              India's premiere AI-powered Workforce Intelligence Platform predicting automation vulnerability & delivering personalized reskilling pathways.
            </p>
            <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full w-fit">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Systems Operational • 99.99% Reliability</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex flex-col gap-3 font-mono text-xs">
            <span className="font-bold text-white uppercase tracking-wider">Platform</span>
            <a href="#features" className="text-slate-400 hover:text-white transition-colors">Risk Analyzer</a>
            <a href="#dashboard-preview" className="text-slate-400 hover:text-white transition-colors">SHAP Engine</a>
            <a href="#workflow" className="text-slate-400 hover:text-white transition-colors">ChromaDB RAG</a>
            <a href="#features" className="text-slate-400 hover:text-white transition-colors">Workforce Simulator</a>
          </div>

          <div className="flex flex-col gap-3 font-mono text-xs">
            <span className="font-bold text-white uppercase tracking-wider">Solutions</span>
            <a href="#" className="text-slate-400 hover:text-white transition-colors">Software Engineering</a>
            <a href="#" className="text-slate-400 hover:text-white transition-colors">Data Science & AI</a>
            <a href="#" className="text-slate-400 hover:text-white transition-colors">Fintech & Banking</a>
            <a href="#" className="text-slate-400 hover:text-white transition-colors">Enterprise HR Tech</a>
          </div>

          <div className="flex flex-col gap-3 font-mono text-xs">
            <span className="font-bold text-white uppercase tracking-wider">Company</span>
            <a href="#" className="text-slate-400 hover:text-white transition-colors">About Us</a>
            <a href="#" className="text-slate-400 hover:text-white transition-colors">Research Papers</a>
            <a href="#" className="text-slate-400 hover:text-white transition-colors">Careers</a>
            <a href="#" className="text-slate-400 hover:text-white transition-colors">Contact Support</a>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
          <div>© 2026 Skills Mirage AI Inc. All rights reserved.</div>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-slate-300 transition-colors" title="Global Network"><Globe size={16} /></a>
            <a href="#" className="hover:text-slate-300 transition-colors" title="Share"><Share2 size={16} /></a>
            <a href="#" className="hover:text-slate-300 transition-colors" title="Community"><MessageSquare size={16} /></a>
            <a href="#" className="hover:text-slate-300 transition-colors" title="External Link"><ExternalLink size={16} /></a>
          </div>
        </div>
      </footer>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* INTERACTIVE CAREER RISK ANALYZER MODAL */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isAnalyzerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-mirage-glow max-w-xl w-full p-6 sm:p-8 rounded-3xl border border-[#8b5cf6]/40 relative text-left flex flex-col gap-6 shadow-2xl"
            >
              <button 
                onClick={() => setIsAnalyzerOpen(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-900 transition-colors"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/20 border border-purple-500/30 text-[#8b5cf6]">
                  <Zap size={22} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white font-ui">AI Career Risk Analyzer</h3>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">Calculate your 3-year automation vulnerability index.</p>
                </div>
              </div>

              {/* Form Input */}
              <div className="flex flex-col gap-4 font-mono text-xs">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Your Current Job Role</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Senior Software Engineer / Data Analyst" 
                    value={userRoleInput}
                    onChange={(e) => setUserRoleInput(e.target.value)}
                    className="w-full bg-slate-950 border border-white/15 rounded-xl p-3 text-white focus:outline-none focus:border-[#8b5cf6]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold">Years of Experience</label>
                    <select 
                      value={userExpInput}
                      onChange={(e) => setUserExpInput(e.target.value)}
                      className="w-full bg-slate-950 border border-white/15 rounded-xl p-3 text-white focus:outline-none focus:border-[#8b5cf6]"
                    >
                      <option value="1-3 Years">1 - 3 Years</option>
                      <option value="3-7 Years">3 - 7 Years</option>
                      <option value="7+ Years">7+ Years</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold">Primary Tech City</label>
                    <select 
                      value={userCityInput}
                      onChange={(e) => setUserCityInput(e.target.value)}
                      className="w-full bg-slate-950 border border-white/15 rounded-xl p-3 text-white focus:outline-none focus:border-[#8b5cf6]"
                    >
                      <option value="Bengaluru">Bengaluru</option>
                      <option value="Hyderabad">Hyderabad</option>
                      <option value="Pune">Pune</option>
                      <option value="NCR (Delhi/Gurugram)">NCR (Gurugram/Noida)</option>
                      <option value="Mumbai">Mumbai</option>
                    </select>
                  </div>
                </div>

                <button 
                  onClick={handleRunAnalysis}
                  disabled={isAnalyzing || !userRoleInput.trim()}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#ff3d5a] via-[#8b5cf6] to-[#06b6d4] text-white font-bold text-sm hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Executing XGBoost Risk Calculation...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={16} />
                      <span>Analyze My Risk Profile</span>
                    </>
                  )}
                </button>
              </div>

              {/* Analysis Result Card */}
              {analyzedResult && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 rounded-2xl bg-slate-950 border border-[#8b5cf6]/40 flex flex-col gap-3 font-mono text-xs"
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="font-bold text-white">{analyzedResult.role}</span>
                    <span className="bg-[#ff3d5a]/20 text-[#ff3d5a] border border-[#ff3d5a]/30 px-2 py-0.5 rounded font-bold">
                      {analyzedResult.riskScore}% Automation Risk
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                    <div>Primary Threat: <strong className="text-white block mt-0.5">{analyzedResult.topRiskFactor}</strong></div>
                    <div>Recommended Shield: <strong className="text-[#06b6d4] block mt-0.5">{analyzedResult.recommendedSkill}</strong></div>
                  </div>

                  <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Projected Salary Uplift: <strong className="text-emerald-400">{analyzedResult.salaryUplift}</strong></span>
                    <button 
                      onClick={() => setIsAnalyzerOpen(false)}
                      className="px-3 py-1 bg-[#8b5cf6] text-white rounded font-bold hover:bg-purple-600 transition-colors"
                    >
                      Start Reskilling →
                    </button>
                  </div>
                </motion.div>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default SkillsMirageLanding;
