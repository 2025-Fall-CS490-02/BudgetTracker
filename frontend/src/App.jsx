import { useEffect, useState } from "react";
import { fetchSummary, uploadCsv } from "./lib/api";
import "./App.css";

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; // YYYY-MM
}

// YYYY-MM -> Date (first of month)
function monthToDate(m) {
  const [y, mm] = m.split("-").map(Number);
  return new Date(y, mm - 1, 1);
}

// add n months (n can be negative) to YYYY-MM
function addMonths(m, n) {
  const d = monthToDate(m);
  d.setMonth(d.getMonth() + n);
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${mm}`;
}

export default function App() {
  const [month, setMonth] = useState(thisMonth());
  const [data, setData] = useState(null);        // { month, totals, byCategory, daily }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // import UI state
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetchSummary(month)
      .then((json) => setData(json))
      .catch((err) => setError(err.message || "Failed to load summary"))
      .finally(() => setLoading(false));
  }, [month]);

  const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const income = data?.totals?.income ?? 0;
  const expense = data?.totals?.expense ?? 0;
  const net = data?.totals?.net ?? 0;

  // ---- CSV upload handler ----
  async function onUpload(e) {
    e.preventDefault();
    setImportError("");
    setImportResult(null);
    if (!file) {
      setImportError("Please choose a CSV file first.");
      return;
    }
    try {
      setImporting(true);
      const res = await uploadCsv(file);
      setImportResult(res);

      // Optional UX: if your CSV clearly targets a later month than the current selection,
      // let the user jump there quickly. If your backend ever returns a {month} in res,
      // you could auto-switch: if (res.month) setMonth(res.month)
      const refreshed = await fetchSummary(month);
      setData(refreshed);
    } catch (err) {
      setImportError(err?.message || "Upload failed");
    } finally {
      setImporting(false);
    }
  }

  // ---- inline bar chart from byCategory ----
  const catEntries = Object.entries(data?.byCategory || {}); // [["Food",123], ...]
  const chartData = catEntries.map(([category, amount]) => ({ category, amount: Number(amount) || 0 }));
  const max = chartData.reduce((m, d) => Math.max(m, d.amount), 0) || 1;
  const W = 640, H = 260, P = 30;
  const barW = chartData.length ? (W - P * 2) / chartData.length : 0;

  return (
    <div className="container">
      <h1>Budget Tracker</h1>

      {/* Month controls */}
      <div className="list" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button className="card" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="Previous month">
          ◀ Prev
        </button>

        <label className="card" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="label">Month</span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={{ padding: "0.4rem" }}
          />
        </label>

        <button className="card" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month">
          Next ▶
        </button>

        <button className="card" onClick={() => setMonth(thisMonth())} aria-label="Jump to current month">
          Today
        </button>
      </div>

      <p className="subtle">Selected: {month}</p>

      {loading && <p>Loading…</p>}
      {error && <p className="error">Error: {error}</p>}

      {data && !loading && !error && (
        <>
          {/* three stat boxes */}
          <div className="stats">
            <div className="card">
              <div className="label">Income</div>
              <div className="value">{fmt.format(income)}</div>
            </div>
            <div className="card">
              <div className="label">Expense</div>
              <div className="value">{fmt.format(expense)}</div>
            </div>
            <div className={`card ${net >= 0 ? "ok" : "bad"}`}>
              <div className="label">Net</div>
              <div className="value">{fmt.format(net)}</div>
            </div>
          </div>

          {/* simple inline bar chart */}
          <h2 className="h2">Spending by Category</h2>
          {chartData.length === 0 ? (
            <div className="row empty">No categories yet.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <svg width={W} height={H} role="img" aria-label="Bar chart of spending by category">
                <text x={4} y={H - P} fontSize="10">{fmt.format(0)}</text>
                <text x={4} y={P + 10} fontSize="10">{fmt.format(max)}</text>
                <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="#ddd" />
                {chartData.map((d, i) => {
                  const h = Math.round((d.amount / max) * (H - P * 2));
                  const x = P + i * barW + barW * 0.1;
                  const y = H - P - h;
                  const w = barW * 0.8;
                  return (
                    <g key={d.category}>
                      <rect x={x} y={y} width={w} height={h} fill="#69b3a2" />
                      <text x={x + w / 2} y={H - P + 12} fontSize="10" textAnchor="middle">
                        {d.category.length > 10 ? d.category.slice(0, 10) + "…" : d.category}
                      </text>
                      <text x={x + w / 2} y={y - 4} fontSize="10" textAnchor="middle">
                        {fmt.format(d.amount)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}

          {/* category list */}
          <ul className="list">
            {Object.entries(data.byCategory || {}).map(([cat, amt]) => (
              <li key={cat} className="row">
                <span>{cat}</span>
                <strong>{fmt.format(amt)}</strong>
              </li>
            ))}
            {(!data.byCategory || Object.keys(data.byCategory).length === 0) && (
              <li className="row empty">No categories yet.</li>
            )}
          </ul>

          {/* --- Import section --- */}
          <h2 className="h2" style={{ marginTop: "1rem" }}>Import CSV</h2>
          <form onSubmit={onUpload} className="list" style={{ gap: 8 }}>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <button className="card" type="submit" disabled={!file || importing} style={{ cursor: "pointer" }}>
              {importing ? "Uploading..." : "Upload"}
            </button>
          </form>
          {importError && <p className="error">Error: {importError}</p>}
          {importResult && (
            <div className="card" style={{ marginTop: 8 }}>
              <div className="label">Import Result</div>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                {JSON.stringify(importResult, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
