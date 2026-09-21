import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import {
  Upload, FileSpreadsheet, AlertTriangle, CheckCircle, XCircle,
  ChevronRight, Download, Info, Activity, Shield, Droplets,
  FileText, Table, FileDown, ChevronDown, Printer, CheckSquare,
  Loader2, MapPin, BarChart2, X,
} from "lucide-react";
import * as XLSX from "xlsx";

import Header        from "../components/Header";
import NavBar        from "../components/NavBar";
import Footer        from "../components/Footer";
import useBreakpoint from "../hooks/useBreakpoint";
import { calculateQMRA, getModuleConfig } from "../services/api";
import SensitivityHeatmap from "../components/SensitivityHeatmap";

// ─── Colour palette ──────────────────────────────────────────────────────────
// Same structural colours as RQPage. C.primary = teal to differentiate QMRA.
const C = {
  primary:   "#0D9488",
  accent:    "#DC2626",
  yellow:    "#D97706",
  bg:        "#F0F4F8",
  cardBg:    "#FFFFFF",
  border:    "#CBD5E1",
  textDark:  "#0F172A",
  textMid:   "#475569",
  textLight: "#94A3B8",
};

// ─── DALY thresholds — WHO benchmark 1×10⁻⁶ DALYs/person/year ───────────────
const DEFAULT_THRESHOLDS = [
  { label: "Below Threshold", min: 0,    max: 1e-6, color: "#059669" },
  { label: "Above Threshold", min: 1e-6, max: null,  color: "#DC2626" },
];
const WHO_BENCHMARK = 1e-6; // DALYs/person/year

export const riskFromDaly = (daly, thresholds = DEFAULT_THRESHOLDS) => {
  let result = thresholds[0];
  for (const t of thresholds) { if (daly >= t.min) result = t; }
  return { label: result.label, color: result.color, bg: result.color + "22" };
};

// ─── P(infection) threshold — EPA/WHO benchmark 1×10⁻⁴ annual probability ───
const DEFAULT_INFECTION_THRESHOLDS = [
  { label: "Below Threshold", min: 0,    max: 1e-4, color: "#059669" },
  { label: "Above Threshold", min: 1e-4, max: null,  color: "#DC2626" },
];
const riskFromPInfection = (p_annual, infThresholds = DEFAULT_INFECTION_THRESHOLDS) => {
  let result = infThresholds[0];
  for (const t of infThresholds) { if (p_annual >= t.min) result = t; }
  return { label: result.label, color: result.color, bg: result.color + "22" };
};

// ─── Pagination ──────────────────────────────────────────────────────────────
const Pagination = ({ page, total, pageSize, onChange }) => {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const getPages = () => {
    const delta = 2;
    const range = [];
    for (let i = Math.max(2, page - delta); i <= Math.min(totalPages - 1, page + delta); i++) range.push(i);
    if (page - delta > 2) range.unshift("...");
    if (page + delta < totalPages - 1) range.push("...");
    range.unshift(1);
    if (totalPages > 1) range.push(totalPages);
    return range;
  };

  const btnBase = { borderRadius: 6, padding: "3px 9px", fontSize: 14, border: `1px solid ${C.border}`, background: "white", color: C.textMid, cursor: "pointer" };

  return (
    <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
      <span style={{ color: C.textMid, fontSize: 14 }}>
        Showing {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="flex items-center gap-1 flex-wrap">
        <button onClick={() => onChange(page - 1)} disabled={page === 1}
                style={{ ...btnBase, color: page === 1 ? C.textLight : C.textMid }}>‹ Prev</button>
        {getPages().map((p, i) =>
          p === "..."
            ? <span key={`dot-${i}`} style={{ fontSize: 14, color: C.textLight, padding: "0 2px" }}>…</span>
            : <button key={p} onClick={() => onChange(p)}
                      style={{ ...btnBase, background: p === page ? C.primary : "white",
                               color: p === page ? "white" : C.textMid,
                               border: `1px solid ${p === page ? C.primary : C.border}` }}>
                {p}
              </button>
        )}
        <button onClick={() => onChange(page + 1)} disabled={page === totalPages}
                style={{ ...btnBase, color: page === totalPages ? C.textLight : C.textMid }}>Next ›</button>
      </div>
    </div>
  );
};

// ─── Pathogen badge (equivalent to CategoryBadge in RQPage) ──────────────────
const PATHOGEN_COLOURS = {
  "Escherichia":     { color: "#1D4ED8", bg: "#DBEAFE" },
  "Cryptosporidium": { color: "#7C3AED", bg: "#EDE9FE" },
  "Rotavirus":       { color: "#DC2626", bg: "#FEE2E2" },
  "Norovirus":       { color: "#EA580C", bg: "#FFEDD5" },
  "Campylobacter":   { color: "#0D9488", bg: "#CCFBF1" },
  "Salmonella":      { color: "#D97706", bg: "#FEF3C7" },
  "Giardia":         { color: "#059669", bg: "#DCFCE7" },
  "Adenovirus":      { color: "#9333EA", bg: "#F3E8FF" },
  "Klebsiella":      { color: "#1E40AF", bg: "#DBEAFE" },
  "Enterococcus":    { color: "#92400E", bg: "#FFEDD5" },
  // Legacy ARB display names
  "ESBL":            { color: "#B45309", bg: "#FEF3C7" },
  "MRSA":            { color: "#991B1B", bg: "#FEE2E2" },
  "VRE":             { color: "#92400E", bg: "#FFEDD5" },
};
const DEFAULT_PATHOGEN_COLOUR = { color: "#475569", bg: "#F1F5F9" };

const pathogenColour = (name) => {
  if (!name) return DEFAULT_PATHOGEN_COLOUR;
  const genus = name.split(" ")[0];
  return PATHOGEN_COLOURS[genus] ?? DEFAULT_PATHOGEN_COLOUR;
};

const PathogenBadge = ({ value }) => {
  const { color, bg } = pathogenColour(value);
  const short = value?.split(" ").slice(0, 2).join(" ") ?? value;
  return (
    <span title={value}
          style={{ background: bg, color, border: `1px solid ${color}33`,
                   fontSize: 12, fontWeight: 600, padding: "2px 7px",
                   borderRadius: 999, whiteSpace: "nowrap" }}>
      {short ?? "—"}
    </span>
  );
};

// ─── Risk badge ───────────────────────────────────────────────────────────────
const RiskBadge = ({ daly, thresholds }) => {
  const r = riskFromDaly(daly, thresholds);
  return (
    <span style={{ background: r.bg, color: r.color, border: `1px solid ${r.color}33` }}
          className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
      {r.label}
    </span>
  );
};

// ─── Scientific notation helper ───────────────────────────────────────────────
function fmtSci(val) {
  if (val == null || !isFinite(val)) return "—";
  if (val === 0) return "0";
  if (Math.abs(val) >= 0.01) return val.toFixed(4);
  const exp = Math.floor(Math.log10(Math.abs(val)));
  const man = (val / Math.pow(10, exp)).toFixed(2);
  return `${man}e${exp}`;
}

function fmtSciJsx(val) {
  if (val == null || !isFinite(val)) return <span style={{ color: C.textLight }}>—</span>;
  if (val === 0) return <span style={{ color: C.textLight }}>0</span>;
  if (Math.abs(val) >= 0.01) return val.toFixed(4);
  const exp = Math.floor(Math.log10(Math.abs(val)));
  const man = (val / Math.pow(10, exp)).toFixed(2);
  return <span>{man}×10<sup>{exp}</sup></span>;
}

// ─── Download utilities ───────────────────────────────────────────────────────
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function downloadCSV(data, thresholds, infectionThresholds) {
  const hasDdaly = data.some(r => r.d_daly != null);
  const headers = ["#", "Site", "Date", "Sample Type", "Exposure Type", "Pathogen", "Strain", "Disease", "Dose-Response Model",
                   "Concentration", "ARB Concentration", "Unit", "Log Reduction", "Volume (L)", "Events/Year",
                   "Pathogenic Fraction", "Dose", "P(infection)", "P(annual)", "Infection Risk (≥10⁻⁴)", "P(illness)",
                   "DALYs/yr (baseline)", "CFR Baseline", "DALY Risk (≥10⁻⁶)",
                   ...(hasDdaly ? ["DALYs/yr (ARB)", "CFR Resistant", "dDALY", "DALY Risk (ARB)"] : [])];
  const rows = data.map((r, i) => [
    i + 1, r.site, r.date, r.sample_type, r.exposure_type ?? "", r.pathogen, r.strain, r.endpoint, r.model,
    r.concentration, r.arb_concentration ?? "", r.unit, r.log_reduction, r.volume_l, r.events_per_year,
    r.pathogenic_fraction,
    fmtSci(r.dose), fmtSci(r.p_infection), fmtSci(r.p_annual), riskFromPInfection(r.p_annual, infectionThresholds).label, fmtSci(r.p_illness),
    r.daly_baseline != null ? r.daly_baseline.toExponential(2) : r.daly.toExponential(2),
    r.cfr_baseline ?? "",
    riskFromDaly(r.daly, thresholds).label,
    ...(hasDdaly ? [
      r.daly_arb != null ? r.daly_arb.toExponential(2) : "",
      r.cfr_resistant ?? "",
      r.d_daly != null ? r.d_daly.toExponential(2) : "",
      r.risk_label_arb ?? "",
    ] : []),
  ]);
  const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(",")).join("\n");
  triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    `AMR_QMRA_Results_${new Date().toISOString().slice(0, 10)}.csv`);
}

