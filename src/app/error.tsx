"use client";

import { useEffect } from "react";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    // Surfaces in the browser console and Vercel's runtime logs.
    console.error(error);
  }, [error]);

  return (
    <main className="boot-screen">
      <div className="empty-state">
        <strong>Something went wrong</strong>
        <p>An unexpected error occurred. Try again, and if it keeps happening, contact your TPO admin{error.digest ? ` (reference ${error.digest})` : ""}.</p>
        <button className="primary-button" onClick={() => retry()}>Try again</button>
      </div>
    </main>
  );
}
