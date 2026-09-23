import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend, Cell,
} from "recharts";
import {
  Upload, FileSpreadsheet, AlertTriangle, CheckCircle, XCircle,
  ChevronRight, Download, Info, Activity, FileText, Table,
  FileDown, ChevronDown, Printer, CheckSquare, Loader2,
  MapPin, BarChart2, Layers, TrendingUp, X,
} from "lucide-react";
import * as XLSX from "xlsx";

import Header  from "../components/Header";
import NavBar  from "../components/NavBar";
import Footer  from "../components/Footer";
import { validateCAMRI, calculateCAMRI, downloadCAMRITemplate, getModuleConfig } from "../services/api";

// ─── Colour palette (purple primary, same structure as QMRA/RQ) ───────────────
const C = {
  primary:   "#7C3AED",
  accent:    "#DC2626",
  yellow:    "#D97706",
  bg:        "#F0F4F8",
  cardBg:    "#FFFFFF",
  border:    "#CBD5E1",
  textDark:  "#0F172A",
  textMid:   "#475569",
  textLight: "#94A3B8",
};

// ─── Risk levels (fallback — overridden at runtime from module_config) ─────────
const DEFAULT_RISK_LEVELS = [
  { label: "Low",    min: 0,    max: 0.40, color: "#059669" },
  { label: "Medium", min: 0.40, max: 0.65, color: "#D97706" },
  { label: "High",   min: 0.65, max: null, color: "#DC2626" },
];

function riskFromScore(score, thresholds = DEFAULT_RISK_LEVELS) {
  let r = thresholds[0];
  for (const level of thresholds) { if (score >= level.min) r = level; }
  return r;
}

const RiskBadge = ({ label, thresholds = DEFAULT_RISK_LEVELS }) => {
  const r = thresholds.find(l => l.label === label) ?? thresholds[0];
  return (
    <span style={{ background: r.color + "20", color: r.color, border: `1px solid ${r.color}44`,
                   fontSize: 12, fontWeight: 600, padding: "2px 7px",
                   borderRadius: 999, whiteSpace: "nowrap" }}>
      {r.label}
    </span>
  );
};

// ─── Pagination ───────────────────────────────────────────────────────────────
const Pagination = ({ page, total, pageSize, onChange }) => {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-4 mt-3" style={{ fontSize: 13, color: C.textMid }}>
      <span>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
      <div className="flex gap-1 flex-wrap">
        {[...Array(Math.min(totalPages, 10))].map((_, i) => (
          <button key={i} onClick={() => onChange(i + 1)}
                  style={{
                    padding: "3px 9px", borderRadius: 6, fontSize: 13, cursor: "pointer",
                    background: page === i + 1 ? C.primary : "white",
                    color:      page === i + 1 ? "white"   : C.textMid,
                    border:     `1px solid ${page === i + 1 ? C.primary : C.border}`,
                  }}>
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ message, onDone }) => {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
                  zIndex: 999, background: "#0F172A", color: "white", whiteSpace: "nowrap",
                  borderRadius: 10, padding: "10px 20px", display: "flex",
                  alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.25)", fontSize: 14, fontWeight: 500 }}>
      <CheckSquare size={16} color="#34D399"/> {message}
    </div>
  );
};

// ─── Download utilities ───────────────────────────────────────────────────────
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function doDownloadCSV(results) {
  const headers = ["#","Sample ID","Site","Month","Date","Category","Sub-category","r_ARB","r_ARG","r_AMR","Risk Level"];
  const rows = results.map((r, i) => [
    i + 1, r.sample_id, r.site, r.month, r.date, r.category, r.sub_category,
    r.r_arb, r.r_arg, r.r_amr, r.risk_level,
  ]);
  const csv = [headers, ...rows].map(row => row.map(v => `"${v ?? ""}"`).join(",")).join("\n");
  triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    `CAMRI_Results_${new Date().toISOString().slice(0, 10)}.csv`);
}

