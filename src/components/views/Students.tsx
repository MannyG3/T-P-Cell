"use client";

import { useEffect, useMemo, useState } from "react";
import { adminRequest } from "@/lib/data";
import { isStoredResume, openResume } from "@/lib/resume";
import type { PlacementEvent, PlacementStatus, Student } from "@/lib/types";
import { useDashboard, type StudentFilter } from "../dashboard-context";
import { applicationLabel, Avatar, ConfirmButton, EmptyState, Field, formatDate, formatLpa, Modal, PlacementBadge, placementLabel, studentScore } from "../ui";
import { isIncomplete } from "./Overview";

const FILTERS: { value: StudentFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "placed", label: "Placed" },
  { value: "unplaced", label: "Looking" },
  { value: "higher-studies", label: "Higher studies" },
  { value: "incomplete", label: "Incomplete profile" },
];

export function StudentsView({ filter, setFilter }: { filter: StudentFilter; setFilter: (f: StudentFilter) => void }) {
  const { data, openView } = useDashboard();
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("all");
  const [editing, setEditing] = useState<Student | null>(null);
  const [adding, setAdding] = useState(false);

  const departments = useMemo(() => [...new Set(data.students.map((s) => s.department))].sort(), [data.students]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.students.filter((s) =>
      (!q || `${s.profiles?.full_name ?? ""} ${s.profiles?.email ?? ""} ${s.roll_no} ${s.department} ${s.placed_company ?? ""}`.toLowerCase().includes(q))
      && (department === "all" || s.department === department)
      && (filter === "all" || (filter === "incomplete" ? isIncomplete(s) : s.placement_status === filter)));
  }, [data.students, query, department, filter]);

  return <>
    <div className="page-heading view-heading">
      <div><p className="eyebrow">STUDENT DIRECTORY</p><h1>Students</h1><p className="subheading">Manage profiles, placement status, and eligibility.</p></div>
      <div className="heading-actions">
        <button className="secondary-button" onClick={() => setAdding(true)}>Add student</button>
        <button className="primary-button" onClick={() => openView("Import data")}><span>＋</span> Import students</button>
      </div>
    </div>
    <section className="panel directory-panel">
      <div className="directory-toolbar">
        <div className="search-box"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, roll no, email, company…" /></div>
        <select className="filter-select" value={filter} onChange={(e) => setFilter(e.target.value as StudentFilter)} aria-label="Filter by status">
          {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select className="filter-select" value={department} onChange={(e) => setDepartment(e.target.value)} aria-label="Filter by department">
          <option value="all">All departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <span className="result-count">{filtered.length} of {data.students.length}</span>
      </div>
      {filtered.length === 0
        ? <EmptyState title={data.students.length === 0 ? "No students yet" : "No students match these filters"}>
          {data.students.length === 0 ? "Import a CSV or add students one at a time." : "Try clearing the search or changing the filters."}
        </EmptyState>
        : <div className="table-wrap"><table>
          <thead><tr><th>STUDENT</th><th>DEPARTMENT</th><th>BATCH</th><th>ACADEMIC SCORE</th><th>STATUS</th><th>PLACEMENT</th><th /></tr></thead>
          <tbody>{filtered.map((s) => (
            <tr key={s.id} className="clickable" onClick={() => setEditing(s)}>
              <td><div className="table-person"><Avatar name={s.profiles?.full_name} seed={s.id} /><div><strong>{s.profiles?.full_name ?? "Unnamed"}</strong><span>{s.roll_no} · {s.profiles?.email}</span></div></div></td>
              <td>{s.department}</td>
              <td>{s.batch_year}</td>
              <td>{studentScore(s)}{s.backlog_count > 0 && <span className="muted-inline"> · {s.backlog_count} backlog{s.backlog_count > 1 ? "s" : ""}</span>}</td>
              <td><PlacementBadge status={s.placement_status} /></td>
              <td>{s.placement_status === "placed" ? <>{s.placed_company ?? "—"}<span className="muted-inline"> · {formatLpa(s.placed_package)}</span></> : "—"}</td>
              <td><button className="row-menu" aria-label={`Edit ${s.profiles?.full_name}`}>Edit</button></td>
            </tr>
          ))}</tbody>
        </table></div>}
    </section>
    {editing && <StudentEditor student={editing} onClose={() => setEditing(null)} />}
    {adding && <AddPersonModal kind="students" onClose={() => setAdding(false)} />}
  </>;
}

