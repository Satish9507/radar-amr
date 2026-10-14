const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/**
 * Format an ISO date string (YYYY-MM-DD) as "DD Mmm YYYY", e.g. "10 Jan 2024".
 * Returns the original string unchanged if it can't be parsed.
 */
export function fmtDate(iso) {
  if (!iso) return "";
  const parts = String(iso).slice(0, 10).split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  const month = MONTHS[parseInt(m, 10) - 1];
  if (!month) return iso;
  return `${d} ${month} ${y}`;
}
