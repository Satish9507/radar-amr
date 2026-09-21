import { useState, useEffect, useRef, useCallback } from 'react';
import { startSensitivityAnalysis, pollSensitivityStatus } from '../services/api';

// ── Colour helpers ────────────────────────────────────────────────────────────

function rhoToColor(rho) {
  const v = Math.max(-1, Math.min(1, rho));
  if (v >= 0) {
    const t = v;
    return `rgb(${Math.round(247 + t * (178 - 247))},${Math.round(247 + t * (24 - 247))},${Math.round(247 + t * (43 - 247))})`;
  }
  const t = -v;
  return `rgb(${Math.round(247 + t * (33 - 247))},${Math.round(247 + t * (102 - 247))},${Math.round(247 + t * (172 - 247))})`;
}

function textColor(rho) {
  return Math.abs(rho) > 0.55 ? '#fff' : '#222';
}

function sigStars(p) {
  if (p < 0.001) return '***';
  if (p < 0.01)  return '**';
  if (p < 0.05)  return '*';
  return '';
}

// ── Layout constants ──────────────────────────────────────────────────────────
const CW = 60;
const CH = 36;
const LP = 158;
const TP = 10;
const BP = 135;   // bottom padding for downward-angled labels
const RP = 140;   // right padding for last column's label overhang

// ── Method chips (header metadata) ───────────────────────────────────────────
function MethodChips() {
  const chips = [
    { label: 'Spearman Rank ρ',       symbol: 'ρ',  bg: '#E6F4FA', color: '#1565A0', mono: true },
    { label: 'n = 10,000 MC',         symbol: '⟳',  bg: '#EEF2FF', color: '#3730A3'             },
    { label: 'E. coli · ETEC + UPEC', symbol: '⬡',  bg: '#F0FDF4', color: '#166534'             },
    { label: 'Swimming · Kayaking',   symbol: '◎',  bg: '#FFF7ED', color: '#9A3412'             },
  ];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
      {chips.map((c, i) => (
        <span
          key={i}
          style={{
            background: c.bg,
            color: c.color,
            border: `1px solid ${c.color}44`,
            borderRadius: 100,
            padding: '3px 11px',
            fontSize: 12,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            letterSpacing: '0.01em',
          }}
        >
          <span style={{ fontWeight: 700, fontFamily: c.mono ? "'JetBrains Mono', monospace" : 'inherit' }}>
            {c.symbol}
          </span>
          {c.label}
        </span>
      ))}
    </div>
  );
}

