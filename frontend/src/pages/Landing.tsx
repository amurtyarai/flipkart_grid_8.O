import React, { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, BarChart2, ShieldAlert, Cpu, Database, Award, ArrowRight, Navigation } from 'lucide-react';
import { Button, Card } from '../components/DesignSystem';
import { useStore } from '../store/useStore';
import { t } from '../utils/multilingual';

// ─────────────────────────────────────────────────────────────────────────────
// VIBRANT 3D INTERACTIVE PARTICLE SPHERE / BALL COMPONENT
// Crisp 60fps canvas, mouse drag rotation, and keyboard arrow control (← ↑ → ↓)
// ─────────────────────────────────────────────────────────────────────────────
const Interactive3DOrbHero: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 450);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 450);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle sphere configuration with vibrant Flipkart & AI colors
    const particleCount = 220;
    const radius = Math.min(width, height) * 0.38;
    const particles: { x: number; y: number; z: number; color: string }[] = [];
    const colors = ['#F8CB2E', '#60a5fa', '#34d399', '#a78bfa', '#ff3d5a', '#ffffff'];

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.acos(2 * Math.random() - 1);
      const phi = 2 * Math.PI * Math.random();
      particles.push({
        x: radius * Math.sin(theta) * Math.cos(phi),
        y: radius * Math.sin(theta) * Math.sin(phi),
        z: radius * Math.cos(theta),
        color: colors[i % colors.length]
      });
    }

    let angleX = 0;
    let angleY = 0;
    let velocityX = 0.005;
    let velocityY = 0.008;

    // Mouse Pointer Drag Handling
    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      previousMousePosition.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        const deltaX = e.clientX - previousMousePosition.current.x;
        const deltaY = e.clientY - previousMousePosition.current.y;
        velocityY += deltaX * 0.0004;
        velocityX += deltaY * 0.0004;
        previousMousePosition.current = { x: e.clientX, y: e.clientY };
      } else {
        const rect = canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - width / 2) * 0.00008;
        const mouseY = (e.clientY - rect.top - height / 2) * 0.00008;
        velocityX += mouseY;
        velocityY += mouseX;
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    // Keyboard Arrow key rotation control (← ↑ → ↓)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') velocityY -= 0.04;
      if (e.key === 'ArrowRight') velocityY += 0.04;
      if (e.key === 'ArrowUp') velocityX -= 0.04;
      if (e.key === 'ArrowDown') velocityX += 0.04;
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      angleX += velocityX;
      angleY += velocityY;

      // Smooth deceleration back to steady ambient spin
      velocityX *= 0.95;
      velocityY *= 0.95;
      if (Math.abs(velocityX) < 0.003) velocityX = 0.004;
      if (Math.abs(velocityY) < 0.004) velocityY = 0.007;

      const centerX = width / 2;
      const centerY = height / 2;

      // Bright glowing ambient core behind sphere
      const gradient = ctx.createRadialGradient(centerX, centerY, 15, centerX, centerY, radius * 1.3);
      gradient.addColorStop(0, 'rgba(248, 203, 46, 0.3)');
      gradient.addColorStop(0.35, 'rgba(96, 165, 250, 0.2)');
      gradient.addColorStop(0.7, 'rgba(167, 139, 250, 0.1)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.35, 0, Math.PI * 2);
      ctx.fill();

      // Project 3D particles to 2D
      const projected: { x: number; y: number; z: number; color: string }[] = [];

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        
        // 3D Matrix Rotation
        const x1 = p.x * Math.cos(angleY) - p.z * Math.sin(angleY);
        const z1 = p.x * Math.sin(angleY) + p.z * Math.cos(angleY);

        const y2 = p.y * Math.cos(angleX) - z1 * Math.sin(angleX);
        const z2 = p.y * Math.sin(angleX) + z1 * Math.cos(angleX);

        const fov = 380;
        const scale = fov / (fov + z2);
        const projX = centerX + x1 * scale;
        const projY = centerY + y2 * scale;

        projected.push({ x: projX, y: projY, z: z2, color: p.color });
      }

      projected.sort((a, b) => b.z - a.z);

      // Connecting neural lines
      ctx.lineWidth = 0.8;
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j += 4) {
          const dx = projected[i].x - projected[j].x;
          const dy = projected[i].y - projected[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 68) {
            const alpha = (1 - dist / 68) * 0.45;
            ctx.strokeStyle = `rgba(248, 203, 46, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(projected[i].x, projected[i].y);
            ctx.lineTo(projected[j].x, projected[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw particle nodes
      for (let i = 0; i < projected.length; i++) {
        const p = projected[i];
        const alpha = Math.max(0.3, (p.z + radius) / (radius * 2));
        const size = Math.max(1.5, ((p.z + radius) / (radius * 2)) * 4.2);

        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();

        // Add soft glow around front particles
        if (p.z > 0) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = p.color;
        } else {
          ctx.shadowBlur = 0;
        }
      }

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="relative w-full h-[420px] sm:h-[500px] flex items-center justify-center">
      <canvas ref={canvasRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      {/* Overlay Ambient Glow Ring */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-72 h-72 rounded-full border border-[#F8CB2E]/30 animate-ping opacity-30" />
        <div className="w-96 h-96 rounded-full border border-[#60a5fa]/30 animate-pulse opacity-40" />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN LANDING PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const Landing: React.FC = () => {
  const { language } = useStore();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring' as const, stiffness: 100 }
    }
  };

  const steps = [
    { icon: <Cpu className="text-[#60a5fa]" size={20} />, title: t("Preprocessor", language), label: t("Normalise Features", language) },
    { icon: <BarChart2 className="text-[#F8CB2E]" size={20} />, title: t("XGBoost", language), label: t("Predict Risk", language) },
    { icon: <Sparkles className="text-purple-400" size={20} />, title: t("TreeSHAP", language), label: t("Local Attribution", language) },
    { icon: <ShieldAlert className="text-rose-400" size={20} />, title: t("Root Cause", language), label: t("Friction Reasoning", language) },
    { icon: <Database className="text-emerald-400" size={20} />, title: t("ChromaDB RAG", language), label: t("Strategy Match", language) },
    { icon: <Award className="text-amber-400" size={20} />, title: t("Recommender", language), label: t("Optimise Nudge", language) }
  ];

  return (
    <motion.div
      className="min-h-screen py-12 px-4 sm:px-8 max-w-[1400px] mx-auto flex flex-col gap-20 relative z-10"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* 1. HERO SECTION (Side-by-Side Grid with Prominent 3D AI Orb) */}
      <motion.section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center text-left" variants={itemVariants}>
        
        {/* Left Column: Heading, Subtitle & Primary Actions */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          <div className="inline-flex items-center gap-2 bg-[#F8CB2E]/10 border border-[#F8CB2E]/30 px-3.5 py-1.5 rounded-full text-xs font-mono self-start backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-[#F8CB2E] animate-pulse" />
            <span className="text-[#F8CB2E] font-bold">FLIPKART GRiD 8.0</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-300">Intelligent Cart Abandonment Intervention</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight text-white font-ui">
            {t("Predict & Prevent Cart Abandonment with", language)} <br />
            <span className="text-[#F8CB2E]">{t("Agentic AI Intelligence", language)}</span>
          </h1>

          <p className="text-slate-300 font-mono text-sm sm:text-base leading-relaxed max-w-2xl">
            {t("Flipkart's real-time cart abandonment control center. Monitors live shopping behavior, isolates hesitation friction via local SHAP attributions, and deploys targeted RAG interventions.", language)}
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link to="/store">
              <Button variant="primary" className="px-8 py-3.5 text-sm font-mono font-extrabold uppercase tracking-wider group shadow-lg shadow-[#F8CB2E]/20">
                <span>{t("Launch Store Demo", language)}</span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button variant="secondary" className="px-8 py-3.5 text-sm font-mono font-bold uppercase tracking-wider">
                <span>{t("Open Mission Control", language)}</span>
              </Button>
            </Link>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-3 font-mono text-xs pt-4 border-t border-white/10">
            <div>
              <div className="text-slate-400">{t("Inference Speed", language)}</div>
              <div className="text-base font-bold text-white mt-0.5">~1.2 ms</div>
            </div>
            <div>
              <div className="text-slate-400">{t("SHAP Attributions", language)}</div>
              <div className="text-base font-bold text-[#60a5fa] mt-0.5">100% Native</div>
            </div>
            <div>
              <div className="text-slate-400">{t("RAG Vector Match", language)}</div>
              <div className="text-base font-bold text-[#F8CB2E] mt-0.5">&lt; 180 ms</div>
            </div>
          </div>

        </div>

        {/* Right Column: Prominent Interactive 3D Ball & Control Card */}
        <div className="lg:col-span-5 relative flex flex-col items-center justify-center">
          
          {/* Vibrant 3D Particle Ball Canvas */}
          <Interactive3DOrbHero />

          {/* Floating Glass Control Overlay Badge */}
          <motion.div 
            whileHover={{ y: -4 }}
            className="absolute bottom-2 left-2 right-2 sm:left-4 sm:right-4 glass p-4 rounded-2xl border border-white/15 text-left flex flex-col gap-2.5 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F8CB2E] animate-ping" />
                <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">{t("Interactive 3D AI Orb", language)}</span>
              </div>
              <span className="text-[10px] font-mono bg-[#60a5fa]/20 text-[#60a5fa] border border-[#60a5fa]/30 px-2 py-0.5 rounded font-bold">
                220 Signals
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono text-slate-300">
              <div className="flex items-center gap-1.5">
                <Navigation size={14} className="text-[#F8CB2E] animate-spin" />
                <span>{t("Drag Mouse or Press", language)} <strong>← ↑ → ↓</strong></span>
              </div>
              <span className="text-[#34d399] font-bold">60 FPS</span>
            </div>
          </motion.div>

        </div>

      </motion.section>

      {/* 2. PROJECT OVERVIEW */}
      <motion.section className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center relative z-10" variants={itemVariants}>
        <div className="text-left flex flex-col gap-4">
          <h2 className="text-3xl font-extrabold text-white tracking-tight font-ui">{t("Protecting Merchant Margins while Maximising Conversions", language)}</h2>
          <p className="text-slate-400 font-mono text-sm leading-relaxed">
            {t("Generic e-commerce platforms push heavy discount coupons to every abandoning user, eroding merchant margins and training shoppers to wait for price drops.", language)}
          </p>
          <p className="text-slate-400 font-mono text-sm leading-relaxed">
            {t("Our system solves this. An XGBoost Classifier estimates abandonment probability in real time, TreeSHAP maps local attributions to isolate exact friction causes, and a ChromaDB RAG Engine retrieves cost-efficient targeted interventions.", language)}
          </p>
        </div>
        
        <Card variant="glow" className="flex flex-col gap-6 text-left">
          <h3 className="text-lg font-bold text-[#F8CB2E] flex items-center gap-2 font-ui">
            <ShieldAlert className="text-[#F8CB2E]" />
            <span>{t("Real-time Risk Performance", language)}</span>
          </h3>
          <div className="grid grid-cols-3 gap-4 font-mono">
            <div className="p-3 bg-[#0d1220] rounded-lg border border-white/10">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t("Inference Speed", language)}</span>
              <div className="text-lg font-black text-white mt-1">~1.2 ms</div>
            </div>
            <div className="p-3 bg-[#0d1220] rounded-lg border border-white/10">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t("SHAP Resolution", language)}</span>
              <div className="text-lg font-black text-white mt-1">100% Native</div>
            </div>
            <div className="p-3 bg-[#0d1220] rounded-lg border border-white/10">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t("RAG Retrieval", language)}</span>
              <div className="text-lg font-black text-[#F8CB2E] mt-1">&lt; 180 ms</div>
            </div>
          </div>
        </Card>
      </motion.section>

      {/* 3. AI WORKFLOW DIAGRAM */}
      <motion.section className="flex flex-col gap-8 text-center relative z-10" variants={itemVariants}>
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl md:text-3xl font-extrabold text-white font-ui">{t("The Multi-Agent Inference Pipeline", language)}</h2>
          <p className="text-xs font-mono text-slate-400">{t("Sequential execution from telemetry signal capture to personalized intervention deployment", language)}</p>
        </div>

        {/* Workflow steps diagram */}
        <div className="glass p-6 rounded-xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 overflow-x-auto font-mono">
          {steps.map((step, idx) => (
            <React.Fragment key={idx}>
              <div className="flex flex-col items-center gap-2.5 p-4 bg-[#0d1220] rounded-lg border border-white/10 min-w-[150px] flex-1">
                <div className="w-10 h-10 rounded-lg bg-[#080c14] flex items-center justify-center border border-white/10 shadow-inner">
                  {step.icon}
                </div>
                <div className="text-xs font-bold text-white">{step.title}</div>
                <div className="text-[10px] text-[#F8CB2E] uppercase tracking-widest font-bold">{step.label}</div>
              </div>
              {idx < steps.length - 1 && (
                <div className="hidden md:flex items-center text-slate-600 animate-pulse">
                  <ArrowRight size={20} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </motion.section>

      {/* 4. FEATURES GRID */}
      <motion.section className="flex flex-col gap-8 text-left relative z-10" variants={itemVariants}>
        <h2 className="text-2xl md:text-3xl font-extrabold text-white text-center font-ui">{t("System Core Features", language)}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="flex flex-col gap-3">
            <div className="w-8 h-8 rounded bg-[#60a5fa]/10 text-[#60a5fa] border border-[#60a5fa]/30 flex items-center justify-center">
              <Cpu size={18} />
            </div>
            <h4 className="font-bold text-base text-white font-ui">{t("Dual XGBoost Core", language)}</h4>
            <p className="text-xs font-mono text-slate-400 leading-relaxed">
              {t("Dual-model backend utilizing high-capacity XGBClassifier for probability estimation and XGBRegressor for baseline comparison.", language)}
            </p>
          </Card>
          <Card className="flex flex-col gap-3">
            <div className="w-8 h-8 rounded bg-[#a78bfa]/10 text-[#a78bfa] border border-[#a78bfa]/30 flex items-center justify-center">
              <BarChart2 size={18} />
            </div>
            <h4 className="font-bold text-base text-white font-ui">{t("Tree-Attribution SHAP", language)}</h4>
            <p className="text-xs font-mono text-slate-400 leading-relaxed">
              {t("Provides mathematical guarantees on local feature explanations to pinpoint conversion obstacles per user session.", language)}
            </p>
          </Card>
          <Card className="flex flex-col gap-3">
            <div className="w-8 h-8 rounded bg-[#34d399]/10 text-[#34d399] border border-[#34d399]/30 flex items-center justify-center">
              <Database size={18} />
            </div>
            <h4 className="font-bold text-base text-white font-ui">{t("ChromaDB RAG Engine", language)}</h4>
            <p className="text-xs font-mono text-slate-400 leading-relaxed">
              {t("Queries a 200-document vector knowledge base with metadata filters to match optimal intervention strategies.", language)}
            </p>
          </Card>
        </div>
      </motion.section>
    </motion.div>
  );
};

export default Landing;
