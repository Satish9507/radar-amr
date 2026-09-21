import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Menu, X, Settings } from "lucide-react";
import useBreakpoint from "../hooks/useBreakpoint";

function SettingsMenu({ onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div ref={ref} style={{
      position: "absolute", top: "calc(100% + 6px)", right: 16,
      background: "white", borderRadius: 12,
      border: "1px solid #E2E8F0",
      boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
      width: 240, zIndex: 100,
      fontFamily: "'Inter', system-ui, sans-serif",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px",
        borderBottom: "1px solid #F1F5F9",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Settings size={14} color="#475569" />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Settings</span>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none", cursor: "pointer",
          color: "#94A3B8", display: "flex", padding: 2,
        }}>
          <X size={14} />
        </button>
      </div>

      {/* Placeholder items */}
      <div style={{ padding: "8px 0" }}>
        {["Module config", "Compound reference", "Pathogen profile"].map(item => (
          <div key={item} style={{
            padding: "9px 16px", fontSize: 13, color: "#475569",
            cursor: "default", display: "flex", alignItems: "center",
            justifyContent: "space-between",
          }}>
            {item}
            <span style={{
              fontSize: 10, color: "#94A3B8", background: "#F8FAFC",
              border: "1px solid #E2E8F0", borderRadius: 4, padding: "1px 6px",
            }}>
              Soon
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Header({
  title    = "RADAR",
  subtitle = "Risk Assessment Dashboard for AMR Response",
  icon: Icon = Shield,
  accent = "#1D4ED8",
}) {
  const { isMobile }  = useBreakpoint();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const logoSrc = "/logo.png";

  return (
    <header style={{
      background: `linear-gradient(135deg, #1E3A8A 0%, ${accent} 100%)`,
      borderBottom: "1px solid rgba(255,255,255,0.08)",
      position: "relative",
      overflow: "visible",
    }}>
      {/* Dot pattern overlay */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.055) 1px, transparent 1px)",
        backgroundSize: "20px 20px",
        pointerEvents: "none",
        overflow: "hidden",
      }} />

      {/* Content row */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: isMobile ? "14px 16px" : "18px 24px",
        position: "relative", zIndex: 1,
      }}>
        {/* Left: icon + title + subtitle */}
        <div
          onClick={() => navigate("/")}
          style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 14, minWidth: 0,
                   cursor: "pointer" }}
        >
          <img
            src={logoSrc}
            alt="RADAR logo"
            style={{ height: isMobile ? 32 : 44, width: "auto", display: "block", flexShrink: 0 }}
          />
          <div style={{ minWidth: 0 }}>
            <h1 style={{
              color: "white", fontWeight: 800,
              fontSize: isMobile ? 15 : 19,
              letterSpacing: "-0.3px", lineHeight: 1.2,
              margin: 0,
            }}>
              {title}
            </h1>
            {!isMobile && (
              <p style={{
                color: "rgba(255,255,255,0.60)",
                fontSize: 13, margin: "4px 0 0",
                fontWeight: 400,
              }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right: hamburger */}
        <button
          onClick={() => setOpen(o => !o)}
          title="Settings"
          style={{
            flexShrink: 0, marginLeft: 16,
            background: open ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 9, padding: "7px 9px",
            cursor: "pointer", display: "flex", alignItems: "center",
            color: "white",
            transition: "background 0.15s",
          }}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Shimmer bottom line */}
      <div style={{
        height: 2,
        background: "linear-gradient(to right, rgba(255,255,255,0.04), rgba(255,255,255,0.35), rgba(255,255,255,0.04))",
      }} />

      {/* Settings dropdown */}
      {open && <SettingsMenu onClose={() => setOpen(false)} />}
    </header>
  );
}