function StudentEditor({ student, onClose }: { student: Student; onClose: () => void }) {
  const { supabase, refresh, notify } = useDashboard();
  const [form, setForm] = useState({
    full_name: student.profiles?.full_name ?? "",
    roll_no: student.roll_no,
    department: student.department,
    batch_year: String(student.batch_year),
    division: student.division ?? "",
    contact: student.contact ?? "",
    resume_url: student.resume_url ?? "",
    skills: student.skills.join(", "),
    cgpa: student.cgpa?.toString() ?? "",
    percentage: student.percentage?.toString() ?? "",
    backlog_count: String(student.backlog_count),
    placement_status: student.placement_status,
    placed_company: student.placed_company ?? "",
    placed_package: student.placed_package?.toString() ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: e.target.value });
  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  const save = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const batch = Number(form.batch_year);
    const cgpa = num(form.cgpa), pct = num(form.percentage), pkg = num(form.placed_package), backlogs = Number(form.backlog_count || 0);
    if (!form.full_name.trim() || !form.roll_no.trim() || !form.department.trim()) return setError("Name, roll number and department are required.");
    if (!Number.isInteger(batch) || batch < 1950 || batch > 2100) return setError("Enter a valid batch year.");
    if (cgpa !== null && (Number.isNaN(cgpa) || cgpa < 0 || cgpa > 10)) return setError("CGPA must be between 0 and 10.");
    if (pct !== null && (Number.isNaN(pct) || pct < 0 || pct > 100)) return setError("Percentage must be between 0 and 100.");
    if (!Number.isInteger(backlogs) || backlogs < 0) return setError("Backlogs must be a whole number.");
    if (pkg !== null && (Number.isNaN(pkg) || pkg < 0)) return setError("Package must be a positive number (LPA).");
    if (form.placement_status === "placed" && !form.placed_company.trim()) return setError("Enter the company the student was placed at.");

    setBusy(true); setError("");
    const placed = form.placement_status === "placed";
    const [studentResult, profileResult] = await Promise.all([
      supabase.from("students").update({
        roll_no: form.roll_no.trim(),
        department: form.department.trim(),
        batch_year: batch,
        division: form.division.trim() || null,
        contact: form.contact.trim() || null,
        resume_url: form.resume_url.trim() || null,
        skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
        cgpa, percentage: pct, backlog_count: backlogs,
        placement_status: form.placement_status,
        placed_company: placed ? form.placed_company.trim() : null,
        placed_package: placed ? pkg : null,
        updated_at: new Date().toISOString(),
      }).eq("id", student.id),
      supabase.from("profiles").update({ full_name: form.full_name.trim(), updated_at: new Date().toISOString() }).eq("id", student.id),
    ]);
    setBusy(false);
    const failure = studentResult.error ?? profileResult.error;
    if (failure) return setError(failure.code === "23505" ? "That roll number is already used by another student." : failure.message);
    notify(`${form.full_name.trim()} updated.`);
    await refresh();
    onClose();
  };

  const sendPasswordLink = async () => {
    const email = student.profiles?.email;
    if (!email) return;
    setBusy(true);
    const { error: mailError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setBusy(false);
    if (mailError) return notify(`Could not send the email: ${mailError.message}`, "error");
    notify(`Password-setup link sent to ${email}.`);
  };

  const remove = async () => {
    setBusy(true);
    try {
      await adminRequest(supabase, "/api/admin/people/delete", { id: student.id });
      notify(`${student.profiles?.full_name ?? "Student"} deleted.`);
      await refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
      setBusy(false);
    }
  };

  return (
    <Modal title={student.profiles?.full_name ?? "Edit student"} subtitle={`${student.roll_no} · ${student.profiles?.email ?? ""}`} onClose={onClose} wide
      footer={<>
        <ConfirmButton label="Delete student" confirmLabel="Delete permanently" armed={confirmDelete} setArmed={setConfirmDelete} onConfirm={() => void remove()} disabled={busy} />
        <span className="spacer" />
        <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
        <button type="submit" form="student-form" className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
      </>}>
      <form id="student-form" className="form-grid" onSubmit={save}>
        <Field label="Full name" wide><input value={form.full_name} onChange={set("full_name")} /></Field>
        <Field label="Roll number"><input value={form.roll_no} onChange={set("roll_no")} /></Field>
        <Field label="Department"><input value={form.department} onChange={set("department")} /></Field>
        <Field label="Batch year"><input type="number" value={form.batch_year} onChange={set("batch_year")} /></Field>
        <Field label="Division"><input value={form.division} onChange={set("division")} /></Field>
        <Field label="Contact number"><input value={form.contact} onChange={set("contact")} /></Field>
        {isStoredResume(student.resume_url)
          ? <div className="field"><span>Resume</span><button type="button" className="secondary-button" onClick={() => void openResume(supabase, student.resume_url!).catch((e: Error) => setError(e.message))}>Open uploaded PDF ↗</button></div>
          : <Field label="Resume link"><input type="url" value={form.resume_url} onChange={set("resume_url")} placeholder="https://" /></Field>}
        <Field label="Skills (comma separated)" wide><input value={form.skills} onChange={set("skills")} placeholder="Java, AutoCAD, Python" /></Field>
        <Field label="CGPA"><input type="number" step="0.01" value={form.cgpa} onChange={set("cgpa")} /></Field>
        <Field label="Percentage"><input type="number" step="0.01" value={form.percentage} onChange={set("percentage")} /></Field>
        <Field label="Backlogs"><input type="number" min="0" value={form.backlog_count} onChange={set("backlog_count")} /></Field>
        <Field label="Placement status">
          <select value={form.placement_status} onChange={(e) => setForm({ ...form, placement_status: e.target.value as PlacementStatus })}>
            <option value="unplaced">Looking</option>
            <option value="placed">Placed</option>
            <option value="higher-studies">Higher studies</option>
          </select>
        </Field>
        {form.placement_status === "placed" && <>
          <Field label="Placed company"><input value={form.placed_company} onChange={set("placed_company")} /></Field>
          <Field label="Package (LPA)"><input type="number" step="0.01" value={form.placed_package} onChange={set("placed_package")} /></Field>
        </>}
        {error && <p className="form-error">{error}</p>}
      </form>
      <div className="editor-extras">
        <div className="section-head">
          <h3>Account access</h3>
          <button type="button" className="text-button" disabled={busy} onClick={() => void sendPasswordLink()}>Email password-setup link</button>
        </div>
        <PlacementHistory studentId={student.id} />
      </div>
    </Modal>
  );
}

