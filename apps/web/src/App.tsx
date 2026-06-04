import { useEffect, useState } from "react";
import { fetchWorkerHealth, type WorkerHealth } from "./api";

export function App() {
  const [health, setHealth] = useState<WorkerHealth | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    fetchWorkerHealth()
      .then((result) => {
        if (!canceled) {
          setHealth(result);
        }
      })
      .catch((err: unknown) => {
        if (!canceled) {
          setError(err instanceof Error ? err.message : "Unknown worker error");
        }
      });
    return () => {
      canceled = true;
    };
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <h1>Diplomat</h1>
      <p>Local AI subtitle editor foundation.</p>
      <section aria-live="polite">
        {health ? <strong>Worker: {health.status}</strong> : <strong>Worker: checking</strong>}
        {error ? <p role="alert">Worker error: {error}</p> : null}
      </section>
    </main>
  );
}
