import { useEffect, useState } from "react";
import { fetchSummary } from "./lib/api";
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

          {/* category list */}
          <h2 className="h2">By Category</h2>
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
        </>
      )}
    </div>
  );
}
