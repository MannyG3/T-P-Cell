"use client";

import { useActionState } from "react";
import { PasswordInput } from "@/components/auth/PasswordInput";
import type { AuthFormState } from "@/app/login/actions";
import { updatePassword } from "./actions";

export function ResetPasswordForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(updatePassword, null);
  return (
    <form action={action}>
      {/* Lets password managers associate the new password with the right account. */}
      <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
      <label>New password<PasswordInput id="password" name="password" placeholder="At least 8 characters" autoComplete="new-password" /></label>
      <label>Confirm password<PasswordInput id="confirm" name="confirm" placeholder="Type it again" autoComplete="new-password" /></label>
      {state?.error && <p className="login-error" role="alert">{state.error}</p>}
      <button className="login-submit" type="submit" disabled={pending}><span>{pending ? "Saving…" : "Save password"}</span> <span>&rarr;</span></button>
    </form>
  );
}
