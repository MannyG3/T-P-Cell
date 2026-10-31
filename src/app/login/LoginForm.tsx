"use client";

import Link from "next/link";
import { useActionState, useRef, useState, type KeyboardEvent } from "react";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { LOGIN_TABS, loginTabLabel, type LoginTab } from "@/lib/roles";
import { requestPasswordReset, signIn, type AuthFormState } from "./actions";

const copy: Record<LoginTab, { emailLabel: string; placeholder: string; footer: React.ReactNode }> = {
  staff: {
    emailLabel: "Email address",
    placeholder: "name@institute.edu",
    footer: <>Need staff access? Ask an existing TPO Admin to invite you.</>,
  },
  student: {
    emailLabel: "Email address",
    placeholder: "you@institute.edu",
    footer: <>First time here? Your Training &amp; Placement Office sends you an invite. Already invited but forgot the password? Use “Forgot password?”.</>,
  },
  alumni: {
    emailLabel: "Personal email",
    placeholder: "you@gmail.com",
    footer: <>No alumni account yet? <Link href="/request-access">Request access</Link></>,
  },
};

export function LoginForm({ initialTab, next, initialError, initialInfo }: { initialTab: LoginTab; next: string; initialError?: string; initialInfo?: string }) {
  const [tab, setTab] = useState<LoginTab>(initialTab);
  const [signInState, signInAction, signingIn] = useActionState<AuthFormState, FormData>(signIn, initialError ? { error: initialError } : null);
  const [resetState, resetAction, resetting] = useActionState<AuthFormState, FormData>(requestPasswordReset, initialInfo ? { info: initialInfo } : null);
  const [lastAction, setLastAction] = useState<"signin" | "reset">(initialInfo ? "reset" : "signin");
  const tabRefs = useRef<Record<LoginTab, HTMLButtonElement | null>>({ staff: null, student: null, alumni: null });

  const state = lastAction === "signin" ? signInState : resetState;
  const busy = signingIn || resetting;

  // Roving focus for the tablist (Left/Right/Home/End), per the WAI-ARIA tabs pattern.
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = LOGIN_TABS.indexOf(tab);
    const target = event.key === "ArrowRight" ? LOGIN_TABS[(index + 1) % LOGIN_TABS.length]
      : event.key === "ArrowLeft" ? LOGIN_TABS[(index + LOGIN_TABS.length - 1) % LOGIN_TABS.length]
        : event.key === "Home" ? LOGIN_TABS[0]
          : event.key === "End" ? LOGIN_TABS[LOGIN_TABS.length - 1] : null;
    if (!target) return;
    event.preventDefault();
    setTab(target);
    tabRefs.current[target]?.focus();
  };

  return (
    <>
      <p className="eyebrow">WELCOME BACK</p>
      <h2>Sign in to your workspace</h2>
      <p className="login-subtitle">Use your CampusTrack account to continue.</p>
      <div className="role-switcher" role="tablist" aria-label="Sign in as">
        {LOGIN_TABS.map((option) => (
          <button
            key={option}
            ref={(el) => { tabRefs.current[option] = el; }}
            type="button"
            role="tab"
            id={`tab-${option}`}
            aria-selected={tab === option}
            aria-controls="login-panel"
            tabIndex={tab === option ? 0 : -1}
            className={tab === option ? "selected" : ""}
            onClick={() => setTab(option)}
            onKeyDown={onTabKey}
          >
            {loginTabLabel[option]}
          </button>
        ))}
      </div>

      <form id="login-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} action={(formData) => { setLastAction("signin"); signInAction(formData); }}>
        <input type="hidden" name="tab" value={tab} />
        <input type="hidden" name="next" value={next} />
        <label>
          {copy[tab].emailLabel}
          <input name="email" type="email" placeholder={copy[tab].placeholder} autoComplete="email" required />
        </label>
        <label>
          Password
          <PasswordInput id="password" name="password" placeholder="Enter your password" autoComplete="current-password" />
        </label>
        <div className="login-options">
          <label className="remember-option"><input type="checkbox" name="remember" defaultChecked /> <span>Remember me</span></label>
          <button type="submit" formAction={(formData) => { setLastAction("reset"); resetAction(formData); }} formNoValidate className="forgot-button" disabled={busy}>
            {resetting ? "Sending…" : "Forgot password?"}
          </button>
        </div>
        {state?.error && <p className="login-error" role="alert">{state.error}</p>}
        {state?.info && <p className="login-info" role="status">{state.info}</p>}
        <button className="login-submit" type="submit" disabled={busy}>
          <span>{signingIn ? "Signing in…" : `Continue as ${loginTabLabel[tab]}`}</span> <span>&rarr;</span>
        </button>
      </form>
      <p className="login-help">{copy[tab].footer}</p>
    </>
  );
}