// ── Stats cards (shown after results load) ────────────────────────────────────
function StatsRow({ nRows, nTotal, nSim, hasArb, darkMode }) {
  const cardBg     = darkMode ? '#252B3B' : '#F8FAFC';
  const cardBorder = darkMode ? '#2E3650' : '#E2E8F0';
  const valColor   = darkMode ? '#DDE3EF' : '#1C2330';
  const lblColor   = darkMode ? '#8896B8' : '#64748B';

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
      {/* Rows used */}
      <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 8, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#1B7FA3" strokeWidth={1.7} strokeLinecap="round">
          <rect x={3} y={3} width={18} height={18} rx={2}/>
          <line x1={3}  y1={9}  x2={21} y2={9}/>
          <line x1={3}  y1={15} x2={21} y2={15}/>
          <line x1={9}  y1={3}  x2={9}  y2={21}/>
        </svg>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: valColor, lineHeight: 1.1, fontFamily: "'JetBrains Mono', monospace" }}>
            {nRows}{nTotal != null && nTotal > nRows ? <span style={{ fontSize: 12, fontWeight: 400, color: lblColor }}> / {nTotal}</span> : null}
          </div>
          <div style={{ fontSize: 12, color: lblColor, marginTop: 1 }}>E. coli rows {nTotal != null && nTotal > nRows ? '(swim + kayak / total)' : 'used'}</div>
        </div>
      </div>

      {/* MC iterations */}
      <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 8, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#3730A3" strokeWidth={1.7} strokeLinecap="round">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: valColor, lineHeight: 1.1, fontFamily: "'JetBrains Mono', monospace" }}>{nSim.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: lblColor, marginTop: 1 }}>MC iterations</div>
        </div>
      </div>

      {/* ARB warning — only shown when no ARB data */}
      {!hasArb && (
        <div style={{
          background: darkMode ? '#2A1D08' : '#FEF9EC',
          border: `1px solid ${darkMode ? '#5C3D10' : '#FCD34D'}`,
          borderRadius: 8,
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth={1.7} strokeLinecap="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1={12} y1={9}  x2={12} y2={13}/>
            <line x1={12} y1={17} x2={12} y2={17}/>
          </svg>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? '#FCD34D' : '#92400E' }}>No ARB data</div>
            <div style={{ fontSize: 12, color: darkMode ? '#D97706' : '#B45309', marginTop: 1 }}>ESBL panel uses default concentrations</div>
          </div>
        </div>
      )}

      {/* ARB confirmation — shown when ARB data exists */}
      {hasArb && (
        <div style={{
          background: darkMode ? '#0B2519' : '#F0FDF4',
          border: `1px solid ${darkMode ? '#1A4A30' : '#86EFAC'}`,
          borderRadius: 8,
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth={1.7} strokeLinecap="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? '#86EFAC' : '#15803D' }}>ARB data present</div>
            <div style={{ fontSize: 12, color: darkMode ? '#4ADE80' : '#166534', marginTop: 1 }}>ESBL panel uses measured concentrations</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── How to read panel ─────────────────────────────────────────────────────────
function HowToRead({ darkMode }) {
  const bg     = darkMode ? '#1A1F2E' : '#F8FAFC';
  const bdr    = darkMode ? '#2E3650' : '#E2E8F0';
  const txt    = darkMode ? '#DDE3EF' : '#1C2330';
  const mid    = darkMode ? '#8896B8' : '#5A6880';
  const secBg  = darkMode ? '#252B3B' : '#fff';

  return (
    <div style={{ background: bg, border: `1px solid ${bdr}`, borderRadius: 8, padding: '14px 16px', marginTop: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: mid, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
        How to read this chart
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>

        {/* Colour meaning */}
        <div style={{ background: secBg, border: `1px solid ${bdr}`, borderRadius: 6, padding: '10px 14px', flex: '1 1 200px', minWidth: 200 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: mid, marginBottom: 8 }}>Cell colour</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {[
              { fill: '#2166AC', label: 'Negative ρ — input reduces risk'  },
              { fill: '#F7F7F7', label: 'ρ ≈ 0 — no association',           border: '#ccc' },
              { fill: '#B2182B', label: 'Positive ρ — input increases risk' },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 30, height: 14, borderRadius: 3, background: row.fill, border: row.border ? `1px solid ${row.border}` : undefined, flexShrink: 0 }}/>
                <span style={{ fontSize: 13, color: txt }}>{row.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Significance stars */}
        <div style={{ background: secBg, border: `1px solid ${bdr}`, borderRadius: 6, padding: '10px 14px', flex: '1 1 160px', minWidth: 160 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: mid, marginBottom: 8 }}>Stars = significance</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {[['*','p < 0.05'],['**','p < 0.01'],['***','p < 0.001']].map(([s, p]) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: '#1B7FA3', minWidth: 28, letterSpacing: '0.05em' }}>{s}</span>
                <span style={{ fontSize: 13, color: txt }}>{p}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: mid, marginTop: 9, lineHeight: 1.45 }}>
            Focus on <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>|ρ| &gt; 0.3</span> — at n=10,000 nearly all p-values pass; effect size matters more.
          </div>
        </div>

        {/* Layout guide */}
        <div style={{ background: secBg, border: `1px solid ${bdr}`, borderRadius: 6, padding: '10px 14px', flex: '1 1 180px', minWidth: 180 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: mid, marginBottom: 8 }}>Chart layout</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <svg width={30} height={16} style={{ flexShrink: 0 }}>
                <line x1={15} y1={0} x2={15} y2={16} stroke={darkMode ? '#888' : '#555'} strokeWidth={1.5} strokeDasharray="3,2"/>
              </svg>
              <span style={{ fontSize: 13, color: txt }}>Divides Swimming (left) from Kayaking (right)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <svg width={30} height={16} style={{ flexShrink: 0 }}>
                <rect x={3} y={3} width={24} height={10} rx={2} fill={rhoToColor(0.75)}/>
                <text x={15} y={11} fontSize={7} textAnchor="middle" fill="#fff" fontFamily="monospace">0.75**</text>
              </svg>
              <span style={{ fontSize: 13, color: txt }}>Row = sampled input · Column = annual output</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Colour scale legend ───────────────────────────────────────────────────────
function Legend({ darkMode }) {
  const stops  = 120;
  const W = 160;
  const H = 11;
  const lc = darkMode ? '#aaa' : '#666';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: lc, marginBottom: 16, flexWrap: 'wrap', rowGap: 6 }}>
      <span style={{ fontFamily: 'monospace' }}>−1</span>
      <svg width={W} height={H} style={{ borderRadius: 2, overflow: 'hidden' }}>
        {Array.from({ length: stops }, (_, i) => {
          const rho = -1 + (2 * i) / (stops - 1);
          return <rect key={i} x={(i / stops) * W} y={0} width={W / stops + 1} height={H} fill={rhoToColor(rho)} />;
        })}
      </svg>
      <span style={{ fontFamily: 'monospace' }}>+1</span>
      <span style={{ marginLeft: 6, fontWeight: 500 }}>Spearman ρ scale</span>
    </div>
  );
}

// ── Panel heading ─────────────────────────────────────────────────────────────
function PanelHeading({ title, subtitle, darkMode }) {
  const bg  = darkMode ? '#0F2A3A' : '#E6F4FA';
  const txt = darkMode ? '#38A8D0' : '#1565A0';
  const sub = darkMode ? '#8896B8' : '#5A6880';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: bg, borderRadius: 6, padding: '7px 12px', marginBottom: 10 }}>
      <div style={{ width: 4, height: 28, borderRadius: 2, background: txt, flexShrink: 0 }}/>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color: txt }}>{title}</div>
        <div style={{ fontSize: 12, color: sub, marginTop: 1 }}>{subtitle}</div>
      </div>
    </div>
  );
}

