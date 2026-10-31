"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { safeNext } from "@/lib/roles";

/**
 * Landing page for every emailed auth link (invite, password reset, approved alumni request).
 * Supports all three link styles Supabase can produce:
 *   ?token_hash=…&type=…   (recommended email templates)
 *   ?code=…                (PKCE: reset requested from this browser)
 *   #access_token=…        (default invite template / implicit flow)
 */
export default function ConfirmPage() {
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.slice(1));
    const query = url.searchParams;
    const type = (query.get("type") ?? hash.get("type")) as EmailOtpType | null;
    const passwordFlow = type === "invite" || type === "recovery" || type === "signup";
    const next = safeNext(query.get("next")) ?? (passwordFlow ? "/reset-password" : "/dashboard");

    const linkError = query.get("error_description") ?? hash.get("error_description");
    const tokenHash = query.get("token_hash");
    const code = query.get("code");
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");

    const verify = linkError ? Promise.resolve({ error: { message: linkError } })
      : tokenHash && type ? supabase.auth.verifyOtp({ token_hash: tokenHash, type })
        : code ? supabase.auth.exchangeCodeForSession(code)
          : accessToken && refreshToken ? supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
            : Promise.resolve({ error: { message: "This link is incomplete." } });

    verify.then(({ error: verifyError }) => {
      if (verifyError) {
        setError(/code verifier/i.test(verifyError.message)
          ? "Open the reset link in the same browser you requested it from, or request a new one."
          : verifyError.message);
        return;
      }
      window.location.replace(next);
    });
  }, []);

  return (
    <main className="boot-screen">
      {error ? (
        <div className="empty-state">
          <strong>This link didn&apos;t work</strong>
          <p>{error} Links expire after a while and can only be used once.</p>
          <Link className="primary-button" href="/login?error=link-expired">Back to sign in</Link>
        </div>
      ) : (
        <div className="loading-state"><span className="spinner" /> Verifying your link…</div>
      )}
    </main>
  );
}