function downloadXLSX(data, thresholds, infectionThresholds) {
  const wb = XLSX.utils.book_new();

  const hasDdaly = data.some(r => r.d_daly != null);
  const wsDetail = XLSX.utils.aoa_to_sheet([
    ["#", "Site", "Date", "Sample Type", "Exposure Type", "Pathogen", "Strain", "Disease", "Dose-Response Model",
     "Concentration", "ARB Conc.", "Unit", "Log Reduction", "Volume (L)", "Events/Year",
     "Path. Fraction", "Dose", "P(infection)", "P(annual)", "Infection Risk (≥10⁻⁴)", "P(illness)",
     "DALYs/yr (baseline)", "CFR Baseline", "DALY Risk (≥10⁻⁶)",
     ...(hasDdaly ? ["DALYs/yr (ARB)", "CFR Resistant", "dDALY", "DALY Risk (ARB)"] : [])],
    ...data.map((r, i) => [
      i + 1, r.site, r.date, r.sample_type, r.exposure_type ?? "", r.pathogen, r.strain, r.endpoint, r.model,
      r.concentration, r.arb_concentration ?? "", r.unit, r.log_reduction, r.volume_l, r.events_per_year,
      r.pathogenic_fraction,
      fmtSci(r.dose), fmtSci(r.p_infection), fmtSci(r.p_annual), riskFromPInfection(r.p_annual, infectionThresholds).label, fmtSci(r.p_illness),
      r.daly_baseline != null ? r.daly_baseline.toExponential(2) : r.daly.toExponential(2),
      r.cfr_baseline ?? "",
      riskFromDaly(r.daly, thresholds).label,
      ...(hasDdaly ? [
        r.daly_arb != null ? r.daly_arb.toExponential(2) : "",
        r.cfr_resistant ?? "",
        r.d_daly != null ? r.d_daly.toExponential(2) : "",
        r.risk_label_arb ?? "",
      ] : []),
    ]),
  ]);
  wsDetail["!cols"] = [4,10,10,18,26,16,12,14,14,14,12,14,12,14,14,12,14,12,12,14,12,14,14,12,12,14].map(wch => ({ wch }));
  XLSX.utils.book_append_sheet(wb, wsDetail, "QMRA Results");

  const sites = [...new Set(data.map(r => r.site))];
  const wsSummary = XLSX.utils.aoa_to_sheet([
    ["Site", "Samples", "Pathogens", "Max DALYs/yr", "Overall DALY Risk"],
    ...sites.map(site => {
      const rows = data.filter(r => r.site === site);
      const maxDaly = Math.max(...rows.map(r => r.daly));
      const pathogens = [...new Set(rows.map(r => r.pathogen))].length;
      return [site, rows.length, pathogens, maxDaly.toExponential(2), riskFromDaly(maxDaly, thresholds).label];
    }),
  ]);
  wsSummary["!cols"] = [{ wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Site Summary");

  const now = new Date();
  const thresholdRows = thresholds.map(t =>
    [t.max != null ? `${t.min.toExponential(0)} ≤ DALY < ${t.max.toExponential(0)}` : `DALY ≥ ${t.min.toExponential(0)}`, t.label]
  );
  const infectionThresholdRows = infectionThresholds.map(t =>
    [t.max != null ? `${t.min.toExponential(0)} ≤ P(annual) < ${t.max.toExponential(0)}` : `P(annual) ≥ ${t.min.toExponential(0)}`, t.label]
  );
  const wsMeta = XLSX.utils.aoa_to_sheet([
    ["RADAR — QMRA Report"], [""],
    ["Generated", now.toLocaleString()], ["Tool Version", "v1.0"],
    ["Method", "Quantitative Microbial Risk Assessment (QMRA)"],
    ["Dose-Response Source", "Goh et al. 2023 (J Hazard Mater); Haas et al. 1999; Harb & Hong 2017"],
    ["DALY Framework", "Cassini et al. 2019 (Lancet Infect Dis); WHO Guidelines 2006"],
    ["DALY Benchmark", "10⁻⁶ DALYs/person/year (WHO tolerable risk)"],
    ["Infection Risk Benchmark", "10⁻⁴ annual P(infection) (EPA/WHO)"],
    [""], ["Infection Risk Thresholds"],
    ...infectionThresholdRows,
    [""], ["DALY Risk Thresholds"],
    ...thresholdRows,
  ]);
  wsMeta["!cols"] = [{ wch: 22 }, { wch: 52 }];
  XLSX.utils.book_append_sheet(wb, wsMeta, "Metadata");

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  triggerDownload(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `AMR_QMRA_Results_${now.toISOString().slice(0, 10)}.xlsx`);
}

// ─── Download dropdown ────────────────────────────────────────────────────────
const DownloadMenu = ({ data, thresholds, infectionThresholds, onToast, disabled }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const opts = [
    { icon: Table,    label: "CSV",           sub: "Opens in any spreadsheet app",     color: "#059669", bg: "#D1FAE5", fn: () => { downloadCSV(data, thresholds, infectionThresholds);    onToast("CSV download started");   } },
    { icon: FileDown, label: "Excel (.xlsx)", sub: "3 sheets: Results, Summary, Meta", color: C.primary, bg: "#CCFBF1", fn: () => { downloadXLSX(data, thresholds, infectionThresholds); onToast("Excel download started");  } },
    { icon: Printer,  label: "Print / PDF",   sub: "Use browser Save as PDF option",   color: "#7C3AED", bg: "#EDE9FE", fn: () => { window.print();                   onToast("Print dialog opened");    } },
  ];
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => !disabled && setOpen(o => !o)} disabled={disabled}
              style={{ background: disabled ? "#94A3B8" : C.primary, color: "white", cursor: disabled ? "not-allowed" : "pointer" }}
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
            <p style={{ color: C.textMid, fontSize: 13 }}>{data.length} records · QMRA Results</p>
          </div>
          <div style={{ padding: "6px" }}>
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

// ─── Upload Zone ──────────────────────────────────────────────────────────────
const UploadZone = ({ onCalculate, onDownloadTemplate }) => {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const inputRef = useRef(null);
  const clearFile = useCallback((e) => {
    e.stopPropagation();
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);
  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) setFile(f);
  }, []);
  return (
    <div className="space-y-3">
      <div onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
           onDragLeave={() => setDragging(false)} onDrop={handleDrop}
           onClick={() => inputRef.current?.click()}
           style={{ border: `2px dashed ${dragging ? C.primary : C.border}`,
                    background: dragging ? "#CCFBF1" : "#F8FAFC", transition: "all 0.2s",
                    position: "relative" }}
           className="rounded-xl p-6 md:p-10 text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50">
        <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
               onChange={(e) => setFile(e.target.files[0])}/>
        {file && (
          <button onClick={clearFile}
                  style={{ position:"absolute", top:8, right:8, background:"white",
                           border:`1px solid ${C.border}`, borderRadius:"50%",
                           width:24, height:24, display:"flex", alignItems:"center",
                           justifyContent:"center", cursor:"pointer", flexShrink:0 }}>
            <X size={13} color={C.textMid}/>
          </button>
        )}
        <Upload className="mx-auto mb-2" size={32} color={C.primary}/>
        <p style={{ color: C.textDark }} className="font-semibold text-sm md:text-base">
          {file ? file.name : "Drop your Excel file here"}
        </p>
        <p style={{ color: C.textMid }} className="text-xs md:text-sm mt-1">
          {file ? `${(file.size / 1024).toFixed(1)} KB — ready to process`
                : "Supports .xlsx or .xls · Based on the QMRA input template"}
        </p>
      </div>
      <div style={{ background: "#CCFBF1", border: "1px solid #99F6E4" }}
           className="rounded-lg px-3 py-2.5 flex items-start gap-2">
        <Info size={15} color={C.primary} style={{ flexShrink: 0, marginTop: 1 }}/>
        <span style={{ color: C.primary }} className="text-xs md:text-sm">
          First time?&nbsp;
          <button className="underline font-semibold" onClick={onDownloadTemplate}>
            Download the QMRA input template
          </button>
          &nbsp;to ensure correct column structure.
        </span>
      </div>
      <button onClick={() => onCalculate(file)} disabled={!file}
              style={{ background: file ? C.primary : "#94A3B8" }}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm md:text-base flex items-center justify-center gap-2">
        <Shield size={16}/> {file ? "Calculate QMRA Risk" : "Upload a file to continue"}
      </button>
    </div>
  );
};

