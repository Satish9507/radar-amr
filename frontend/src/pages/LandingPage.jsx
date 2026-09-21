import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Footer from "../components/Footer";
import {
  Shield, Beaker, Activity, Cpu, ArrowRight, Upload,
  Download, CheckCircle, FlaskConical, Globe,
  ChevronDown, Microscope, AlertTriangle,
} from "lucide-react";
import useBreakpoint from "../hooks/useBreakpoint";

// ─── Molecule SVG (hidden on mobile) ─────────────────────────────────────────
const MoleculeGraphic = () => (
  <svg viewBox="0 0 420 380" fill="none" xmlns="http://www.w3.org/2000/svg"
       style={{ width:"100%", maxWidth:460, opacity:0.92 }}>
    <circle cx="210" cy="190" r="140" fill="url(#glowOuter)" />
    <circle cx="210" cy="190" r="90"  fill="url(#glowInner)" />
    <line x1="210" y1="190" x2="320" y2="100" stroke="rgba(147,197,253,0.5)" strokeWidth="1.5" strokeDasharray="4 3" />
    <line x1="210" y1="190" x2="100" y2="100" stroke="rgba(147,197,253,0.5)" strokeWidth="1.5" strokeDasharray="4 3" />
    <line x1="210" y1="190" x2="330" y2="270" stroke="rgba(147,197,253,0.5)" strokeWidth="1.5" strokeDasharray="4 3" />
    <line x1="210" y1="190" x2="90"  y2="280" stroke="rgba(147,197,253,0.5)" strokeWidth="1.5" strokeDasharray="4 3" />
    <line x1="210" y1="190" x2="210" y2="60"  stroke="rgba(147,197,253,0.5)" strokeWidth="1.5" strokeDasharray="4 3" />
    <line x1="210" y1="190" x2="210" y2="330" stroke="rgba(147,197,253,0.5)" strokeWidth="1.5" strokeDasharray="4 3" />
    <line x1="320" y1="100" x2="210" y2="60"  stroke="rgba(147,197,253,0.2)" strokeWidth="1" />
    <line x1="100" y1="100" x2="210" y2="60"  stroke="rgba(147,197,253,0.2)" strokeWidth="1" />
    <line x1="330" y1="270" x2="210" y2="330" stroke="rgba(147,197,253,0.2)" strokeWidth="1" />
    <line x1="90"  y1="280" x2="210" y2="330" stroke="rgba(147,197,253,0.2)" strokeWidth="1" />
    <circle cx="320" cy="100" r="18" fill="#1E40AF" stroke="#60A5FA" strokeWidth="2" />
    <circle cx="100" cy="100" r="14" fill="#1E3A8A" stroke="#93C5FD" strokeWidth="1.5" />
    <circle cx="330" cy="270" r="16" fill="#1E40AF" stroke="#60A5FA" strokeWidth="2" />
    <circle cx="90"  cy="280" r="12" fill="#1E3A8A" stroke="#93C5FD" strokeWidth="1.5" />
    <circle cx="210" cy="60"  r="20" fill="#0D9488" stroke="#2DD4BF" strokeWidth="2" />
    <circle cx="210" cy="330" r="14" fill="#1E40AF" stroke="#60A5FA" strokeWidth="1.5" />
    <circle cx="370" cy="175" r="8"  fill="#DC2626" stroke="#FCA5A5" strokeWidth="1.5" />
    <circle cx="50"  cy="190" r="8"  fill="#D97706" stroke="#FCD34D" strokeWidth="1.5" />
    <circle cx="360" cy="310" r="6"  fill="#7C3AED" stroke="#C4B5FD" strokeWidth="1.5" />
    <circle cx="60"  cy="155" r="6"  fill="#059669" stroke="#6EE7B7" strokeWidth="1.5" />
    <circle cx="210" cy="190" r="38" fill="#1E40AF" stroke="#3B82F6" strokeWidth="2.5" />
    <circle cx="210" cy="190" r="28" fill="#1D4ED8" stroke="#60A5FA" strokeWidth="1.5" />
    <text x="210" y="186" textAnchor="middle" fill="white"   fontSize="12" fontWeight="bold" fontFamily="Inter,sans-serif">RADAR</text>
    <text x="210" y="200" textAnchor="middle" fill="#93C5FD" fontSize="9"  fontFamily="Inter,sans-serif">AMR RISK</text>
    <circle cx="210" cy="190" r="70"  stroke="rgba(96,165,250,0.2)"  strokeWidth="1" strokeDasharray="6 4" fill="none" />
    <circle cx="210" cy="190" r="110" stroke="rgba(96,165,250,0.12)" strokeWidth="1" strokeDasharray="8 5" fill="none" />
    <text x="320" y="104" textAnchor="middle" fill="white" fontSize="8" fontFamily="Inter,sans-serif">RQ</text>
    <text x="210" y="64"  textAnchor="middle" fill="white" fontSize="8" fontFamily="Inter,sans-serif">QMRA</text>
    <text x="330" y="274" textAnchor="middle" fill="white" fontSize="7" fontFamily="Inter,sans-serif">CAMRI</text>
    <defs>
      <radialGradient id="glowOuter" cx="50%" cy="50%" r="50%">
        <stop offset="0%"   stopColor="#3B82F6" stopOpacity="0.15" />
        <stop offset="100%" stopColor="#1E40AF" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="glowInner" cx="50%" cy="50%" r="50%">
        <stop offset="0%"   stopColor="#60A5FA" stopOpacity="0.2" />
        <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
      </radialGradient>
    </defs>
  </svg>
);

