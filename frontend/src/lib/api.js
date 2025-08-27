// small helper to call the backend /summary endpoint
export async function fetchSummary(month) {
  const base = import.meta.env.VITE_API_URL; // e.g. http://localhost:8000
  const res = await fetch(`${base}/summary?month=${encodeURIComponent(month)}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Summary failed: ${res.status} ${text}`);
  }
  return res.json(); // { month, totals, byCategory, daily }
}

// POST /import/csv (multipart)
export async function uploadCsv(file) {
  const base = import.meta.env.VITE_API_URL; // e.g. http://localhost:8000
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${base}/import/csv`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upload failed: ${res.status} ${text}`);
  }
  return res.json(); // { imported, skipped, errors }
}