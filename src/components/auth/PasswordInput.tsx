"use client";

import { useState } from "react";

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M4 4l16 16" />}
    </svg>
  );
}

export function PasswordInput({ name, placeholder, autoComplete, id }: { name: string; placeholder: string; autoComplete: "current-password" | "new-password"; id?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="password-field">
      <input id={id} name={name} type={show ? "text" : "password"} placeholder={placeholder} autoComplete={autoComplete} required minLength={autoComplete === "new-password" ? 8 : undefined} />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} aria-controls={id}>
        <EyeIcon open={!show} />
      </button>
    </div>
  );
}
