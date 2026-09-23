import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import {
  Upload, FileSpreadsheet, AlertTriangle, CheckCircle, XCircle,
  ChevronRight, Download, Info, Activity, Beaker, Shield,
  FileText, Table, FileDown, ChevronDown, Printer, CheckSquare,
  Loader2, X,
} from "lucide-react";
import * as XLSX from "xlsx";

import Header         from "../components/Header";
import NavBar         from "../components/NavBar";
import Footer         from "../components/Footer";
import useBreakpoint  from "../hooks/useBreakpoint";
import { calculateRQ, getModuleConfig, getCompounds } from "../services/api";


// ─── Colour palette ──────────────────────────────────────────────────────────
const C = {
  primary:   "#1E40AF",
  accent:    "#DC2626",
  teal:      "#0D9488",
  yellow:    "#D97706",
  bg:        "#F0F4F8",
  cardBg:    "#FFFFFF",
  border:    "#CBD5E1",
  textDark:  "#0F172A",
  textMid:   "#475569",
  textLight: "#94A3B8",
};

// ─── Threshold helpers ────────────────────────────────────────────────────────
// Default mirrors module_config.risk_thresholds in DB (PNAS Nexus 2025 scheme).
const DEFAULT_THRESHOLDS = [
  { label: 'Low Risk',       min: 0,   max: 0.1,  color: '#059669' },
  { label: 'Moderate Risk',  min: 0.1, max: 1,    color: '#D97706' },
  { label: 'High Risk',      min: 1,   max: 10,   color: '#EA580C' },
  { label: 'Very High Risk', min: 10,  max: null,  color: '#DC2626' },
];

export const riskLevel = (rq, thresholds = DEFAULT_THRESHOLDS) => {
  let result = thresholds[0];
  for (const t of thresholds) {
    if (rq >= t.min) result = t;
  }
  return { label: result.label, color: result.color, bg: result.color + '22' };
};

