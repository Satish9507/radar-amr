import { useNavigate } from "react-router-dom";
import useBreakpoint from "../hooks/useBreakpoint";

export default function Footer() {
  const navigate     = useNavigate();
  const { isMobile } = useBreakpoint();
  const px           = isMobile ? 20 : 48;

  return (
    <footer style={{
      background: "linear-gradient(180deg, #1E3A8A 0%, #162d72 100%)",
      borderTop: "1px solid rgba(255,255,255,0.08)",
    }}>
      {/* Main row */}
      <div style={{
        maxWidth: 1200, margin: "0 auto",
        padding: `28px ${px}px 20px`,
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        gap: isMobile ? 24 : 0,
        justifyContent: "space-between",
      }}>
        {/* Brand */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/logo.png" alt="RADAR"
                 style={{ height: isMobile ? 44 : 56, width: "auto", display: "block" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ color: "white", fontWeight: 700, fontSize: isMobile ? 16 : 18, lineHeight: 1.2 }}>RADAR</span>
              <span style={{ color: "rgba(255,255,255,0.50)", fontSize: 12, lineHeight: 1.4 }}>Risk Assessment Dashboard for AMR Response</span>
            </div>
          </div>
          <p style={{ color: "rgba(255,255,255,0.70)", fontSize: 13, fontWeight: 600, margin: 0 }}>
            Environmental Surveillance and Modeling Laboratory
          </p>
          <p style={{ color: "rgba(255,255,255,0.40)", fontSize: 12, margin: 0 }}>
            National University of Singapore
          </p>
        </div>

        {/* Tools */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>
            Tools
          </p>
          {[
            { label: "Risk Quotient (RQ)", route: "/rq"    },
            { label: "QMRA",               route: "/qmra"  },
            { label: "CAMRI",              route: "/camri" },
          ].map(t => (
            <button key={t.route} onClick={() => navigate(t.route)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "rgba(255,255,255,0.65)", fontSize: 13, textAlign: "left",
                padding: 0, fontFamily: "inherit",
              }}>
              {t.label}
            </button>
          ))}
        </div>

      </div>

      {/* Bottom bar */}
      <div style={{
        borderTop: "1px solid rgba(255,255,255,0.08)",
        padding: `12px ${px}px`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>
          © {new Date().getFullYear()} RADAR · Risk Assessment Dashboard for AMR Response
        </span>
      </div>
    </footer>
  );
}
