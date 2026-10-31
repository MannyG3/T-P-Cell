"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { loadSessionUser } from "@/lib/data";
import type { SessionUser } from "@/lib/types";
import { Dashboard } from "@/components/Dashboard";
import { LoginScreen, ResetPasswordScreen } from "@/components/LoginScreen";

type AuthState =
  | { status: "loading" }
  | { status: "signedOut"; notice?: string }
  | { status: "recovery" }
  | { status: "signedIn"; user: SessionUser };

export default function Home() {
  const [auth, setAuth] = useState<AuthState>(() => (supabase ? { status: "loading" } : { status: "signedOut" }));

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let cancelled = false;

    // Restore an existing session so a page reload doesn't sign the user out.
    void client.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      const user = data.session ? await loadSessionUser(client, data.session.user) : null;
      if (cancelled) return;
      setAuth((current) => (current.status === "loading" ? (user ? { status: "signedIn", user } : { status: "signedOut" }) : current));
    });

    const { data: listener } = client.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setAuth({ status: "recovery" });
      if (event === "SIGNED_OUT") setAuth((current) => (current.status === "signedOut" ? current : { status: "signedOut" }));
    });
    return () => { cancelled = true; listener.subscription.unsubscribe(); };
  }, []);

  if (auth.status === "loading") return <div className="boot-screen"><span className="spinner" /></div>;
  if (auth.status === "recovery" && supabase) {
    return <ResetPasswordScreen supabase={supabase} onDone={() => {
      setAuth({ status: "signedOut", notice: "Password saved. Sign in with your email and new password." });
      void supabase!.auth.signOut();
    }} />;
  }
  if (auth.status === "signedIn" && supabase) return <Dashboard supabase={supabase} user={auth.user} onSignOut={() => setAuth({ status: "signedOut" })} />;
  return <LoginScreen key={auth.status === "signedOut" ? auth.notice ?? "" : ""} supabase={supabase} notice={auth.status === "signedOut" ? auth.notice : undefined} onLogin={(user) => setAuth({ status: "signedIn", user })} />;
}