// ── SVG Heatmap ───────────────────────────────────────────────────────────────
function HeatmapSVG({ rowLabels, colLabels, rho, pvalues, darkMode }) {
  const nRows = rowLabels.length;
  const nCols = colLabels.length;
  const W = LP + nCols * CW + RP;
  const H = TP + nRows * CH + BP;
  const gapX = LP + 4 * CW;
  const labelColor = darkMode ? '#aaa' : '#555';

  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      {rowLabels.map((label, i) => (
        <text key={i} x={LP - 8} y={TP + i * CH + CH / 2 + 4}
          fontSize={11} fill={labelColor} textAnchor="end"
          fontFamily="'JetBrains Mono', 'Fira Mono', monospace">
          {label}
        </text>
      ))}
      {colLabels.map((label, j) => {
        const cx = LP + j * CW + CW / 2;
        const cy = TP + nRows * CH + 6;
        return (
          <text key={j} x={cx} y={cy} fontSize={10} fill={labelColor} textAnchor="start"
            fontFamily="'JetBrains Mono', 'Fira Mono', monospace"
            transform={`rotate(40,${cx},${cy})`}>
            {label}
          </text>
        );
      })}
      {rho.map((row, i) =>
        row.map((r, j) => {
          const x = LP + j * CW;
          const y = TP + i * CH;
          return (
            <g key={`${i}-${j}`}>
              <rect x={x} y={y} width={CW} height={CH} fill={rhoToColor(r)}
                stroke={darkMode ? '#333' : '#d0d0d0'} strokeWidth={0.5}/>
              <text x={x + CW / 2} y={y + CH / 2 + 4} fontSize={9} fill={textColor(r)}
                textAnchor="middle" fontFamily="'JetBrains Mono', monospace">
                {r.toFixed(2)}{sigStars(pvalues[i][j])}
              </text>
            </g>
          );
        })
      )}
      <line x1={gapX} y1={TP} x2={gapX} y2={TP + nRows * CH}
        stroke={darkMode ? '#888' : '#555'} strokeWidth={1.5} strokeDasharray="4,3"/>
    </svg>
  );
}