// ─── Summary Cards ────────────────────────────────────────────────────────────
const SummaryCards = ({ data, thresholds }) => {
  const maxDaly = Math.max(...data.map(r => r.daly));
  const exceedWHO = data.filter(r => r.daly >= WHO_BENCHMARK).length;
  const sites = [...new Set(data.map(r => r.site))].length;
  const pathogens = [...new Set(data.map(r => r.pathogen))].length;
  const cards = [
    { label: "Samples Assessed",       value: data.length,                icon: FileSpreadsheet, color: C.primary    },
    { label: "Exceed WHO Benchmark",   value: `${exceedWHO} / ${data.length}`, icon: AlertTriangle,   color: C.yellow     },
    { label: "Sites",                  value: sites,                       icon: MapPin,          color: "#7C3AED"    },
    { label: "Max DALYs/yr",           value: maxDaly.toExponential(1),   icon: Activity,        color: riskFromDaly(maxDaly, thresholds).color },
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
          <span style={{ color: C.textDark, fontWeight: 600, fontSize: 16 }}>How to Use the QMRA Module</span>
        </div>
        <ChevronDown size={15} color={C.textMid}
                     style={{ transform: open ? "rotate(180deg)" : "none", transition: "0.2s" }}/>
      </button>

      {open && (
        <div style={{ borderTop: `1px solid ${C.border}` }} className="p-4 md:p-5 space-y-4">

          {/* Steps */}
          <div>
            <p style={{ color: C.textDark, fontWeight: 600, fontSize: 15 }} className="mb-3">Steps</p>
            <div className="space-y-2.5">
              {[
                { n: 1, title: "Download the template",    body: 'Click "Download the QMRA input template" in the upload panel to get the pre-formatted Excel file.' },
                { n: 2, title: "Fill in your data",        body: "Enter Site, Date, Sample_Type, Exposure_Type, Pathogen, Endpoint, Concentration, Unit, and Events_Per_Year. Volume_L defaults automatically from Exposure_Type. ARB_Concentration and Log_Reduction are optional." },
                { n: 3, title: "Upload the file",          body: "Drag and drop or click to select your completed .xlsx or .xls file in the upload panel." },
                { n: 4, title: "Review your results",      body: "P(infection), P(illness) and DALYs per person per year are calculated automatically. Explore results across tabs and export as needed." },
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

          {/* Template structure */}
          <div style={{ background: "#F8FAFC", border: `1px solid ${C.border}`, borderRadius: 10 }} className="p-3 md:p-4">
            <p style={{ color: C.textDark, fontWeight: 600, fontSize: 15 }} className="mb-2.5">Template Columns</p>
            <div className="space-y-2">
              {[
                { row: "Required", label: "Core fields",     body: "Site, Date (DD/MM/YY), Sample_Type (Water), Exposure_Type (Drinking Water / Primary Contact (Swimming) / Secondary Contact (Kayaking/Wading)), Pathogen, Endpoint, Concentration, Unit, Events_Per_Year." },
                { row: "Optional", label: "ARB / Treatment", body: "Volume_L (defaults from Exposure_Type if blank — 1.0 L for Drinking Water, 0.1 L for Swimming, 0.01 L for Kayaking/Wading), ARB_Concentration (enables dDALY dual-track output), Log_Reduction (default 0)." },
                { row: "Auto",     label: "Calculated",      body: "Dose, P(infection), P(annual), Infection Risk, DALYs/yr, DALY Risk, and dDALY (if ARB_Concentration provided) are computed automatically." },
              ].map(r => (
                <div key={r.row} className="flex gap-3 items-start">
                  <span style={{ background: C.primary + "18", color: C.primary, fontWeight: 700,
                                 fontSize: 13, padding: "2px 7px", borderRadius: 5, flexShrink: 0, marginTop: 1 }}>
                    {r.row}
                  </span>
                  <span style={{ color: C.textMid, fontSize: 14 }}>
                    <strong style={{ color: C.textDark }}>{r.label}: </strong>{r.body}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Note */}
          <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8 }} className="px-3 py-2.5 flex items-start gap-2">
            <AlertTriangle size={14} color={C.yellow} style={{ flexShrink: 0, marginTop: 1 }}/>
            <p style={{ color: "#92400E", fontSize: 14 }}>
              <strong>Note:</strong> Dose-response parameters are sourced from{" "}
              Goh et al. 2023 (J Hazard Mater), Haas et al. 1999, Harb &amp; Hong 2017, and Cassini et al. 2019 (Lancet Infect Dis).
              The best-fit model per pathogen is applied automatically.
              Results are estimates. Please consult a qualified risk assessor for regulatory decisions.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Empty State ──────────────────────────────────────────────────────────────
const EmptyState = ({ icon: Icon, title, sub }) => (
  <div className="flex flex-col items-center justify-center py-14 gap-3">
    <div style={{ background: "#F1F5F9", borderRadius: "50%", padding: 20 }}>
      <Icon size={32} color="#94A3B8"/>
    </div>
    <p style={{ color: "#0F172A", fontWeight: 600, fontSize: 17 }}>{title}</p>
    <p style={{ color: "#94A3B8", fontSize: 15 }}>{sub}</p>
  </div>
);

// ─── Threshold icons ──────────────────────────────────────────────────────────
const THRESHOLD_ICONS = [CheckCircle, AlertTriangle, XCircle, XCircle];

// ─── Box Plot (QMRA-specific custom SVG) ─────────────────────────────────────
function computeBoxStats(values) {
  if (!values?.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  const q1 = s[Math.floor(n * 0.25)];
  const median = s[Math.floor(n * 0.5)];
  const q3 = s[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  const min = Math.max(s[0], q1 - 1.5 * iqr);
  const max = Math.min(s[n - 1], q3 + 1.5 * iqr);
  return { min, q1, median, q3, max, outliers: s.filter(v => v < min || v > max), values: s };
}

const BOX_PALETTE = [
  "#2563EB","#059669","#D97706","#7C3AED","#0D9488","#EA580C","#BE185D","#0369A1","#65A30D","#9333EA",
];

function BoxPlot({ data, xKey, yKey, yLabel, benchmarkY, benchmarkLabel }) {
  const [hovered, setHovered] = useState(null);

  if (!data?.length) return <EmptyState icon={BarChart2} title="No data" sub="Upload a file to see the box plot."/>;

  const groups = {};
  data.forEach(r => {
    const k = r[xKey] ?? "Unknown";
    if (!groups[k]) groups[k] = [];
    groups[k].push(r[yKey]);
  });
  const labels = Object.keys(groups).sort();
  const stats = labels.map(l => ({ label: l, ...computeBoxStats(groups[l]) }));

  const allVals = data.map(r => r[yKey]).filter(v => v > 0);
  if (!allVals.length) return null;

  const LOG_MIN = Math.pow(10, Math.floor(Math.log10(Math.min(...allVals))) - 1);
  const LOG_MAX = Math.pow(10, Math.ceil(Math.log10(Math.max(...allVals))) + 1);
  const logPos = v => Math.max(0, Math.min(1, (Math.log10(Math.max(v, LOG_MIN)) - Math.log10(LOG_MIN)) / (Math.log10(LOG_MAX) - Math.log10(LOG_MIN))));

  const CHART_H = 300; const BOX_W_EACH = 90;
  const PAD_L = 80; const PAD_R = 20; const PAD_T = 20; const PAD_B = 90;
  const totalW = PAD_L + labels.length * BOX_W_EACH + PAD_R;
  const drawH = CHART_H - PAD_T - PAD_B;
  const y = v => PAD_T + drawH * (1 - logPos(v));

  const logLow = Math.floor(Math.log10(LOG_MIN));
  const logHigh = Math.ceil(Math.log10(LOG_MAX));
  const ticks = [];
  for (let e = logLow; e <= logHigh; e++) ticks.push(Math.pow(10, e));

  const colFor = (label, idx) =>
    xKey === "pathogen" ? pathogenColour(label).color : BOX_PALETTE[idx % BOX_PALETTE.length];

  return (
    <div style={{ overflowX: "auto", position: "relative" }}>
      {hovered && (
        <div style={{
          position: "absolute", left: hovered.px + 12, top: hovered.py - 10,
          background: "#0F172A", color: "white", borderRadius: 8,
          padding: "10px 13px", fontSize: 12, zIndex: 20,
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)", pointerEvents: "none",
          minWidth: 170, lineHeight: 1.7,
        }}>
          <p style={{ fontWeight: 700, color: hovered.col, marginBottom: 4, fontSize: 13 }}>
            {hovered.s.label}
          </p>
          <p style={{ color: "#94A3B8", fontSize: 11, marginBottom: 6 }}>
            n = {hovered.s.values.length} sample{hovered.s.values.length !== 1 ? "s" : ""}
            {hovered.s.outliers.length > 0 && ` · ${hovered.s.outliers.length} outlier${hovered.s.outliers.length !== 1 ? "s" : ""}`}
          </p>
          {[
            ["Max (whisker)",  hovered.s.max],
            ["Q3 (75th pct)", hovered.s.q3],
            ["Median",         hovered.s.median],
            ["Q1 (25th pct)", hovered.s.q1],
            ["Min (whisker)",  hovered.s.min],
          ].map(([lbl, val]) => (
            <div key={lbl} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span style={{ color: "#94A3B8" }}>{lbl}</span>
              <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmtSci(val)}</span>
            </div>
          ))}
        </div>
      )}
      <svg width={Math.max(totalW, 400)} height={CHART_H + PAD_B} style={{ display: "block" }}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={PAD_L} x2={totalW - PAD_R} y1={y(t)} y2={y(t)}
                  stroke="#E2E8F0" strokeWidth={1} strokeDasharray="4 3"/>
            <text x={PAD_L - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill={C.textLight}>
              {t.toExponential(0)}
            </text>
          </g>
        ))}
        {benchmarkY && (
          <g>
            <line x1={PAD_L} x2={totalW - PAD_R} y1={y(benchmarkY)} y2={y(benchmarkY)}
                  stroke="#DC2626" strokeWidth={1.5} strokeDasharray="6 3"/>
            <text x={PAD_L + 4} y={y(benchmarkY) - 5} fontSize={11} fill="#DC2626" fontWeight="600">
              {benchmarkLabel ?? "Benchmark"}
            </text>
          </g>
        )}
        <text transform={`translate(14,${PAD_T + drawH / 2}) rotate(-90)`}
              textAnchor="middle" fontSize={12} fill={C.textMid}>{yLabel}</text>
        {stats.map((s, i) => {
          if (!s.q1) return null;
          const cx = PAD_L + i * BOX_W_EACH + BOX_W_EACH / 2;
          const bw = 40;
          const col = colFor(s.label, i);
          return (
            <g key={s.label}
               style={{ cursor: "pointer" }}
               onMouseEnter={e => {
                 const rect = e.currentTarget.closest("svg").parentElement.getBoundingClientRect();
                 const svgRect = e.currentTarget.closest("svg").getBoundingClientRect();
                 setHovered({ s, col, px: cx - (svgRect.left - rect.left), py: y(s.median) });
               }}
               onMouseMove={e => {
                 const rect = e.currentTarget.closest("svg").parentElement.getBoundingClientRect();
                 setHovered(h => h ? { ...h, px: e.clientX - rect.left, py: e.clientY - rect.top } : h);
               }}
               onMouseLeave={() => setHovered(null)}>
              <rect x={cx - BOX_W_EACH/2} y={PAD_T} width={BOX_W_EACH} height={drawH}
                    fill="transparent"/>
              <line x1={cx} x2={cx} y1={y(s.max)} y2={y(s.q3)} stroke={col} strokeWidth={1.5}/>
              <line x1={cx - bw/4} x2={cx + bw/4} y1={y(s.max)} y2={y(s.max)} stroke={col} strokeWidth={1.5}/>
              <rect x={cx - bw/2} y={y(s.q3)} width={bw} height={Math.max(2, y(s.q1) - y(s.q3))}
                    fill={col + "33"} stroke={col} strokeWidth={1.5} rx={3}/>
              <line x1={cx - bw/2} x2={cx + bw/2} y1={y(s.median)} y2={y(s.median)}
                    stroke={col} strokeWidth={2.5}/>
              <line x1={cx} x2={cx} y1={y(s.q1)} y2={y(s.min)} stroke={col} strokeWidth={1.5}/>
              <line x1={cx - bw/4} x2={cx + bw/4} y1={y(s.min)} y2={y(s.min)} stroke={col} strokeWidth={1.5}/>
              {s.outliers.map((o, oi) => (
                <circle key={oi} cx={cx} cy={y(o)} r={3} fill="none" stroke={col} strokeWidth={1.5}/>
              ))}
              {s.values.map((v, vi) => (
                <circle key={vi} cx={cx + (vi % 2 === 0 ? -8 : 8)} cy={y(v)} r={2.5}
                        fill={col} opacity={0.5}/>
              ))}
              <text
                transform={`translate(${cx + 3}, ${CHART_H - PAD_B + 12}) rotate(-40)`}
                textAnchor="end" fontSize={11} fill={C.textMid}>
                {s.label}
              </text>
            </g>
          );
        })}
        <line x1={PAD_L} x2={PAD_L} y1={PAD_T} y2={PAD_T + drawH} stroke={C.border} strokeWidth={1}/>
        <line x1={PAD_L} x2={totalW - PAD_R} y1={PAD_T + drawH} y2={PAD_T + drawH} stroke={C.border} strokeWidth={1}/>
      </svg>
      <p style={{ color: C.textLight, fontSize: 13, marginTop: 6 }}>
        Box: Q1–Q3 · Centre line: median · Whiskers: ±1.5×IQR · Dots: individual samples · Log scale
      </p>
    </div>
  );
}

// ─── QMRA Page ────────────────────────────────────────────────────────────────
export default function QMRAPage() {
  const navigate      = useNavigate();
  const { isMobile }  = useBreakpoint();
  const [thresholds,          setThresholds]          = useState(DEFAULT_THRESHOLDS);
  const [infectionThresholds, setInfectionThresholds] = useState(DEFAULT_INFECTION_THRESHOLDS);
  const [results,             setResults]             = useState(null);

  useEffect(() => {
    getModuleConfig('QMRA')
      .then(cfg => {
        const levels = cfg.risk_thresholds?.levels;
        if (Array.isArray(levels) && levels.length > 0) setThresholds(levels);
        const infLevels = cfg.infection_risk_thresholds?.levels;
        if (Array.isArray(infLevels) && infLevels.length > 0) setInfectionThresholds(infLevels);
      })
      .catch(() => {});
  }, []);
  const [apiErrors,   setApiErrors]   = useState([]);
  const [warnings,    setWarnings]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [apiError,    setApiError]    = useState(null);
  const [activeTab,   setActiveTab]   = useState("table");
  const [toast,       setToast]       = useState(null);
  const [tablePage,   setTablePage]   = useState(1);
  const [sitePage,    setSitePage]    = useState(1);
  const [warnPage,    setWarnPage]    = useState(1);
  const [sortCol,     setSortCol]     = useState(null);
  const [sortDir,     setSortDir]     = useState("asc");
  const [filterSite,         setFilterSite]         = useState("");
  const [filterPathogen,     setFilterPathogen]     = useState("");
  const [filterSampleType,   setFilterSampleType]   = useState("");
  const [filterExposureType, setFilterExposureType] = useState("");
  const [filterRisk,         setFilterRisk]         = useState("");
  const [boxMetric,   setBoxMetric]   = useState("daly");
  const [boxGroup,    setBoxGroup]    = useState("site");
  const TABLE_PAGE_SIZE = 20;
  const SITE_PAGE_SIZE  = 5;
  const WARN_PAGE_SIZE  = 5;

  const downloadTemplate = () => {
    // Pre-built xlsx with dropdown validations (openpyxl). SheetJS community
    // edition cannot write dataValidations, so this base64 is generated server-side.
    const b64 = "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";
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    triggerDownload(
      new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      "AMR_QMRA_Template.xlsx"
    );
    setToast("QMRA template downloaded");
  };

  const handleCalculate = async (file) => {
    if (!file) return;
    setLoading(true); setApiError(null);
    try {
      const json = await calculateQMRA(file);
      setResults(json.results ?? []);
      setWarnings(json.warnings ?? []);
      setApiErrors(json.errors ?? []);
      setTablePage(1); setSitePage(1); setWarnPage(1);
      setSortCol(null); setSortDir("asc");
      setFilterSite(""); setFilterPathogen(""); setFilterSampleType(""); setFilterRisk("");
      setActiveTab("table");
    } catch (err) {
      setApiError(err.message || "Calculation failed. Please check your file and try again.");
    } finally {
      setLoading(false);
    }
  };

  const sites = results ? [...new Set(results.map(r => r.site))] : [];

  const siteOptions       = useMemo(() => [...new Set(results?.map(r => r.site)       ?? [])].sort(), [results]);
  const pathogenOptions   = useMemo(() => [...new Set(results?.map(r => r.pathogen)   ?? [])].sort(), [results]);
  const sampleTypeOptions   = useMemo(() => [...new Set(results?.map(r => r.sample_type)  ?? [])].sort(), [results]);
  const exposureTypeOptions = useMemo(() => [...new Set(results?.map(r => r.exposure_type).filter(Boolean) ?? [])].sort(), [results]);
  const riskOptions       = thresholds.map(t => t.label);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
    setTablePage(1);
  };

  const clearFilters = () => {
    setFilterSite(""); setFilterPathogen(""); setFilterSampleType(""); setFilterExposureType(""); setFilterRisk("");
    setSortCol(null); setSortDir("asc"); setTablePage(1);
  };

  const hasFilters = filterSite || filterPathogen || filterSampleType || filterExposureType || filterRisk;

  const displayResults = useMemo(() => {
    if (!results) return [];
    let rows = [...results];
    if (filterSite)         rows = rows.filter(r => r.site === filterSite);
    if (filterPathogen)     rows = rows.filter(r => r.pathogen === filterPathogen);
    if (filterSampleType)   rows = rows.filter(r => r.sample_type === filterSampleType);
    if (filterExposureType) rows = rows.filter(r => r.exposure_type === filterExposureType);
    if (filterRisk)         rows = rows.filter(r => riskFromDaly(r.daly, thresholds).label === filterRisk);
    if (sortCol) {
      rows.sort((a, b) => {
        const av = a[sortCol] ?? "";
        const bv = b[sortCol] ?? "";
        const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return rows;
  }, [results, filterSite, filterPathogen, filterSampleType, filterRisk, sortCol, sortDir, thresholds]);

  // Chart data: max DALYs per pathogen + per site
  const chartDataPathogen = useMemo(() => {
    if (!results?.length) return [];
    const map = {};
    for (const r of results) {
      if (!map[r.pathogen] || r.daly > map[r.pathogen].daly) map[r.pathogen] = r;
    }
    return Object.values(map).sort((a, b) => b.daly - a.daly);
  }, [results]);

  const chartDataSite = useMemo(() => {
    if (!results?.length) return [];
    const map = {};
    for (const r of results) {
      if (!map[r.site] || r.daly > map[r.site].daly) map[r.site] = r;
    }
    return Object.values(map).sort((a, b) => b.daly - a.daly);
  }, [results]);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const r = riskFromDaly(d.daly, thresholds);
    return (
      <div style={{ background: "white", border: `1px solid ${C.border}`, borderRadius: 8,
                    padding: "10px 14px", fontSize: 14, boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}>
        <p style={{ fontWeight: 700, color: C.textDark, marginBottom: 4 }}>{d.pathogen ?? d.site}</p>
        <p style={{ color: C.textMid }}>DALYs/yr: <strong style={{ color: r.color }}>{d.daly.toExponential(2)}</strong></p>
        <p style={{ color: r.color, fontWeight: 700 }}>{r.label}</p>
      </div>
    );
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Inter',sans-serif" }}>
      <Header accent="#0D9488" />
      <NavBar/>

      <main className="p-3 md:p-6 max-w-screen-xl mx-auto space-y-4 md:space-y-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1" style={{ color: C.textMid, fontSize: 14 }}>
          <button onClick={() => navigate("/")}
                  style={{ color: C.primary, fontWeight: 500, background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 14 }}>
            Home
          </button>
          <ChevronRight size={13}/>
          <span style={{ color: C.primary, fontWeight: 600, fontSize: 14 }}>QMRA</span>
        </div>

        {/* ── Pre-results: Instructions + Models/Thresholds/Upload ── */}
        {!results && (
          <div className="space-y-4">
            <Instructions/>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.6fr] gap-4 md:gap-6">

              {/* Left: Models + DALY Thresholds */}
              <div className="space-y-3 md:space-y-4">

                {/* Dose-Response Models (equivalent to RQ Formulae card) */}
                <div style={{ background: C.cardBg, border: `1px solid ${C.border}` }} className="rounded-xl p-4 md:p-5">
                  <h3 style={{ color: C.textDark }} className="font-semibold mb-3 flex items-center gap-2 text-sm md:text-base">
                    <Droplets size={15} color={C.primary}/> Dose-Response Models
                  </h3>
                  <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10 }} className="p-3 md:p-4 space-y-3">
                    {[
                      { label: "Exponential",   eq: "P = 1 − e^(−k × dose)",             desc: "Single-hit, one parameter" },
                      { label: "Beta-Poisson",  eq: "P = 1 − (1 + dose/β)^(−α)",         desc: "Best-fit for most pathogens" },
                    ].map(f => (
                      <div key={f.label} className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <span style={{ color: C.primary, fontWeight: 700, fontSize: 16 }}>{f.label}</span>
                          <span style={{ color: C.textMid, fontSize: 13 }} className="ml-1">{f.desc}</span>
                        </div>
                        <span style={{ color: C.primary, fontWeight: 600, fontSize: 14, background: "white",
                                       padding: "2px 8px", borderRadius: 6, border: "1px solid #BBF7D0", flexShrink: 0 }}>
                          {f.eq}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 space-y-1" style={{ fontSize: 13, color: C.textMid }}>
                    {[
                      ["P",    "Probability of infection per exposure event"],
                      ["k",    "Exponential infectivity coefficient"],
                      ["α / β","Beta-Poisson shape / scale parameters"],
                      ["dose", "Organisms ingested = concentration × volume × 10^(−log_reduction)"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span style={{ color: C.primary, fontWeight: 600, minWidth: 64 }}>{k}</span>
                        <span>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* DALY Thresholds */}
                <div style={{ background: C.cardBg, border: `1px solid ${C.border}` }} className="rounded-xl p-4 md:p-5">
                  <h3 style={{ color: C.textDark }} className="font-semibold mb-3 text-sm md:text-base">
                    DALY Risk Thresholds
                  </h3>
                  {thresholds.map((t, idx) => {
                    const Icon = THRESHOLD_ICONS[idx] ?? XCircle;
                    const fmtExpJsx = v => { const e = Math.log10(v); return <span>10<sup>{e < 0 ? '-' : ''}{Math.abs(e)}</sup></span>; };
                    const rangeLabel = t.max != null
                      ? (t.min === 0 ? <span>DALY &lt; {fmtExpJsx(t.max)}</span> : <span>{fmtExpJsx(t.min)} ≤ DALY &lt; {fmtExpJsx(t.max)}</span>)
                      : <span>DALY ≥ {fmtExpJsx(t.min)}</span>;
                    const bg = t.color + "22";
                    return (
                      <div key={t.label} style={{ background: bg, borderRadius: 8, marginBottom: 6 }}
                           className="flex items-center gap-2 px-3 py-2">
                        <Icon size={14} color={t.color}/>
                        <span style={{ color: t.color, fontWeight: 700, fontSize: 14, minWidth: 120 }}>{rangeLabel}</span>
                        <span style={{ color: t.color, fontSize: 13 }}>{t.label}</span>
                      </div>
                    );
                  })}
                  <div style={{ background: "#F8FAFC", border: `1px solid ${C.border}`,
                                borderRadius: 7, marginTop: 8 }}
                       className="px-3 py-2 flex items-start gap-2">
                    <Info size={12} color={C.textLight} style={{ flexShrink: 0, marginTop: 1 }}/>
                    <p style={{ color: C.textLight, fontSize: 12, lineHeight: 1.5 }}>
                      Benchmark: <span style={{ fontSize: 14, fontWeight: 600 }}>10<sup>-6</sup></span> DALYs/person/year from{" "}
                      <strong style={{ color: C.textMid }}>WHO (2022)</strong>{" "}
                      <em>Guidelines for Drinking-Water Quality</em>, 4th ed.
                    </p>
                  </div>
                </div>

                {/* Infection Risk Thresholds */}
                <div style={{ background: C.cardBg, border: `1px solid ${C.border}` }} className="rounded-xl p-4 md:p-5">
                  <h3 style={{ color: C.textDark }} className="font-semibold mb-3 text-sm md:text-base">
                    Infection Risk Thresholds
                  </h3>
                  {infectionThresholds.map((t, idx) => {
                    const Icon = idx === 0 ? CheckCircle : XCircle;
                    const fmtExpJsx = v => { const e = Math.log10(v); return <span>10<sup>{e < 0 ? '-' : ''}{Math.abs(e)}</sup></span>; };
                    const rangeLabel = t.max != null
                      ? (t.min === 0 ? <span>P(annual) &lt; {fmtExpJsx(t.max)}</span> : <span>{fmtExpJsx(t.min)} ≤ P(annual) &lt; {fmtExpJsx(t.max)}</span>)
                      : <span>P(annual) ≥ {fmtExpJsx(t.min)}</span>;
                    return (
                      <div key={t.label} style={{ background: t.color + "22", borderRadius: 8, marginBottom: 6 }}
                           className="flex items-center gap-2 px-3 py-2">
                        <Icon size={14} color={t.color}/>
                        <span style={{ color: t.color, fontWeight: 700, fontSize: 14, minWidth: 120 }}>{rangeLabel}</span>
                        <span style={{ color: t.color, fontSize: 13 }}>{t.label}</span>
                      </div>
                    );
                  })}
                  <div style={{ background: "#F8FAFC", border: `1px solid ${C.border}`,
                                borderRadius: 7, marginTop: 8 }}
                       className="px-3 py-2 flex items-start gap-2">
                    <Info size={12} color={C.textLight} style={{ flexShrink: 0, marginTop: 1 }}/>
                    <p style={{ color: C.textLight, fontSize: 12, lineHeight: 1.5 }}>
                      Benchmark: <span style={{ fontSize: 14, fontWeight: 600 }}>10<sup>-4</sup></span> annual P(infection) from{" "}
                      <strong style={{ color: C.textMid }}>EPA (2006)</strong>{" "}
                      <em>Microbial Risk Assessment Guidelines</em> and{" "}
                      <strong style={{ color: C.textMid }}>WHO GDWQ (2022)</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: Upload panel */}
              <div style={{ background: C.cardBg, border: `1px solid ${C.border}` }} className="rounded-xl p-4 md:p-6">
                <h2 style={{ color: C.textDark }} className="font-bold text-sm md:text-base mb-1">Upload Sample Data</h2>
                <p style={{ color: C.textMid }} className="text-xs md:text-sm mb-4">
                  Upload your site readings via the QMRA Excel template. The tool calculates P(infection), P(illness), DALYs/yr and dDALY (if ARB_Concentration provided) automatically using best-fit dose-response models (Goh et al. 2023; Haas et al. 1999; Harb &amp; Hong 2017).
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
                    <p style={{ color: C.textMid, fontSize: 15 }}>Calculating QMRA risk…</p>
                  </div>
                ) : (
                  <UploadZone onCalculate={handleCalculate} onDownloadTemplate={downloadTemplate}/>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {results && (
          <div className="space-y-4 md:space-y-5">
            <SummaryCards data={results} thresholds={thresholds}/>

            <div style={{ background: C.cardBg, border: `1px solid ${C.border}` }} className="rounded-xl overflow-hidden">

              {/* Tab bar + Export */}
              <div style={{ borderBottom: `1px solid ${C.border}` }} className="flex items-center">
                <div className="flex items-center overflow-x-auto whitespace-nowrap scrollbar-none flex-1">
                  {[
                    { id: "table", label: "Data Table", icon: FileText   },
                    { id: "bar",   label: "Bar Chart",  icon: Activity   },
                    { id: "box",   label: "Box Plot",   icon: BarChart2  },
                    { id: "site",  label: "By Site",    icon: MapPin     },
                  ].map(tab => (
                    <button key={tab.id}
                            onClick={() => { setActiveTab(tab.id); setTablePage(1); setSitePage(1); setWarnPage(1); }}
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
                <div className="px-3 md:px-4 flex items-center flex-shrink-0">
                  <DownloadMenu data={results} thresholds={thresholds} infectionThresholds={infectionThresholds} onToast={setToast} disabled={results.length === 0}/>
                </div>
              </div>

              {/* Tab content */}
              <div className="p-3 md:p-5">

                {/* ── Data Table ── */}
                {activeTab === "table" && (
                  <div>
                    {results.length === 0 && (
                      <EmptyState icon={FileSpreadsheet} title="No data assessed" sub="Upload a sample file to see results here."/>
                    )}
                    {results.length > 0 && (apiErrors.length > 0 || warnings.length > 0) && (() => {
                      const allMessages = [
                        ...warnings.map(w => ({ type: "warn",  message: w.message })),
                        ...apiErrors.map(e => ({ type: "error", message: e.message })),
                      ];
                      const pageMessages = allMessages.slice((warnPage - 1) * WARN_PAGE_SIZE, warnPage * WARN_PAGE_SIZE);
                      return (
                        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8 }}
                             className="px-3 py-2 mb-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle size={14} color={C.yellow} style={{ flexShrink: 0, marginTop: 1 }}/>
                            <div style={{ fontSize: 13, color: "#92400E", flex: 1 }}>
                              {pageMessages.map((m, i) => <p key={i} className="mb-0.5">{m.message}</p>)}
                            </div>
                          </div>
                          <Pagination page={warnPage} total={allMessages.length} pageSize={WARN_PAGE_SIZE} onChange={setWarnPage}/>
                        </div>
                      );
                    })()}
                    {results.length > 0 && (
                      <>
                        {/* Filter bar */}
                        <div className="flex items-center gap-2 flex-wrap mb-3">
                          {[
                            { label: "Site",          value: filterSite,         setter: setFilterSite,         opts: siteOptions         },
                            { label: "Pathogen",      value: filterPathogen,     setter: setFilterPathogen,     opts: pathogenOptions     },
                            { label: "Sample Type",   value: filterSampleType,   setter: setFilterSampleType,   opts: sampleTypeOptions   },
                            { label: "Exposure Type", value: filterExposureType, setter: setFilterExposureType, opts: exposureTypeOptions },
                            { label: "DALY Risk",     value: filterRisk,         setter: setFilterRisk,         opts: riskOptions         },
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
                                    style={{ fontSize: 13, color: C.accent, border: `1px solid ${C.accent}33`,
                                             borderRadius: 7, padding: "4px 10px", background: "#FEF2F2" }}>
                              Clear filters
                            </button>
                          )}
                          <span style={{ color: C.textMid, fontSize: 13, marginLeft: "auto" }}>
                            {displayResults.length} of {results.length} rows
                          </span>
                        </div>

                        <div className="overflow-x-auto -mx-3 md:mx-0 px-3 md:px-0">
                          <table className="w-full text-xs md:text-sm" style={{ minWidth: 1000 }}>
                            <thead>
                              <tr style={{ background: "#F1F5F9" }}>
                                {[
                                  { label: "#",            sortKey: null              },
                                  { label: "Site",         sortKey: "site"            },
                                  { label: "Date",         sortKey: "date"            },
                                  { label: "Pathogen",     sortKey: "pathogen"        },
                                  { label: "Disease",     sortKey: "endpoint"        },
                                  { label: "Sample Type",  sortKey: "sample_type"     },
                                  { label: "Exposure Type", sortKey: "exposure_type"  },
                                  { label: "Conc.",        sortKey: "concentration"   },
                                  { label: "Unit",         sortKey: null              },
                                  { label: "Dose-Response Model",        sortKey: "model"           },
                                  { label: "Dose",         sortKey: "dose"            },
                                  { label: "P(infection)",         sortKey: "p_infection" },
                                  { label: "P(annual)",            sortKey: "p_annual"    },
                                  { label: "Infection Risk",       sortKey: "p_annual",    minWidth: 120 },
                                  { label: "DALYs/yr",             sortKey: "daly"        },
                                  { label: "DALY Risk",            sortKey: "daly"        },
                                  ...(displayResults.some(r => r.d_daly != null) ? [
                                    { label: "dDALY",              sortKey: "d_daly"      },
                                    { label: "DALY Risk (ARB)",    sortKey: null          },
                                  ] : []),
                                ].map(col => (
                                  <th key={col.label}
                                      onClick={() => col.sortKey && handleSort(col.sortKey)}
                                      className="px-2 md:px-3 py-2 text-left font-semibold"
                                      style={{ color: sortCol === col.sortKey && col.sortKey ? C.primary : C.textMid,
                                               fontSize: 13, cursor: col.sortKey ? "pointer" : "default",
                                               userSelect: "none", whiteSpace: "nowrap",
                                               minWidth: col.minWidth ?? "auto" }}>
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
                              {displayResults.slice((tablePage - 1) * TABLE_PAGE_SIZE, tablePage * TABLE_PAGE_SIZE).map((r, i) => {
                                const rowNum = (tablePage - 1) * TABLE_PAGE_SIZE + i + 1;
                                const risk = riskFromDaly(r.daly, thresholds);
                                return (
                                  <tr key={r.id} style={{ borderTop: `1px solid ${C.border}` }} className="hover:bg-slate-50">
                                    <td className="px-2 md:px-3 py-2" style={{ color: C.textLight }}>{rowNum}</td>
                                    <td className="px-2 md:px-3 py-2 font-medium" style={{ color: C.textDark }}>{r.site}</td>
                                    <td className="px-2 md:px-3 py-2" style={{ color: C.textMid }}>{r.date}</td>
                                    <td className="px-2 md:px-3 py-2"><PathogenBadge value={r.pathogen}/></td>
                                    <td className="px-2 md:px-3 py-2" style={{ color: C.textMid, fontSize: 13 }}>{r.endpoint}</td>
                                    <td className="px-2 md:px-3 py-2" style={{ color: C.textMid, fontSize: 13 }}>{r.sample_type}</td>
                                    <td className="px-2 md:px-3 py-2" style={{ color: C.textMid, fontSize: 13 }}>{r.exposure_type ?? "—"}</td>
                                    <td className="px-2 md:px-3 py-2">{r.concentration}</td>
                                    <td className="px-2 md:px-3 py-2" style={{ color: C.textMid }}>{r.unit}</td>
                                    <td className="px-2 md:px-3 py-2" style={{ color: C.textMid, fontSize: 12 }}>{r.model}</td>
                                    <td className="px-2 md:px-3 py-2" style={{ color: C.textMid }}>{fmtSciJsx(r.dose)}</td>
                                    <td className="px-2 md:px-3 py-2 font-bold" style={{ color: risk.color }}>{fmtSciJsx(r.p_infection)}</td>
                                    <td className="px-2 md:px-3 py-2 font-bold" style={{ color: riskFromPInfection(r.p_annual, infectionThresholds).color }}>{fmtSciJsx(r.p_annual)}</td>
                                    <td className="px-2 md:px-3 py-2">{(() => { const ir = riskFromPInfection(r.p_annual, infectionThresholds); return <span style={{ background: ir.bg, color: ir.color, border: `1px solid ${ir.color}33` }} className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">{ir.label}</span>; })()}</td>
                                    <td className="px-2 md:px-3 py-2 font-bold" style={{ color: risk.color }}>{fmtSciJsx(r.daly_baseline ?? r.daly)}</td>
                                    <td className="px-2 md:px-3 py-2"><RiskBadge daly={r.daly} thresholds={thresholds}/></td>
                                    {displayResults.some(d => d.d_daly != null) && (
                                      <>
                                        <td className="px-2 md:px-3 py-2 font-bold" style={{ color: r.d_daly > 0 ? "#D97706" : C.textMid, fontSize: 13 }}>
                                          {r.d_daly != null ? fmtSciJsx(r.d_daly) : "—"}
                                        </td>
                                        <td className="px-2 md:px-3 py-2">
                                          {r.risk_label_arb ? <RiskBadge daly={r.daly_arb ?? 0} thresholds={thresholds}/> : <span style={{ color: C.textLight, fontSize: 13 }}>—</span>}
                                        </td>
                                      </>
                                    )}
                                  </tr>
                                );
                              })}
                              {displayResults.length === 0 && (
                                <tr><td colSpan={displayResults.some(r => r.d_daly != null) ? 19 : 17} className="text-center py-10"
                                        style={{ color: C.textLight, fontSize: 15 }}>No rows match the current filters.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        <Pagination page={tablePage} total={displayResults.length} pageSize={TABLE_PAGE_SIZE} onChange={setTablePage}/>

                        {/* Quick download */}
                        <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 12, paddingTop: 12 }}
                             className="flex items-center gap-2 flex-wrap">
                          <span style={{ color: C.textMid, fontSize: 13 }}>Quick download:</span>
                          {[
                            { label: "CSV",   color: "#059669", icon: Table,    fn: () => { downloadCSV(displayResults, thresholds, infectionThresholds);    setToast("CSV download started");   } },
                            { label: "Excel", color: C.primary, icon: FileDown, fn: () => { downloadXLSX(displayResults, thresholds, infectionThresholds); setToast("Excel download started");  } },
                            { label: "PDF",   color: "#7C3AED", icon: Printer,  fn: () => { window.print();                             setToast("Print dialog opened");    } },
                          ].map(btn => (
                            <button key={btn.label} onClick={btn.fn}
                                    style={{ border: `1px solid ${btn.color}`, color: btn.color, fontSize: 13 }}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:opacity-80 font-medium">
                              <btn.icon size={12}/> {btn.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ── Bar Chart ── */}
                {activeTab === "bar" && (
                  <div>
                    {results.length === 0 ? (
                      <EmptyState icon={Activity} title="No data assessed" sub="Upload a sample file to see charts."/>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
                          <p style={{ color: C.textMid, fontSize: 14 }}>
                            Max DALYs/yr per pathogen and per site, sorted highest first.
                            <br/>Log scale applied — dashed line marks WHO 10⁻⁶ benchmark.
                          </p>
                          <div className="flex items-center gap-3 flex-wrap">
                            {thresholds.map(t => (
                              <div key={t.label} className="flex items-center gap-1.5">
                                <div style={{ width: 10, height: 10, borderRadius: 2, background: t.color }}/>
                                <span style={{ color: C.textMid, fontSize: 13 }}>{t.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* By Pathogen */}
                        <p style={{ color: C.textDark, fontWeight: 600, fontSize: 14 }} className="mb-1">DALYs/year by Pathogen (max per pathogen)</p>
                        <ResponsiveContainer width="100%" height={isMobile ? 200 : 260}>
                          <BarChart data={chartDataPathogen} margin={{ top: 5, right: 10, left: isMobile ? -10 : 10, bottom: 65 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false}/>
                            <XAxis dataKey="pathogen" tick={{ fontSize: 12, fill: C.textMid }} angle={-35} textAnchor="end" interval={0}/>
                            <YAxis scale="log" domain={[1e-9, 1e-2]}
                                   tick={{ fontSize: 12, fill: C.textMid }}
                                   tickFormatter={v => v.toExponential(0)}
                                   label={!isMobile ? { value: "DALYs/yr (log)", angle: -90, position: "insideLeft", fontSize: 12, fill: C.textMid, offset: 10 } : undefined}/>
                            <Tooltip content={<CustomTooltip/>}/>
                            <ReferenceLine y={WHO_BENCHMARK} stroke={C.accent} strokeDasharray="5 5"
                                           label={{ value: `10⁻⁶`, position: "insideTopRight", fill: C.accent, fontSize: 12 }}/>
                            <Bar dataKey="daly" radius={[3, 3, 0, 0]} maxBarSize={40}>
                              {chartDataPathogen.map((e, i) => <Cell key={i} fill={riskFromDaly(e.daly, thresholds).color}/>)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>

                        {/* By Site */}
                        <p style={{ color: C.textDark, fontWeight: 600, fontSize: 14 }} className="mb-1 mt-5">DALYs/year by Site (max per site)</p>
                        <ResponsiveContainer width="100%" height={isMobile ? 200 : 260}>
                          <BarChart data={chartDataSite} margin={{ top: 5, right: 10, left: isMobile ? -10 : 10, bottom: 65 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false}/>
                            <XAxis dataKey="site" tick={{ fontSize: 12, fill: C.textMid }} angle={-35} textAnchor="end" interval={0}/>
                            <YAxis scale="log" domain={[1e-9, 1e-2]}
                                   tick={{ fontSize: 12, fill: C.textMid }}
                                   tickFormatter={v => v.toExponential(0)}
                                   label={!isMobile ? { value: "DALYs/yr (log)", angle: -90, position: "insideLeft", fontSize: 12, fill: C.textMid, offset: 10 } : undefined}/>
                            <Tooltip content={<CustomTooltip/>}/>
                            <ReferenceLine y={WHO_BENCHMARK} stroke={C.accent} strokeDasharray="5 5"
                                           label={{ value: `10⁻⁶`, position: "insideTopRight", fill: C.accent, fontSize: 12 }}/>
                            <Bar dataKey="daly" radius={[3, 3, 0, 0]} maxBarSize={40}>
                              {chartDataSite.map((e, i) => <Cell key={i} fill={riskFromDaly(e.daly, thresholds).color}/>)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </>
                    )}
                  </div>
                )}

                {/* ── Box Plot ── */}
                {activeTab === "box" && (
                  <div>
                    {results.length === 0 ? (
                      <EmptyState icon={BarChart2} title="No data assessed" sub="Upload a sample file to see box plots."/>
                    ) : (
                      <>
                        <div className="flex items-center gap-3 flex-wrap mb-4">
                          <div>
                            <label style={{ fontSize: 13, color: C.textMid, fontWeight: 600, marginRight: 6 }}>Metric</label>
                            <select value={boxMetric} onChange={e => setBoxMetric(e.target.value)}
                                    style={{ border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 14,
                                             padding: "5px 10px", background: "white", color: C.textDark, cursor: "pointer" }}>
                              <option value="daly">DALYs/person/year</option>
                              <option value="p_infection">P(infection) per event</option>
                              <option value="p_annual">P(annual infection)</option>
                              <option value="p_illness">P(illness)</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: 13, color: C.textMid, fontWeight: 600, marginRight: 6 }}>Group by</label>
                            <select value={boxGroup} onChange={e => setBoxGroup(e.target.value)}
                                    style={{ border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 14,
                                             padding: "5px 10px", background: "white", color: C.textDark, cursor: "pointer" }}>
                              <option value="site">Site</option>
                              <option value="pathogen">Pathogen</option>
                              <option value="sample_type">Sample Type</option>
                              <option value="exposure_type">Exposure Type</option>
                            </select>
                          </div>
                        </div>
                        <p style={{ color: C.textMid, fontSize: 14 }} className="mb-3">
                          Distribution of {boxMetric === "daly" ? "DALYs/yr" : boxMetric} grouped by {boxGroup}.
                          Log scale applied
                          {boxMetric === "daly" ? " — dashed line marks WHO 10⁻⁶ benchmark" :
                           boxMetric === "p_annual" ? " — dashed line marks EPA/WHO 10⁻⁴ infection threshold" : ""}.
                        </p>
                        <BoxPlot
                          data={displayResults}
                          xKey={boxGroup}
                          yKey={boxMetric}
                          yLabel={boxMetric === "daly" ? "DALYs/yr" : boxMetric}
                          benchmarkY={
                            boxMetric === "daly"     ? WHO_BENCHMARK :
                            boxMetric === "p_annual" ? (infectionThresholds.find(t => t.min > 0)?.min ?? 1e-4) :
                            undefined
                          }
                          benchmarkLabel={
                            boxMetric === "daly"     ? "WHO 10⁻⁶ benchmark" :
                            boxMetric === "p_annual" ? "EPA/WHO 10⁻⁴ threshold" :
                            undefined
                          }
                        />
                      </>
                    )}
                  </div>
                )}

                {/* ── By Site ── */}
                {activeTab === "site" && (
                  <div>
                    {results.length === 0 ? (
                      <EmptyState icon={MapPin} title="No data assessed" sub="Upload a sample file to see site breakdown."/>
                    ) : (
                      <>
                        <p style={{ color: C.textMid, fontSize: 14 }} className="mb-3">
                          Aggregated DALY risk per sampling site — highest value observed at each location.
                        </p>
                        {sites.slice((sitePage - 1) * SITE_PAGE_SIZE, sitePage * SITE_PAGE_SIZE).map(site => {
                          const rows = results.filter(r => r.site === site);
                          const dalyVals = rows.map(r => r.daly);
                          const maxDaly = Math.max(...dalyVals);
                          const minDaly = Math.min(...dalyVals);
                          const pathogens = [...new Set(rows.map(r => r.pathogen))].length;
                          const lvl = riskFromDaly(maxDaly, thresholds);
                          return (
                            <div key={site} style={{ background: lvl.bg, border: `1px solid ${lvl.color}33`,
                                                     borderRadius: 12, marginBottom: 10, padding: "12px 14px" }}>
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div>
                                  <span style={{ color: C.textDark, fontWeight: 700, fontSize: 16 }}>{site}</span>
                                  <span style={{ color: C.textMid, fontSize: 13, marginLeft: 6 }}>
                                    ({rows.length} samples · {pathogens} pathogen{pathogens !== 1 ? "s" : ""})
                                  </span>
                                </div>
                                <span style={{ background: lvl.color, color: "white", fontWeight: 600,
                                               fontSize: 13, padding: "2px 10px", borderRadius: 999 }}>
                                  {lvl.label}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2">
                                <div>
                                  <span style={{ color: C.textMid, fontSize: 13 }}>Max DALYs/yr: </span>
                                  <span style={{ color: lvl.color, fontWeight: 700, fontSize: 15 }}>{maxDaly.toExponential(2)}</span>
                                </div>
                                <div>
                                  <span style={{ color: C.textMid, fontSize: 13 }}>Min DALYs/yr: </span>
                                  <span style={{ color: C.textMid, fontWeight: 600, fontSize: 15 }}>{minDaly.toExponential(2)}</span>
                                </div>
                                <div>
                                  <span style={{ color: C.textMid, fontSize: 13 }}>Exceed WHO benchmark: </span>
                                  <span style={{ color: rows.filter(r => r.daly >= WHO_BENCHMARK).length > 0 ? C.accent : "#059669",
                                                 fontWeight: 700, fontSize: 15 }}>
                                    {rows.filter(r => r.daly >= WHO_BENCHMARK).length} / {rows.length}
                                  </span>
                                </div>
                                <div>
                                  <span style={{ color: C.textMid, fontSize: 13 }}>Sample Type: </span>
                                  <span style={{ color: C.textMid, fontWeight: 600, fontSize: 15 }}>
                                    {[...new Set(rows.map(r => r.sample_type))].join(", ")}
                                  </span>
                                </div>
                                <div>
                                  <span style={{ color: C.textMid, fontSize: 13 }}>Exposure Type: </span>
                                  <span style={{ color: C.textMid, fontWeight: 600, fontSize: 15 }}>
                                    {[...new Set(rows.map(r => r.exposure_type).filter(Boolean))].join(", ") || "—"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <Pagination page={sitePage} total={sites.length} pageSize={SITE_PAGE_SIZE} onChange={setSitePage}/>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Sensitivity Analysis ── */}
            <SensitivityHeatmap results={results} C={C} />

            <button onClick={() => { setResults(null); setApiErrors([]); setWarnings([]); setApiError(null); setActiveTab("table"); }}
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
