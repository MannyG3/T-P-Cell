"use client";

import { useCallback, useEffect, useState } from "react";
import { adminRequest } from "@/lib/data";
import { roleLabel, type AccountRole } from "@/lib/roles";
import { useDashboard } from "../dashboard-context";
import { EmptyState, Field, formatDate } from "../ui";

type Department = { id: number; name: string };
type AccessRequest = {
  id: number;
  full_name: string;
  personal_email: string;
  passing_year: number | null;
  roll_no: string | null;
  current_company: string | null;
  message: string | null;
  created_at: string;
  departments: { name: string } | null;
};

function useDepartments() {
  const { supabase } = useDashboard();
  const [departments, setDepartments] = useState<Department[]>([]);
  useEffect(() => {
    let cancelled = false;
    supabase.from("departments").select("id, name").eq("is_active", true).order("name")
      .then(({ data }) => { if (!cancelled) setDepartments((data ?? []) as Department[]); });
    return () => { cancelled = true; };
  }, [supabase]);
  return departments;
}

/** TPO Admin: invite staff, students or alumni. Roles are assigned server-side by /api/admin/invite. */
export function InviteUserCard() {
  const { supabase, notify } = useDashboard();
  const departments = useDepartments();
  const empty = { full_name: "", email: "", role: "dept_coordinator" as AccountRole, department_id: "", roll_no: "", batch_year: "" };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: e.target.value });
  const needsDept = form.role === "dept_coordinator" || form.role === "student";

  const submit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      await adminRequest(supabase, "/api/admin/invite", {
        ...form,
        department_id: needsDept ? Number(form.department_id) : undefined,
        batch_year: form.role === "student" ? Number(form.batch_year) : undefined,
      });
      notify(`Invite sent to ${form.email.trim()}.`);
      setForm({ ...empty, role: form.role });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the invite.");
    }
    setBusy(false);
  };

  return (
    <section className="panel settings-card">
      <div className="panel-heading"><div><h2>Invite a user</h2><p>They get an email link to set a password. Requires custom SMTP in Supabase.</p></div></div>
      <form className="settings-form" onSubmit={submit}>
        <Field label="Role">
          <select value={form.role} onChange={set("role")}>
            {(["tpo_admin", "dept_coordinator", "student", "alumni"] as AccountRole[]).map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
          </select>
        </Field>
        <Field label="Full name"><input value={form.full_name} onChange={set("full_name")} required maxLength={120} autoComplete="off" /></Field>
        <Field label="Email"><input type="email" value={form.email} onChange={set("email")} required autoComplete="off" /></Field>
        {needsDept && (
          <Field label="Department">
            <select value={form.department_id} onChange={set("department_id")} required>
              <option value="" disabled>Choose…</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        )}
        {form.role === "student" && <>
          <Field label="Roll number"><input value={form.roll_no} onChange={set("roll_no")} required maxLength={40} /></Field>
          <Field label="Batch year"><input type="number" value={form.batch_year} onChange={set("batch_year")} required min={1950} max={2100} /></Field>
        </>}
        {error && <p className="form-error">{error}</p>}
        <div className="settings-actions"><span /><button className="primary-button" disabled={busy}>{busy ? "Sending…" : "Send invite"}</button></div>
      </form>
    </section>
  );
}

/** TPO Admin: approve (sends an invite) or reject alumni access requests from /request-access. */
export function AccessRequestsCard() {
  const { supabase, notify } = useDashboard();
  const [requests, setRequests] = useState<AccessRequest[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(() => supabase
    .from("alumni_requests")
    .select("id, full_name, personal_email, passing_year, roll_no, current_company, message, created_at, departments(name)")
    .eq("status", "pending")
    .order("created_at"), [supabase]);

  useEffect(() => {
    let cancelled = false;
    load().then(({ data, error }) => {
      if (cancelled) return;
      if (error) setLoadError(error.message);
      else setRequests((data ?? []) as unknown as AccessRequest[]);
    });
    return () => { cancelled = true; };
  }, [load]);

  const review = async (request: AccessRequest, action: "approve" | "reject") => {
    setBusyId(request.id);
    try {
      await adminRequest(supabase, "/api/admin/access-requests", { id: request.id, action });
      notify(action === "approve" ? `Approved. Invite sent to ${request.personal_email}.` : `Request from ${request.full_name} rejected.`);
      setRequests((prev) => prev?.filter((r) => r.id !== request.id) ?? null);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not update the request.", "error");
    }
    setBusyId(null);
  };

  return (
    <section className="panel settings-card">
      <div className="panel-heading"><div><h2>Alumni access requests</h2><p>Submitted from the public “Request access” page.</p></div></div>
      <div className="settings-form">
        {loadError && <p className="form-error">Couldn&apos;t load requests: {loadError}</p>}
        {!loadError && requests === null && <p className="muted-note">Loading…</p>}
        {requests?.length === 0 && <EmptyState title="No pending requests" />}
        {requests?.map((r) => (
          <div className="request-item" key={r.id}>
            <div>
              <strong>{r.full_name}</strong>
              <span>{r.personal_email}</span>
              <span>{[r.departments?.name, r.passing_year && `Passed ${r.passing_year}`, r.roll_no && `Roll ${r.roll_no}`, r.current_company].filter(Boolean).join(" · ")}</span>
              {r.message && <p>{r.message}</p>}
              <small>Requested {formatDate(r.created_at)}</small>
            </div>
            <div className="request-actions">
              <button className="text-button" disabled={busyId === r.id} onClick={() => void review(r, "reject")}>Reject</button>
              <button className="primary-button small-button" disabled={busyId === r.id} onClick={() => void review(r, "approve")}>{busyId === r.id ? "Working…" : "Approve & invite"}</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
