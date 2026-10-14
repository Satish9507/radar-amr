import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip as RechartTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell,
  PieChart, Pie, LineChart, Line, ReferenceLine,
} from "recharts";
import {
  Upload, FileSpreadsheet, AlertTriangle, CheckCircle, XCircle,
  ChevronDown, ChevronRight, Info, Target, Beaker, Shield, Activity,
  FileText, Table, MapPin, BarChart2, Download, TrendingUp, FileDown, Printer, CheckSquare,
  Layers, LayoutGrid,
} from "lucide-react";
import * as XLSX from "xlsx";

import Header        from "../components/Header";
import NavBar        from "../components/NavBar";
import Footer        from "../components/Footer";
import useBreakpoint from "../hooks/useBreakpoint";
import { calculateRADAR } from "../services/api";
import { fmtDate } from "../utils/dateUtils";

// ── Colour palette ────────────────────────────────────────────────────────────
const C = {
  primary:   "#0891B2",
  accent:    "#0E7490",
  bg:        "#F0F4F8",
  cardBg:    "#FFFFFF",
  border:    "#CBD5E1",
  textDark:  "#0F172A",
  textMid:   "#475569",
  textLight: "#94A3B8",
};

// ── Risk tier helpers ─────────────────────────────────────────────────────────
const TIER_COLORS = {
  Negligible: { color: '#059669', bg: '#D1FAE5' },
  Low:        { color: '#0EA5E9', bg: '#E0F2FE' },
  Moderate:   { color: '#D97706', bg: '#FEF3C7' },
  High:       { color: '#DC2626', bg: '#FEE2E2' },
};

const tierStyle = (label) => TIER_COLORS[label] ?? { color: '#64748B', bg: '#F1F5F9' };

// ── Weight slider ─────────────────────────────────────────────────────────────
function WeightSlider({ label, icon: Icon, color, value, onChange, disabled }) {
  return (
    <div style={{ flex: 1, minWidth: 160 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <Icon size={14} color={color} />
        <span style={{ fontSize: 13, fontWeight: 600, color: C.textDark }}>{label}</span>
        <span style={{
          marginLeft: "auto", fontSize: 13, fontWeight: 700, color,
          background: color + "18", borderRadius: 6, padding: "1px 8px",
        }}>
          {Math.round(value * 100)}%
        </span>
      </div>
      <input
        type="range" min={0} max={1} step={0.01}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        style={{ width: "100%", accentColor: color, cursor: disabled ? "not-allowed" : "pointer" }}
      />
    </div>
  );
}

// ── Upload zone ───────────────────────────────────────────────────────────────
function UploadZone({ label, icon: Icon, color, file, onFile, accept = ".xlsx,.xls", subtext }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }, [onFile]);

  return (
    <label
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 8, padding: "20px 12px", borderRadius: 12,
        border: `2px dashed ${dragging ? color : (file ? color : C.border)}`,
        background: file ? color + "08" : dragging ? color + "10" : "#F8FAFC",
        cursor: "pointer", transition: "all 0.15s", textAlign: "center",
      }}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef} type="file" accept={accept} style={{ display: "none" }}
        onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]); }}
      />
      {file ? (
        <>
          <CheckCircle size={24} color={color} />
          <span style={{ fontSize: 14, fontWeight: 600, color, wordBreak: "break-all" }}>{file.name}</span>
          <button
            onClick={e => { e.preventDefault(); onFile(null); }}
            style={{ fontSize: 12, color: C.textLight, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
          >
            Remove
          </button>
        </>
      ) : (
        <>
          <Icon size={24} color={color} style={{ opacity: 0.7 }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: C.textDark }}>{label}</span>
          <span style={{ fontSize: 12, color: C.textLight }}>{subtext ?? "Supports .xlsx or .xls"}</span>
        </>
      )}
    </label>
  );
}