function doDownloadXLSX(results, meta, thresholds = DEFAULT_RISK_LEVELS) {
  const wb = XLSX.utils.book_new();
  const wsResults = XLSX.utils.aoa_to_sheet([
    ["#","Sample ID","Site","Month","Date","Category","Sub-category","r_ARB","r_ARG","r_AMR","Risk Level"],
    ...results.map((r, i) => [
      i + 1, r.sample_id, r.site, r.month, r.date, r.category, r.sub_category,
      r.r_arb, r.r_arg, r.r_amr, r.risk_level,
    ]),
  ]);
  wsResults["!cols"] = [4,12,14,8,12,14,14,8,8,8,10].map(wch => ({ wch }));
  XLSX.utils.book_append_sheet(wb, wsResults, "CAMRI Results");

  const now = new Date();
  const wsMeta = XLSX.utils.aoa_to_sheet([
    ["RADAR — CAMRI Report"], [""],
    ["Generated",       now.toLocaleString()],
    ["Tool Version",    "v1.0"],
    ["Method",          "CAMRI (Goh et al. 2022, J. Hazardous Materials)"],
    ["α (ARB weight)",  meta?.alpha ?? "—"],
    ["Samples",         meta?.k ?? results.length],
    [""], ["Risk Levels"],
    ...thresholds.map(t => [
      t.max != null
        ? `r_AMR ${Number(t.min).toFixed(2)}–${Number(t.max).toFixed(2)}`
        : `r_AMR ≥ ${Number(t.min).toFixed(2)}`,
      t.label,
    ]),
    [""], ["ARB Coefficients (Cassini et al. 2019 DALY)"],
    ["Ec_CAZ",37.2],["Pseu_MEM",27.2],["Kleb_CAZ",22.5],
    ["Kleb_MEM",11.5],["Ent_VAN",5.49],["Ec_MEM",0.80],
    [""], ["ARG Coefficients (Zhang et al. 2019 ARG Ranker)"],
    ["blaKPC/blaCTX_M",5],["vanA",4],["blaNDM/blaSHV/tetO",3],["tetM",2],["qnrA",1],
  ]);
  wsMeta["!cols"] = [{ wch: 30 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsMeta, "Metadata");

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  triggerDownload(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `CAMRI_Results_${now.toISOString().slice(0, 10)}.xlsx`,
  );
}

// ─── Download menu ────────────────────────────────────────────────────────────
const DownloadMenu = ({ results, meta, thresholds = DEFAULT_RISK_LEVELS, onToast, disabled }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const opts = [
    { icon: Table,    label: "CSV",           sub: "Opens in any spreadsheet app",   color: "#059669", bg: "#D1FAE5", fn: () => { doDownloadCSV(results);         onToast("CSV download started");  } },
    { icon: FileDown, label: "Excel (.xlsx)", sub: "2 sheets: Results, Metadata",    color: C.primary, bg: "#EDE9FE", fn: () => { doDownloadXLSX(results, meta, thresholds); onToast("Excel download started"); } },
    { icon: Printer,  label: "Print / PDF",   sub: "Use browser Save as PDF option", color: "#7C3AED", bg: "#EDE9FE", fn: () => { window.print();                 onToast("Print dialog opened");   } },
  ];
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => !disabled && setOpen(o => !o)} disabled={disabled}
              style={{ background: disabled ? "#94A3B8" : C.primary, color: "white",
                       cursor: disabled ? "not-allowed" : "pointer" }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold">
        <Download size={13}/> Export
        <ChevronDown size={11} style={{ transform: open ? "rotate(180deg)" : "none", transition: "0.2s" }}/>
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 260,
                      background: "white", border: `1px solid ${C.border}`, borderRadius: 12,
                      boxShadow: "0 8px 32px rgba(0,0,0,0.12)", zIndex: 100 }}>
          <div style={{ borderBottom: `1px solid ${C.border}`, padding: "10px 14px" }}>
            <p style={{ color: C.textDark, fontWeight: 700, fontSize: 15 }}>Export Options</p>
            <p style={{ color: C.textMid, fontSize: 13 }}>{results.length} samples · CAMRI Results</p>
          </div>
          <div style={{ padding: 6 }}>
            {opts.map(o => (
              <button key={o.label} onClick={() => { setOpen(false); o.fn(); }}
                      className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-left">
                <div style={{ background: o.bg, borderRadius: 8, padding: 7, marginTop: 1, flexShrink: 0 }}>
                  <o.icon size={14} color={o.color}/>
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
};

// ─── Summary cards ────────────────────────────────────────────────────────────
const SummaryCards = ({ results, meta, thresholds = DEFAULT_RISK_LEVELS }) => {
  const topLabel  = [...thresholds].sort((a, b) => b.min - a.min)[0]?.label ?? "High";
  const highCount = results.filter(r => r.risk_level === topLabel).length;
  const sites     = [...new Set(results.map(r => r.site))].length;
  const maxScore  = results.length ? Math.max(...results.map(r => r.r_amr ?? r.r_arb ?? r.r_arg ?? 0)) : 0;
  const rv        = riskFromScore(maxScore, thresholds);
  const cards = [
    { label: "Samples Assessed",  value: results.length,                     icon: FileSpreadsheet, color: C.primary },
    { label: "High Risk Samples", value: `${highCount} / ${results.length}`, icon: AlertTriangle,   color: "#DC2626" },
    { label: "Sites",             value: sites,                               icon: MapPin,          color: "#7C3AED" },
    { label: "Max r_AMR",         value: maxScore.toFixed(3),                icon: Activity,        color: rv.color  },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(card => (
        <div key={card.label}
             style={{ background: C.cardBg, border: `1px solid ${C.border}` }}
             className="rounded-xl p-3 md:p-4 flex items-center gap-2 md:gap-3">
          <div style={{ background: card.color + "18", borderRadius: 8, padding: 8, flexShrink: 0 }}>
            <card.icon size={18} color={card.color}/>
          </div>
          <div className="min-w-0">
            <p style={{ color: C.textMid, fontSize: 12 }} className="truncate">{card.label}</p>
            <p style={{ color: C.textDark }} className="text-lg md:text-xl font-bold">{card.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Instructions ─────────────────────────────────────────────────────────────
const Instructions = () => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: C.cardBg, border: `1px solid ${C.border}` }} className="rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3"
              style={{ background: "none", border: "none", cursor: "pointer" }}>
        <div className="flex items-center gap-2">
          <Info size={15} color={C.primary}/>
          <span style={{ color: C.textDark, fontWeight: 600, fontSize: 16 }}>How to Use the CAMRI Module</span>
        </div>
        <ChevronDown size={15} color={C.textMid}
                     style={{ transform: open ? "rotate(180deg)" : "none", transition: "0.2s" }}/>
      </button>

      {open && (
        <div style={{ borderTop: `1px solid ${C.border}` }} className="p-4 md:p-5 space-y-4">
          <div>
            <p style={{ color: C.textDark, fontWeight: 600, fontSize: 15 }} className="mb-3">Steps</p>
            <div className="space-y-2.5">
              {[
                { n: 1, title: "Download templates", body: 'Click "Download template" above each upload zone to get the pre-formatted ARB and ARG Excel files.' },
                { n: 2, title: "Fill in your data",  body: "Row 1 = units (CFU/mL for ARB, copies/mL for ARG). Row 2 = headers (Sample_ID, Site, Month, Date, Category, Sub_category, data columns). Row 3+ = data. Use absolute concentrations." },
                { n: 3, title: "Upload both files",  body: "Drop your completed ARB and ARG Excel files. Samples are matched by Sample_ID — unmatched samples are excluded." },
                { n: 4, title: "Set α and calculate",body: "Adjust α weighting if needed (default 0.6 from Goh et al. 2022, constrained to > 0.5). Click Calculate CAMRI to run the full 6-step pipeline." },
              ].map(s => (
                <div key={s.n} className="flex gap-3 items-start">
                  <div style={{ background: C.primary, color: "white", borderRadius: "50%", width: 22, height: 22,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 13, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>
                    {s.n}
                  </div>
                  <div>
                    <span style={{ color: C.textDark, fontWeight: 600, fontSize: 15 }}>{s.title} — </span>
                    <span style={{ color: C.textMid, fontSize: 14 }}>{s.body}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "#F8FAFC", border: `1px solid ${C.border}`, borderRadius: 10 }} className="p-3 md:p-4">
            <p style={{ color: C.textDark, fontWeight: 600, fontSize: 15 }} className="mb-2.5">CAMRI Pipeline (Goh et al. 2022)</p>
            <div className="space-y-2">
              {[
                ["Steps 1–2", "Build K×M (ARB) and K×N (ARG) matrices; min-max scale each analyte column to [0, 1]"],
                ["Step 3",    "Multiply by burden coefficients: ARB → DALY weights (Cassini 2019); ARG → ARG-Ranker scores (Zhang 2019)"],
                ["Step 4",    "Sum weighted scores across all analytes → S_ARB and S_ARG per sample"],
                ["Step 5",    "Normalise S_ARB and S_ARG to [0, 1] → ℜ_ARB and ℜ_ARG"],
                ["Step 6",    "Combine: ℜ_AMR = α × ℜ_ARB + (1−α) × ℜ_ARG  (α > 0.5, ARBs always weighted more)"],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-3 items-start">
                  <span style={{ background: C.primary + "18", color: C.primary, fontWeight: 700,
                                 fontSize: 13, padding: "2px 7px", borderRadius: 5, flexShrink: 0, marginTop: 1 }}>
                    {k}
                  </span>
                  <span style={{ color: C.textMid, fontSize: 14 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8 }} className="px-3 py-2.5 flex items-start gap-2">
            <AlertTriangle size={14} color={C.yellow} style={{ flexShrink: 0, marginTop: 1 }}/>
            <p style={{ color: "#92400E", fontSize: 14 }}>
              <strong>Reference:</strong> Goh et al. (2022) <em>Journal of Hazardous Materials</em>.
              ARB coefficients from Cassini et al. (2019) DALY database.
              ARG coefficients from Zhang et al. (2019) ARG Ranker.
              Results are relative indices (0–1), not absolute risk estimates.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Empty state ──────────────────────────────────────────────────────────────
const EmptyState = ({ icon: Icon, title, sub }) => (
  <div className="flex flex-col items-center justify-center py-14 gap-3">
    <div style={{ background: "#F1F5F9", borderRadius: "50%", padding: 20 }}>
      <Icon size={32} color="#94A3B8"/>
    </div>
    <p style={{ color: "#0F172A", fontWeight: 600, fontSize: 17 }}>{title}</p>
    <p style={{ color: "#94A3B8", fontSize: 15 }}>{sub}</p>
  </div>
);

// ─── Single-file drop zone ────────────────────────────────────────────────────
const FileZone = ({ label, file, onFile, inputId, subtext }) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const handleDrop = useCallback(e => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) onFile(f);
  }, [onFile]);
  const clearFile = useCallback(e => {
    e.stopPropagation();
    onFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [onFile]);
  return (
    <label htmlFor={inputId}
         onDragOver={e => { e.preventDefault(); setDragging(true); }}
         onDragLeave={() => setDragging(false)}
         onDrop={handleDrop}
         style={{
           border: `2px dashed ${file ? C.primary : dragging ? C.primary : C.border}`,
           background: file ? "#EDE9FE" : dragging ? "#EDE9FE" : "#F8FAFC",
           transition: "all 0.2s",
           position: "relative",
           display: "block",
         }}
         className="rounded-xl p-4 text-center cursor-pointer hover:border-violet-400 hover:bg-violet-50">
      <input ref={inputRef} id={inputId} type="file" accept=".xlsx,.xls" className="hidden"
             onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]); }}/>
      {file && (
        <button onClick={e => { e.preventDefault(); clearFile(e); }}
                style={{ position:"absolute", top:8, right:8, background:"white",
                         border:`1px solid ${C.border}`, borderRadius:"50%",
                         width:24, height:24, display:"flex", alignItems:"center",
                         justifyContent:"center", cursor:"pointer", flexShrink:0 }}>
          <X size={13} color={C.textMid}/>
        </button>
      )}
      {file
        ? <CheckCircle className="mx-auto mb-1" size={22} color={C.primary}/>
        : <Upload      className="mx-auto mb-1" size={22} color={C.textLight}/>}
      <p style={{ color: file ? C.primary : C.textDark, fontWeight: 600, fontSize: 14 }}>
        {file ? file.name : label}
      </p>
      <p style={{ color: C.textMid, fontSize: 12, marginTop: 2 }}>
        {file ? `${(file.size / 1024).toFixed(1)} KB · click to change` : (subtext ?? "Drop .xlsx or .xls")}
      </p>
    </label>
  );
};

// ─── Heatmap cell colouring ───────────────────────────────────────────────────
function heatCell(val, maxVal, hiColor = [124, 58, 237]) {
  const t = maxVal > 0 ? Math.min(val / maxVal, 1) : 0;
  const [hr, hg, hb] = hiColor;
  const r = Math.round(255 + t * (hr - 255));
  const g = Math.round(255 + t * (hg - 255));
  const b = Math.round(255 + t * (hb - 255));
  return { bg: `rgb(${r},${g},${b})`, fg: t > 0.45 ? "white" : "#0F172A" };
}

// ─── Box-plot statistics ──────────────────────────────────────────────────────
function boxStats(vals) {
  if (!vals.length) return null;
  const s = [...vals].sort((a, b) => a - b);
  const n = s.length;
  const q = p => {
    const pos = p * (n - 1);
    const lo = Math.floor(pos), hi = Math.ceil(pos);
    return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (pos - lo);
  };
  return { min: s[0], q1: q(0.25), median: q(0.5), q3: q(0.75), max: s[n - 1],
           mean: vals.reduce((a, b) => a + b, 0) / n, count: n };
}

// ─── Site colour palette ──────────────────────────────────────────────────────
const SITE_PALETTE = ["#7C3AED","#2563EB","#059669","#D97706","#DC2626","#0D9488","#9333EA","#EA580C","#BE185D","#0369A1"];

// ─── Site box-plot component ──────────────────────────────────────────────────
const SiteBoxPlot = ({ results, scoreKey, scoreLabel, siteCols, thresholds = DEFAULT_RISK_LEVELS }) => {
  const [tooltip, setTooltip] = useState(null); // { data, riskCounts, clientX, clientY }

  const sites    = [...new Set(results.map(r => r.site))];
  const siteData = sites
    .map(site => {
      const rows = results.filter(r => r.site === site);
      const vals = rows.map(r => r[scoreKey] ?? 0);
      const riskCounts = { Low: 0, Medium: 0, High: 0 };
      rows.forEach(r => { riskCounts[r.risk_level] = (riskCounts[r.risk_level] || 0) + 1; });
      return { site, riskCounts, ...boxStats(vals) };
    })
    .filter(d => d && d.count > 0);

  if (!siteData.length) return (
    <div className="flex flex-col items-center justify-center py-14 gap-3">
      <MapPin size={32} color={C.textLight}/>
      <p style={{ color: C.textMid, fontWeight: 600 }}>No site data available</p>
    </div>
  );

  const nSites = siteData.length;
  const BOX_W  = 50;
  const PAD    = { top: 20, right: 44, bottom: 72, left: 52 };
  const svgH   = 300;
  const colW   = Math.max(BOX_W + 40, 90);
  const plotW  = nSites * colW;
  const svgW   = PAD.left + plotW + PAD.right;
  const plotH  = svgH - PAD.top - PAD.bottom;
  const ys     = v => PAD.top + plotH * (1 - v);
  const xs     = i => PAD.left + (i + 0.5) * colW;
  const half   = BOX_W / 2;
  const capW   = BOX_W / 4;
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];

  const handleEnter = (d) => (e) => setTooltip({ data: d, clientX: e.clientX, clientY: e.clientY });
  const handleMove  = (d) => (e) => setTooltip(t => t ? { ...t, clientX: e.clientX, clientY: e.clientY } : null);
  const handleLeave = () => setTooltip(null);

  return (
    <>
      <div style={{ overflowX: "auto" }}>
        <svg width={svgW} height={svgH} style={{ fontFamily: "'Inter', sans-serif", display: "block" }}>
          {[...thresholds].sort((a, b) => a.min - b.min).map(t => {
            const top = t.max != null ? Number(t.max) : 1.0;
            const bot = Number(t.min);
            return (
              <rect key={t.label} x={PAD.left} y={ys(top)} width={plotW}
                    height={Math.max(ys(bot) - ys(top), 0)} fill={t.color + "12"}/>
            );
          })}
          {yTicks.map(t => (
            <g key={t}>
              <line x1={PAD.left} y1={ys(t)} x2={PAD.left + plotW} y2={ys(t)} stroke={C.border} strokeDasharray="3 3"/>
              <text x={PAD.left - 6} y={ys(t)} textAnchor="end" dominantBaseline="middle"
                    fill={C.textLight} fontSize={11}>{t.toFixed(2)}</text>
            </g>
          ))}
          {thresholds.filter(t => t.min > 0).map(t => (
            <text key={t.label} x={PAD.left + plotW + 4} y={ys(Number(t.min))}
                  fill={t.color} fontSize={9} dominantBaseline="middle">
              {Number(t.min).toFixed(2)}
            </text>
          ))}
          <text x={14} y={PAD.top + plotH / 2} textAnchor="middle" fill={C.textMid} fontSize={12}
                transform={`rotate(-90, 14, ${PAD.top + plotH / 2})`}>{scoreLabel}</text>
          <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + plotH} stroke={C.border} strokeWidth={1}/>
          <line x1={PAD.left} y1={PAD.top + plotH} x2={PAD.left + plotW} y2={PAD.top + plotH} stroke={C.border} strokeWidth={1}/>
          {siteData.map((d, i) => {
            const x      = xs(i);
            const col    = siteCols[d.site] ?? SITE_PALETTE[i % SITE_PALETTE.length];
            const hovered = tooltip?.data?.site === d.site;
            return (
              <g key={d.site} style={{ cursor: "pointer" }}
                 onMouseEnter={handleEnter(d)}
                 onMouseMove={handleMove(d)}
                 onMouseLeave={handleLeave}>
                {/* hover zone + highlight */}
                <rect x={x - colW / 2} y={PAD.top} width={colW} height={plotH}
                      fill={hovered ? col + "12" : "transparent"} rx={3}/>
                {/* upper whisker */}
                <line x1={x} y1={ys(d.q3)} x2={x} y2={ys(d.max)} stroke={col} strokeWidth={1.5}/>
                <line x1={x - capW} y1={ys(d.max)} x2={x + capW} y2={ys(d.max)} stroke={col} strokeWidth={1.5}/>
                {/* lower whisker */}
                <line x1={x} y1={ys(d.q1)} x2={x} y2={ys(d.min)} stroke={col} strokeWidth={1.5}/>
                <line x1={x - capW} y1={ys(d.min)} x2={x + capW} y2={ys(d.min)} stroke={col} strokeWidth={1.5}/>
                {/* IQR box */}
                <rect x={x - half} y={ys(d.q3)} width={BOX_W}
                      height={Math.max(ys(d.q1) - ys(d.q3), 1)}
                      fill={col + "28"} stroke={col} strokeWidth={hovered ? 2 : 1.5} rx={2}/>
                {/* median */}
                <line x1={x - half} y1={ys(d.median)} x2={x + half} y2={ys(d.median)}
                      stroke={col} strokeWidth={hovered ? 3 : 2.5}/>
                {/* mean dot */}
                <circle cx={x} cy={ys(d.mean)} r={hovered ? 4 : 3} fill={col} stroke="white" strokeWidth={1}/>
                {/* n label */}
                <text x={x} y={ys(d.min) + 12} textAnchor="middle" fill={C.textLight} fontSize={9}>
                  n={d.count}
                </text>
                {/* site label */}
                <text x={x} y={PAD.top + plotH + 16} textAnchor="end" fill={hovered ? col : C.textMid}
                      fontWeight={hovered ? 700 : 400} fontSize={11}
                      transform={`rotate(-35, ${x}, ${PAD.top + plotH + 16})`}>
                  {d.site.length > 14 ? d.site.slice(0, 14) + "…" : d.site}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex items-center gap-5 mt-2 flex-wrap" style={{ fontSize: 12, color: C.textMid }}>
        <div className="flex items-center gap-1.5">
          <div style={{ width: 20, height: 3, background: C.primary }}/>
          <span>Median</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.primary }}/>
          <span>Mean</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div style={{ width: 14, height: 14, background: C.primary + "28",
                        border: `1.5px solid ${C.primary}`, borderRadius: 2 }}/>
          <span>IQR (Q1–Q3)</span>
        </div>
        <span style={{ color: C.textLight }}>Hover a box for full statistics</span>
      </div>

      {/* ── Floating tooltip ── */}
      {tooltip && (
        <div style={{
          position: "fixed",
          left:  Math.min(tooltip.clientX + 16, window.innerWidth - 230),
          top:   Math.max(tooltip.clientY - 120, 8),
          background: "white",
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: "12px 16px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.13)",
          fontSize: 13,
          pointerEvents: "none",
          zIndex: 9999,
          minWidth: 200,
        }}>
          <p style={{ fontWeight: 700, color: C.textDark, fontSize: 14, marginBottom: 10 }}>
            {tooltip.data.site}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", rowGap: 4, columnGap: 10 }}>
            {[
              ["Samples",  tooltip.data.count,                             C.textDark],
              ["Max",      tooltip.data.max.toFixed(4),                    riskFromScore(tooltip.data.max, thresholds).color],
              ["Q3 (75%)", tooltip.data.q3.toFixed(4),                     C.textDark],
              ["Median",   tooltip.data.median.toFixed(4),                 C.textDark],
              ["Mean",     tooltip.data.mean.toFixed(4),                   C.primary],
              ["Q1 (25%)", tooltip.data.q1.toFixed(4),                     C.textDark],
              ["Min",      tooltip.data.min.toFixed(4),                    riskFromScore(tooltip.data.min, thresholds).color],
              ["IQR",      (tooltip.data.q3 - tooltip.data.q1).toFixed(4), C.textMid],
            ].flatMap(([k, v, col]) => [
              <span key={`k-${k}`} style={{ color: C.textMid, fontSize: 12 }}>{k}</span>,
              <span key={`v-${k}`} style={{ color: col, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{v}</span>,
            ])}
          </div>
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
            <p style={{ color: C.textLight, fontSize: 11, marginBottom: 5 }}>Risk breakdown</p>
            <div className="flex gap-2 flex-wrap">
              {[...thresholds].sort((a, b) => a.min - b.min).map(r => (
                <span key={r.label} style={{
                  background: r.color + "20", color: r.color,
                  border: `1px solid ${r.color}44`,
                  fontSize: 11, fontWeight: 700,
                  padding: "2px 8px", borderRadius: 999,
                }}>
                  {tooltip.data.riskCounts[r.label] ?? 0} {r.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ─── CAMRI Page ───────────────────────────────────────────────────────────────
export default function CAMRIPage() {
  const navigate = useNavigate();

  const [thresholds, setThresholds] = useState(DEFAULT_RISK_LEVELS);

  const [arbFile,    setArbFile]    = useState(null);
  const [argFile,    setArgFile]    = useState(null);
  const [alpha,      setAlpha]      = useState(0.6);
  const [validation, setValidation] = useState(null);
  const [validating, setValidating] = useState(false);
  const [validError, setValidError] = useState(null);

  const [results,     setResults]     = useState(null);
  const [calcMode,    setCalcMode]    = useState(null); // 'arb_only' | 'arg_only' | 'combined'
  const [calcMeta,    setCalcMeta]    = useState(null);
  const [sensitivity, setSensitivity] = useState(null);
  const [warnings,    setWarnings]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [apiError,    setApiError]    = useState(null);
  const [activeTab,   setActiveTab]   = useState("table");
  const [toast,       setToast]       = useState(null);
  const [tablePage,   setTablePage]   = useState(1);
  const [chartPage,   setChartPage]   = useState(1);
  const CHART_PAGE_SIZE = 25;
  const [sortCol,     setSortCol]     = useState(null);
  const [sortDir,     setSortDir]     = useState("asc");
  const [filterSite,  setFilterSite]  = useState("");
  const [filterRisk,  setFilterRisk]  = useState("");
  const [arbMatrix,   setArbMatrix]   = useState(null);
  const [argMatrix,   setArgMatrix]   = useState(null);
  const [arbKeys,     setArbKeys]     = useState([]);
  const [argKeys,     setArgKeys]     = useState([]);

  const TABLE_PAGE_SIZE = 20;

  // Load risk thresholds from module_config
  useEffect(() => {
    getModuleConfig('CAMRI')
      .then(cfg => {
        const levels = cfg.risk_thresholds?.levels;
        if (Array.isArray(levels) && levels.length > 0) setThresholds(levels);
      })
      .catch(() => {});
  }, []);

  // Auto-validate whenever both files are ready
  useEffect(() => {
    if (!arbFile || !argFile) { setValidation(null); setValidError(null); return; }
    let cancelled = false;
    (async () => {
      setValidating(true); setValidError(null); setValidation(null);
      try {
        const v = await validateCAMRI(arbFile, argFile);
        if (!cancelled) setValidation(v);
      } catch (err) {
        if (!cancelled) setValidError(err.message ?? "Validation failed");
      } finally {
        if (!cancelled) setValidating(false);
      }
    })();
    return () => { cancelled = true; };
  }, [arbFile, argFile]);

  const handleCalculate = async () => {
    if (!arbFile && !argFile) return;
    setLoading(true); setApiError(null);
    try {
      const json = await calculateCAMRI(arbFile, argFile, alpha);
      setResults(json.results ?? []);
      setCalcMode(json.mode ?? null);
      setCalcMeta(json.meta ?? null);
      setSensitivity(json.sensitivity ?? null);
      setWarnings(json.warnings ?? []);
      setArbMatrix(json.arb_matrix?.length ? json.arb_matrix : null);
      setArgMatrix(json.arg_matrix?.length ? json.arg_matrix : null);
      setArbKeys(json.arb_keys ?? []);
      setArgKeys(json.arg_keys ?? []);
      setTablePage(1); setChartPage(1); setSortCol(null); setSortDir("asc");
      setFilterSite(""); setFilterRisk("");
      setActiveTab("table");
    } catch (err) {
      setApiError(err.message ?? "Calculation failed. Please check your files and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateDownload = async (type) => {
    try {
      const blob = await downloadCAMRITemplate(type);
      triggerDownload(blob, `camri_${type}_template.xlsx`);
      setToast(`${type.toUpperCase()} template downloaded`);
    } catch {
      setToast("Template download failed");
    }
  };

  const handleSort = col => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
    setTablePage(1);
  };

  const siteOptions = useMemo(() => [...new Set(results?.map(r => r.site) ?? [])].sort(), [results]);

  const displayResults = useMemo(() => {
    if (!results) return [];
    let rows = [...results];
    if (filterSite) rows = rows.filter(r => r.site === filterSite);
    if (filterRisk) rows = rows.filter(r => r.risk_level === filterRisk);
    if (sortCol) {
      rows.sort((a, b) => {
        const av = a[sortCol] ?? ""; const bv = b[sortCol] ?? "";
        const cmp = typeof av === "number" && typeof bv === "number"
          ? av - bv : String(av).localeCompare(String(bv));
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return rows;
  }, [results, filterSite, filterRisk, sortCol, sortDir]);

  const siteCols = useMemo(() => {
    const sites = [...new Set(results?.map(r => r.site) ?? [])];
    return Object.fromEntries(sites.map((s, i) => [s, SITE_PALETTE[i % SITE_PALETTE.length]]));
  }, [results]);

  const amrChartData = useMemo(() =>
    results?.map(r => ({ name: r.sample_id, site: r.site, r_arb: r.r_arb ?? 0, r_arg: r.r_arg ?? 0, r_amr: r.r_amr ?? 0 })) ?? [],
  [results]);

  // Score key and label for the primary score chart (mode-aware)
  const scoreKey   = calcMode === 'arg_only' ? 'r_arg' : calcMode === 'arb_only' ? 'r_arb' : 'r_amr';
  const scoreLabel = calcMode === 'arg_only' ? 'ℜ_ARG' : calcMode === 'arb_only' ? 'ℜ_ARB' : 'ℜ_AMR';

  const sensChartData = useMemo(() => {
    if (!sensitivity || !results) return [];
    return results.map((r, i) => ({
      name:    r.sample_id,
      "α=0.6": +(sensitivity["0.6"]?.[i] ?? 0).toFixed(3),
      "α=0.7": +(sensitivity["0.7"]?.[i] ?? 0).toFixed(3),
      "α=0.8": +(sensitivity["0.8"]?.[i] ?? 0).toFixed(3),
      "α=0.9": +(sensitivity["0.9"]?.[i] ?? 0).toFixed(3),
    }));
  }, [sensitivity, results]);

  const arbHeatMax = useMemo(() => {
    if (!arbMatrix?.length) return 0;
    let max = 0;
    for (const row of arbMatrix) for (const v of row) if (v > max) max = v;
    return max;
  }, [arbMatrix]);

  const argHeatMax = useMemo(() => {
    if (!argMatrix?.length) return 0;
    let max = 0;
    for (const row of argMatrix) for (const v of row) if (v > max) max = v;
    return max;
  }, [argMatrix]);

  const isCombined = !!(arbFile && argFile);
  const canCalculate = !loading && !!(arbFile || argFile) && (
    !isCombined ||
    (!validating && validation?.site_validation?.valid === true)
  );

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <Header accent="#7C3AED"/>
      <NavBar/>

      <main className="p-3 md:p-6 max-w-screen-xl mx-auto space-y-4 md:space-y-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1" style={{ color: C.textMid, fontSize: 14 }}>
          <button onClick={() => navigate("/")}
                  style={{ color: C.primary, fontWeight: 500, background: "none",
                           border: "none", cursor: "pointer", padding: 0, fontSize: 14 }}>
            Home
          </button>
          <ChevronRight size={13}/>
          <span style={{ color: C.primary, fontWeight: 600, fontSize: 14 }}>CAMRI</span>
        </div>

        {/* ── Pre-results ── */}
        {!results && (
          <div className="space-y-4">
            <Instructions/>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.6fr] gap-4 md:gap-6">

              {/* Left: Algorithm + Risk levels */}
              <div className="space-y-3 md:space-y-4">

                <div style={{ background: C.cardBg, border: `1px solid ${C.border}` }} className="rounded-xl p-4 md:p-5">
                  <h3 style={{ color: C.textDark }} className="font-semibold mb-3 flex items-center gap-2 text-sm md:text-base">
                    <Activity size={15} color={C.primary}/> CAMRI Formula
                  </h3>
                  <div style={{ background: "#EDE9FE", border: "1px solid #DDD6FE", borderRadius: 10 }} className="p-3 md:p-4 space-y-3">
                    {[
                      { label: "ℜ_AMR", eq: "α × ℜ_ARB + (1−α) × ℜ_ARG", desc: "Final AMR burden index" },
                      { label: "ℜ_ARB", eq: "minmax( Σ N_arb × w_arb )",   desc: "Normalised ARB track"    },
                      { label: "ℜ_ARG", eq: "minmax( Σ N_arg × w_arg )",   desc: "Normalised ARG track"    },
                    ].map(f => (
                      <div key={f.label} className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <span style={{ color: C.primary, fontWeight: 700, fontSize: 16 }}>{f.label}</span>
                          <span style={{ color: C.textMid, fontSize: 13 }} className="ml-1">{f.desc}</span>
                        </div>
                        <span style={{ color: C.primary, fontWeight: 600, fontSize: 14, background: "white",
                                       padding: "2px 8px", borderRadius: 6, border: "1px solid #DDD6FE", flexShrink: 0 }}>
                          = {f.eq}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 space-y-1" style={{ fontSize: 13, color: C.textMid }}>
                    {[
                      ["N_arb/N_arg", "Min-max scaled concentrations per analyte"],
                      ["w_arb",       "ARB burden weight (Cassini 2019 DALY)"],
                      ["w_arg",       "ARG burden weight (Zhang 2019 ARG Ranker)"],
                      ["α",           "ARB track weight — must be > 0.5 (ARBs weighted more)"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span style={{ color: C.primary, fontWeight: 600, minWidth: 80 }}>{k}</span>
                        <span>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ background: C.cardBg, border: `1px solid ${C.border}` }} className="rounded-xl p-4 md:p-5">
                  <h3 style={{ color: C.textDark }} className="font-semibold mb-3 text-sm md:text-base">
                    CAMRI Risk Levels
                  </h3>
                  {[...thresholds].sort((a, b) => a.min - b.min).map(l => (
                    <div key={l.label} style={{ background: l.color + "18", borderRadius: 8, marginBottom: 6 }}
                         className="flex items-center gap-2 px-3 py-2">
                      <CheckCircle size={14} color={l.color}/>
                      <span style={{ color: l.color, fontWeight: 700, fontSize: 14, minWidth: 120 }}>
                        r_AMR {l.max != null ? `< ${Number(l.max).toFixed(2)}` : `≥ ${Number(l.min).toFixed(2)}`}
                      </span>
                      <span style={{ color: l.color, fontSize: 13 }}>{l.label}</span>
                    </div>
                  ))}
                  <p style={{ color: C.textLight, fontSize: 13, marginTop: 8 }}>
                    ℜ_AMR is a relative index 0–1 · higher = greater AMR burden vs. other samples
                  </p>
                  <div style={{ background: "#F8FAFC", border: `1px solid ${C.border}`,
                                borderRadius: 7, marginTop: 8 }}
                       className="px-3 py-2 flex items-start gap-2">
                    <Info size={12} color={C.textLight} style={{ flexShrink: 0, marginTop: 1 }}/>
                    <p style={{ color: C.textLight, fontSize: 12, lineHeight: 1.5 }}>
                      Thresholds adapted from{" "}
                      <strong style={{ color: C.textMid }}>Goh et al. (2022)</strong>{" "}
                      <em>J. Hazardous Materials</em>, Table 2.
                      Configurable via module settings.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: Upload panel */}
              <div style={{ background: C.cardBg, border: `1px solid ${C.border}` }} className="rounded-xl p-4 md:p-6">
                <h2 style={{ color: C.textDark }} className="font-bold text-sm md:text-base mb-1">Upload Sample Data</h2>
                <p style={{ color: C.textMid }} className="text-xs md:text-sm mb-4">
                  Upload an ARB file (antibiotic-resistant bacteria, CFU/mL) and an ARG file
                  (resistance genes, copies/mL). Samples are matched by Sample_ID.
                  The tool runs the 6-step CAMRI pipeline (Goh et al. 2022).
                </p>

                {apiError && (
                  <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 10 }}
                       className="flex items-start gap-2 px-3 py-2.5 mb-3">
                    <XCircle size={15} color={C.accent} style={{ flexShrink: 0, marginTop: 1 }}/>
                    <span style={{ color: C.accent, fontSize: 14 }}>{apiError}</span>
                  </div>
                )}

                {loading ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <Loader2 size={32} color={C.primary} className="animate-spin"/>
                    <p style={{ color: C.textMid, fontSize: 15 }}>Calculating CAMRI scores…</p>
                  </div>
                ) : (
                  <div className="space-y-3">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <p style={{ color: C.textDark, fontWeight: 600, fontSize: 14 }}>ARB File</p>
                        <FileZone label="Drop ARB Excel file here" file={arbFile} onFile={setArbFile}
                                  inputId="arbInput" subtext="Supports .xlsx or .xls · Based on the ARB input template"/>
                        <div style={{ background: "#EDE9FE", border: "1px solid #DDD6FE" }}
                             className="rounded-lg px-3 py-2.5 flex items-start gap-2">
                          <Info size={14} color={C.primary} style={{ flexShrink: 0, marginTop: 1 }}/>
                          <span style={{ color: C.primary }} className="text-xs md:text-sm">
                            First time?&nbsp;
                            <button className="underline font-semibold"
                                    style={{ background: "none", border: "none", cursor: "pointer",
                                             color: C.primary, padding: 0, fontSize: "inherit" }}
                                    onClick={() => handleTemplateDownload("arb")}>
                              Download the ARB input template
                            </button>
                            &nbsp;to ensure correct column structure.
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p style={{ color: C.textDark, fontWeight: 600, fontSize: 14 }}>ARG File</p>
                        <FileZone label="Drop ARG Excel file here" file={argFile} onFile={setArgFile}
                                  inputId="argInput" subtext="Supports .xlsx or .xls · Based on the ARG input template"/>
                        <div style={{ background: "#EDE9FE", border: "1px solid #DDD6FE" }}
                             className="rounded-lg px-3 py-2.5 flex items-start gap-2">
                          <Info size={14} color={C.primary} style={{ flexShrink: 0, marginTop: 1 }}/>
                          <span style={{ color: C.primary }} className="text-xs md:text-sm">
                            First time?&nbsp;
                            <button className="underline font-semibold"
                                    style={{ background: "none", border: "none", cursor: "pointer",
                                             color: C.primary, padding: 0, fontSize: "inherit" }}
                                    onClick={() => handleTemplateDownload("arg")}>
                              Download the ARG input template
                            </button>
                            &nbsp;to ensure correct column structure.
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Mode indicator */}
                    {(arbFile || argFile) && (
                      <div style={{
                        background: isCombined ? "#EDE9FE" : "#F0FDF4",
                        border: `1px solid ${isCombined ? "#DDD6FE" : "#BBF7D0"}`,
                        borderRadius: 8,
                      }} className="flex items-center gap-2 px-3 py-2">
                        <Activity size={13} color={isCombined ? C.primary : "#059669"}/>
                        <span style={{ fontWeight: 600, fontSize: 13, color: isCombined ? C.primary : "#059669" }}>
                          {isCombined ? "Combined mode — ARB + ARG → ℜ_AMR"
                            : arbFile  ? "ARB track only — ℜ_ARB score per sample"
                                       : "ARG track only — ℜ_ARG score per sample"}
                        </span>
                      </div>
                    )}

                    {/* Validation (combined mode only) */}
                    {isCombined && validating && (
                      <div style={{ background: "#EDE9FE", borderRadius: 8 }}
                           className="flex items-center gap-2 px-3 py-2.5">
                        <Loader2 size={14} color={C.primary} className="animate-spin"/>
                        <span style={{ color: C.primary, fontSize: 14 }}>Validating sample IDs…</span>
                      </div>
                    )}
                    {isCombined && validError && (
                      <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 8 }}
                           className="flex items-start gap-2 px-3 py-2">
                        <XCircle size={14} color={C.accent} style={{ flexShrink: 0, marginTop: 2 }}/>
                        <span style={{ color: C.accent, fontSize: 13 }}>{validError}</span>
                      </div>
                    )}
                    {isCombined && validation?.site_validation && (
                      <div style={{
                        background: validation.site_validation.valid ? "#F0FDF4" : "#FFFBEB",
                        border: `1px solid ${validation.site_validation.valid ? "#BBF7D0" : "#FDE68A"}`,
                        borderRadius: 8,
                      }} className="px-3 py-2.5 space-y-1">
                        <div className="flex items-center gap-2">
                          {validation.site_validation.valid
                            ? <CheckCircle size={14} color="#059669"/>
                            : <AlertTriangle size={14} color={C.yellow}/>}
                          <span style={{ fontWeight: 600, fontSize: 14,
                                         color: validation.site_validation.valid ? "#059669" : "#92400E" }}>
                            {validation.site_validation.matched.length} matched sample
                            {validation.site_validation.matched.length !== 1 ? "s" : ""}
                            {validation.site_validation.arb_only.length > 0
                              && ` · ${validation.site_validation.arb_only.length} ARB-only`}
                            {validation.site_validation.arg_only.length > 0
                              && ` · ${validation.site_validation.arg_only.length} ARG-only`}
                          </span>
                        </div>
                        {(validation.arb_unmatched_cols?.length > 0 || validation.arg_unmatched_cols?.length > 0) && (
                          <p style={{ color: "#92400E", fontSize: 13 }}>
                            Unrecognised columns (excluded):&nbsp;
                            {[...(validation.arb_unmatched_cols ?? []), ...(validation.arg_unmatched_cols ?? [])].join(", ")}
                          </p>
                        )}
                      </div>
                    )}

                    {/* α slider — combined mode only */}
                    {isCombined && (
                      <div style={{ background: "#F8FAFC", border: `1px solid ${C.border}`, borderRadius: 10 }}
                           className="px-3 py-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span style={{ color: C.textDark, fontWeight: 600, fontSize: 14 }}>
                            α (ARB weight):&nbsp;<span style={{ color: C.primary }}>{alpha.toFixed(2)}</span>
                          </span>
                          <span style={{ color: C.textMid, fontSize: 12 }}>ARG weight: {(1 - alpha).toFixed(2)}</span>
                        </div>
                        <input type="range" min="0.51" max="1.0" step="0.01" value={alpha}
                               onChange={e => setAlpha(Number(e.target.value))}
                               style={{ width: "100%", accentColor: C.primary }}/>
                        <p style={{ color: C.textLight, fontSize: 12, marginTop: 2 }}>
                          Default α = 0.6 (Goh et al. 2022) · must be &gt; 0.5 — ARBs always weighted more (Manaia 2017)
                        </p>
                      </div>
                    )}

                    <button onClick={handleCalculate} disabled={!canCalculate}
                            style={{ background: canCalculate ? C.primary : "#94A3B8",
                                     cursor: canCalculate ? "pointer" : "not-allowed" }}
                            className="w-full py-3 rounded-xl text-white font-semibold text-sm md:text-base flex items-center justify-center gap-2">
                      <Activity size={16}/>
                      {!arbFile && !argFile
                        ? "Upload at least one file to continue"
                        : isCombined && validating
                        ? "Validating…"
                        : isCombined && validation && !validation.site_validation?.valid
                        ? "No matched samples — check files"
                        : isCombined
                        ? "Calculate Combined CAMRI"
                        : arbFile
                        ? "Calculate ARB Track"
                        : "Calculate ARG Track"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {results && (
          <div className="space-y-4 md:space-y-5">
            <SummaryCards results={results} meta={calcMeta} thresholds={thresholds}/>

            <div style={{ background: C.cardBg, border: `1px solid ${C.border}` }} className="rounded-xl overflow-hidden">

              {/* Tab bar */}
              <div style={{ borderBottom: `1px solid ${C.border}` }} className="flex items-center">
                <div className="flex items-center overflow-x-auto whitespace-nowrap scrollbar-none flex-1">
                  {[
                    { id: "table",        label: "Data Table",         icon: FileText,   show: true              },
                    { id: "bysite",       label: "By Site",            icon: MapPin,     show: true },
                    { id: "amrscore",     label: `${scoreLabel} Chart`, icon: BarChart2, show: true      },
                    { id: "contribution", label: "Contributions",      icon: Layers,     show: calcMode === "combined" },
                    { id: "sensitivity",  label: "Sensitivity",        icon: TrendingUp, show: calcMode === "combined" },
                    { id: "arbheatmap",   label: "ARB Heatmap",        icon: Table,      show: calcMode === "arb_only" || calcMode === "combined" },
                    { id: "argheatmap",   label: "ARG Heatmap",        icon: Table,      show: calcMode === "arg_only" || calcMode === "combined" },
                  ].filter(t => t.show).map(tab => (
                    <button key={tab.id}
                            onClick={() => { setActiveTab(tab.id); setTablePage(1); setChartPage(1); }}
                            style={{
                              borderBottom: activeTab === tab.id ? `3px solid ${C.primary}` : "3px solid transparent",
                              color:        activeTab === tab.id ? C.primary : C.textMid,
                              fontWeight:   activeTab === tab.id ? 700 : 500,
                              flexShrink:   0,
                            }}
                            className="flex items-center gap-1.5 px-3 md:px-5 py-3 text-xs md:text-sm transition-all">
                      <tab.icon size={13}/> {tab.label}
                    </button>
                  ))}
                </div>
                <div className="px-3 md:px-4 flex items-center gap-2 flex-shrink-0">
                  <DownloadMenu results={results} meta={calcMeta} thresholds={thresholds} onToast={setToast} disabled={results.length === 0}/>
                </div>
              </div>

              {/* Tab content */}
              <div className="p-3 md:p-5">

                {/* ── Data Table ── */}
                {activeTab === "table" && (
                  <div>
                    {warnings.length > 0 && (
                      <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8 }}
                           className="px-3 py-2 mb-3 flex items-start gap-2">
                        <AlertTriangle size={14} color={C.yellow} style={{ flexShrink: 0, marginTop: 1 }}/>
                        <div style={{ fontSize: 13, color: "#92400E" }}>
                          {warnings.map((w, i) => <p key={i}>{w.message ?? String(w)}</p>)}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      <select value={filterSite} onChange={e => { setFilterSite(e.target.value); setTablePage(1); }}
                              style={{ border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13,
                                       padding: "4px 8px", color: filterSite ? C.primary : C.textMid,
                                       background: "white", cursor: "pointer" }}>
                        <option value="">All Sites</option>
                        {siteOptions.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <select value={filterRisk} onChange={e => { setFilterRisk(e.target.value); setTablePage(1); }}
                              style={{ border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13,
                                       padding: "4px 8px", color: filterRisk ? C.primary : C.textMid,
                                       background: "white", cursor: "pointer" }}>
                        <option value="">All Risk Levels</option>
                        {[...thresholds].sort((a,b) => a.min - b.min).map(l => <option key={l.label} value={l.label}>{l.label}</option>)}
                      </select>
                      {(filterSite || filterRisk) && (
                        <button onClick={() => { setFilterSite(""); setFilterRisk(""); setTablePage(1); }}
                                style={{ fontSize: 13, color: C.accent, border: `1px solid ${C.accent}33`,
                                         borderRadius: 7, padding: "4px 10px", background: "#FEF2F2", cursor: "pointer" }}>
                          Clear filters
                        </button>
                      )}
                      <span style={{ color: C.textMid, fontSize: 13, marginLeft: "auto" }}>
                        {displayResults.length} of {results.length} rows
                      </span>
                    </div>

                    <div className="overflow-x-auto -mx-3 md:mx-0 px-3 md:px-0">
                      <table className="w-full text-xs md:text-sm" style={{ minWidth: 700 }}>
                        <thead>
                          <tr style={{ background: "#F1F5F9" }}>
                            {[
                              { label: "#",          sortKey: null,         show: true                         },
                              { label: "Sample ID",  sortKey: "sample_id",  show: true                         },
                              { label: "Site",       sortKey: "site",       show: true                         },
                              { label: "Date",       sortKey: "date",       show: true                         },
                              { label: "Category",   sortKey: "category",   show: true                         },
                              { label: "r_ARB",      sortKey: "r_arb",      show: calcMode !== "arg_only"      },
                              { label: "r_ARG",      sortKey: "r_arg",      show: calcMode !== "arb_only"      },
                              { label: "r_AMR",      sortKey: "r_amr",      show: calcMode === "combined"      },
                              { label: "Risk Level", sortKey: "risk_level", show: true                         },
                            ].filter(c => c.show).map(col => (
                              <th key={col.label}
                                  onClick={() => col.sortKey && handleSort(col.sortKey)}
                                  className="px-2 md:px-3 py-2 text-left font-semibold"
                                  style={{ color: sortCol === col.sortKey && col.sortKey ? C.primary : C.textMid,
                                           fontSize: 13, cursor: col.sortKey ? "pointer" : "default",
                                           userSelect: "none", whiteSpace: "nowrap" }}>
                                {col.label}
                                {col.sortKey && (
                                  <span style={{ marginLeft: 3, opacity: sortCol === col.sortKey ? 1 : 0.3 }}>
                                    {sortCol === col.sortKey ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
                                  </span>
                                )}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {displayResults
                            .slice((tablePage - 1) * TABLE_PAGE_SIZE, tablePage * TABLE_PAGE_SIZE)
                            .map((r, i) => (
                              <tr key={r.sample_id}
                                  style={{ borderBottom: `1px solid ${C.border}`,
                                           background: i % 2 === 0 ? "white" : "#F8FAFC" }}
                                  className="hover:bg-violet-50 transition-colors">
                                <td className="px-2 md:px-3 py-2" style={{ color: C.textLight, fontSize: 12 }}>
                                  {(tablePage - 1) * TABLE_PAGE_SIZE + i + 1}
                                </td>
                                <td className="px-2 md:px-3 py-2" style={{ color: C.textDark, fontWeight: 600 }}>{r.sample_id}</td>
                                <td className="px-2 md:px-3 py-2" style={{ color: C.textMid }}>{r.site}</td>
                                <td className="px-2 md:px-3 py-2" style={{ color: C.textMid }}>{r.date}</td>
                                <td className="px-2 md:px-3 py-2" style={{ color: C.textMid }}>{r.category}</td>
                                {calcMode !== "arg_only" && (
                                  <td className="px-2 md:px-3 py-2" style={{ color: C.textDark, fontVariantNumeric: "tabular-nums" }}>
                                    {r.r_arb != null ? r.r_arb.toFixed(4) : "—"}
                                  </td>
                                )}
                                {calcMode !== "arb_only" && (
                                  <td className="px-2 md:px-3 py-2" style={{ color: C.textDark, fontVariantNumeric: "tabular-nums" }}>
                                    {r.r_arg != null ? r.r_arg.toFixed(4) : "—"}
                                  </td>
                                )}
                                {calcMode === "combined" && (
                                  <td className="px-2 md:px-3 py-2">
                                    <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums",
                                                   color: riskFromScore(r.r_amr ?? 0, thresholds).color }}>
                                      {r.r_amr != null ? r.r_amr.toFixed(4) : "—"}
                                    </span>
                                  </td>
                                )}
                                <td className="px-2 md:px-3 py-2"><RiskBadge label={r.risk_level} thresholds={thresholds}/></td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    <Pagination page={tablePage} total={displayResults.length}
                                pageSize={TABLE_PAGE_SIZE} onChange={setTablePage}/>
                  </div>
                )}

                {/* ── Score chart (mode-aware) ── */}
                {activeTab === "amrscore" && (
                  <div>
                    <p style={{ color: C.textMid, fontSize: 13, marginBottom: 16 }}>
                      {calcMode === "combined"
                        ? `Combined AMR burden index ℜ_AMR per sample (α = ${calcMeta?.alpha ?? alpha.toFixed(2)}) · bars coloured by site`
                        : calcMode === "arb_only"
                        ? "Normalised ARB burden score ℜ_ARB per sample · bars coloured by site"
                        : "Normalised ARG burden score ℜ_ARG per sample · bars coloured by site"}
                    </p>
                    {amrChartData.length === 0
                      ? <EmptyState icon={BarChart2} title="No data" sub="Calculate to see this chart."/>
                      : (() => {
                          const pageData = amrChartData.slice((chartPage - 1) * CHART_PAGE_SIZE, chartPage * CHART_PAGE_SIZE);
                          return (
                            <>
                              <ResponsiveContainer width="100%" height={340}>
                                <BarChart data={pageData} margin={{ top: 8, right: 16, left: 0, bottom: 70 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.textMid }}
                                         angle={-40} textAnchor="end" interval={0}/>
                                  <YAxis domain={[0, 1]} tick={{ fontSize: 11, fill: C.textMid }}
                                         label={{ value: scoreLabel, angle: -90, position: "insideLeft",
                                                  fill: C.textMid, fontSize: 12 }}/>
                                  <Tooltip content={({ active, payload }) => {
                                    if (!active || !payload?.length) return null;
                                    const d = payload[0].payload;
                                    const score = d[scoreKey] ?? 0;
                                    const rv = riskFromScore(score, thresholds);
                                    return (
                                      <div style={{ background: "white", border: `1px solid ${C.border}`,
                                                    borderRadius: 8, padding: "10px 14px", fontSize: 13,
                                                    boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}>
                                        <p style={{ fontWeight: 700, color: C.textDark, marginBottom: 4 }}>{d.name}</p>
                                        <p style={{ color: C.textMid }}>Site: {d.site}</p>
                                        {calcMode !== "arg_only" && <p style={{ color: C.textMid }}>ℜ_ARB: {d.r_arb.toFixed(4)}</p>}
                                        {calcMode !== "arb_only" && <p style={{ color: C.textMid }}>ℜ_ARG: {d.r_arg.toFixed(4)}</p>}
                                        <p style={{ color: rv.color, fontWeight: 700 }}>{scoreLabel}: {score.toFixed(4)} — {rv.label}</p>
                                      </div>
                                    );
                                  }}/>
                                  <Bar dataKey={scoreKey} name={scoreLabel} radius={[3, 3, 0, 0]}>
                                    {pageData.map((d, i) => (
                                      <Cell key={i} fill={siteCols[d.site] ?? C.primary}/>
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                              <div className="flex items-center justify-between flex-wrap gap-3 mt-3">
                                <div className="flex flex-wrap gap-3">
                                  {Object.entries(siteCols).map(([site, col]) => (
                                    <div key={site} className="flex items-center gap-1.5">
                                      <div style={{ width: 10, height: 10, borderRadius: 2, background: col, flexShrink: 0 }}/>
                                      <span style={{ color: C.textMid, fontSize: 13 }}>{site}</span>
                                    </div>
                                  ))}
                                </div>
                                {amrChartData.length > CHART_PAGE_SIZE && (
                                  <Pagination page={chartPage} total={amrChartData.length}
                                              pageSize={CHART_PAGE_SIZE} onChange={setChartPage}/>
                                )}
                              </div>
                            </>
                          );
                        })()}
                  </div>
                )}

                {/* ── Contributions chart ── */}
                {activeTab === "contribution" && (
                  <div>
                    <p style={{ color: C.textMid, fontSize: 13, marginBottom: 16 }}>
                      Normalised ARB track (ℜ_ARB) vs ARG track (ℜ_ARG) per sample — shows relative driver of overall score
                    </p>
                    {amrChartData.length === 0
                      ? <EmptyState icon={Layers} title="No data" sub="Calculate to see contributions."/>
                      : (() => {
                          const pageData = amrChartData.slice((chartPage - 1) * CHART_PAGE_SIZE, chartPage * CHART_PAGE_SIZE);
                          return (
                            <>
                              <ResponsiveContainer width="100%" height={340}>
                                <BarChart data={pageData} margin={{ top: 8, right: 16, left: 0, bottom: 70 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.textMid }}
                                         angle={-40} textAnchor="end" interval={0}/>
                                  <YAxis domain={[0, 1]} tick={{ fontSize: 11, fill: C.textMid }}/>
                                  <Tooltip content={({ active, payload }) => {
                                    if (!active || !payload?.length) return null;
                                    const d = payload[0].payload;
                                    return (
                                      <div style={{ background: "white", border: `1px solid ${C.border}`,
                                                    borderRadius: 8, padding: "10px 14px", fontSize: 13,
                                                    boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}>
                                        <p style={{ fontWeight: 700, color: C.textDark, marginBottom: 4 }}>{d.name}</p>
                                        <p style={{ color: "#7C3AED" }}>ℜ_ARB (Bacteria): {d.r_arb.toFixed(4)}</p>
                                        <p style={{ color: "#2563EB" }}>ℜ_ARG (Genes): {d.r_arg.toFixed(4)}</p>
                                      </div>
                                    );
                                  }}/>
                                  <Legend verticalAlign="top" wrapperStyle={{ fontSize: 13, paddingBottom: 8 }}/>
                                  <Bar dataKey="r_arb" name="ℜ_ARB (Bacteria)" fill="#7C3AED" radius={[3, 3, 0, 0]}/>
                                  <Bar dataKey="r_arg" name="ℜ_ARG (Genes)"    fill="#2563EB" radius={[3, 3, 0, 0]}/>
                                </BarChart>
                              </ResponsiveContainer>
                              {amrChartData.length > CHART_PAGE_SIZE && (
                                <div className="flex justify-end mt-3">
                                  <Pagination page={chartPage} total={amrChartData.length}
                                              pageSize={CHART_PAGE_SIZE} onChange={setChartPage}/>
                                </div>
                              )}
                            </>
                          );
                        })()}
                  </div>
                )}

                {/* ── Sensitivity chart ── */}
                {activeTab === "sensitivity" && (
                  <div>
                    <p style={{ color: C.textMid, fontSize: 13, marginBottom: 16 }}>
                      How ℜ_AMR scores shift as α varies from 0.6 to 0.9 · samples with greater ARB/ARG divergence show wider spread
                    </p>
                    {sensChartData.length === 0
                      ? <EmptyState icon={TrendingUp} title="No data" sub="Calculate to see sensitivity analysis."/>
                      : (() => {
                          const pageData = sensChartData.slice((chartPage - 1) * CHART_PAGE_SIZE, chartPage * CHART_PAGE_SIZE);
                          return (
                            <>
                              <ResponsiveContainer width="100%" height={340}>
                                <LineChart data={pageData} margin={{ top: 8, right: 16, left: 0, bottom: 70 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.textMid }}
                                         angle={-40} textAnchor="end" interval={0}/>
                                  <YAxis domain={[0, 1]} tick={{ fontSize: 11, fill: C.textMid }}
                                         label={{ value: "ℜ_AMR", angle: -90, position: "insideLeft",
                                                  fill: C.textMid, fontSize: 12 }}/>
                                  <Tooltip contentStyle={{ fontSize: 13, borderRadius: 8, border: `1px solid ${C.border}` }}/>
                                  <Legend verticalAlign="top" wrapperStyle={{ fontSize: 13, paddingBottom: 8 }}/>
                                  <Line type="monotone" dataKey="α=0.6" stroke="#7C3AED" strokeWidth={2} dot={{ r: 3 }}/>
                                  <Line type="monotone" dataKey="α=0.7" stroke="#2563EB" strokeWidth={2} dot={{ r: 3 }}/>
                                  <Line type="monotone" dataKey="α=0.8" stroke="#059669" strokeWidth={2} dot={{ r: 3 }}/>
                                  <Line type="monotone" dataKey="α=0.9" stroke="#D97706" strokeWidth={2} dot={{ r: 3 }}/>
                                </LineChart>
                              </ResponsiveContainer>
                              {sensChartData.length > CHART_PAGE_SIZE && (
                                <div className="flex justify-end mt-3">
                                  <Pagination page={chartPage} total={sensChartData.length}
                                              pageSize={CHART_PAGE_SIZE} onChange={setChartPage}/>
                                </div>
                              )}
                            </>
                          );
                        })()}
                  </div>
                )}

                {/* ── ARB Heatmap ── */}
                {activeTab === "arbheatmap" && (
                  <div>
                    <p style={{ color: C.textMid, fontSize: 13, marginBottom: 12 }}>
                      Weighted ARB burden per sample and analyte — S_ARB = N_ARB × DALY coefficient (Cassini 2019).
                      Darker cells indicate higher weighted burden for that analyte.
                    </p>
                    {!arbMatrix || !arbMatrix.length
                      ? <EmptyState icon={Table} title="No ARB matrix data" sub="Calculate to see the heatmap."/>
                      : (
                        <div className="overflow-x-auto -mx-3 md:mx-0 px-3 md:px-0">
                          <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: "max-content" }}>
                            <thead>
                              <tr>
                                <th style={{ padding: "6px 10px", textAlign: "left", color: C.textMid,
                                             background: "#F1F5F9", border: `1px solid ${C.border}`,
                                             position: "sticky", left: 0, zIndex: 1, whiteSpace: "nowrap" }}>
                                  Sample ID
                                </th>
                                <th style={{ padding: "6px 10px", textAlign: "left", color: C.textMid,
                                             background: "#F1F5F9", border: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>
                                  Site
                                </th>
                                {arbKeys.map(k => (
                                  <th key={k} style={{ padding: "6px 10px", textAlign: "center", color: C.textMid,
                                                       background: "#F1F5F9", border: `1px solid ${C.border}`,
                                                       whiteSpace: "nowrap" }}>
                                    {k}
                                  </th>
                                ))}
                                <th style={{ padding: "6px 10px", textAlign: "center", color: C.primary,
                                             background: "#EDE9FE", border: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>
                                  ℜ_ARB
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {results.map((row, i) => {
                                const cells = arbMatrix[i] ?? [];
                                return (
                                  <tr key={row.sample_id}>
                                    <td style={{ padding: "5px 10px", border: `1px solid ${C.border}`,
                                                 fontWeight: 600, color: C.textDark, whiteSpace: "nowrap",
                                                 position: "sticky", left: 0, background: "white" }}>
                                      {row.sample_id}
                                    </td>
                                    <td style={{ padding: "5px 10px", border: `1px solid ${C.border}`,
                                                 color: C.textMid, whiteSpace: "nowrap" }}>
                                      {row.site}
                                    </td>
                                    {cells.map((val, j) => {
                                      const { bg, fg } = heatCell(val, arbHeatMax);
                                      return (
                                        <td key={j} title={`${arbKeys[j]}: ${val.toFixed(4)}`}
                                            style={{ padding: "5px 10px", border: `1px solid ${C.border}`,
                                                     background: bg, color: fg, textAlign: "center",
                                                     fontVariantNumeric: "tabular-nums" }}>
                                          {val.toFixed(3)}
                                        </td>
                                      );
                                    })}
                                    <td style={{ padding: "5px 10px", border: `1px solid ${C.border}`,
                                                 fontWeight: 700, textAlign: "center",
                                                 color: riskFromScore(row.r_arb ?? 0, thresholds).color,
                                                 fontVariantNumeric: "tabular-nums" }}>
                                      {row.r_arb != null ? row.r_arb.toFixed(4) : "—"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                  </div>
                )}

                {/* ── ARG Heatmap ── */}
                {activeTab === "argheatmap" && (
                  <div>
                    <p style={{ color: C.textMid, fontSize: 13, marginBottom: 12 }}>
                      Weighted ARG burden per sample and gene — S_ARG = N_ARG × ARG-Ranker score (Zhang 2019).
                      Darker cells indicate higher weighted burden for that resistance gene.
                    </p>
                    {!argMatrix || !argMatrix.length
                      ? <EmptyState icon={Table} title="No ARG matrix data" sub="Calculate to see the heatmap."/>
                      : (
                        <div className="overflow-x-auto -mx-3 md:mx-0 px-3 md:px-0">
                          <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: "max-content" }}>
                            <thead>
                              <tr>
                                <th style={{ padding: "6px 10px", textAlign: "left", color: C.textMid,
                                             background: "#F1F5F9", border: `1px solid ${C.border}`,
                                             position: "sticky", left: 0, zIndex: 1, whiteSpace: "nowrap" }}>
                                  Sample ID
                                </th>
                                <th style={{ padding: "6px 10px", textAlign: "left", color: C.textMid,
                                             background: "#F1F5F9", border: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>
                                  Site
                                </th>
                                {argKeys.map(k => (
                                  <th key={k} style={{ padding: "6px 10px", textAlign: "center", color: C.textMid,
                                                       background: "#F1F5F9", border: `1px solid ${C.border}`,
                                                       whiteSpace: "nowrap" }}>
                                    {k}
                                  </th>
                                ))}
                                <th style={{ padding: "6px 10px", textAlign: "center", color: "#2563EB",
                                             background: "#EFF6FF", border: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>
                                  ℜ_ARG
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {results.map((row, i) => {
                                const cells = argMatrix[i] ?? [];
                                return (
                                  <tr key={row.sample_id}>
                                    <td style={{ padding: "5px 10px", border: `1px solid ${C.border}`,
                                                 fontWeight: 600, color: C.textDark, whiteSpace: "nowrap",
                                                 position: "sticky", left: 0, background: "white" }}>
                                      {row.sample_id}
                                    </td>
                                    <td style={{ padding: "5px 10px", border: `1px solid ${C.border}`,
                                                 color: C.textMid, whiteSpace: "nowrap" }}>
                                      {row.site}
                                    </td>
                                    {cells.map((val, j) => {
                                      const { bg, fg } = heatCell(val, argHeatMax, [37, 99, 235]);
                                      return (
                                        <td key={j} title={`${argKeys[j]}: ${val.toFixed(4)}`}
                                            style={{ padding: "5px 10px", border: `1px solid ${C.border}`,
                                                     background: bg, color: fg, textAlign: "center",
                                                     fontVariantNumeric: "tabular-nums" }}>
                                          {val.toFixed(3)}
                                        </td>
                                      );
                                    })}
                                    <td style={{ padding: "5px 10px", border: `1px solid ${C.border}`,
                                                 fontWeight: 700, textAlign: "center",
                                                 color: riskFromScore(row.r_arg ?? 0, thresholds).color,
                                                 fontVariantNumeric: "tabular-nums" }}>
                                      {row.r_arg != null ? row.r_arg.toFixed(4) : "—"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                  </div>
                )}

                {/* ── By Site box plot ── */}
                {activeTab === "bysite" && (
                  <div>
                    <p style={{ color: C.textMid, fontSize: 13, marginBottom: 16 }}>
                      Distribution of {scoreLabel} scores per site — box shows IQR, whiskers show min/max,
                      line = median, dot = mean
                    </p>
                    <SiteBoxPlot results={results} scoreKey={scoreKey}
                                 scoreLabel={scoreLabel} siteCols={siteCols} thresholds={thresholds}/>
                  </div>
                )}

              </div>
            </div>

            <button onClick={() => {
                      setResults(null); setCalcMode(null); setCalcMeta(null); setSensitivity(null); setWarnings([]);
                      setArbMatrix(null); setArgMatrix(null); setArbKeys([]); setArgKeys([]);
                      setValidation(null); setArbFile(null); setArgFile(null); setApiError(null);
                    }}
                    style={{ border: `1px solid ${C.border}`, color: C.textMid }}
                    className="px-4 py-2 rounded-lg text-sm hover:bg-slate-50">
              ← Upload New File
            </button>
          </div>
        )}

      </main>

      <Footer/>

      {toast && <Toast message={toast} onDone={() => setToast(null)}/>}
    </div>
  );
}