function describeEvent(event: PlacementEvent): string {
  if (event.kind === "placement") {
    const label = (value: string | null) => (value && value in placementLabel ? placementLabel[value as PlacementStatus].label : value ?? "—");
    return `Placement: ${label(event.from_value)} → ${label(event.to_value)}`;
  }
  const label = (value: string | null) => (value && value in applicationLabel ? applicationLabel[value as keyof typeof applicationLabel].label : value ?? "—");
  return event.from_value ? `Application ${label(event.from_value)} → ${label(event.to_value)}` : "Applied";
}

/** Audit trail of placement and application status changes (placement_events table). */
function PlacementHistory({ studentId }: { studentId: string }) {
  const { supabase } = useDashboard();
  const [events, setEvents] = useState<PlacementEvent[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    supabase.from("placement_events").select("*, profiles(full_name)").eq("student_id", studentId).order("created_at", { ascending: false }).limit(30)
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) setError(loadError.message);
        else setEvents((data ?? []) as PlacementEvent[]);
      });
    return () => { cancelled = true; };
  }, [supabase, studentId]);

  return (
    <div className="history">
      <h3>History</h3>
      {error && <p className="muted-note">History unavailable: {error}</p>}
      {!error && events === null && <p className="muted-note">Loading…</p>}
      {events?.length === 0 && <p className="muted-note">No placement activity recorded yet.</p>}
      {events && events.length > 0 && (
        <ul className="history-list">
          {events.map((e) => (
            <li key={e.id}>
              <strong>{describeEvent(e)}</strong>
              {e.detail && <span>{e.detail}</span>}
              <small>{formatDate(e.created_at)} · {e.profiles?.full_name ?? "System"}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AddPersonModal({ kind, onClose }: { kind: "students" | "alumni"; onClose: () => void }) {
  const { supabase, refresh, notify } = useDashboard();
  const [form, setForm] = useState({ full_name: "", email: "", roll_no: "", department: "", batch_year: String(new Date().getFullYear()), current_company: "", designation: "" });
  const [sendInvite, setSendInvite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  const submit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const result = await adminRequest<{ created: number; results: { ok: boolean; error?: string }[] }>(supabase, "/api/admin/people", { kind, rows: [form], sendInvites: sendInvite });
      if (result.created === 0) throw new Error(result.results[0]?.error ?? "Could not create the account.");
      const warning = result.results[0]?.error;
      notify(warning ? `${form.full_name.trim()} added. ${warning}` : `${form.full_name.trim()} added.`, warning ? "error" : "success");
      await refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the account.");
      setBusy(false);
    }
  };

  const isStudent = kind === "students";
  return (
    <Modal title={isStudent ? "Add a student" : "Add an alumnus"} subtitle="Creates their CampusTrack account. They can set a password with “Forgot password?” on the sign-in page." onClose={onClose} wide
      footer={<>
        <span className="spacer" />
        <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
        <button type="submit" form="add-person-form" className="primary-button" disabled={busy}>{busy ? "Adding…" : "Add"}</button>
      </>}>
      <form id="add-person-form" className="form-grid" onSubmit={submit}>
        <Field label="Full name" wide><input value={form.full_name} onChange={set("full_name")} required /></Field>
        <Field label="Email"><input type="email" value={form.email} onChange={set("email")} required /></Field>
        {isStudent && <Field label="Roll number"><input value={form.roll_no} onChange={set("roll_no")} required /></Field>}
        <Field label="Department"><input value={form.department} onChange={set("department")} required /></Field>
        <Field label="Batch year"><input type="number" value={form.batch_year} onChange={set("batch_year")} required /></Field>
        {!isStudent && <>
          <Field label="Current company"><input value={form.current_company} onChange={set("current_company")} /></Field>
          <Field label="Designation"><input value={form.designation} onChange={set("designation")} /></Field>
        </>}
        <label className="check-field field-wide"><input type="checkbox" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} /> Email them a link to set their password (needs SMTP configured in Supabase)</label>
        {error && <p className="form-error">{error}</p>}
      </form>
    </Modal>
  );
}