// ── Instructions ──────────────────────────────────────────────────────────────
function Instructions() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: C.cardBg, border: `1px solid ${C.border}` }} className="rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3"
              style={{ background: "none", border: "none", cursor: "pointer" }}>
        <div className="flex items-center gap-2">
          <Info size={15} color={C.primary} />
          <span style={{ color: C.textDark, fontWeight: 600, fontSize: 16 }}>How to Use RADAR Score</span>
        </div>
        <ChevronDown size={15} color={C.textMid}
                     style={{ transform: open ? "rotate(180deg)" : "none", transition: "0.2s" }} />
      </button>

      {open && (
        <div style={{ borderTop: `1px solid ${C.border}` }} className="p-4 md:p-5 space-y-4">

          {/* Component cards */}
          <div>
            <p style={{ color: C.textDark, fontWeight: 600, fontSize: 15 }} className="mb-3">Score Components</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
              {[
                { icon: Shield,   color: "#0D9488", title: "ARB Score (W_A)", desc: "Upload your QMRA file. DALYs/yr are summed per site+date and normalised against the WHO 10⁻⁶ benchmark." },
                { icon: Activity, color: "#7C3AED", title: "ARG Score (W_B)", desc: "Upload your CAMRI ARG file. The ℜ_ARG score (already 0–1) is used directly, no extra normalisation." },
                { icon: Beaker,   color: "#1E40AF", title: "PPCP Score (W_C)", desc: "Upload your RQ file. AMR_RQ and ECO_RQ per compound are combined using the Hazard Index (sum), capped at 1.0." },
                { icon: Target,   color: C.primary, title: "RADAR Score",      desc: "Weighted sum of the 3 normalised components. Adjust weights with the sliders. Missing modules redistribute their weight automatically." },
              ].map(({ icon: Icon, color, title, desc }) => (
                <div key={title} style={{ background: "#F8FAFC", border: `1px solid ${C.border}`, borderRadius: 10 }} className="p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Icon size={14} color={color} />
                    <span style={{ color: C.textDark, fontWeight: 600, fontSize: 15 }}>{title}</span>
                  </div>
                  <p style={{ color: C.textMid, fontSize: 14, margin: 0, lineHeight: 1.5 }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Note */}
          <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8 }} className="px-3 py-2.5 flex items-start gap-2">
            <AlertTriangle size={14} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ color: "#92400E", fontSize: 14, margin: 0 }}>
              Site names must be consistent across all uploaded files: The QMRA, RQ and CAMRI ARG site column headers must all use the same values.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Methodology panel ─────────────────────────────────────────────────────────
function MethodologyPanel() {
  const [open, setOpen] = useState(false);

  const thCell = { padding: "6px 10px", textAlign: "left", color: C.textMid, border: `1px solid ${C.border}`, fontWeight: 600, fontSize: 12, background: "#F8FAFC" };
  const tdCell = { padding: "6px 10px", border: `1px solid ${C.border}`, fontSize: 13, color: C.textDark };
  const code   = { fontFamily: "monospace", background: "#F1F5F9", padding: "2px 6px", borderRadius: 4, fontSize: 13 };

  return (
    <div style={{ background: C.cardBg, border: `1px solid ${C.border}` }} className="rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3"
              style={{ background: "none", border: "none", cursor: "pointer" }}>
        <div className="flex items-center gap-2">
          <FileText size={15} color={C.primary} />
          <span style={{ color: C.textDark, fontWeight: 600, fontSize: 16 }}>RADAR Score Formula &amp; Methodology</span>
        </div>
        <ChevronDown size={15} color={C.textMid}
                     style={{ transform: open ? "rotate(180deg)" : "none", transition: "0.2s" }} />
      </button>

      {open && (
        <div style={{ borderTop: `1px solid ${C.border}` }} className="p-4 md:p-5 space-y-4">

          {/* Core formula */}
          <div>
            <p style={{ color: C.textDark, fontWeight: 600, fontSize: 15 }} className="mb-3">Core Formula</p>
            <div style={{ background: "#F8FAFC", border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 12 }}>
              <code style={{ fontSize: 14, color: C.primary, fontWeight: 700, fontFamily: "monospace" }}>
                RADAR = (W_A × S_ARB) + (W_B × S_ARG) + (W_C × S_PPCP)
              </code>
              <p style={{ fontSize: 13, color: C.textMid, margin: "8px 0 0" }}>
                Constraint: W_A + W_B + W_C = 1.0 at all times. All component scores are normalised to [0, 1].
              </p>
            </div>
            <div className="overflow-x-auto">
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>{["Variable", "Description", "Source", "Default Weight"].map(h => <th key={h} style={thCell}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {[
                    { v: "S_ARB", desc: "Normalised ARB Score ∈ [0, 1]", src: "QMRA",  w: "W_A = 0.50" },
                    { v: "S_ARG", desc: "Normalised ARG Score ∈ [0, 1]", src: "CAMRI", w: "W_B = 0.30" },
                    { v: "S_PPCP",desc: "Normalised PPCP Score ∈ [0, 1]",src: "RQ",    w: "W_C = 0.20" },
                  ].map(r => (
                    <tr key={r.v}>
                      <td style={{ ...tdCell, fontFamily: "monospace", color: C.primary, fontWeight: 700 }}>{r.v}</td>
                      <td style={tdCell}>{r.desc}</td>
                      <td style={tdCell}>{r.src}</td>
                      <td style={{ ...tdCell, fontWeight: 600 }}>{r.w}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Component normalisation */}
          <div>
            <p style={{ color: C.textDark, fontWeight: 600, fontSize: 15 }} className="mb-3">Component Normalisation</p>
            <div className="space-y-2.5">
              {[
                {
                  label: "S_ARB: ARB Score (QMRA)",
                  color: "#0D9488",
                  formula: "S_ARB = min(total_DALY / 1×10⁻⁶, 1.0)",
                  note: "DALYs per site+date summed across all pathogens. Normalised against the WHO 10⁻⁶ DALYs/person/year benchmark. Capped at 1.0.",
                },
                {
                  label: "S_ARG: ARG Score (CAMRI)",
                  color: "#7C3AED",
                  formula: "S_ARG = ℜ_ARG  (used directly)",
                  note: "ℜ_ARG from the CAMRI ARG file is already normalised to [0, 1]. The ℜ_AMR combined score is not used. It would double-count ARB risk already captured by S_ARB.",
                },
                {
                  label: "S_PPCP: PPCP Score (RQ)",
                  color: "#1E40AF",
                  formula: "RQ_compound = max(AMR_RQ, ECO_RQ)\nMRQ = Σ RQ_compound  (Hazard Index)\nS_PPCP = min(MRQ, 1.0)",
                  note: "Hazard Index (sum) captures the cocktail effect where sub-threshold compounds collectively exceed the threshold. Capped at 1.0.",
                },
              ].map(({ label, color, formula, note }) => (
                <div key={label} style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ background: color + "10", borderBottom: `1px solid ${C.border}`, padding: "7px 12px" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color }}>{label}</span>
                  </div>
                  <div style={{ padding: "10px 12px", background: "#FAFBFC" }}>
                    <pre style={{ ...code, display: "block", whiteSpace: "pre-wrap", marginBottom: 6, lineHeight: 1.7 }}>{formula}</pre>
                    <p style={{ fontSize: 13, color: C.textMid, margin: 0, lineHeight: 1.5 }}>{note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Weight redistribution */}
          <div>
            <p style={{ color: C.textDark, fontWeight: 600, fontSize: 15 }} className="mb-1.5">Missing Module (Weight Redistribution)</p>
            <p style={{ color: C.textMid, fontSize: 13, marginBottom: 10 }}>
              If a module file is not uploaded, its weight redistributes proportionally among the provided modules:
            </p>
            <div style={{ background: "#F8FAFC", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", marginBottom: 10 }}>
              <code style={{ ...code, display: "block", fontSize: 13 }}>W_i_adjusted = W_i / (Σ W_present)</code>
            </div>
            <p style={{ color: C.textMid, fontSize: 13, margin: 0 }}>
              Example: RQ absent (W_C = 0.20 missing): W_A → 0.50 / 0.80 = <strong>0.625</strong>, W_B → 0.30 / 0.80 = <strong>0.375</strong>
            </p>
          </div>

          {/* Risk tiers */}
          <div>
            <p style={{ color: C.textDark, fontWeight: 600, fontSize: 15 }} className="mb-3">Risk Tiers</p>
            <div className="overflow-x-auto">
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>{["Tier", "RADAR Score Range", "Interpretation"].map(h => <th key={h} style={thCell}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {[
                    { tier: "Negligible", range: "0.00 – 0.25", color: "#059669", bg: "#D1FAE5", note: "All components low, no immediate concern" },
                    { tier: "Low",        range: "0.25 – 0.50", color: "#0EA5E9", bg: "#E0F2FE", note: "Minor signal in one or more components" },
                    { tier: "Moderate",   range: "0.50 – 0.75", color: "#D97706", bg: "#FEF3C7", note: "Elevated multi-component risk, warrants investigation" },
                    { tier: "High",       range: "0.75 – 1.00", color: "#DC2626", bg: "#FEE2E2", note: "High composite risk, priority site for intervention" },
                  ].map(r => (
                    <tr key={r.tier}>
                      <td style={tdCell}>
                        <span style={{ background: r.bg, color: r.color, fontWeight: 700, fontSize: 12, borderRadius: 6, padding: "2px 10px" }}>{r.tier}</span>
                      </td>
                      <td style={{ ...tdCell, fontFamily: "monospace", fontWeight: 600 }}>{r.range}</td>
                      <td style={{ ...tdCell, color: C.textMid }}>{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Reference note */}
          <div style={{ background: "#F8FAFC", border: `1px solid ${C.border}`, borderRadius: 8 }} className="px-3 py-2.5">
            <p style={{ fontSize: 13, color: C.textMid, margin: 0 }}>
              <strong style={{ color: C.textDark }}>References:</strong> WHO GDWQ 4th ed. (2022) · EPA Cumulative Risk Assessment (2000) · Bengtsson-Palme &amp; Larsson (2016) · Goh et al. (2022) CAMRI framework.
            </p>
          </div>

        </div>
      )}
    </div>
  );
}

// ── Summary cards ─────────────────────────────────────────────────────────────
function SummaryCards({ results }) {
  const highCount = results.samples.filter(r => r.risk_tier === "High").length;
  const maxScore  = results.samples.length ? Math.max(...results.samples.map(r => r.radar_score ?? 0)) : 0;
  const items = [
    { label: "Samples Assessed",  value: results.samples.length,                        icon: FileSpreadsheet, color: C.primary },
    { label: "High Risk Samples", value: `${highCount} / ${results.samples.length}`,    icon: AlertTriangle,   color: "#DC2626" },
    { label: "Sites",             value: results.sites.length,                           icon: MapPin,          color: "#0D9488" },
    { label: "Max RADAR Score",   value: maxScore.toFixed(3),                           icon: TrendingUp,      color: C.primary },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map(({ label, value, icon: Icon, color }) => (
        <div key={label} style={{ background: C.cardBg, border: `1px solid ${C.border}` }}
             className="rounded-xl p-3 md:p-4 flex items-center gap-2 md:gap-3">
          <div style={{ background: color + "18", borderRadius: 8, padding: 8, flexShrink: 0 }}>
            <Icon size={18} color={color} />
          </div>
          <div className="min-w-0">
            <p style={{ color: C.textMid, fontSize: 12 }} className="truncate">{label}</p>
            <p style={{ color: C.textDark }} className="text-lg md:text-xl font-bold">{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Results panel (tabbed, matches CAMRI/QMRA/RQ pattern) ────────────────────
const CHART_PAGE_SIZE = 20;
const TABLE_PAGE_SIZE = 20;

const SPIDER_COLORS = ["#0891B2", "#0D9488", "#7C3AED", "#1E40AF", "#DC2626", "#059669"];

// ── Download utilities ────────────────────────────────────────────────────────
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename;
  a.click(); URL.revokeObjectURL(url);
}

function doDownloadCSV(samples) {
  const header = ["Site", "Date", "ARB Score", "ARG Score", "PPCP Score", "RADAR Score", "Risk Tier", "Modules Used"];
  const rows = samples.map(r => [
    r.site, r.date,
    r.s_arb?.toFixed(6) ?? "", r.s_arg?.toFixed(6) ?? "", r.s_ppcp?.toFixed(6) ?? "",
    r.radar_score?.toFixed(6) ?? "",
    r.risk_tier ?? "",
    Array.isArray(r.modules_used) ? r.modules_used.join("|") : (r.modules_used ?? ""),
  ]);
  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `RADAR_Results_${new Date().toISOString().slice(0, 10)}.csv`);
}

function doDownloadXLSX(results) {
  const wb = XLSX.utils.book_new();

  // Sheet 1 — sample results
  const wsData = XLSX.utils.aoa_to_sheet([
    ["Site", "Date", "ARB Score (S_ARB)", "ARG Score (S_ARG)", "PPCP Score (S_PPCP)",
     "RADAR Score", "Risk Tier", "W_A Used", "W_B Used", "W_C Used", "Modules Used"],
    ...results.samples.map(r => [
      r.site, r.date,
      r.s_arb ?? "", r.s_arg ?? "", r.s_ppcp ?? "",
      r.radar_score ?? "", r.risk_tier ?? "",
      r.w_a_used ?? "", r.w_b_used ?? "", r.w_c_used ?? "",
      Array.isArray(r.modules_used) ? r.modules_used.join(", ") : (r.modules_used ?? ""),
    ]),
  ]);
  XLSX.utils.book_append_sheet(wb, wsData, "RADAR Results");

  // Sheet 2 — site summary
  const wsSite = XLSX.utils.aoa_to_sheet([
    ["Site", "Sample Count", "Mean RADAR Score", "Mean ARB Score", "Mean ARG Score", "Mean PPCP Score", "Risk Tier"],
    ...results.sites.map(s => [
      s.site, s.sample_count,
      s.mean_radar ?? "", s.mean_s_arb ?? "", s.mean_s_arg ?? "", s.mean_s_ppcp ?? "",
      s.risk_tier ?? "",
    ]),
  ]);
  XLSX.utils.book_append_sheet(wb, wsSite, "Site Summary");

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  triggerDownload(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `RADAR_Results_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

// ── Toast notification ────────────────────────────────────────────────────────
const Toast = ({ message, onDone }) => {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
                  zIndex: 999, background: "#0F172A", color: "white", whiteSpace: "nowrap",
                  borderRadius: 10, padding: "10px 20px", display: "flex",
                  alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.25)", fontSize: 14, fontWeight: 500 }}>
      <CheckSquare size={16} color="#34D399" /> {message}
    </div>
  );
};

// ── Export dropdown (matches CAMRI / RQ pattern) ──────────────────────────────
function DownloadMenu({ results, onToast }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const opts = [
    { icon: Table,    label: "CSV",           sub: "Opens in any spreadsheet app",  color: "#059669", bg: "#D1FAE5", fn: () => { doDownloadCSV(results.samples);  onToast("CSV download started");   } },
    { icon: FileDown, label: "Excel (.xlsx)", sub: "2 sheets: Results, Site Summary", color: C.primary, bg: "#EDE9FE", fn: () => { doDownloadXLSX(results);        onToast("Excel download started"); } },
    { icon: Printer,  label: "Print / PDF",   sub: "Use browser Save as PDF option", color: "#7C3AED", bg: "#EDE9FE", fn: () => { window.print();                  onToast("Print dialog opened");    } },
  ];
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
              style={{ background: C.primary, color: "white", cursor: "pointer" }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold">
        <Download size={13} /> Export
        <ChevronDown size={11} style={{ transform: open ? "rotate(180deg)" : "none", transition: "0.2s" }} />
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 260,
                      background: "white", border: `1px solid ${C.border}`, borderRadius: 12,
                      boxShadow: "0 8px 32px rgba(0,0,0,0.12)", zIndex: 100 }}>
          <div style={{ borderBottom: `1px solid ${C.border}`, padding: "10px 14px" }}>
            <p style={{ color: C.textDark, fontWeight: 700, fontSize: 15 }}>Export Options</p>
            <p style={{ color: C.textMid, fontSize: 13 }}>{results.samples.length} records · RADAR Results</p>
          </div>
          <div style={{ padding: "6px" }}>
            {opts.map(o => (
              <button key={o.label} onClick={() => { setOpen(false); o.fn(); }}
                      className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-left">
                <div style={{ background: o.bg, borderRadius: 8, padding: 7, marginTop: 1, flexShrink: 0 }}>
                  <o.icon size={14} color={o.color} />
                </div>
                <div>
                  <p style={{ color: C.textDark, fontWeight: 600, fontSize: 15 }}>{o.label}</p>
                  <p style={{ color: C.textMid, fontSize: 13 }}>{o.sub}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const MODULE_COLORS = {
  QMRA:  { color: "#0D9488", bg: "#CCFBF1" },
  CAMRI: { color: "#7C3AED", bg: "#EDE9FE" },
  RQ:    { color: "#1E40AF", bg: "#DBEAFE" },
};

function ModuleBadges({ value }) {
  const mods = Array.isArray(value) ? value : (value ? String(value).split(/[,|]/).map(s => s.trim()) : []);
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {mods.map(m => {
        const mc = MODULE_COLORS[m] ?? { color: C.textMid, bg: "#F1F5F9" };
        return (
          <span key={m} style={{ background: mc.bg, color: mc.color, fontWeight: 700, fontSize: 11, borderRadius: 6, padding: "2px 7px" }}>{m}</span>
        );
      })}
    </div>
  );
}

function ResultsPanel({ results, warnings, apiErrors, onToast }) {
  const [activeTab,  setActiveTab]  = useState("table");
  const [tablePage,  setTablePage]  = useState(1);
  const [chartPage,  setChartPage]  = useState(1);
  const [sortCol,       setSortCol]       = useState(null);
  const [sortDir,       setSortDir]       = useState("asc");
  const [filterSite,    setFilterSite]    = useState("");
  const [filterTier,    setFilterTier]    = useState("");
  const [breakdownPage, setBreakdownPage] = useState(1);

  const thStyle = { padding: "8px 12px", fontSize: 12, fontWeight: 600, color: C.textMid, textAlign: "left", background: "#F8FAFC", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap", userSelect: "none" };
  const tdStyle = { padding: "8px 12px", fontSize: 13, color: C.textDark, borderBottom: `1px solid #F1F5F9`, whiteSpace: "nowrap" };

  const siteOptions = useMemo(() => [...new Set(results.samples.map(r => r.site))].sort(), [results.samples]);
  const tierOptions = useMemo(() => [...new Set(results.samples.map(r => r.risk_tier).filter(Boolean))], [results.samples]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
    setTablePage(1);
  };

  const displaySamples = useMemo(() => {
    let rows = [...results.samples];
    if (filterSite) rows = rows.filter(r => r.site === filterSite);
    if (filterTier) rows = rows.filter(r => r.risk_tier === filterTier);
    if (sortCol) rows.sort((a, b) => {
      const av = a[sortCol] ?? "", bv = b[sortCol] ?? "";
      const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [results.samples, filterSite, filterTier, sortCol, sortDir]);

  const hasFilters = filterSite || filterTier;
  const clearFilters = () => { setFilterSite(""); setFilterTier(""); setTablePage(1); };

  const tablePageRows = displaySamples.slice((tablePage - 1) * TABLE_PAGE_SIZE, tablePage * TABLE_PAGE_SIZE);
  const tableCols = [
    { key: "site",        label: "Site",        sortKey: "site"        },
    { key: "date",        label: "Date",        sortKey: "date",        fmt: v => fmtDate(v) },
    { key: "s_arb",       label: "ARB Score",   sortKey: "s_arb",   fmt: v => v != null ? v.toFixed(3) : "" },
    { key: "s_arg",       label: "ARG Score",   sortKey: "s_arg",   fmt: v => v != null ? v.toFixed(3) : "" },
    { key: "s_ppcp",      label: "PPCP Score",  sortKey: "s_ppcp",  fmt: v => v != null ? v.toFixed(3) : "" },
    { key: "radar_score", label: "RADAR Score", sortKey: "radar_score", fmt: v => v != null ? v.toFixed(3) : "", bold: true },
    { key: "risk_tier",   label: "Risk Tier",   sortKey: "risk_tier",  render: v => {
      const s = tierStyle(v);
      return <span style={{ background: s.bg, color: s.color, fontWeight: 700, fontSize: 11, borderRadius: 6, padding: "2px 8px" }}>{v}</span>;
    }},
    { key: "w_a_used", label: "W_A (ARB)",  sortKey: "w_a_used", fmt: v => v != null ? v.toFixed(3) : "" },
    { key: "w_b_used", label: "W_B (ARG)",  sortKey: "w_b_used", fmt: v => v != null ? v.toFixed(3) : "" },
    { key: "w_c_used", label: "W_C (PPCP)", sortKey: "w_c_used", fmt: v => v != null ? v.toFixed(3) : "" },
    { key: "modules_used", label: "Modules", render: v => <ModuleBadges value={v} /> },
  ];

  // Bar chart (paginated)
  const allBarData = results.samples.map(s => ({
    name:  `${s.site} / ${fmtDate(s.date)}`,
    score: s.radar_score,
    color: tierStyle(s.risk_tier).color,
  }));
  const chartTotalPages = Math.ceil(allBarData.length / CHART_PAGE_SIZE);
  const chartSlice = allBarData.slice((chartPage - 1) * CHART_PAGE_SIZE, chartPage * CHART_PAGE_SIZE);

  // Spider (first 6 for legibility)
  const spiderSamples = results.samples.slice(0, 6);
  const spiderAxes    = ["ARB Score", "ARG Score", "PPCP Score"];
  const spiderData    = spiderAxes.map((ax, i) => {
    const keys  = ["s_arb", "s_arg", "s_ppcp"];
    const entry = { axis: ax };
    spiderSamples.forEach((s, j) => { entry[`s${j}`] = parseFloat((s[keys[i]] ?? 0).toFixed(3)); });
    return entry;
  });

  // ── Computed data for new visualisations ─────────────────────────────────────
  const breakdownData = useMemo(() =>
    results.samples.map(s => ({
      name: `${s.site} / ${fmtDate(s.date)}`,
      arb:  parseFloat(((s.w_a_used ?? 0) * (s.s_arb  ?? 0)).toFixed(6)),
      arg:  parseFloat(((s.w_b_used ?? 0) * (s.s_arg  ?? 0)).toFixed(6)),
      ppcp: parseFloat(((s.w_c_used ?? 0) * (s.s_ppcp ?? 0)).toFixed(6)),
    })),
  [results.samples]);

  const trendData = useMemo(() => {
    const dates = [...new Set(results.samples.map(s => s.date))].sort();
    const sites = [...new Set(results.samples.map(s => s.site))].sort();
    const lookup = {};
    results.samples.forEach(s => {
      if (!lookup[s.date]) lookup[s.date] = {};
      lookup[s.date][s.site] = s.radar_score;
    });
    return {
      points: dates.map(d => ({ date: fmtDate(d), ...lookup[d] })),
      sites,
    };
  }, [results.samples]);

  const distributionData = useMemo(() => {
    const counts = {};
    results.samples.forEach(s => { if (s.risk_tier) counts[s.risk_tier] = (counts[s.risk_tier] || 0) + 1; });
    return ['Negligible', 'Low', 'Moderate', 'High']
      .filter(t => counts[t])
      .map(t => ({ name: t, value: counts[t], ...TIER_COLORS[t] }));
  }, [results.samples]);

  const heatmapData = useMemo(() => {
    const sites = [...new Set(results.samples.map(s => s.site))].sort();
    const dates = [...new Set(results.samples.map(s => s.date))].sort();
    const lookup = {};
    results.samples.forEach(s => { lookup[`${s.site}||${s.date}`] = { score: s.radar_score, tier: s.risk_tier }; });
    return { sites, dates, lookup };
  }, [results.samples]);

  const tabs = [
    { id: "table",        label: "Data Table",       icon: FileText   },
    { id: "bysite",       label: "By Site",           icon: MapPin     },
    { id: "chart",        label: "RADAR Chart",       icon: BarChart2  },
    { id: "breakdown",    label: "Score Breakdown",   icon: Layers     },
    { id: "trend",        label: "Trend Over Time",   icon: TrendingUp },
    { id: "spider",       label: "Component Scores",  icon: Target     },
    { id: "distribution", label: "Distribution",      icon: Activity   },
    { id: "heatmap",      label: "Heatmap",           icon: LayoutGrid },
  ];

  const switchTab = (id) => { setActiveTab(id); setTablePage(1); setChartPage(1); setBreakdownPage(1); };

  return (
    <div style={{ background: C.cardBg, border: `1px solid ${C.border}` }} className="rounded-xl overflow-hidden">

      {/* Tab bar */}
      <div style={{ borderBottom: `1px solid ${C.border}` }} className="flex items-center">
        <div className="flex items-center overflow-x-auto whitespace-nowrap scrollbar-none flex-1">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => switchTab(tab.id)}
              style={{
                borderBottom: activeTab === tab.id ? `3px solid ${C.primary}` : "3px solid transparent",
                color:        activeTab === tab.id ? C.primary : C.textMid,
                fontWeight:   activeTab === tab.id ? 700 : 500,
                flexShrink:   0,
              }}
              className="flex items-center gap-1.5 px-3 md:px-5 py-3 text-xs md:text-sm transition-all">
              <tab.icon size={13} /> {tab.label}
            </button>
          ))}
        </div>
        <div className="px-3 md:px-4 flex items-center gap-2 flex-shrink-0">
          <DownloadMenu results={results} onToast={onToast} />
        </div>
      </div>

      {/* Tab content */}
      <div className="p-3 md:p-5">

        {/* Data Table */}
        {activeTab === "table" && (
          <div>
            {apiErrors.length > 0 && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8 }}
                   className="px-3 py-2 mb-3 flex items-start gap-2">
                <XCircle size={14} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 13, color: "#991B1B" }}>
                  <strong>{apiErrors.length} row{apiErrors.length > 1 ? "s" : ""} excluded during processing:</strong>{" "}
                  {apiErrors.slice(0, 3).map((e, i) => <span key={i}>{e.message ?? String(e)}{i < Math.min(apiErrors.length, 3) - 1 ? " · " : ""}</span>)}
                  {apiErrors.length > 3 && <span> …and {apiErrors.length - 3} more</span>}
                </div>
              </div>
            )}
            {warnings.length > 0 && (
              <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8 }}
                   className="px-3 py-2 mb-3 flex items-start gap-2">
                <AlertTriangle size={14} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 13, color: "#92400E" }}>
                  <strong>{warnings.length} warning{warnings.length > 1 ? "s" : ""}:</strong>{" "}
                  {warnings.slice(0, 3).map((w, i) => <span key={i}>{w.message ?? String(w)}{i < Math.min(warnings.length, 3) - 1 ? " · " : ""}</span>)}
                  {warnings.length > 3 && <span> …and {warnings.length - 3} more</span>}
                </div>
              </div>
            )}
            {/* Filter bar */}
            <div className="flex items-center gap-2 flex-wrap mb-3">
              {[
                { label: "Site",      value: filterSite, setter: setFilterSite, opts: siteOptions },
                { label: "Risk Tier", value: filterTier, setter: setFilterTier, opts: tierOptions },
              ].map(f => (
                <select key={f.label} value={f.value}
                        onChange={e => { f.setter(e.target.value); setTablePage(1); }}
                        style={{ border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13,
                                 padding: "4px 8px", color: f.value ? C.primary : C.textMid,
                                 background: "white", cursor: "pointer" }}>
                  <option value="">All {f.label}s</option>
                  {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ))}
              {hasFilters && (
                <button onClick={clearFilters}
                        style={{ fontSize: 13, color: "#DC2626", border: "1px solid #FECACA",
                                 borderRadius: 7, padding: "4px 10px", background: "#FEF2F2", cursor: "pointer" }}>
                  Clear filters
                </button>
              )}
              <span style={{ color: C.textMid, fontSize: 13, marginLeft: "auto" }}>
                {displaySamples.length} of {results.samples.length} rows
              </span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                <thead>
                  <tr>
                    {tableCols.map(c => (
                      <th key={c.key} style={{ ...thStyle, cursor: c.sortKey ? "pointer" : "default",
                                               color: sortCol === c.sortKey && c.sortKey ? C.primary : C.textMid }}
                          onClick={() => c.sortKey && handleSort(c.sortKey)}>
                        {c.label}
                        {c.sortKey && (
                          <span style={{ marginLeft: 3, opacity: sortCol === c.sortKey ? 1 : 0.3 }}>
                            {sortCol === c.sortKey ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tablePageRows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50" style={{ borderTop: `1px solid ${C.border}` }}>
                      {tableCols.map(c => (
                        <td key={c.key} style={{ ...tdStyle, fontWeight: c.bold ? 700 : 400, color: c.bold ? C.primary : C.textDark }}>
                          {c.render ? c.render(r[c.key]) : c.fmt ? c.fmt(r[c.key]) : (r[c.key] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {tablePageRows.length === 0 && (
                    <tr><td colSpan={tableCols.length} style={{ textAlign: "center", padding: "32px 0", color: C.textLight, fontSize: 14 }}>
                      No rows match the current filters.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
              <span style={{ color: C.textMid, fontSize: 13 }}>
                {displaySamples.length === 0 ? "0" : Math.min((tablePage - 1) * TABLE_PAGE_SIZE + 1, displaySamples.length)}–{Math.min(tablePage * TABLE_PAGE_SIZE, displaySamples.length)} of {displaySamples.length} rows
              </span>
              {Math.ceil(displaySamples.length / TABLE_PAGE_SIZE) > 1 && (
                <div className="flex gap-1">
                  <button onClick={() => setTablePage(p => Math.max(1, p - 1))} disabled={tablePage === 1}
                    style={{ padding: "3px 10px", borderRadius: 6, fontSize: 13, border: `1px solid ${C.border}`, background: "white", color: tablePage === 1 ? C.textLight : C.textMid, cursor: tablePage === 1 ? "default" : "pointer" }}>‹</button>
                  {Array.from({ length: Math.ceil(displaySamples.length / TABLE_PAGE_SIZE) }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => setTablePage(p)}
                      style={{ padding: "3px 10px", borderRadius: 6, fontSize: 13, border: `1px solid ${p === tablePage ? C.primary : C.border}`, background: p === tablePage ? C.primary : "white", color: p === tablePage ? "white" : C.textMid, cursor: "pointer" }}>{p}</button>
                  ))}
                  <button onClick={() => setTablePage(p => Math.min(Math.ceil(displaySamples.length / TABLE_PAGE_SIZE), p + 1))} disabled={tablePage === Math.ceil(displaySamples.length / TABLE_PAGE_SIZE)}
                    style={{ padding: "3px 10px", borderRadius: 6, fontSize: 13, border: `1px solid ${C.border}`, background: "white", color: tablePage === Math.ceil(displaySamples.length / TABLE_PAGE_SIZE) ? C.textLight : C.textMid, cursor: tablePage === Math.ceil(displaySamples.length / TABLE_PAGE_SIZE) ? "default" : "pointer" }}>›</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* By Site */}
        {activeTab === "bysite" && (
          <div>
            <p style={{ color: C.textMid, fontSize: 14, marginBottom: 12 }}>
              Aggregated RADAR risk per sampling site, mean and component scores across all samples at each location.
            </p>
            {results.sites.map(r => {
              const s = tierStyle(r.risk_tier);
              return (
                <div key={r.site} style={{ background: s.bg + "80", border: `1px solid ${s.color}33`,
                                           borderRadius: 12, marginBottom: 10, padding: "12px 14px" }}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <span style={{ color: C.textDark, fontWeight: 700, fontSize: 16 }}>{r.site}</span>
                      <span style={{ color: C.textMid, fontSize: 13, marginLeft: 6 }}>({r.sample_count} samples)</span>
                    </div>
                    <span style={{ background: s.color, color: "white", fontWeight: 600,
                                   fontSize: 13, padding: "2px 10px", borderRadius: 999 }}>
                      {r.risk_tier}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 mt-2">
                    <div>
                      <span style={{ color: C.textMid, fontSize: 13 }}>Mean RADAR: </span>
                      <span style={{ color: s.color, fontWeight: 700, fontSize: 15 }}>{r.mean_radar?.toFixed(3) ?? ""}</span>
                    </div>
                    <div>
                      <span style={{ color: C.textMid, fontSize: 13 }}>Mean ARB: </span>
                      <span style={{ color: C.textDark, fontWeight: 600, fontSize: 15 }}>{r.mean_s_arb?.toFixed(3) ?? ""}</span>
                    </div>
                    <div>
                      <span style={{ color: C.textMid, fontSize: 13 }}>Mean ARG: </span>
                      <span style={{ color: C.textDark, fontWeight: 600, fontSize: 15 }}>{r.mean_s_arg?.toFixed(3) ?? ""}</span>
                    </div>
                    <div>
                      <span style={{ color: C.textMid, fontSize: 13 }}>Mean PPCP: </span>
                      <span style={{ color: C.textDark, fontWeight: 600, fontSize: 15 }}>{r.mean_s_ppcp?.toFixed(3) ?? ""}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* RADAR Score Chart (paginated bar) */}
        {activeTab === "chart" && (
          <div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartSlice} margin={{ top: 4, right: 8, bottom: 60, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.textMid }} angle={-40} textAnchor="end" interval={0} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: C.textMid }} />
                <RechartTooltip formatter={(v) => [v.toFixed(3), "RADAR Score"]} />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {chartSlice.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Chart tier legend */}
            <div className="flex gap-3 flex-wrap mt-2 mb-3">
              {Object.entries(TIER_COLORS).map(([label, { color }]) => (
                <span key={label} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: "inline-block" }} />
                  <span style={{ color: C.textMid }}>{label}</span>
                </span>
              ))}
            </div>

            {/* Chart pagination */}
            {chartTotalPages > 1 && (
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span style={{ color: C.textMid, fontSize: 13 }}>
                  Showing {(chartPage - 1) * CHART_PAGE_SIZE + 1}–{Math.min(chartPage * CHART_PAGE_SIZE, allBarData.length)} of {allBarData.length} samples
                </span>
                <div className="flex gap-1">
                  <button onClick={() => setChartPage(p => Math.max(1, p - 1))} disabled={chartPage === 1}
                    style={{ padding: "3px 10px", borderRadius: 6, fontSize: 13, border: `1px solid ${C.border}`, background: "white", color: chartPage === 1 ? C.textLight : C.textMid, cursor: chartPage === 1 ? "default" : "pointer" }}>‹ Prev</button>
                  {Array.from({ length: chartTotalPages }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => setChartPage(p)}
                      style={{ padding: "3px 10px", borderRadius: 6, fontSize: 13, border: `1px solid ${p === chartPage ? C.primary : C.border}`, background: p === chartPage ? C.primary : "white", color: p === chartPage ? "white" : C.textMid, cursor: "pointer" }}>{p}</button>
                  ))}
                  <button onClick={() => setChartPage(p => Math.min(chartTotalPages, p + 1))} disabled={chartPage === chartTotalPages}
                    style={{ padding: "3px 10px", borderRadius: 6, fontSize: 13, border: `1px solid ${C.border}`, background: "white", color: chartPage === chartTotalPages ? C.textLight : C.textMid, cursor: chartPage === chartTotalPages ? "default" : "pointer" }}>Next ›</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Score Breakdown — stacked bar showing weighted component contributions */}
        {activeTab === "breakdown" && (
          <div>
            <p style={{ color: C.textMid, fontSize: 13, marginBottom: 10 }}>
              Weighted contribution of each component to the final RADAR Score per sample. Bars sum to the score.
            </p>
            <div className="flex gap-4 flex-wrap mb-3">
              {[["ARB (QMRA)", "#0D9488"], ["ARG (CAMRI)", "#7C3AED"], ["PPCP (RQ)", "#1E40AF"]].map(([label, color]) => (
                <span key={label} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: "inline-block" }} />
                  <span style={{ color: C.textMid }}>{label}</span>
                </span>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={breakdownData.slice((breakdownPage - 1) * CHART_PAGE_SIZE, breakdownPage * CHART_PAGE_SIZE)}
                margin={{ top: 4, right: 8, bottom: 60, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.textMid }} angle={-40} textAnchor="end" interval={0} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: C.textMid }} />
                <RechartTooltip formatter={(v, name) => [v.toFixed(3), name === "arb" ? "ARB" : name === "arg" ? "ARG" : "PPCP"]} />
                <Bar dataKey="arb"  stackId="a" fill="#0D9488" name="arb"  />
                <Bar dataKey="arg"  stackId="a" fill="#7C3AED" name="arg"  />
                <Bar dataKey="ppcp" stackId="a" fill="#1E40AF" name="ppcp" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            {Math.ceil(breakdownData.length / CHART_PAGE_SIZE) > 1 && (
              <div className="flex items-center justify-between flex-wrap gap-2 mt-2">
                <span style={{ color: C.textMid, fontSize: 13 }}>
                  Showing {(breakdownPage - 1) * CHART_PAGE_SIZE + 1}–{Math.min(breakdownPage * CHART_PAGE_SIZE, breakdownData.length)} of {breakdownData.length} samples
                </span>
                <div className="flex gap-1">
                  <button onClick={() => setBreakdownPage(p => Math.max(1, p - 1))} disabled={breakdownPage === 1}
                    style={{ padding: "3px 10px", borderRadius: 6, fontSize: 13, border: `1px solid ${C.border}`, background: "white", color: breakdownPage === 1 ? C.textLight : C.textMid, cursor: breakdownPage === 1 ? "default" : "pointer" }}>‹ Prev</button>
                  {Array.from({ length: Math.ceil(breakdownData.length / CHART_PAGE_SIZE) }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => setBreakdownPage(p)}
                      style={{ padding: "3px 10px", borderRadius: 6, fontSize: 13, border: `1px solid ${p === breakdownPage ? C.primary : C.border}`, background: p === breakdownPage ? C.primary : "white", color: p === breakdownPage ? "white" : C.textMid, cursor: "pointer" }}>{p}</button>
                  ))}
                  <button onClick={() => setBreakdownPage(p => Math.min(Math.ceil(breakdownData.length / CHART_PAGE_SIZE), p + 1))} disabled={breakdownPage === Math.ceil(breakdownData.length / CHART_PAGE_SIZE)}
                    style={{ padding: "3px 10px", borderRadius: 6, fontSize: 13, border: `1px solid ${C.border}`, background: "white", color: breakdownPage === Math.ceil(breakdownData.length / CHART_PAGE_SIZE) ? C.textLight : C.textMid, cursor: breakdownPage === Math.ceil(breakdownData.length / CHART_PAGE_SIZE) ? "default" : "pointer" }}>Next ›</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Trend Over Time — line chart per site */}
        {activeTab === "trend" && (
          <div>
            <p style={{ color: C.textMid, fontSize: 13, marginBottom: 12 }}>
              RADAR Score over time per site. Dashed lines mark risk tier thresholds (0.25 / 0.50 / 0.75).
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData.points} margin={{ top: 8, right: 20, bottom: 60, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.textMid }} angle={-40} textAnchor="end" interval={0} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: C.textMid }} />
                <RechartTooltip formatter={(v) => v != null ? v.toFixed(3) : "—"} />
                {[0.25, 0.50, 0.75].map(t => (
                  <ReferenceLine key={t} y={t} stroke={C.border} strokeDasharray="4 4"
                    label={{ value: t.toFixed(2), position: "insideRight", fontSize: 9, fill: C.textLight }} />
                ))}
                {trendData.sites.map((site, i) => (
                  <Line key={site} type="monotone" dataKey={site} name={site}
                    stroke={SPIDER_COLORS[i % SPIDER_COLORS.length]} strokeWidth={2}
                    dot={{ r: 3 }} connectNulls={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 mt-3">
              {trendData.sites.map((site, i) => (
                <span key={site} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 14, height: 3, background: SPIDER_COLORS[i % SPIDER_COLORS.length], display: "inline-block", borderRadius: 2 }} />
                  <span style={{ color: C.textMid }}>{site}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Component Scores — Spider View */}
        {activeTab === "spider" && (
          <div>
            <p style={{ color: C.textMid, fontSize: 13, marginBottom: 12 }}>
              Each polygon represents one sample, plotted on 3 axes (ARB, ARG, PPCP). The shape shows which risk component dominates. Showing the first {spiderSamples.length} samples for readability.
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={spiderData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid stroke={C.border} />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 12, fill: C.textMid }} />
                <PolarRadiusAxis domain={[0, 1]} tick={{ fontSize: 9, fill: C.textLight }} tickCount={4} />
                {spiderSamples.map((s, j) => (
                  <Radar key={j}
                    name={`${s.site}${s.date ? ` (${fmtDate(s.date)})` : ""}`}
                    dataKey={`s${j}`}
                    stroke={SPIDER_COLORS[j]} fill={SPIDER_COLORS[j]} fillOpacity={0.12} strokeWidth={2}
                  />
                ))}
                <RechartTooltip formatter={(v) => v.toFixed(3)} />
              </RadarChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 mt-3">
              {spiderSamples.map((s, j) => (
                <span key={j} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: SPIDER_COLORS[j], display: "inline-block" }} />
                  <span style={{ color: C.textMid }}>{s.site}{s.date ? ` / ${fmtDate(s.date)}` : ""}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Distribution — donut chart + tier count table */}
        {activeTab === "distribution" && (
          <div>
            <p style={{ color: C.textMid, fontSize: 13, marginBottom: 16 }}>
              Distribution of samples across risk tiers.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
              <div style={{ flexShrink: 0 }}>
                <PieChart width={180} height={180}>
                  <Pie data={distributionData} cx={90} cy={90} innerRadius={50} outerRadius={80}
                       dataKey="value" paddingAngle={3}>
                    {distributionData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <RechartTooltip formatter={(v, name) => [`${v} samples`, name]} />
                </PieChart>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Tier", "Samples", "% of Total"].map(h => (
                        <th key={h} style={{ padding: "6px 12px", textAlign: "left", fontSize: 12,
                                             color: C.textMid, fontWeight: 600, background: "#F8FAFC",
                                             borderBottom: `1px solid ${C.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {distributionData.map(d => (
                      <tr key={d.name}>
                        <td style={{ padding: "8px 12px", borderBottom: `1px solid #F1F5F9` }}>
                          <span style={{ background: d.bg, color: d.color, fontWeight: 700, fontSize: 12, borderRadius: 6, padding: "2px 10px" }}>{d.name}</span>
                        </td>
                        <td style={{ padding: "8px 12px", borderBottom: `1px solid #F1F5F9`, fontWeight: 700, color: C.textDark, fontSize: 14 }}>{d.value}</td>
                        <td style={{ padding: "8px 12px", borderBottom: `1px solid #F1F5F9`, color: C.textMid, fontSize: 14 }}>
                          {((d.value / results.samples.length) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Heatmap — sites × dates grid coloured by risk tier */}
        {activeTab === "heatmap" && (
          <div>
            <p style={{ color: C.textMid, fontSize: 13, marginBottom: 10 }}>
              RADAR Score by site and date. Cell colour indicates risk tier; value shows the score.
            </p>
            <div className="flex gap-3 flex-wrap mb-3">
              {Object.entries(TIER_COLORS).map(([label, { color, bg }]) => (
                <span key={label} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 2, background: bg, border: `1px solid ${color}`, display: "inline-block" }} />
                  <span style={{ color: C.textMid }}>{label}</span>
                </span>
              ))}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ padding: "6px 10px", textAlign: "left", background: "#F8FAFC",
                                 border: `1px solid ${C.border}`, color: C.textMid, fontWeight: 600,
                                 whiteSpace: "nowrap", minWidth: 80 }}>Site</th>
                    {heatmapData.dates.map(d => (
                      <th key={d} style={{ padding: "6px 8px", textAlign: "center", background: "#F8FAFC",
                                           border: `1px solid ${C.border}`, color: C.textMid, fontWeight: 600,
                                           whiteSpace: "nowrap", fontSize: 11 }}>
                        {fmtDate(d)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmapData.sites.map(site => (
                    <tr key={site}>
                      <td style={{ padding: "6px 10px", border: `1px solid ${C.border}`, fontWeight: 600,
                                   color: C.textDark, background: "#F8FAFC", whiteSpace: "nowrap" }}>{site}</td>
                      {heatmapData.dates.map(date => {
                        const cell = heatmapData.lookup[`${site}||${date}`];
                        const s    = cell ? tierStyle(cell.tier) : null;
                        return (
                          <td key={date} style={{
                            padding: "6px 8px", border: `1px solid ${C.border}`, textAlign: "center",
                            background: s ? s.bg + "B0" : "#F8FAFC",
                            color:      s ? s.color : C.textLight,
                            fontWeight: cell ? 600 : 400,
                            minWidth: 64,
                          }}>
                            {cell ? cell.score.toFixed(3) : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RADARPage() {
  const { isMobile } = useBreakpoint();
  const navigate      = useNavigate();

  const [qmraFile,    setQmraFile]    = useState(null);
  const [camriFile,   setCamriFile]   = useState(null);
  const [rqFile,      setRqFile]      = useState(null);

  const [weights, setWeights] = useState({ w_a: 0.50, w_b: 0.30, w_c: 0.20 });

  const [loading,   setLoading]   = useState(false);
  const [results,   setResults]   = useState(null);
  const [error,     setError]     = useState(null);
  const [warnings,  setWarnings]  = useState([]);
  const [apiErrors, setApiErrors] = useState([]);
  const [toast,     setToast]     = useState(null);

  const filesUploaded = [qmraFile, camriFile, rqFile].filter(Boolean).length;
  const canCalculate  = filesUploaded >= 2 && !loading;

  // When a weight slider moves, clamp others so the sum stays at 1
  const handleWeight = (key, newVal) => {
    setWeights(prev => {
      const others   = Object.entries(prev).filter(([k]) => k !== key);
      const remaining = Math.max(0, 1 - newVal);
      const otherSum  = others.reduce((s, [, v]) => s + v, 0);
      const adjusted  = {};
      others.forEach(([k, v]) => {
        adjusted[k] = otherSum > 0 ? parseFloat((v / otherSum * remaining).toFixed(6)) : parseFloat((remaining / others.length).toFixed(6));
      });
      return { ...adjusted, [key]: parseFloat(newVal.toFixed(6)) };
    });
  };

  const handleCalculate = async () => {
    setLoading(true); setError(null); setResults(null); setWarnings([]); setApiErrors([]);
    try {
      const data = await calculateRADAR(qmraFile, camriFile, rqFile, weights);
      setResults({ samples: data.results, sites: data.site_summary, meta: data.meta });
      setWarnings(data.warnings ?? []);
      setApiErrors(data.errors ?? []);
    } catch (err) {
      setError(err.message || "Calculation failed. Please check your files.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <Header accent="#0891B2" />
      <NavBar />

      <main className="p-3 md:p-6 max-w-screen-xl mx-auto space-y-4 md:space-y-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1" style={{ color: C.textMid, fontSize: 14 }}>
          <button onClick={() => navigate("/")}
                  style={{ color: C.primary, fontWeight: 500, background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 14 }}>
            Home
          </button>
          <ChevronRight size={13} />
          <span style={{ color: C.primary, fontWeight: 600, fontSize: 14 }}>RADAR Score</span>
        </div>

        {/* ── Pre-results ── */}
        {!results && (
          <div className="space-y-4">

            <div className="space-y-4">
              <Instructions />
              <MethodologyPanel />
            </div>

            {/* Upload grid + weight controls */}
            <div style={{ background: C.cardBg, borderRadius: 14, border: `1px solid ${C.border}`, padding: isMobile ? 14 : 20 }}>
              <h2 style={{ color: C.textDark, display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }} className="font-bold text-sm md:text-base">
                <Upload size={15} color={C.primary} /> Upload Module Files
              </h2>
              <p style={{ color: C.textMid, marginBottom: 6 }} className="text-xs md:text-sm">
                Upload the same raw Excel files you use for each individual module.
              </p>
              <p style={{ color: C.textMid, marginBottom: 14 }} className="text-xs md:text-sm">
                Samples are matched by <strong style={{ color: C.textDark }}>Site + Date</strong> across all uploaded files.
              </p>

              {/* Upload zones */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
                <UploadZone label="Drop QMRA Excel file here"     icon={Shield}   color="#0D9488" file={qmraFile}  onFile={setQmraFile}  subtext="Supports .xlsx or .xls · Based on the QMRA input template" />
                <UploadZone label="Drop CAMRI ARG Excel file here" icon={Activity} color="#7C3AED" file={camriFile} onFile={setCamriFile} subtext="Supports .xlsx or .xls · Based on the ARG input template"  />
                <UploadZone label="Drop RQ Excel file here"        icon={Beaker}   color="#1E40AF" file={rqFile}    onFile={setRqFile}    subtext="Supports .xlsx or .xls · Based on the RQ input template"   />
              </div>

              {/* Weight controls */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
                <div style={{ color: C.textDark, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }} className="font-bold text-sm md:text-base">
                  <Target size={13} color={C.primary} /> Adjust Weights
                  {[!qmraFile && "QMRA", !camriFile && "CAMRI", !rqFile && "RQ"].filter(Boolean).length > 0 && (
                    <span style={{ fontSize: 13, color: C.textLight, fontWeight: 400, marginLeft: 4 }}>
                      ({[!qmraFile && "QMRA", !camriFile && "CAMRI", !rqFile && "RQ"].filter(Boolean).join(", ")} weight{[!qmraFile, !camriFile, !rqFile].filter(Boolean).length > 1 ? "s" : ""} will redistribute)
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
                  <WeightSlider label="ARB (QMRA)"  icon={Shield}   color="#0D9488" value={weights.w_a} onChange={v => handleWeight("w_a", v)} disabled={!qmraFile}  />
                  <WeightSlider label="ARG (CAMRI)" icon={Activity} color="#7C3AED" value={weights.w_b} onChange={v => handleWeight("w_b", v)} disabled={!camriFile} />
                  <WeightSlider label="PPCP (RQ)"   icon={Beaker}   color="#1E40AF" value={weights.w_c} onChange={v => handleWeight("w_c", v)} disabled={!rqFile}    />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 16px", marginTop: 16, display: "flex", gap: 10 }}>
                  <XCircle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 14, color: "#991B1B" }}>{error}</span>
                </div>
              )}

              {/* Calculate button */}
              <div style={{ marginTop: 18 }}>
                <button
                  onClick={handleCalculate}
                  disabled={!canCalculate}
                  style={{ background: canCalculate ? C.primary : "#94A3B8", cursor: canCalculate ? "pointer" : "not-allowed" }}
                  className="w-full py-3 rounded-xl text-white font-semibold text-sm md:text-base flex items-center justify-center gap-2"
                >
                  <Target size={16} />
                  {loading
                    ? "Calculating…"
                    : filesUploaded < 2
                    ? "Upload at least 2 module files to calculate"
                    : "Calculate RADAR Score"}
                </button>
              </div>
            </div>

          </div>
        )}

        {/* ── Results ── */}
        {results && (
          <div className="space-y-4 md:space-y-5">

            {results.samples.length === 0 ? (
              /* No site match */
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "24px 20px", textAlign: "center" }}>
                <XCircle size={32} color="#DC2626" style={{ margin: "0 auto 12px" }} />
                <p style={{ fontSize: 16, fontWeight: 700, color: "#991B1B", marginBottom: 6 }}>No Matching Sites Found</p>
                <p style={{ fontSize: 14, color: "#B91C1C", maxWidth: 480, margin: "0 auto" }}>
                  None of the uploaded files share a common site name. The QMRA, RQ and CAMRI ARG site column headers must all use the same values to produce a RADAR score.
                </p>
              </div>
            ) : (
              <>
                <SummaryCards results={results} />
                <ResultsPanel results={results} warnings={warnings} apiErrors={apiErrors} onToast={setToast} />
              </>
            )}

            <button
              onClick={() => { setResults(null); setWarnings([]); setApiErrors([]); setError(null); setQmraFile(null); setCamriFile(null); setRqFile(null); setWeights({ w_a: 0.50, w_b: 0.30, w_c: 0.20 }); }}
              style={{ border: `1px solid ${C.border}`, color: C.textMid }}
              className="px-4 py-2 rounded-lg text-sm hover:bg-slate-50"
            >
              ← New Calculation
            </button>

          </div>
        )}
      </main>

      <Footer />
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
