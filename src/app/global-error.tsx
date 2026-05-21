"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es-AR">
      <body
        style={{
          fontFamily: "Segoe UI, Arial, sans-serif",
          background: "#f5f5f5",
          color: "#1a1a1a",
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
        }}
      >
        <h1 style={{ color: "#006081" }}>Ocurrió un error</h1>
        <p>Intentá nuevamente. Si persiste, contactá a soporte.</p>
        <button
          onClick={() => reset()}
          style={{
            background: "#006081",
            color: "#fff",
            border: "none",
            padding: "0.6rem 1.2rem",
            borderRadius: "0.5rem",
            cursor: "pointer",
          }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
