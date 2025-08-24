import { useEffect } from "react";


function App() {
  useEffect(() => {
    const url = `${import.meta.env.VITE_API_URL}/health`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => console.log("Health check:", data))
      .catch((err) => console.error("Error:", err));
  }, []);

  return (
    <div>
      <h1>Budget Tracker</h1>
      <p>Check console for health check.</p>
    </div>
  );
}

export default App;