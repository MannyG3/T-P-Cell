"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadSessionUser } from "@/lib/data";
import type { SessionUser } from "@/lib/types";

function Brand({ className }: { className: string }) {
  return <div className={className}><span className="brand-mark">ct</span><span>campus<span>track</span></span></div>;
}

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="login-shell">
      <div className="login-art">
        <Brand className="login-brand" />
        <div className="login-message">
          <p className="eyebrow">TRAINING & PLACEMENT OFFICE</p>
          <h1>Make every opportunity count.</h1>
          <p>One calm workspace for your students, recruiters, and placement team.</p>
        </div>
        <div className="login-art-footer"><span>CampusTrack</span><span>Secure institute workspace</span></div>
      </div>
      <section className="login-panel"><div className="login-panel-inner"><Brand className="login-mobile-brand" />{children}</div></section>
    </main>
  );
}

function PasswordInput({ value, onChange, placeholder, autoComplete }: { value: string; onChange: (v: string) => void; placeholder: string; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="password-field">
      <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>{show ? "◎" : "◉"}</button>
    </div>
  );
}

/**
 * Sign-in only. Accounts are created by the TPO (import or "Add student"), so
 * there is no public sign-up; new users set their password via the emailed link
 * or "Forgot password?".
 */
export function LoginScreen({ supabase, onLogin, notice }: { supabase: SupabaseClient | null; onLogin: (user: SessionUser) => void; notice?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState(notice ?? "");
  const [busy, setBusy] = useState(false);

  const fail = (message: string) => { setError(message); setInfo(""); };

  const forgotPassword = async () => {
    if (!supabase) return;
    if (!email.trim()) return fail("Enter your email address first, then click “Forgot password?”.");
    setBusy(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    setBusy(false);
    if (resetError) return fail(resetError.message);
    setError("");
    setInfo(`If an account exists for ${email.trim()}, a password link is on its way. Check your inbox and spam folder.`);
  };

  const submit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return fail("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    if (!email.trim() || !password) return fail("Enter your email and password to continue.");

    setBusy(true);
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) { setBusy(false); return fail(authError.message === "Invalid login credentials" ? "Incorrect email or password." : authError.message); }
    // The role comes from the account's profile, never from the client.
    const user = await loadSessionUser(supabase, data.user);
    setBusy(false);
    if (!user) {
      await supabase.auth.signOut();
      return fail("Signed in, but your profile could not be loaded. Contact your TPO admin.");
    }
    onLogin(user);
  };

  return (
    <AuthLayout>
      <p className="eyebrow">WELCOME BACK</p>
      <h2>Sign in to your workspace</h2>
      <p className="login-subtitle">TPO admins, students and alumni all sign in here.</p>
      <form onSubmit={submit}>
        <label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@institute.edu" autoComplete="email" /></label>
        <label>Password<PasswordInput value={password} onChange={setPassword} placeholder="Enter your password" autoComplete="current-password" /></label>
        <div className="login-options"><span /><button type="button" className="forgot-button" onClick={() => void forgotPassword()} disabled={busy}>Forgot password?</button></div>
        {error && <p className="login-error" role="alert">{error}</p>}
        {info && <p className="login-info" role="status">{info}</p>}
        <button className="login-submit" type="submit" disabled={busy}><span>{busy ? "Please wait…" : "Sign in"}</span> <span>&rarr;</span></button>
      </form>
      <p className="login-help">
        New student or alumnus? Your Training &amp; Placement Office creates your account. Use “Forgot password?” with your institute email to set a password.
      </p>
    </AuthLayout>
  );
}

export function ResetPasswordScreen({ supabase, onDone }: { supabase: SupabaseClient; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) return setError(updateError.message);
    onDone();
  };

  return (
    <AuthLayout>
      <p className="eyebrow">SET YOUR PASSWORD</p>
      <h2>Choose a password</h2>
      <p className="login-subtitle">You&apos;ll use it with your email address to sign in.</p>
      <form onSubmit={submit}>
        <label>New password<PasswordInput value={password} onChange={setPassword} placeholder="At least 8 characters" autoComplete="new-password" /></label>
        <label>Confirm password<PasswordInput value={confirm} onChange={setConfirm} placeholder="Type it again" autoComplete="new-password" /></label>
        {error && <p className="login-error" role="alert">{error}</p>}
        <button className="login-submit" type="submit" disabled={busy}><span>{busy ? "Saving…" : "Save password"}</span> <span>&rarr;</span></button>
      </form>
    </AuthLayout>
  );
}
