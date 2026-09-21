import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { Shield, Beaker, Activity } from "lucide-react";
import { getModuleConfigs } from "../services/api";

const MODULE_META = {
  RQ:    { path: "/rq",    icon: Beaker,   name: "Risk Quotient", color: "#1E40AF", hoverBg: "rgba(59,130,246,0.18)"  },
  QMRA:  { path: "/qmra",  icon: Shield,   name: "QMRA",          color: "#0D9488", hoverBg: "rgba(13,148,136,0.18)" },
  CAMRI: { path: "/camri", icon: Activity, name: "CAMRI",         color: "#7C3AED", hoverBg: "rgba(124,58,237,0.18)" },
};
const NAV_ORDER     = Object.keys(MODULE_META);
const ALWAYS_ACTIVE = new Set(["RQ", "QMRA", "CAMRI"]);

export default function NavBar() {
  const [modules, setModules] = useState([]);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    getModuleConfigs()
      .then(data => setModules(Array.isArray(data) ? data : (data.results ?? [])))
      .catch(() => setModules([]));
  }, []);

  const dbCodes  = new Set(modules.map(m => m.module_code));
  const fallback = [...ALWAYS_ACTIVE]
    .filter(code => !dbCodes.has(code))
    .map(code => ({ module_code: code, module_name: MODULE_META[code]?.name ?? code, is_active: true }));
  const allModules = [...modules, ...fallback].sort((a, b) => {
    const ia = NAV_ORDER.indexOf(a.module_code);
    const ib = NAV_ORDER.indexOf(b.module_code);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  return (
    <nav style={{
      background: "#1E3A8A",
      borderBottom: "1px solid #1e40af",
      display: "flex", alignItems: "center",
      padding: "0 16px", height: 52,
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 3, overflowX: "auto" }}>
        {allModules.map((mod) => {
          const meta   = MODULE_META[mod.module_code] ?? {
            path: `/${mod.module_code.toLowerCase()}`,
            icon: Beaker, name: mod.module_name,
            color: "#3B82F6", hoverBg: "rgba(59,130,246,0.18)",
          };
          const Icon   = meta.icon;
          const label  = mod.module_name ?? meta.name;
          const isLive = mod.is_active || ALWAYS_ACTIVE.has(mod.module_code);
          const isHov  = hovered === mod.module_code;

          return isLive ? (
            <NavLink
              key={mod.module_code}
              to={meta.path}
              onMouseEnter={() => setHovered(mod.module_code)}
              onMouseLeave={() => setHovered(null)}
              style={({ isActive }) => ({
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "5px 13px", borderRadius: 20,
                fontSize: 13, fontWeight: 600,
                textDecoration: "none", flexShrink: 0,
                transition: "background 0.15s, color 0.15s",
                background: isActive ? meta.color : isHov ? meta.hoverBg : "transparent",
                color:      isActive ? "white"    : isHov ? "white"     : "#93C5FD",
              })}
            >
              <Icon size={12} />
              {label}
            </NavLink>
          ) : (
            <div
              key={mod.module_code}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "5px 13px", borderRadius: 20, fontSize: 13,
                color: "rgba(255,255,255,0.22)", cursor: "not-allowed", flexShrink: 0,
              }}
            >
              <Icon size={12} />
              {label}
              <span style={{
                background: "rgba(255,255,255,0.07)", color: "#6B7280",
                fontSize: 10, padding: "1px 6px", borderRadius: 4, marginLeft: 1,
              }}>
                Soon
              </span>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