// ─── Stat badge ───────────────────────────────────────────────────────────────
const StatBadge = ({ value, label, color, delay }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);
  return (
    <div style={{
      background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)",
      borderRadius:12, padding:"10px 16px", textAlign:"center",
      transform:visible?"translateY(0)":"translateY(16px)",
      opacity:visible?1:0, transition:"all 0.5s ease",
      minWidth:80,
    }}>
      <p style={{ color:color||"#60A5FA", fontWeight:800, fontSize:20 }}>{value}</p>
      <p style={{ color:"rgba(255,255,255,0.7)", fontSize:12, marginTop:2 }}>{label}</p>
    </div>
  );
};

// accentColour per module
const MODULE_ACCENT = {
  rq:    { main:"#1E40AF", light:"#DBEAFE", pill:"#EFF6FF", pillBorder:"#BFDBFE" },
  qmra:  { main:"#0D9488", light:"#CCFBF1", pill:"#F0FDFA", pillBorder:"#99F6E4" },
  camri: { main:"#7C3AED", light:"#EDE9FE", pill:"#F5F3FF", pillBorder:"#DDD6FE" },
};
const DEFAULT_ACCENT = { main:"#94A3B8", light:"#F8FAFC", pill:"#F8FAFC", pillBorder:"#E2E8F0" };

// ─── Tool card ────────────────────────────────────────────────────────────────
const ToolCard = ({ icon:Icon, title, desc, tags, active, accent=DEFAULT_ACCENT, onClick }) => (
  <div
    onClick={active ? onClick : undefined}
    style={{
      background:"white",
      border: active ? `2px solid ${accent.main}` : "1px solid #E2E8F0",
      borderRadius:16, padding:20,
      cursor:active?"pointer":"default",
      transition:"all 0.2s", position:"relative", overflow:"hidden",
    }}
    className={active ? "hover:shadow-lg hover:-translate-y-1" : "opacity-60"}
  >
    {active && (
      <div style={{ position:"absolute", top:0, left:0, right:0, height:3,
                    background:`linear-gradient(90deg,${accent.main},${accent.main}99)` }} />
    )}
    {!active && (
      <span style={{ position:"absolute", top:10, right:10, background:"#F1F5F9",
                     color:"#94A3B8", fontSize:12, fontWeight:600,
                     padding:"2px 8px", borderRadius:999 }}>Coming Soon</span>
    )}
    <div style={{ background:active ? accent.light : "#F8FAFC", borderRadius:10,
                  padding:10, display:"inline-flex", marginBottom:12 }}>
      <Icon size={22} color={active ? accent.main : "#94A3B8"} />
    </div>
    <h3 style={{ color:"#0F172A", fontWeight:700, fontSize:17, marginBottom:6 }}>{title}</h3>
    <p style={{ color:"#64748B", fontSize:15, lineHeight:1.6, marginBottom:12 }}>{desc}</p>
    <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
      {tags.map(tag => (
        <span key={tag} style={{
          background: active ? accent.pill : "#F8FAFC",
          color:      active ? accent.main : "#94A3B8",
          fontSize:13, fontWeight:500, padding:"2px 8px", borderRadius:999,
          border:`1px solid ${active ? accent.pillBorder : "#E2E8F0"}`,
        }}>{tag}</span>
      ))}
    </div>
    {active && (
      <div style={{ marginTop:14, display:"flex", alignItems:"center", gap:4,
                    color:accent.main, fontSize:15, fontWeight:600 }}>
        Launch tool <ArrowRight size={14} />
      </div>
    )}
  </div>
);

