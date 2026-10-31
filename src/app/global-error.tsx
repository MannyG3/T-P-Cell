"use client";

import { useEffect } from "react";

// Replaces the root layout when it fails, so it cannot rely on globals.css.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#f8f8f5", color: "#20232d", fontFamily: "Arial, sans-serif" }}>
        <title>Something went wrong | CampusTrack</title>
        <div style={{ textAlign: "center", maxWidth: 380, padding: 24 }}>
          <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 500 }}>Something went wrong</h1>
          <p style={{ color: "#767986", fontSize: 13, lineHeight: 1.5 }}>CampusTrack hit an unexpected error{error.digest ? ` (reference ${error.digest})` : ""}.</p>
          <button onClick={() => retry()} style={{ border: 0, borderRadius: 6, padding: "12px 17px", background: "#20232d", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
