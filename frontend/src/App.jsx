import { useEffect, useState } from "react";
import { fetchSummary, uploadCsv } from "./lib/api"; // now includes uploadCsv
import "./App.css";

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; // YYYY-MM
}

export default function App() {
  const [month] = useState(thisMonth());
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
      // optional: re-fetch summary after import to refresh chart & numbers
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
  const W = 640, H = 260, P = 30; // width, height, padding
  const barW = chartData.length ? (W - P * 2) / chartData.length : 0;

  return (
    <div className="container">
      <h1>Budget Tracker</h1>
      <p className="subtle">Month: {month}</p>

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
                {/* y-axis labels (0 and max) */}
                <text x={4} y={H - P} fontSize="10">{fmt.format(0)}</text>
                <text x={4} y={P + 10} fontSize="10">{fmt.format(max)}</text>

                {/* baseline */}
                <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="#ddd" />

                {/* bars */}
                {chartData.map((d, i) => {
                  const h = Math.round((d.amount / max) * (H - P * 2));
                  const x = P + i * barW + barW * 0.1;
                  const y = H - P - h;
                  const w = barW * 0.8;
                  return (
                    <g key={d.category}>
                      <rect x={x} y={y} width={w} height={h} fill="#69b3a2" />
                      {/* category label */}
                      <text x={x + w / 2} y={H - P + 12} fontSize="10" textAnchor="middle">
                        {d.category.length > 10 ? d.category.slice(0, 10) + "…" : d.category}
                      </text>
                      {/* value on top */}
                      <text x={x + w / 2} y={y - 4} fontSize="10" textAnchor="middle">
                        {fmt.format(d.amount)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}

          {/* category list (your original list stays) */}
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
            <button className="card" type="submit" disabled={importing} style={{ cursor: "pointer" }}>
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
