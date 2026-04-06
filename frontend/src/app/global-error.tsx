"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body style={{ background: "#040610", color: "#e2e8f0", fontFamily: "sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "2rem" }}>
          <div style={{ fontSize: "4rem", marginBottom: "1.5rem" }}>🏀</div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "0.75rem" }}>
            Something went wrong
          </h2>
          <p style={{ color: "#94a3b8", marginBottom: "1.5rem" }}>
            {error?.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.5rem 1.5rem",
              background: "rgba(0,229,255,0.12)",
              color: "#00e5ff",
              border: "1px solid rgba(0,229,255,0.2)",
              borderRadius: "0.5rem",
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