// ─── Pagination ──────────────────────────────────────────────────────────────
const Pagination = ({ page, total, pageSize, onChange }) => {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const getPages = () => {
    const delta = 2;
    const range = [];
    for (let i = Math.max(2, page - delta); i <= Math.min(totalPages - 1, page + delta); i++) {
      range.push(i);
    }
    if (page - delta > 2) range.unshift('...');
    if (page + delta < totalPages - 1) range.push('...');
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
          p === '...'
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

// ─── Category badge ───────────────────────────────────────────────────────────
const CATEGORY_COLOURS = {
  'Antibiotic':                  { color: '#1D4ED8', bg: '#DBEAFE' },
  'Pharmaceutical':              { color: '#7C3AED', bg: '#EDE9FE' },
  'Pesticide':                   { color: '#B45309', bg: '#FEF3C7' },
  'Antimicrobial':               { color: '#0D9488', bg: '#CCFBF1' },
  'Heavy Metal':                 { color: '#475569', bg: '#E2E8F0' },
  'Food Additive':               { color: '#D97706', bg: '#FEF9C3' },
  'Insect Repellent':            { color: '#059669', bg: '#D1FAE5' },
  'Industrial Chemical':         { color: '#64748B', bg: '#F1F5F9' },
  'UV Filter':                   { color: '#9333EA', bg: '#F3E8FF' },
  'Quaternary Ammonium Compound':{ color: '#DB2777', bg: '#FCE7F3' },
};
const DEFAULT_CATEGORY_COLOUR = { color: '#475569', bg: '#F1F5F9' };

const categoryColour = (cls) => {
  if (!cls) return DEFAULT_CATEGORY_COLOUR;
  const group = cls.split(' - ')[0].trim();
  return CATEGORY_COLOURS[group] ?? CATEGORY_COLOURS[cls] ?? DEFAULT_CATEGORY_COLOUR;
};

const CategoryBadge = ({ value }) => {
  const { color, bg } = categoryColour(value);
  return (
    <span style={{ background: bg, color, border: `1px solid ${color}33`,
                   fontSize: 12, fontWeight: 600, padding: '2px 7px',
                   borderRadius: 999, whiteSpace: 'nowrap' }}>
      {value ?? '—'}
    </span>
  );
};

// ─── Risk badge ───────────────────────────────────────────────────────────────
const RiskBadge = ({ value, thresholds }) => {
  const r = riskLevel(value, thresholds);
  return (
    <span style={{ background: r.bg, color: r.color, border: `1px solid ${r.color}33` }}
          className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
      {r.label}
    </span>
  );
};

// ─── Download utilities ───────────────────────────────────────────────────────
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function downloadCSV(data, thresholds) {
  const headers = ["#","Sample ID","Site","Category","Compound","Code","MEC","Unit","PNEC_Eco","PNEC_AMR","RQ_Eco","RQ_AMR","Eco Toxicity Risk","AMR Risk"];
  const rows = data.map((r,i) => [
    i+1, r.sample_id ?? '', r.site, r.compound_class ?? '', r.compound_name, r.compound_code,
    r.mec, r.mec_unit, r.pnec_eco ?? '', r.pnec_amr ?? '',
    r.rq_eco != null ? r.rq_eco.toFixed(4) : '',
    r.rq_amr != null ? r.rq_amr.toFixed(4) : '',
    r.rq_eco != null ? riskLevel(r.rq_eco, thresholds).label : 'No PNEC',
    r.rq_amr != null ? riskLevel(r.rq_amr, thresholds).label : 'No PNEC',
  ]);
  const csv = [headers,...rows].map(row => row.map(v=>`"${v}"`).join(",")).join("\n");
  triggerDownload(new Blob([csv],{type:"text/csv;charset=utf-8;"}),
    `AMR_RQ_Results_${new Date().toISOString().slice(0,10)}.csv`);
}

function downloadXLSX(data, thresholds) {
  const wb = XLSX.utils.book_new();
  const wsDetail = XLSX.utils.aoa_to_sheet([
    ["#","Sample ID","Site","Category","Compound","Code","MEC","Unit","PNEC_Eco","PNEC_AMR","RQ_Eco","RQ_AMR","Eco Toxicity Risk","AMR Risk"],
    ...data.map((r,i)=>[
      i+1, r.sample_id ?? '', r.site, r.compound_class ?? '', r.compound_name, r.compound_code,
      r.mec, r.mec_unit, r.pnec_eco ?? '', r.pnec_amr ?? '',
      r.rq_eco != null ? r.rq_eco.toFixed(4) : '',
      r.rq_amr != null ? r.rq_amr.toFixed(4) : '',
      r.rq_eco != null ? riskLevel(r.rq_eco, thresholds).label : 'No PNEC',
      r.rq_amr != null ? riskLevel(r.rq_amr, thresholds).label : 'No PNEC',
    ])
  ]);
  wsDetail["!cols"]=[{wch:4},{wch:12},{wch:14},{wch:24},{wch:28},{wch:12},{wch:10},{wch:8},{wch:12},{wch:12},{wch:10},{wch:10},{wch:16},{wch:16}];
  XLSX.utils.book_append_sheet(wb,wsDetail,"RQ Results");

  const sites=[...new Set(data.map(r=>r.site))];
  const wsSummary=XLSX.utils.aoa_to_sheet([
    ["Site","Compounds Tested","Max RQ (Eco Tox)","Max RQ (AMR)","Overall Risk Level"],
    ...sites.map(site=>{
      const rows=data.filter(r=>r.site===site);
      const ecoVals=rows.map(r=>r.rq_eco).filter(v=>v!=null);
      const amrVals=rows.map(r=>r.rq_amr).filter(v=>v!=null);
      const maxEco=ecoVals.length?Math.max(...ecoVals):null;
      const maxAmr=amrVals.length?Math.max(...amrVals):null;
      const maxVal=Math.max(maxEco??0,maxAmr??0);
      return[site,rows.length,
        maxEco!=null?maxEco.toFixed(4):'',
        maxAmr!=null?maxAmr.toFixed(4):'',
        riskLevel(maxVal, thresholds).label];
    })
  ]);
  wsSummary["!cols"]=[{wch:16},{wch:18},{wch:14},{wch:14},{wch:20}];
  XLSX.utils.book_append_sheet(wb,wsSummary,"Site Summary");

  const now=new Date();
  const thresholdRows = thresholds.map(t =>
    [t.max != null ? `${t.min} ≤ RQ < ${t.max}` : `RQ ≥ ${t.min}`, t.label]
  );
  const wsMeta=XLSX.utils.aoa_to_sheet([
    ["RADAR — RQ Report"],[""],
    ["Generated",now.toLocaleString()],["Tool Version","v1.0"],
    ["Method","Risk Quotient (RQ)"],["Formula","RQ = MEC / PNEC"],
    ["PNEC Source","AMR Industry Alliance"],
    ["Reference","Tran et al. 2019, Sci Total Environ 692, 157-174"],
    [""],["Risk Thresholds"],
    ...thresholdRows,
  ]);
  wsMeta["!cols"]=[{wch:22},{wch:52}];
  XLSX.utils.book_append_sheet(wb,wsMeta,"Metadata");
  const buf=XLSX.write(wb,{bookType:"xlsx",type:"array"});
  triggerDownload(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),
    `AMR_RQ_Results_${now.toISOString().slice(0,10)}.xlsx`);
}

// ─── Download dropdown ────────────────────────────────────────────────────────
const DownloadMenu = ({ data, thresholds, onToast, disabled }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const opts = [
    { icon:Table,    label:"CSV",            sub:"Opens in any spreadsheet app",       color:"#059669", bg:"#D1FAE5", fn:()=>{ downloadCSV(data, thresholds);    onToast("CSV download started");   } },
    { icon:FileDown, label:"Excel (.xlsx)",  sub:"3 sheets: Results, Summary, Meta",   color:C.primary, bg:"#DBEAFE", fn:()=>{ downloadXLSX(data, thresholds); onToast("Excel download started");  } },
    { icon:Printer,  label:"Print / PDF",    sub:"Use browser Save as PDF option",     color:"#7C3AED", bg:"#EDE9FE", fn:()=>{ window.print();                   onToast("Print dialog opened");    } },
  ];
  return (
    <div className="relative" ref={ref}>
      <button onClick={()=>!disabled && setOpen(o=>!o)}
              disabled={disabled}
              style={{ background: disabled ? "#94A3B8" : C.primary, color:"white", cursor: disabled ? "not-allowed" : "pointer" }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold">
        <Download size={13}/> Export
        <ChevronDown size={11} style={{ transform:open?"rotate(180deg)":"none", transition:"0.2s" }}/>
      </button>
      {open && (
        <div style={{ position:"absolute", right:0, top:"calc(100% + 8px)", width:260,
                      background:"white", border:`1px solid ${C.border}`, borderRadius:12,
                      boxShadow:"0 8px 32px rgba(0,0,0,0.12)", zIndex:100 }}>
          <div style={{ borderBottom:`1px solid ${C.border}`, padding:"10px 14px" }}>
            <p style={{ color:C.textDark, fontWeight:700, fontSize:15 }}>Export Options</p>
            <p style={{ color:C.textMid, fontSize:13 }}>{data.length} records · RQ Results</p>
          </div>
          <div style={{ padding:"6px" }}>
            {opts.map(o=>(
              <button key={o.label} onClick={()=>{ setOpen(false); o.fn(); }}
                      className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-left">
                <div style={{ background:o.bg, borderRadius:8, padding:7, marginTop:1, flexShrink:0 }}>
                  <o.icon size={14} color={o.color}/>
                </div>
                <div>
                  <p style={{ color:C.textDark, fontWeight:600, fontSize:15 }}>{o.label}</p>
                  <p style={{ color:C.textMid, fontSize:13 }}>{o.sub}</p>
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
  useEffect(()=>{ const t=setTimeout(onDone,3000); return()=>clearTimeout(t); },[onDone]);
  return (
    <div style={{ position:"fixed", bottom:20, left:"50%", transform:"translateX(-50%)",
                  zIndex:999, background:"#0F172A", color:"white", whiteSpace:"nowrap",
                  borderRadius:10, padding:"10px 20px", display:"flex",
                  alignItems:"center", justifyContent:"center", gap:8,
                  boxShadow:"0 4px 20px rgba(0,0,0,0.25)", fontSize:14, fontWeight:500 }}>
      <CheckSquare size={16} color="#34D399"/> {message}
    </div>
  );
};

// ─── Upload Zone ──────────────────────────────────────────────────────────────
const UploadZone = ({ onCalculate, onDownloadTemplate }) => {
  const [dragging, setDragging] = useState(false);
  const [file,     setFile]     = useState(null);
  const inputRef = useRef(null);
  const clearFile = useCallback((e) => {
    e.stopPropagation();
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);
  const handleDrop = useCallback((e)=>{
    e.preventDefault(); setDragging(false);
    const f=e.dataTransfer.files[0]; if(f) setFile(f);
  },[]);
  return (
    <div className="space-y-3">
      <label htmlFor="rq-file-input"
           onDragOver={(e)=>{e.preventDefault();setDragging(true);}}
           onDragLeave={()=>setDragging(false)} onDrop={handleDrop}
           style={{ border:`2px dashed ${dragging?C.primary:C.border}`,
                    background:dragging?"#EFF6FF":"#F8FAFC", transition:"all 0.2s",
                    position: "relative", display:"block" }}
           className="rounded-xl p-6 md:p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50">
        <input id="rq-file-input" ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
               onChange={(e)=>setFile(e.target.files[0])}/>
        {file && (
          <button onClick={(e)=>{ e.preventDefault(); clearFile(e); }}
                  style={{ position:"absolute", top:8, right:8, background:"white",
                           border:`1px solid ${C.border}`, borderRadius:"50%",
                           width:24, height:24, display:"flex", alignItems:"center",
                           justifyContent:"center", cursor:"pointer", flexShrink:0 }}>
            <X size={13} color={C.textMid}/>
          </button>
        )}
        <Upload className="mx-auto mb-2" size={32} color={C.primary}/>
        <p style={{ color:C.textDark }} className="font-semibold text-sm md:text-base">
          {file ? file.name : "Drop your Excel file here"}
        </p>
        <p style={{ color:C.textMid }} className="text-xs md:text-sm mt-1">
          {file ? `${(file.size/1024).toFixed(1)} KB — ready to process`
                : "Supports .xlsx or .xls · Based on the AMR-RQ template"}
        </p>
      </label>
      <div style={{ background:"#EFF6FF", border:"1px solid #BFDBFE" }}
           className="rounded-lg px-3 py-2.5 flex items-start gap-2">
        <Info size={15} color={C.primary} style={{ flexShrink:0, marginTop:1 }}/>
        <span style={{ color:C.primary }} className="text-xs md:text-sm">
          First time?&nbsp;
          <button className="underline font-semibold" onClick={onDownloadTemplate}>
            Download the Excel template
          </button>
          &nbsp;to ensure correct column structure.
        </span>
      </div>
      <button onClick={()=>onCalculate(file)} disabled={!file}
              style={{ background:file?C.primary:"#94A3B8" }}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm md:text-base flex items-center justify-center gap-2">
        <Beaker size={16}/> {file?"Calculate Risk Quotients":"Upload a file to continue"}
      </button>
    </div>
  );
};

// ─── Summary Cards ────────────────────────────────────────────────────────────
const SummaryCards = ({ data }) => {
  const highRisk = data.filter(d=>(d.rq_eco??0)>=1||(d.rq_amr??0)>=1).length;
  const ecoVals = data.map(d=>d.rq_eco).filter(v=>v!=null);
  const amrVals = data.map(d=>d.rq_amr).filter(v=>v!=null);
  const maxEco = ecoVals.length ? Math.max(...ecoVals) : 0;
  const maxAmr = amrVals.length ? Math.max(...amrVals) : 0;
  const cards = [
    { label:"Samples Analysed",   value:data.length,       icon:FileSpreadsheet, color:C.primary },
    { label:"Samples with RQ ≥ 1",value:highRisk,          icon:AlertTriangle,   color:C.yellow  },
    { label:"Max RQ (Eco)",       value:maxEco.toFixed(4), icon:Beaker,          color:C.accent  },
    { label:"Max RQ (AMR)",       value:maxAmr.toFixed(4), icon:Shield,          color:"#7C3AED" },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(card=>(
        <div key={card.label}
             style={{ background:C.cardBg, border:`1px solid ${C.border}` }}
             className="rounded-xl p-3 md:p-4 flex items-center gap-2 md:gap-3">
          <div style={{ background:card.color+"18", borderRadius:8, padding:8, flexShrink:0 }}>
            <card.icon size={18} color={card.color}/>
          </div>
          <div className="min-w-0">
            <p style={{ color:C.textMid, fontSize:12 }} className="truncate">{card.label}</p>
            <p style={{ color:C.textDark }} className="text-lg md:text-xl font-bold">{card.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Instructions ────────────────────────────────────────────────────────────
const Instructions = () => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: C.cardBg, border: `1px solid ${C.border}` }} className="rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
        <div className="flex items-center gap-2">
          <Info size={15} color={C.primary}/>
          <span style={{ color: C.textDark, fontWeight: 600, fontSize: 16 }}>How to Use the RQ Module</span>
        </div>
        <ChevronDown size={15} color={C.textMid}
                     style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '0.2s' }}/>
      </button>

      {open && (
        <div style={{ borderTop: `1px solid ${C.border}` }} className="p-4 md:p-5 space-y-4">

          {/* Steps */}
          <div>
            <p style={{ color: C.textDark, fontWeight: 600, fontSize: 15 }} className="mb-3">Steps</p>
            <div className="space-y-2.5">
              {[
                { n: 1, title: 'Download the template',  body: 'Click "Download the Excel template" in the upload panel to get the pre-formatted file with all compound columns ready.' },
                { n: 2, title: 'Fill in MEC values',     body: 'Enter your measured environmental concentrations (MEC) in ng/L for each compound. Leave blank if not measured at that site.' },
                { n: 3, title: 'Upload the file',        body: 'Drag and drop or click to select your completed .xlsx or .xls file in the upload panel.' },
                { n: 4, title: 'Review your results',    body: 'RQ_Eco and RQ_AMR are calculated automatically. Explore results in the Data Table, Bar Chart, or By Site tabs and export as needed.' },
              ].map(s => (
                <div key={s.n} className="flex gap-3 items-start">
                  <div style={{ background: C.primary, color: 'white', borderRadius: '50%', width: 22, height: 22,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
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
          <div style={{ background: '#F8FAFC', border: `1px solid ${C.border}`, borderRadius: 10 }} className="p-3 md:p-4">
            <p style={{ color: C.textDark, fontWeight: 600, fontSize: 15 }} className="mb-2.5">Template Structure</p>
            <div className="space-y-2">
              {[
                { row: 'Row 1', label: 'Unit row',    body: 'Each compound column must contain ng/L. Fixed columns (Sample_ID, Site, etc.) are left blank.' },
                { row: 'Row 2', label: 'Header row',  body: 'Fixed columns first: Sample_ID, Site, Month, Date, Category, Sub_category. Then compound columns in the format Compound Name (CODE) — e.g. Ciprofloxacin (CIPX).' },
                { row: 'Row 3+', label: 'Data rows', body: 'One row per sample. Enter MEC values only — do not include units in these cells.' },
              ].map(r => (
                <div key={r.row} className="flex gap-3 items-start">
                  <span style={{ background: C.primary + '18', color: C.primary, fontWeight: 700,
                                 fontSize: 13, padding: '2px 7px', borderRadius: 5, flexShrink: 0, marginTop: 1 }}>
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
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8 }} className="px-3 py-2.5 flex items-start gap-2">
            <AlertTriangle size={14} color={C.yellow} style={{ flexShrink: 0, marginTop: 1 }}/>
            <p style={{ color: '#92400E', fontSize: 14 }}>
              <strong>Important:</strong> Compound columns must include the code in parentheses, e.g.{' '}
              <code style={{ background: '#FEF3C7', padding: '1px 5px', borderRadius: 3, fontSize: 13 }}>Ciprofloxacin (CIPX)</code>.
              Columns without a recognised code will be skipped and flagged as warnings.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Empty state ─────────────────────────────────────────────────────────────
const EmptyState = ({ icon: Icon, title, sub }) => (
  <div className="flex flex-col items-center justify-center py-14 gap-3">
    <div style={{ background: "#F1F5F9", borderRadius: "50%", padding: 20 }}>
      <Icon size={32} color="#94A3B8"/>
    </div>
    <p style={{ color: "#0F172A", fontWeight: 600, fontSize: 17 }}>{title}</p>
    <p style={{ color: "#94A3B8", fontSize: 15 }}>{sub}</p>
  </div>
);

// ─── Threshold icons (by position: low, moderate, high+) ─────────────────────
const THRESHOLD_ICONS = [CheckCircle, AlertTriangle, XCircle, XCircle];

// ─── RQ Page ──────────────────────────────────────────────────────────────────
export default function RQPage() {
  const navigate  = useNavigate();
  const { isMobile } = useBreakpoint();
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
  const [results,   setResults]   = useState(null);
  const [meta,      setMeta]      = useState(null);
  const [apiErrors, setApiErrors] = useState([]);
  const [warnings,  setWarnings]  = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [apiError,  setApiError]  = useState(null);
  const [activeTab, setActiveTab] = useState("table");
  const [toast,     setToast]     = useState(null);
  const [tablePage, setTablePage] = useState(1);
  const [sitePage,  setSitePage]  = useState(1);
  const [warnPage,  setWarnPage]  = useState(1);
  const [sortCol,   setSortCol]   = useState(null);
  const [sortDir,   setSortDir]   = useState('asc');
  const [filterSite,     setFilterSite]     = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterEcoRisk,  setFilterEcoRisk]  = useState('');
  const [filterAmrRisk,  setFilterAmrRisk]  = useState('');
  const TABLE_PAGE_SIZE = 20;
  const SITE_PAGE_SIZE  = 5;
  const WARN_PAGE_SIZE  = 5;

  useEffect(() => {
    getModuleConfig('RQ')
      .then(cfg => {
        const levels = cfg.risk_thresholds?.levels;
        if (Array.isArray(levels) && levels.length > 0) setThresholds(levels);
      })
      .catch(() => {});
  }, []);

  const downloadTemplate = async () => {
    try {
      const [compoundsData, cfg] = await Promise.all([
        getCompounds().catch(() => []),
        getModuleConfig('RQ').catch(() => ({})),
      ]);
      const compoundList = Array.isArray(compoundsData) ? compoundsData : compoundsData.results ?? [];
      const fixedCols = cfg.input_schema?.fixed_columns ?? ['Sample_ID', 'Site', 'Month', 'Date', 'Category', 'Sub_category'];

      const unitRow   = [...fixedCols.map(() => ''), ...compoundList.map(() => 'ng/L')];
      const headerRow = [...fixedCols, ...compoundList.map(c => `${c.compound_name} (${c.compound_code})`)];
      const exampleRow = [
        'SAMPLE_001', 'Site A', 'January', new Date().toISOString().slice(0, 10),
        'Effluent', 'Hospital',
        ...compoundList.map(() => ''),
      ];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([unitRow, headerRow, exampleRow]);
      ws['!cols'] = [
        ...fixedCols.map(() => ({ wch: 14 })),
        ...compoundList.map(() => ({ wch: 26 })),
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'RQ Data');
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      triggerDownload(
        new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        'AMR_RQ_Template.xlsx',
      );
      setToast('RQ template downloaded');
    } catch {
      setToast('Could not generate template. Check your connection.');
    }
  };

  const handleCalculate = async (file) => {
    setLoading(true);
    setApiError(null);
    try {
      const response = await calculateRQ(file);
      setResults(response.results);
      setMeta(response.meta);
      setApiErrors(response.errors || []);
      setWarnings(response.warnings || []);
      setTablePage(1);
      setSitePage(1);
      setWarnPage(1);
      setSortCol(null); setSortDir('asc');
      setFilterSite(''); setFilterCategory(''); setFilterEcoRisk(''); setFilterAmrRisk('');
    } catch (err) {
      setApiError(err.message || 'Calculation failed. Please check your file and try again.');
    } finally {
      setLoading(false);
    }
  };

  const sites = results ? [...new Set(results.map(r=>r.site))] : [];

  // Filter option lists derived from results
  const siteOptions     = useMemo(() => [...new Set(results?.map(r => r.site) ?? [])].sort(), [results]);
  const categoryOptions = useMemo(() => [...new Set(results?.map(r => r.compound_class).filter(Boolean) ?? [])].sort(), [results]);
  const riskOptions     = thresholds.map(t => t.label);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
    setTablePage(1);
  };

  const clearFilters = () => {
    setFilterSite(''); setFilterCategory(''); setFilterEcoRisk(''); setFilterAmrRisk('');
    setSortCol(null); setSortDir('asc'); setTablePage(1);
  };

  const hasFilters = filterSite || filterCategory || filterEcoRisk || filterAmrRisk;

  // Filtered + sorted view of results for the table
  const displayResults = useMemo(() => {
    if (!results) return [];
    let rows = [...results];
    if (filterSite)     rows = rows.filter(r => r.site === filterSite);
    if (filterCategory) rows = rows.filter(r => r.compound_class === filterCategory);
    if (filterEcoRisk)  rows = rows.filter(r => r.rq_eco != null && riskLevel(r.rq_eco, thresholds).label === filterEcoRisk);
    if (filterAmrRisk)  rows = rows.filter(r => r.rq_amr != null && riskLevel(r.rq_amr, thresholds).label === filterAmrRisk);
    if (sortCol) {
      rows.sort((a, b) => {
        const av = a[sortCol] ?? '';
        const bv = b[sortCol] ?? '';
        const cmp = typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return rows;
  }, [results, filterSite, filterCategory, filterEcoRisk, filterAmrRisk, sortCol, sortDir, thresholds]);

  // Reference lines for chart — first two threshold boundaries
  const refLine1 = thresholds[1]?.min ?? 1;
  const refLine2 = thresholds[2]?.min ?? 10;

  // Aggregate results by compound for chart: max RQ per compound across all samples
  const chartData = useMemo(() => {
    if (!results?.length) return [];
    const byCode = {};
    for (const r of results) {
      if (!byCode[r.compound_code]) {
        byCode[r.compound_code] = { name: r.compound_code, ecoMax: null, amrMax: null };
      }
      if (r.rq_eco != null) byCode[r.compound_code].ecoMax = Math.max(byCode[r.compound_code].ecoMax ?? 0, r.rq_eco);
      if (r.rq_amr != null) byCode[r.compound_code].amrMax = Math.max(byCode[r.compound_code].amrMax ?? 0, r.rq_amr);
    }
    return Object.values(byCode).sort(
      (a, b) => Math.max(b.ecoMax ?? 0, b.amrMax ?? 0) - Math.max(a.ecoMax ?? 0, a.amrMax ?? 0)
    );
  }, [results]);

  return (
    <div style={{ background:C.bg, minHeight:"100vh", fontFamily:"'Inter',sans-serif" }}>
      <Header accent="#1D4ED8" />
      <NavBar/>

      <main className="p-3 md:p-6 max-w-screen-xl mx-auto space-y-4 md:space-y-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1" style={{ color:C.textMid, fontSize:14 }}>
          <button onClick={()=>navigate("/")}
                  style={{ color:C.primary, fontWeight:500, background:"none", border:"none", cursor:"pointer", padding:0, fontSize:14 }}>
            Home
          </button>
          <ChevronRight size={13}/>
          <span style={{ color:C.primary, fontWeight:600, fontSize:14 }}>Risk Quotient (RQ)</span>
        </div>

        {/* ── Upload layout: stacked on mobile/tablet, side-by-side on desktop ── */}
        {!results && (
          <div className="space-y-4">
          <Instructions/>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.6fr] gap-4 md:gap-6">

            {/* Formulas + thresholds */}
            <div className="space-y-3 md:space-y-4">
              <div style={{ background:C.cardBg, border:`1px solid ${C.border}` }} className="rounded-xl p-4 md:p-5">
                <h3 style={{ color:C.textDark }} className="font-semibold mb-3 flex items-center gap-2 text-sm md:text-base">
                  <Beaker size={15} color={C.teal}/> RQ Formulae
                </h3>
                <div style={{ background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:10 }} className="p-3 md:p-4 space-y-3">
                  {[
                    { label:"RQ_Eco", eq:"MEC ÷ PNEC_Eco", desc:"Ecological Toxicity" },
                    { label:"RQ_AMR", eq:"MEC ÷ PNEC_AMR", desc:"AMR resistance risk" },
                  ].map(f=>(
                    <div key={f.label} className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <span style={{ color:C.primary, fontWeight:700, fontSize:16 }}>{f.label}</span>
                        <span style={{ color:C.textMid, fontSize:13 }} className="ml-1">{f.desc}</span>
                      </div>
                      <span style={{ color:C.teal, fontWeight:600, fontSize:14, background:"white",
                                     padding:"2px 8px", borderRadius:6, border:"1px solid #BBF7D0", flexShrink:0 }}>
                        = {f.eq}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-1" style={{ fontSize:13, color:C.textMid }}>
                  {[
                    ["MEC",      "Measured Environmental Concentration"],
                    ["PNEC_Eco", "Predicted No-Effect Conc. (ecological toxicity)"],
                    ["PNEC_AMR", "Predicted No-Effect Conc. (min. inhibition)"],
                  ].map(([k,v])=>(
                    <div key={k} className="flex gap-2">
                      <span style={{ color:C.primary, fontWeight:600, minWidth:64 }}>{k}</span>
                      <span>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background:C.cardBg, border:`1px solid ${C.border}` }} className="rounded-xl p-4 md:p-5">
                <h3 style={{ color:C.textDark }} className="font-semibold mb-3 text-sm md:text-base">Risk Thresholds</h3>
                {thresholds.map((t, idx) => {
                  const Icon = THRESHOLD_ICONS[idx] ?? XCircle;
                  const rangeLabel = t.max != null
                    ? (t.min === 0 ? `RQ < ${t.max}` : `${t.min} ≤ RQ < ${t.max}`)
                    : `RQ ≥ ${t.min}`;
                  const bg = t.color + '22';
                  return (
                    <div key={t.label} style={{ background: bg, borderRadius:8, marginBottom:6 }}
                         className="flex items-center gap-2 px-3 py-2">
                      <Icon size={14} color={t.color}/>
                      <span style={{ color:t.color, fontWeight:700, fontSize:14, minWidth:80 }}>{rangeLabel}</span>
                      <span style={{ color:t.color, fontSize:13 }}>{t.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Upload panel */}
            <div style={{ background:C.cardBg, border:`1px solid ${C.border}` }} className="rounded-xl p-4 md:p-6">
              <h2 style={{ color:C.textDark }} className="font-bold text-sm md:text-base mb-1">Upload Sample Data</h2>
              <p style={{ color:C.textMid }} className="text-xs md:text-sm mb-4">
                Upload your site readings via the AMR-RQ Excel template. The tool will automatically calculate RQ_Eco and RQ_AMR.
              </p>

              {apiError && (
                <div style={{ background:"#FEE2E2", border:"1px solid #FCA5A5", borderRadius:10 }}
                     className="flex items-start gap-2 px-3 py-2.5 mb-3">
                  <XCircle size={15} color={C.accent} style={{ flexShrink:0, marginTop:1 }}/>
                  <span style={{ color:C.accent, fontSize:14 }}>{apiError}</span>
                </div>
              )}

              {loading ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <Loader2 size={32} color={C.primary} className="animate-spin"/>
                  <p style={{ color:C.textMid, fontSize:15 }}>Calculating risk quotients…</p>
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
            <SummaryCards data={results}/>

            <div style={{ background:C.cardBg, border:`1px solid ${C.border}` }} className="rounded-xl overflow-hidden">

              {/* Tab bar + Export */}
              <div style={{ borderBottom:`1px solid ${C.border}` }} className="flex items-center">
                <div className="flex items-center overflow-x-auto whitespace-nowrap scrollbar-none flex-1">
                  {[
                    { id:"table", label:"Data Table",   icon:FileText  },
                    { id:"bar",   label:"Bar Chart",    icon:Activity  },
                    { id:"site",  label:"By Site",      icon:Shield    },
                  ].map(tab=>(
                    <button key={tab.id} onClick={()=>{ setActiveTab(tab.id); setTablePage(1); setSitePage(1); setWarnPage(1); }}
                            style={{
                              borderBottom: activeTab===tab.id?`3px solid ${C.primary}`:"3px solid transparent",
                              color:        activeTab===tab.id?C.primary:C.textMid,
                              fontWeight:   activeTab===tab.id?700:500,
                              flexShrink:   0,
                            }}
                            className="flex items-center gap-1.5 px-3 md:px-5 py-3 text-xs md:text-sm transition-all">
                      <tab.icon size={13}/> {tab.label}
                    </button>
                  ))}
                </div>
                <div className="px-3 md:px-4 flex items-center flex-shrink-0">
                  <DownloadMenu data={results} thresholds={thresholds} onToast={setToast} disabled={results.length === 0}/>
                </div>
              </div>

              {/* Tab content */}
              <div className="p-3 md:p-5">

                {/* Table */}
                {activeTab === "table" && (
                  <div>
                    {results.length === 0 && (
                      <EmptyState icon={FileSpreadsheet} title="No data analysed" sub="Upload a sample file to see results here."/>
                    )}
                    {results.length > 0 && (apiErrors.length > 0 || warnings.length > 0) && (() => {
                      const allMessages = [
                        ...warnings.map(w => ({ type: 'warn', message: w.message })),
                        ...apiErrors.map(e => ({ type: 'error', message: e.message })),
                      ];
                      const pageMessages = allMessages.slice((warnPage - 1) * WARN_PAGE_SIZE, warnPage * WARN_PAGE_SIZE);
                      return (
                        <div style={{ background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:8 }}
                             className="px-3 py-2 mb-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle size={14} color={C.yellow} style={{ flexShrink:0, marginTop:1 }}/>
                            <div style={{ fontSize:13, color:"#92400E", flex:1 }}>
                              {pageMessages.map((m,i) => <p key={i} className="mb-0.5">{m.message}</p>)}
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
                            { label:'Site',        value:filterSite,     setter:setFilterSite,     opts:siteOptions     },
                            { label:'Category',    value:filterCategory, setter:setFilterCategory, opts:categoryOptions },
                            { label:'Eco Risk',    value:filterEcoRisk,  setter:setFilterEcoRisk,  opts:riskOptions     },
                            { label:'AMR Risk',    value:filterAmrRisk,  setter:setFilterAmrRisk,  opts:riskOptions     },
                          ].map(f => (
                            <select key={f.label} value={f.value}
                                    onChange={e => { f.setter(e.target.value); setTablePage(1); }}
                                    style={{ border:`1px solid ${C.border}`, borderRadius:7, fontSize:13,
                                             padding:'4px 8px', color: f.value ? C.primary : C.textMid,
                                             background:'white', cursor:'pointer' }}>
                              <option value="">All {f.label}s</option>
                              {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          ))}
                          {hasFilters && (
                            <button onClick={clearFilters}
                                    style={{ fontSize:13, color:C.accent, border:`1px solid ${C.accent}33`,
                                             borderRadius:7, padding:'4px 10px', background:'#FEF2F2' }}>
                              Clear filters
                            </button>
                          )}
                          <span style={{ color:C.textMid, fontSize:13, marginLeft:'auto' }}>
                            {displayResults.length} of {results.length} rows
                          </span>
                        </div>

                        <div className="overflow-x-auto -mx-3 md:mx-0 px-3 md:px-0">
                          <table className="w-full text-xs md:text-sm" style={{ minWidth:900 }}>
                            <thead>
                              <tr style={{ background:"#F1F5F9" }}>
                                {[
                                  { label:'#',                sortKey: null            },
                                  { label:'Sample ID',        sortKey: 'sample_id'     },
                                  { label:'Site',             sortKey: 'site'          },
                                  { label:'Category',         sortKey: 'compound_class'},
                                  { label:'Compound',         sortKey: 'compound_name' },
                                  { label:'MEC',              sortKey: 'mec'           },
                                  { label:'Unit',             sortKey: null            },
                                  { label:'PNEC_Eco',         sortKey: 'pnec_eco'      },
                                  { label:'PNEC_AMR',         sortKey: 'pnec_amr'      },
                                  { label:'RQ_Eco',           sortKey: 'rq_eco'        },
                                  { label:'RQ_AMR',           sortKey: 'rq_amr'        },
                                  { label:'Eco Toxicity Risk',sortKey: 'rq_eco'        },
                                  { label:'AMR Risk',         sortKey: 'rq_amr'        },
                                ].map(col => (
                                  <th key={col.label}
                                      onClick={() => col.sortKey && handleSort(col.sortKey)}
                                      className="px-2 md:px-3 py-2 text-left font-semibold"
                                      style={{ color: sortCol===col.sortKey && col.sortKey ? C.primary : C.textMid,
                                               fontSize:13, cursor: col.sortKey ? 'pointer' : 'default',
                                               userSelect:'none', whiteSpace:'nowrap' }}>
                                    {col.label}
                                    {col.sortKey && (
                                      <span style={{ marginLeft:3, opacity: sortCol===col.sortKey ? 1 : 0.3 }}>
                                        {sortCol===col.sortKey ? (sortDir==='asc' ? '▲' : '▼') : '⇅'}
                                      </span>
                                    )}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {displayResults.slice((tablePage-1)*TABLE_PAGE_SIZE, tablePage*TABLE_PAGE_SIZE).map((r,i)=>{
                                const rowNum = (tablePage-1)*TABLE_PAGE_SIZE + i + 1;
                                return (
                                  <tr key={i} style={{ borderTop:`1px solid ${C.border}` }} className="hover:bg-slate-50">
                                    <td className="px-2 md:px-3 py-2" style={{ color:C.textLight }}>{rowNum}</td>
                                    <td className="px-2 md:px-3 py-2" style={{ color:C.textMid }}>{r.sample_id ?? '—'}</td>
                                    <td className="px-2 md:px-3 py-2 font-medium" style={{ color:C.textDark }}>{r.site}</td>
                                    <td className="px-2 md:px-3 py-2"><CategoryBadge value={r.compound_class}/></td>
                                    <td className="px-2 md:px-3 py-2 font-semibold" style={{ color:C.primary }}>
                                      <span title={r.compound_code}>{r.compound_name}</span>
                                    </td>
                                    <td className="px-2 md:px-3 py-2">{r.mec}</td>
                                    <td className="px-2 md:px-3 py-2" style={{ color:C.textMid }}>{r.mec_unit}</td>
                                    <td className="px-2 md:px-3 py-2">{r.pnec_eco ?? '—'}</td>
                                    <td className="px-2 md:px-3 py-2">{r.pnec_amr ?? '—'}</td>
                                    <td className="px-2 md:px-3 py-2 font-bold" style={{ color:r.rq_eco!=null?riskLevel(r.rq_eco,thresholds).color:C.textLight }}>
                                      {r.rq_eco!=null?r.rq_eco.toFixed(4):'—'}
                                    </td>
                                    <td className="px-2 md:px-3 py-2 font-bold" style={{ color:r.rq_amr!=null?riskLevel(r.rq_amr,thresholds).color:C.textLight }}>
                                      {r.rq_amr!=null?r.rq_amr.toFixed(4):'—'}
                                    </td>
                                    <td className="px-2 md:px-3 py-2">{r.rq_eco!=null?<RiskBadge value={r.rq_eco} thresholds={thresholds}/>:'—'}</td>
                                    <td className="px-2 md:px-3 py-2">{r.rq_amr!=null?<RiskBadge value={r.rq_amr} thresholds={thresholds}/>:'—'}</td>
                                  </tr>
                                );
                              })}
                              {displayResults.length === 0 && (
                                <tr><td colSpan={13} className="text-center py-10"
                                        style={{ color:C.textLight, fontSize:15 }}>No rows match the current filters.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        <Pagination page={tablePage} total={displayResults.length} pageSize={TABLE_PAGE_SIZE} onChange={setTablePage}/>

                        {/* Quick download */}
                        <div style={{ borderTop:`1px solid ${C.border}`, marginTop:12, paddingTop:12 }}
                             className="flex items-center gap-2 flex-wrap">
                          <span style={{ color:C.textMid, fontSize:13 }}>Quick download:</span>
                          {[
                            { label:"CSV",   color:"#059669", icon:Table,    fn:()=>{ downloadCSV(displayResults, thresholds);  setToast("CSV download started");  } },
                            { label:"Excel", color:C.primary, icon:FileDown, fn:()=>{ downloadXLSX(displayResults, thresholds); setToast("Excel download started"); } },
                            { label:"PDF",   color:"#7C3AED", icon:Printer,  fn:()=>{ window.print();                           setToast("Print dialog opened");   } },
                          ].map(btn=>(
                            <button key={btn.label} onClick={btn.fn}
                                    style={{ border:`1px solid ${btn.color}`, color:btn.color, fontSize:13 }}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:opacity-80 font-medium">
                              <btn.icon size={12}/> {btn.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Bar chart */}
                {activeTab === "bar" && (
                  <div>
                    {results.length === 0 ? (
                      <EmptyState icon={Activity} title="No data analysed" sub="Upload a sample file to see the chart."/>
                    ) : (
                      <>
                        {/* Legend + description */}
                        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
                          <p style={{ color:C.textMid, fontSize:14 }}>
                            Max RQ per compound across all samples, sorted highest first.
                            <br/>Log scale applied — dashed lines mark RQ = {refLine1} and RQ = {refLine2}.
                          </p>
                          <div className="flex items-center gap-3 flex-wrap">
                            {thresholds.map(t => (
                              <div key={t.label} className="flex items-center gap-1.5">
                                <div style={{ width:10, height:10, borderRadius:2, background:t.color }}/>
                                <span style={{ color:C.textMid, fontSize:13 }}>{t.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Ecological Toxicity */}
                        <p style={{ color:C.textDark, fontWeight:600, fontSize:14 }} className="mb-1">Ecological Toxicity (max per compound)</p>
                        <ResponsiveContainer width="100%" height={isMobile ? 200 : 260}>
                          <BarChart data={chartData.filter(d => d.ecoMax != null)} margin={{ top:5, right:10, left:isMobile?-10:10, bottom:65 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false}/>
                            <XAxis dataKey="name" tick={{ fontSize:12, fill:C.textMid }} angle={-35} textAnchor="end" interval={0}/>
                            <YAxis scale="log" domain={[0.001, 'auto']} allowDataKey={true}
                                   tick={{ fontSize:12, fill:C.textMid }}
                                   tickFormatter={v => v >= 1 ? Number(v.toFixed(0)).toLocaleString() : v.toFixed(3)}
                                   label={!isMobile ? { value:'RQ (log scale)', angle:-90, position:'insideLeft', fontSize:12, fill:C.textMid, offset:10 } : undefined}/>
                            <Tooltip formatter={(v, _, props) => [
                              props.payload.ecoMax != null ? props.payload.ecoMax.toFixed(4) : '—', 'Eco Toxicity'
                            ]}/>
                            <ReferenceLine y={refLine1} stroke={C.yellow}  strokeDasharray="5 5" label={{ value:`${refLine1}`,  position:'insideTopRight', fill:C.yellow,  fontSize:12 }}/>
                            <ReferenceLine y={refLine2} stroke={C.accent} strokeDasharray="5 5" label={{ value:`${refLine2}`, position:'insideTopRight', fill:C.accent, fontSize:12 }}/>
                            <Bar dataKey="ecoMax" radius={[3,3,0,0]} maxBarSize={40}>
                              {chartData.filter(d => d.ecoMax != null).map((e, i) => (
                                <Cell key={i} fill={riskLevel(e.ecoMax, thresholds).color}/>
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>

                        {/* RQ AMR */}
                        <p style={{ color:C.textDark, fontWeight:600, fontSize:14 }} className="mb-1 mt-5">Antimicrobial Resistance (max per compound)</p>
                        <ResponsiveContainer width="100%" height={isMobile ? 200 : 260}>
                          <BarChart data={chartData.filter(d => d.amrMax != null)} margin={{ top:5, right:10, left:isMobile?-10:10, bottom:65 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false}/>
                            <XAxis dataKey="name" tick={{ fontSize:12, fill:C.textMid }} angle={-35} textAnchor="end" interval={0}/>
                            <YAxis scale="log" domain={[0.001, 'auto']} allowDataKey={true}
                                   tick={{ fontSize:12, fill:C.textMid }}
                                   tickFormatter={v => v >= 1 ? Number(v.toFixed(0)).toLocaleString() : v.toFixed(3)}
                                   label={!isMobile ? { value:'RQ (log scale)', angle:-90, position:'insideLeft', fontSize:12, fill:C.textMid, offset:10 } : undefined}/>
                            <Tooltip formatter={(v, _, props) => [
                              props.payload.amrMax != null ? props.payload.amrMax.toFixed(4) : '—', 'AMR'
                            ]}/>
                            <ReferenceLine y={refLine1} stroke={C.yellow}  strokeDasharray="5 5" label={{ value:`${refLine1}`,  position:'insideTopRight', fill:C.yellow,  fontSize:12 }}/>
                            <ReferenceLine y={refLine2} stroke={C.accent} strokeDasharray="5 5" label={{ value:`${refLine2}`, position:'insideTopRight', fill:C.accent, fontSize:12 }}/>
                            <Bar dataKey="amrMax" radius={[3,3,0,0]} maxBarSize={40}>
                              {chartData.filter(d => d.amrMax != null).map((e, i) => (
                                <Cell key={i} fill={riskLevel(e.amrMax, thresholds).color}/>
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </>
                    )}
                  </div>
                )}

                {/* Risk by site */}
                {activeTab === "site" && (
                  <div>
                    {results.length === 0 ? (
                      <EmptyState icon={Shield} title="No data analysed" sub="Upload a sample file to see site breakdown."/>
                    ) : (
                      <>
                        <p style={{ color:C.textMid, fontSize:14 }} className="mb-3">
                          Aggregated risk per sampling site — highest RQ observed at each location.
                        </p>
                        {sites.slice((sitePage-1)*SITE_PAGE_SIZE, sitePage*SITE_PAGE_SIZE).map(site=>{
                          const rows = results.filter(r=>r.site===site);
                          const ecoVals = rows.map(r=>r.rq_eco).filter(v=>v!=null);
                          const amrVals = rows.map(r=>r.rq_amr).filter(v=>v!=null);
                          const maxEco = ecoVals.length ? Math.max(...ecoVals) : null;
                          const minEco = ecoVals.length ? Math.min(...ecoVals) : null;
                          const maxAmr = amrVals.length ? Math.max(...amrVals) : null;
                          const minAmr = amrVals.length ? Math.min(...amrVals) : null;
                          const maxVal = Math.max(maxEco ?? 0, maxAmr ?? 0);
                          const lvl = riskLevel(maxVal, thresholds);
                          return (
                            <div key={site} style={{ background:lvl.bg, border:`1px solid ${lvl.color}33`,
                                                      borderRadius:12, marginBottom:10, padding:"12px 14px" }}>
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div>
                                  <span style={{ color:C.textDark, fontWeight:700, fontSize:16 }}>{site}</span>
                                  <span style={{ color:C.textMid, fontSize:13, marginLeft:6 }}>({rows.length} compounds)</span>
                                </div>
                                <span style={{ background:lvl.color, color:"white", fontWeight:600,
                                               fontSize:13, padding:"2px 10px", borderRadius:999 }}>
                                  {lvl.label}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2">
                                <div>
                                  <span style={{ color:C.textMid, fontSize:13 }}>Max RQ (Eco Tox): </span>
                                  <span style={{ color:lvl.color, fontWeight:700, fontSize:15 }}>{maxEco!=null?maxEco.toFixed(4):'—'}</span>
                                </div>
                                <div>
                                  <span style={{ color:C.textMid, fontSize:13 }}>Max RQ (AMR): </span>
                                  <span style={{ color:lvl.color, fontWeight:700, fontSize:15 }}>{maxAmr!=null?maxAmr.toFixed(4):'—'}</span>
                                </div>
                                <div>
                                  <span style={{ color:C.textMid, fontSize:13 }}>Min RQ (Eco Tox): </span>
                                  <span style={{ color:C.textMid, fontWeight:600, fontSize:15 }}>{minEco!=null?minEco.toFixed(4):'—'}</span>
                                </div>
                                <div>
                                  <span style={{ color:C.textMid, fontSize:13 }}>Min RQ (AMR): </span>
                                  <span style={{ color:C.textMid, fontWeight:600, fontSize:15 }}>{minAmr!=null?minAmr.toFixed(4):'—'}</span>
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

            <button onClick={()=>{ setResults(null); setMeta(null); setApiErrors([]); setWarnings([]); setApiError(null); setActiveTab("table"); }}
                    style={{ border:`1px solid ${C.border}`, color:C.textMid }}
                    className="px-4 py-2 rounded-lg text-sm hover:bg-slate-50">
              ← Upload New File
            </button>
          </div>
        )}
      </main>

      <Footer/>
      {toast && <Toast message={toast} onDone={()=>setToast(null)}/>}
    </div>
  );
}