// ─── Step card ────────────────────────────────────────────────────────────────
const StepCard = ({ number, icon:Icon, title, desc, color }) => (
  <div style={{ textAlign:"center", padding:"0 8px" }}>
    <div style={{ width:60, height:60, borderRadius:"50%", background:color+"18",
                  border:`2px solid ${color}44`, display:"flex", alignItems:"center",
                  justifyContent:"center", margin:"0 auto 12px" }}>
      <Icon size={24} color={color} />
    </div>
    <div style={{ width:22, height:22, borderRadius:"50%", background:color,
                  color:"white", fontSize:12, fontWeight:700,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  margin:"-40px auto 18px 42px" }}>
      {number}
    </div>
    <h4 style={{ color:"#0F172A", fontWeight:700, fontSize:16, marginBottom:6 }}>{title}</h4>
    <p style={{ color:"#64748B", fontSize:15, lineHeight:1.6 }}>{desc}</p>
  </div>
);

// ─── Main Landing Page ────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate      = useNavigate();
  const { isMobile, isTablet, isDesktop } = useBreakpoint();
  const onGetStarted  = () => navigate("/rq");

  const [heroVisible, setHeroVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setHeroVisible(true), 100); return () => clearTimeout(t); }, []);

  const px = isMobile ? 20 : isTablet ? 32 : 48;

  const tools = [
    { icon:Beaker,   title:"Risk Quotient (RQ)",  active:true,  route:"/rq",
      accent: MODULE_ACCENT.rq,
      desc:"Calculate ecological and antimicrobial resistance risk quotients from measured environmental concentrations.",
      tags:["MEC/PNEC","Eco Toxicity Risk","AMR Risk"] },
    { icon:Shield,   title:"QMRA",                active:true,  route:"/qmra",
      accent: MODULE_ACCENT.qmra,
      desc:"Quantitative Microbial Risk Assessment. Evaluate the probability of infection and disability-adjusted life years from pathogenic microorganisms in water.",
      tags:["Dose-Response","Infection Risk","DALYs","WHO Benchmark"] },
    { icon:Activity, title:"CAMRI",               active:true,  route:"/camri",
      accent: MODULE_ACCENT.camri,
      desc:"Combined AMR Relative Index using a 6-step pipeline that combines antibiotic-resistant bacteria and resistance genes into a single normalised burden score.",
      tags:["ARB / ARG","Burden Index","Relative Risk"] },
  ];

  return (
    <div style={{ fontFamily:"'Inter',sans-serif", background:"#F8FAFC", minHeight:"100vh" }}>

      {/* ── Hero ── */}
      <section style={{
        background:"linear-gradient(135deg,#0F172A 0%,#1E3A8A 50%,#1E40AF 100%)",
        minHeight: isMobile ? "auto" : "92vh",
        display:"flex", flexDirection:"column",
        position:"relative", overflow:"hidden",
      }}>
        {/* Grid pattern */}
        <div style={{ position:"absolute", inset:0,
                      backgroundImage:"radial-gradient(rgba(96,165,250,0.08) 1px,transparent 1px)",
                      backgroundSize:"32px 32px" }} />

        {/* Top nav */}
        <nav style={{ padding:`16px ${px}px`, display:"flex", alignItems:"center",
                      justifyContent:"space-between", position:"relative", zIndex:10,
                      flexWrap:"wrap", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <img src="/logo.png" alt="RADAR"
                 style={{ height: isMobile ? 32 : 44, width:"auto", display:"block" }} />
            <span style={{ color:"white", fontWeight:700, fontSize: isMobile ? 13 : 15 }}>
              RADAR
            </span>
          </div>
          <button onClick={onGetStarted}
                  style={{ background:"rgba(255,255,255,0.15)", border:"1px solid rgba(255,255,255,0.3)",
                           color:"white", borderRadius:8, padding:"6px 14px",
                           fontSize:14, fontWeight:600, cursor:"pointer" }}>
            Launch Tool
          </button>
        </nav>

        {/* Hero content */}
        <div style={{
          flex:1, display:"flex",
          flexDirection: isDesktop ? "row" : "column-reverse",
          alignItems:"center",
          padding:`${isMobile?24:32}px ${px}px ${isMobile?32:48}px`,
          gap: isMobile ? 24 : 40,
          maxWidth:1200, margin:"0 auto", width:"100%",
          position:"relative", zIndex:10,
          boxSizing:"border-box",
        }}>

          {/* Left — text */}
          <div style={{
            flex:1,
            transform:heroVisible?"translateX(0)":"translateX(-20px)",
            opacity:heroVisible?1:0, transition:"all 0.7s ease",
            textAlign: isDesktop ? "left" : "center",
          }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:6,
                          background:"rgba(13,148,136,0.2)", border:"1px solid rgba(45,212,191,0.4)",
                          borderRadius:999, padding:"4px 12px", marginBottom:16 }}>
              <Microscope size={12} color="#2DD4BF" />
              <span style={{ color:"#2DD4BF", fontSize:13, fontWeight:600 }}>Environmental Risk Science Platform</span>
            </div>

            <h1 style={{ color:"white", fontSize: isMobile?28:isTablet?36:44,
                         fontWeight:800, lineHeight:1.15, marginBottom:16 }}>
              Assess Antibiotic<br />
              <span style={{ color:"#60A5FA" }}>Environmental Risks</span><br />
              with Precision
            </h1>

            <p style={{ color:"rgba(255,255,255,0.65)", fontSize: isMobile?14:16,
                        lineHeight:1.7, marginBottom:24,
                        maxWidth: isDesktop ? 480 : "100%" }}>
              A free, browser-based AMR risk assessment platform for environmental scientists.
              Upload sample data, run validated calculations across three specialist modules, and export professional reports.
            </p>

            <div style={{ display:"flex", gap:12, flexWrap:"wrap",
                          justifyContent: isDesktop ? "flex-start" : "center" }}>
              <button onClick={onGetStarted}
                      style={{ background:"linear-gradient(135deg,#3B82F6,#0D9488)",
                               color:"white", border:"none", borderRadius:12,
                               padding: isMobile ? "12px 20px" : "14px 28px",
                               fontSize: isMobile ? 14 : 15, fontWeight:700, cursor:"pointer",
                               display:"flex", alignItems:"center", gap:8,
                               boxShadow:"0 4px 20px rgba(59,130,246,0.4)" }}>
                Get Started Free <ArrowRight size={16} />
              </button>
              <a href="#how-it-works"
                 style={{ background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.25)",
                          color:"white", borderRadius:12,
                          padding: isMobile ? "12px 18px" : "14px 22px",
                          fontSize: isMobile ? 14 : 15, fontWeight:600, cursor:"pointer",
                          textDecoration:"none", display:"flex", alignItems:"center", gap:6 }}>
                How it works <ChevronDown size={15} />
              </a>
            </div>

            {/* Trust badges */}
            <div style={{ display:"flex", gap:16, marginTop:24, flexWrap:"wrap",
                          justifyContent: isDesktop ? "flex-start" : "center" }}>
              {[
                "No account or login required",
                "Built on peer-reviewed methodologies",
                "No data stored, fully browser-based",
              ].map(t => (
                <div key={t} style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <CheckCircle size={12} color="#34D399" />
                  <span style={{ color:"rgba(255,255,255,0.6)", fontSize:13 }}>{t}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — molecule graphic (hidden on mobile) */}
          {!isMobile && (
            <div style={{
              flexShrink:0, width: isTablet ? 280 : 400,
              transform:heroVisible?"translateX(0)":"translateX(20px)",
              opacity:heroVisible?1:0, transition:"all 0.8s ease",
            }}>
              <MoleculeGraphic />
            </div>
          )}
        </div>

        {/* Stats row */}
        <div style={{ background:"rgba(0,0,0,0.25)", borderTop:"1px solid rgba(255,255,255,0.1)",
                      padding:`16px ${px}px`, display:"flex", justifyContent:"center",
                      gap: isMobile ? 10 : 24, flexWrap:"wrap",
                      position:"relative", zIndex:10 }}>
          {[
            { value:"3",     label:"Risk Modules",             color:"#60A5FA", delay:200  },
            { value:"WHO",   label:"Aligned Benchmarks",       color:"#34D399", delay:350  },
            { value:"0",     label:"Data Leaves Your Browser", color:"#FBBF24", delay:500  },
            { value:"Peer",  label:"Reviewed Methods",         color:"#F472B6", delay:650  },
            { value:"Free",  label:"No Account Needed",        color:"#A78BFA", delay:800  },
          ].map(s => <StatBadge key={s.label} {...s} />)}
        </div>
      </section>

      {/* ── Tools Section ── */}
      <section style={{ padding:`60px ${px}px`, maxWidth:1200, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:"#EFF6FF",
                        border:"1px solid #BFDBFE", borderRadius:999, padding:"4px 14px", marginBottom:12 }}>
            <Beaker size={12} color="#1E40AF" />
            <span style={{ color:"#1E40AF", fontSize:14, fontWeight:600 }}>Assessment Tools</span>
          </div>
          <h2 style={{ color:"#0F172A", fontSize: isMobile?24:30, fontWeight:800, marginBottom:10 }}>
            Three Specialised Risk Tools
          </h2>
          <p style={{ color:"#64748B", fontSize:16, maxWidth:520, margin:"0 auto" }}>
            Each tool targets a specific risk assessment methodology. RQ, QMRA, and CAMRI are all live and free.
          </p>
        </div>

        {/* Tools grid: 1 col mobile → 2 col tablet → 3 col desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {tools.map(tool => (
            <ToolCard key={tool.title} {...tool} onClick={() => navigate(tool.route)} />
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" style={{
        background:"linear-gradient(135deg,#F0F4F8,#EFF6FF)",
        padding:`60px ${px}px`,
        borderTop:"1px solid #E2E8F0", borderBottom:"1px solid #E2E8F0",
      }}>
        <div style={{ maxWidth:900, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:44 }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:"#D1FAE5",
                          border:"1px solid #6EE7B7", borderRadius:999, padding:"4px 14px", marginBottom:12 }}>
              <CheckCircle size={12} color="#059669" />
              <span style={{ color:"#059669", fontSize:14, fontWeight:600 }}>Simple 3-Step Process</span>
            </div>
            <h2 style={{ color:"#0F172A", fontSize: isMobile?22:28, fontWeight:800, marginBottom:10 }}>
              From Data to Risk Report in Minutes
            </h2>
            <p style={{ color:"#64748B", fontSize:16 }}>
              No complex setup. No server uploads. Everything runs privately in your browser.
            </p>
          </div>

          {/* Steps: 1 col mobile → 3 col desktop */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StepCard number="1" icon={Upload}       title="Upload Your Data"   color="#1E40AF"
              desc="Download the Excel template for your chosen module, fill in your sample measurements, and upload the file." />
            <StepCard number="2" icon={FlaskConical} title="Auto Calculate"     color="#0D9488"
              desc="The tool instantly runs the validated risk calculation for each record and classifies results by risk level." />
            <StepCard number="3" icon={Download}     title="Export Your Report" color="#7C3AED"
              desc="Download a formatted Excel report or print directly as a PDF to share with your team." />
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section style={{ background:"linear-gradient(135deg,#1E40AF,#0D9488,#7C3AED)",
                        padding:`52px ${px}px`, textAlign:"center" }}>
        <AlertTriangle size={32} color="rgba(255,255,255,0.5)" style={{ margin:"0 auto 14px" }} />
        <h2 style={{ color:"white", fontSize: isMobile?22:28, fontWeight:800, marginBottom:10 }}>
          Ready to assess your environmental risk data?
        </h2>
        <p style={{ color:"rgba(255,255,255,0.7)", fontSize:16, marginBottom:24,
                    maxWidth:560, margin:"0 auto 24px" }}>
          Three tools live and free. RQ for chemical risk, QMRA for microbial risk, and CAMRI for combined AMR burden. No account needed.
        </p>
        <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
          <button onClick={onGetStarted}
                  style={{ background:"white", color:"#1E40AF", border:"none", borderRadius:12,
                           padding: isMobile ? "12px 20px" : "14px 28px",
                           fontSize: isMobile ? 14 : 15, fontWeight:700, cursor:"pointer",
                           display:"inline-flex", alignItems:"center", gap:8,
                           boxShadow:"0 4px 20px rgba(0,0,0,0.2)" }}>
            Launch RQ <ArrowRight size={16} />
          </button>
          <button onClick={() => navigate("/qmra")}
                  style={{ background:"rgba(255,255,255,0.15)", color:"white",
                           border:"1px solid rgba(255,255,255,0.4)", borderRadius:12,
                           padding: isMobile ? "12px 20px" : "14px 28px",
                           fontSize: isMobile ? 14 : 15, fontWeight:700, cursor:"pointer",
                           display:"inline-flex", alignItems:"center", gap:8 }}>
            Launch QMRA <ArrowRight size={16} />
          </button>
          <button onClick={() => navigate("/camri")}
                  style={{ background:"rgba(124,58,237,0.35)", color:"white",
                           border:"1px solid rgba(196,181,253,0.5)", borderRadius:12,
                           padding: isMobile ? "12px 20px" : "14px 28px",
                           fontSize: isMobile ? 14 : 15, fontWeight:700, cursor:"pointer",
                           display:"inline-flex", alignItems:"center", gap:8 }}>
            Launch CAMRI <ArrowRight size={16} />
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
