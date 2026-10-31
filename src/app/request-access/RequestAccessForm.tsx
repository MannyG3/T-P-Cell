"use client";

import { useActionState } from "react";
import type { AuthFormState } from "@/app/login/actions";
import { requestAlumniAccess } from "./actions";

export function RequestAccessForm({ departments }: { departments: { id: number; name: string }[] }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(requestAlumniAccess, null);

  if (state?.info) return <p className="login-info" role="status">{state.info}</p>;

  return (
    <form action={action}>
      <div className="profile-fields">
        <label>Full name<input name="full_name" autoComplete="name" required maxLength={120} /></label>
        <label>Department
          <select name="department_id" required defaultValue="">
            <option value="" disabled>Choose…</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label>Passing year<input name="passing_year" type="number" inputMode="numeric" min={1950} max={new Date().getFullYear()} required placeholder="e.g. 2019" /></label>
        <label>Roll / enrolment no. <em>(optional)</em><input name="roll_no" maxLength={40} /></label>
        <label>Current company <em>(optional)</em><input name="current_company" autoComplete="organization" maxLength={120} /></label>
      </div>
      <label>Personal email<input name="email" type="email" autoComplete="email" required placeholder="you@gmail.com" /></label>
      <label>Anything the TPO should know? <em>(optional)</em><textarea name="message" rows={3} maxLength={1000} /></label>
      <input name="website" tabIndex={-1} autoComplete="off" className="honeypot" aria-hidden="true" />
      {state?.error && <p className="login-error" role="alert">{state.error}</p>}
      <button className="login-submit" type="submit" disabled={pending}><span>{pending ? "Sending…" : "Request access"}</span> <span>&rarr;</span></button>
    </form>
  );
}