// ── Idle placeholder ──────────────────────────────────────────────────────────
function IdlePlaceholder({ textMid, border, darkMode }) {
  const items = [
    { icon: '⬡', color: '#1B7FA3', title: 'E. coli only',       desc: 'ETEC (diarrhoea) and UPEC (UTI) pathotypes' },
    { icon: '◎', color: '#3730A3', title: 'Swim & Kayak',        desc: 'Drinking Water rows are excluded' },
    { icon: 'ρ', color: '#166534', title: 'Spearman correlation', desc: '11 inputs × 8 outputs per strain' },
    { icon: '⟳', color: '#9A3412', title: '10,000 iterations',   desc: 'Full MC parameter sampling' },
  ];
  const cardBg  = darkMode ? '#1E2330' : '#F8FAFC';
  const cardBdr = darkMode ? '#2E3650' : '#E8EDF4';
  const txt     = darkMode ? '#DDE3EF' : '#1C2330';

  return (
    <div>
      <p style={{ fontSize: 13, color: textMid, marginBottom: 14, lineHeight: 1.6 }}>
        Run a Monte Carlo Spearman sensitivity analysis to see which uncertain parameters
        most strongly drive infection risk and disease burden in your dataset.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
        {items.map((item, i) => (
          <div key={i} style={{
            background: cardBg,
            border: `1px solid ${cardBdr}`,
            borderRadius: 7,
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}>
            <span style={{ fontSize: 18, color: item.color, fontFamily: 'monospace', marginTop: 1, flexShrink: 0 }}>{item.icon}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: txt, marginBottom: 2 }}>{item.title}</div>
              <div style={{ fontSize: 12, color: textMid, lineHeight: 1.4 }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SensitivityHeatmap({ results, C }) {
  const [phase, setPhase] = useState('idle');
  const [taskId, setTaskId] = useState(null);
  const [data, setData] = useState(null);
  const [errMsg, setErrMsg] = useState('');
  const pollRef = useRef(null);

  const darkMode = document.documentElement.getAttribute('data-theme') === 'dark';

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => {
    if (phase !== 'running' || !taskId) return;
    stopPoll();
    pollRef.current = setInterval(async () => {
      try {
        const resp = await pollSensitivityStatus(taskId);
        if (resp.status === 'complete') {
          stopPoll();
          const r = resp.result;
          if (r.status === 'no_data') { setErrMsg(r.message); setPhase('no_data'); }
          else { setData(r); setPhase('done'); }
        } else if (resp.status === 'error') {
          stopPoll(); setErrMsg(resp.message || 'Sensitivity analysis failed.'); setPhase('error');
        }
      } catch (e) { stopPoll(); setErrMsg(e.message); setPhase('error'); }
    }, 2000);
    return stopPoll;
  }, [phase, taskId, stopPoll]);

  const handleRun = useCallback(async () => {
    setPhase('running'); setData(null); setErrMsg('');
    try {
      const resp = await startSensitivityAnalysis(results, 10000);
      setTaskId(resp.task_id);
    } catch (e) { setErrMsg(e.message); setPhase('error'); }
  }, [results]);

  const accentColor = '#1B7FA3';
  const textMid     = C?.textMid ?? '#5A6880';
  const border      = C?.border  ?? '#D6DCE8';
  const surface     = C?.surface ?? '#fff';

  return (
    <div style={{ border: `1px solid ${border}`, borderRadius: 8, padding: '1.25rem 1.4rem', background: surface }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: C?.text ?? '#1C2330' }}>
            Sensitivity Analysis
          </div>
          <MethodChips />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {(phase === 'idle' || phase === 'error' || phase === 'no_data') && (
            <button
              onClick={handleRun}
              style={{
                padding: '0.45rem 1.15rem',
                background: accentColor,
                color: '#fff',
                border: 'none',
                borderRadius: 5,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {phase === 'idle' ? 'Run Sensitivity Analysis' : 'Re-run'}
            </button>
          )}
          {phase === 'running' && (
            <span style={{ fontSize: 13, color: accentColor, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Spinner color={accentColor} />
              Running Monte Carlo…
            </span>
          )}
        </div>
      </div>

      {/* ── Idle ── */}
      {phase === 'idle' && (
        <IdlePlaceholder textMid={textMid} border={border} darkMode={darkMode} />
      )}

      {/* ── Running ── */}
      {phase === 'running' && (
        <div style={{ padding: '2.5rem 0', textAlign: 'center' }}>
          <div style={{ marginBottom: 12 }}><Spinner color={accentColor} size={28} /></div>
          <div style={{ fontSize: 13, fontWeight: 600, color: accentColor, marginBottom: 4 }}>Sampling parameters…</div>
          <div style={{ fontSize: 12, color: textMid }}>10,000 iterations across 11 uncertain inputs per strain</div>
        </div>
      )}

      {/* ── Error / no data ── */}
      {(phase === 'error' || phase === 'no_data') && (
        <div style={{
          background: phase === 'no_data' ? (darkMode ? '#2A1D08' : '#FEF9EC') : (darkMode ? '#2D1515' : '#FEF2F2'),
          border: `1px solid ${phase === 'no_data' ? '#FCD34D' : '#FCA5A5'}`,
          borderRadius: 6,
          padding: '0.8rem 1rem',
          fontSize: 13,
          color: phase === 'no_data' ? (darkMode ? '#FCD34D' : '#92400E') : (darkMode ? '#FCA5A5' : '#7C2D12'),
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
        }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}>{phase === 'no_data' ? '⚠' : '✕'}</span>
          <span>{errMsg}</span>
        </div>
      )}

      {/* ── Results ── */}
      {phase === 'done' && data && (
        <div>
          {/* Stats row */}
          <StatsRow nRows={data.n_ecoli_rows} nTotal={data.n_ecoli_total} nSim={data.n_sim} hasArb={data.has_arb} darkMode={darkMode} />

          {/* Colour scale */}
          <Legend darkMode={darkMode} />

          {/* Susceptible panel */}
          <PanelHeading
            title="Susceptible strain"
            subtitle="Parameters and outputs for the non-resistant E. coli population"
            darkMode={darkMode}
          />
          <div style={{ overflowX: 'auto', marginBottom: 28 }}>
            <HeatmapSVG rowLabels={data.susceptible.row_labels} colLabels={data.col_labels}
              rho={data.susceptible.rho} pvalues={data.susceptible.pvalues} darkMode={darkMode}/>
          </div>

          {/* ESBL panel */}
          <PanelHeading
            title="ESBL / ARB strain"
            subtitle="Parameters and outputs for the antibiotic-resistant E. coli population"
            darkMode={darkMode}
          />
          <div style={{ overflowX: 'auto' }}>
            <HeatmapSVG rowLabels={data.esbl.row_labels} colLabels={data.col_labels}
              rho={data.esbl.rho} pvalues={data.esbl.pvalues} darkMode={darkMode}/>
          </div>

          {/* How to read */}
          <HowToRead darkMode={darkMode} />
        </div>
      )}
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner({ color, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16"
      style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx={8} cy={8} r={6} fill="none" stroke={color} strokeWidth={2} strokeDasharray="20 6"/>
    </svg>
  );
}
