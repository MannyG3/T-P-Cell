"use client";

import { useMemo, useState } from "react";
import type { ApplicationStatus, Drive, DriveStatus, Eligibility, Student } from "@/lib/types";
import { useDashboard } from "../dashboard-context";
import { applicationLabel, Avatar, Badge, companyMark, ConfirmButton, daysUntil, driveLabel, EmptyState, Field, formatDate, Modal, studentScore, toneFor } from "../ui";

type Filter = "all" | DriveStatus;

export function isEligible(student: Student, rules: Eligibility): boolean {
  if (student.placement_status === "higher-studies") return false;
  if (rules.departments?.length && !rules.departments.some((d) => d.toLowerCase() === student.department.toLowerCase())) return false;
  if (rules.min_cgpa != null && (student.cgpa === null || student.cgpa < rules.min_cgpa)) return false;
  if (rules.max_backlogs != null && student.backlog_count > rules.max_backlogs) return false;
  return true;
}

export function describeEligibility(rules: Eligibility): string {
  const parts = [
    rules.departments?.length ? rules.departments.join(", ") : "All departments",
    rules.min_cgpa != null ? `CGPA ≥ ${rules.min_cgpa}` : null,
    rules.max_backlogs != null ? `≤ ${rules.max_backlogs} backlogs` : null,
  ];
  return parts.filter(Boolean).join(" · ");
}

/** First number in a package string like "₹5.4 – 7 LPA". */
function packageValue(range: string | null): number | null {
  const match = range?.replace(/,/g, "").match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

/** Mirrors the check_student_application trigger: open until completed or past the deadline. */
export function applicationsOpen(drive: Pick<Drive, "status" | "application_deadline">): boolean {
  return drive.status !== "completed" && (drive.application_deadline === null || daysUntil(drive.application_deadline) >= 0);
}

export function DeadlineNote({ deadline }: { deadline: string | null }) {
  if (!deadline) return null;
  const days = daysUntil(deadline);
  return (
    <em className={`deadline ${days < 0 ? "deadline-closed" : days <= 2 ? "deadline-urgent" : ""}`}>
      {days < 0 ? "Applications closed" : days === 0 ? "Apply by today" : `Apply by ${formatDate(deadline)}`}
    </em>
  );
}

export function DrivesView({ request }: { request: { create?: boolean; driveId?: number } }) {
  const { data } = useDashboard();
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, setCreating] = useState(request.create ?? false);
  const [selectedId, setSelectedId] = useState<number | null>(request.driveId ?? null);

  const applicantCount = useMemo(() => {
    const map = new Map<number, number>();
    for (const a of data.applications) map.set(a.drive_id, (map.get(a.drive_id) ?? 0) + 1);
    return map;
  }, [data.applications]);

  // Active drives first (soonest first), then completed (most recent first).
  const sorted = useMemo(() => [...data.drives].sort((a, b) =>
    (a.status === "completed" ? 1 : 0) - (b.status === "completed" ? 1 : 0)
    || (a.status === "completed" ? b.drive_date.localeCompare(a.drive_date) : a.drive_date.localeCompare(b.drive_date))), [data.drives]);
  const filtered = sorted.filter((d) => filter === "all" || d.status === filter);
  const selected = data.drives.find((d) => d.id === selectedId) ?? null;

  return <>
    <div className="page-heading view-heading">
      <div><p className="eyebrow">PLACEMENT WORKFLOW</p><h1>Placement drives</h1><p className="subheading">Track opportunities, applicants, and deadlines from one place.</p></div>
      <button className="primary-button" onClick={() => setCreating(true)}><span>＋</span> Create drive</button>
    </div>
    <section className="panel directory-panel">
      <div className="directory-toolbar">
        <div className="drive-summary"><strong>{data.drives.length}</strong><span>total drives</span></div>
        {(["all", "upcoming", "ongoing", "completed"] as Filter[]).map((f) => (
          <button key={f} className={`filter-button ${filter === f ? "selected-filter" : ""}`} onClick={() => setFilter(f)}>
            {f === "all" ? "All drives" : driveLabel[f].label} <span className="filter-count">{f === "all" ? data.drives.length : data.drives.filter((d) => d.status === f).length}</span>
          </button>
        ))}
      </div>
      {filtered.length === 0
        ? <EmptyState title={data.drives.length === 0 ? "No drives yet" : "No drives in this list"} action={<button className="secondary-button" onClick={() => setCreating(true)}>Create a drive</button>} />
        : <div className="drive-list full-drive-list">{filtered.map((d) => {
          const days = daysUntil(d.drive_date);
          return (
            <div className="drive-row clickable" key={d.id} onClick={() => setSelectedId(d.id)}>
              <div className={`company-mark mark-${toneFor(d.companies?.name ?? "")}`}>{companyMark(d.companies?.name ?? "?")}</div>
              <div className="drive-info"><strong>{d.companies?.name ?? "Unknown company"}</strong><span>{d.role} · {describeEligibility(d.eligibility_criteria ?? {})}</span></div>
              <div className="drive-date"><span>DRIVE DATE</span><strong>{formatDate(d.drive_date)}</strong>{d.status === "upcoming" && days >= 0 && days <= 7 && <em className="soon">{days === 0 ? "Today" : `in ${days}d`}</em>}{d.status !== "completed" && <DeadlineNote deadline={d.application_deadline} />}</div>
              <div className="drive-applicants"><span>APPLICANTS</span><strong>{applicantCount.get(d.id) ?? 0}</strong></div>
              <div className="drive-package"><span>PACKAGE</span><strong>{d.package_range || "—"}</strong></div>
              <Badge tone={driveLabel[d.status].tone}>{driveLabel[d.status].label}</Badge>
              <button className="row-menu" aria-label="Open drive">Open</button>
            </div>
          );
        })}</div>}
    </section>
    {creating && <DriveForm onClose={() => setCreating(false)} onSaved={(id) => { setCreating(false); setSelectedId(id); }} />}
    {selected && <DriveDetail drive={selected} onClose={() => setSelectedId(null)} />}
  </>;
}

function DriveForm({ drive, onClose, onSaved }: { drive?: Drive; onClose: () => void; onSaved: (id: number) => void }) {
  const { supabase, data, refresh, notify } = useDashboard();
  const departments = useMemo(() => [...new Set(data.students.map((s) => s.department))].sort(), [data.students]);
  const rules = drive?.eligibility_criteria ?? {};
  const [form, setForm] = useState({
    company: drive?.companies?.name ?? "",
    sector: "",
    role: drive?.role ?? "",
    drive_date: drive?.drive_date ?? "",
    application_deadline: drive?.application_deadline ?? "",
    package_range: drive?.package_range ?? "",
    min_cgpa: rules.min_cgpa?.toString() ?? "",
    max_backlogs: rules.max_backlogs?.toString() ?? "",
    departments: rules.departments ?? [],
    status: drive?.status ?? ("upcoming" as DriveStatus),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key: "company" | "sector" | "role" | "drive_date" | "application_deadline" | "package_range" | "min_cgpa" | "max_backlogs") => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });
  const existingCompany = data.companies.find((c) => c.name.toLowerCase() === form.company.trim().toLowerCase());

  const submit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const minCgpa = form.min_cgpa.trim() ? Number(form.min_cgpa) : null;
    const maxBacklogs = form.max_backlogs.trim() ? Number(form.max_backlogs) : null;
    if (!form.company.trim() || !form.role.trim() || !form.drive_date) return setError("Company, role and drive date are required.");
    if (minCgpa !== null && (Number.isNaN(minCgpa) || minCgpa < 0 || minCgpa > 10)) return setError("Minimum CGPA must be between 0 and 10.");
    if (maxBacklogs !== null && (!Number.isInteger(maxBacklogs) || maxBacklogs < 0)) return setError("Max backlogs must be a whole number.");
    if (form.application_deadline && form.application_deadline > form.drive_date) return setError("Applications must close on or before the drive date.");
    setBusy(true); setError("");
    try {
      let companyId = existingCompany?.id;
      if (!companyId) {
        const { data: company, error: companyError } = await supabase.from("companies").insert({ name: form.company.trim(), sector: form.sector.trim() || null }).select("id").single<{ id: number }>();
        if (companyError || !company) throw new Error(companyError?.message ?? "Could not create company.");
        companyId = company.id;
      }
      const payload = {
        company_id: companyId,
        role: form.role.trim(),
        drive_date: form.drive_date,
        application_deadline: form.application_deadline || null,
        package_range: form.package_range.trim() || null,
        status: form.status,
        eligibility_criteria: { min_cgpa: minCgpa, max_backlogs: maxBacklogs, departments: form.departments } satisfies Eligibility,
        updated_at: new Date().toISOString(),
      };
      const result = drive
        ? await supabase.from("drives").update(payload).eq("id", drive.id).select("id").single<{ id: number }>()
        : await supabase.from("drives").insert(payload).select("id").single<{ id: number }>();
      if (result.error || !result.data) throw new Error(result.error?.message ?? "Could not save drive.");
      notify(drive ? "Drive updated." : `${form.company.trim()} drive created.`);
      await refresh();
      onSaved(result.data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save drive.");
      setBusy(false);
    }
  };

  const toggleDept = (dept: string) => setForm({ ...form, departments: form.departments.includes(dept) ? form.departments.filter((d) => d !== dept) : [...form.departments, dept] });

  return (
    <Modal title={drive ? "Edit drive" : "Create a placement drive"} subtitle={drive ? `${drive.companies?.name} · ${drive.role}` : "Add a new opportunity for your students."} onClose={onClose} wide
      footer={<>
        <span className="spacer" />
        <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
        <button type="submit" form="drive-form" className="primary-button" disabled={busy}>{busy ? "Saving…" : drive ? "Save drive" : "Create drive"}</button>
      </>}>
      <form id="drive-form" className="form-grid" onSubmit={submit}>
        <Field label="Company"><input value={form.company} onChange={set("company")} list="company-options" placeholder="e.g. Tata Consultancy Services" required /></Field>
        <datalist id="company-options">{data.companies.map((c) => <option key={c.id} value={c.name} />)}</datalist>
        {!existingCompany && form.company.trim()
          ? <Field label="Sector (new company)"><input value={form.sector} onChange={set("sector")} placeholder="e.g. IT services" /></Field>
          : <Field label="Status"><StatusSelect value={form.status} onChange={(status) => setForm({ ...form, status })} /></Field>}
        <Field label="Role"><input value={form.role} onChange={set("role")} placeholder="e.g. Graduate Engineer Trainee" required /></Field>
        <Field label="Drive date"><input type="date" value={form.drive_date} onChange={set("drive_date")} required /></Field>
        <Field label="Applications close"><input type="date" value={form.application_deadline} onChange={set("application_deadline")} max={form.drive_date || undefined} /></Field>
        <Field label="Package"><input value={form.package_range} onChange={set("package_range")} placeholder="e.g. ₹5.4 LPA or 4–6 LPA" /></Field>
        {!existingCompany && form.company.trim() && <Field label="Status"><StatusSelect value={form.status} onChange={(status) => setForm({ ...form, status })} /></Field>}
        <Field label="Minimum CGPA"><input type="number" step="0.1" value={form.min_cgpa} onChange={set("min_cgpa")} placeholder="Optional" /></Field>
        <Field label="Max backlogs"><input type="number" min="0" value={form.max_backlogs} onChange={set("max_backlogs")} placeholder="Optional" /></Field>
        <div className="field field-wide">
          <span>Eligible departments {form.departments.length === 0 && <em>(none selected = all departments)</em>}</span>
          {departments.length === 0
            ? <p className="muted-note">Departments appear here once students are imported.</p>
            : <div className="chip-list">{departments.map((d) => (
              <button type="button" key={d} className={`chip ${form.departments.includes(d) ? "chip-on" : ""}`} onClick={() => toggleDept(d)}>{d}</button>
            ))}</div>}
        </div>
        {error && <p className="form-error">{error}</p>}
      </form>
    </Modal>
  );
}

function StatusSelect({ value, onChange }: { value: DriveStatus; onChange: (status: DriveStatus) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as DriveStatus)}>
      <option value="upcoming">Upcoming</option>
      <option value="ongoing">Ongoing</option>
      <option value="completed">Completed</option>
    </select>
  );
}

function DriveDetail({ drive, onClose }: { drive: Drive; onClose: () => void }) {
  const { supabase, data, refresh, notify } = useDashboard();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(() => new Set());
  const [bulkStatus, setBulkStatus] = useState<ApplicationStatus>("shortlisted");
  const rules = drive.eligibility_criteria ?? {};
  const companyName = drive.companies?.name ?? "Unknown company";

  const studentsById = useMemo(() => new Map(data.students.map((s) => [s.id, s])), [data.students]);
  const applications = data.applications.filter((a) => a.drive_id === drive.id);
  const appliedIds = new Set(applications.map((a) => a.student_id));
  const candidates = data.students
    .filter((s) => !appliedIds.has(s.id) && isEligible(s, rules))
    .filter((s) => !search.trim() || `${s.profiles?.full_name ?? ""} ${s.roll_no}`.toLowerCase().includes(search.trim().toLowerCase()));

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try { await action(); } catch (e) { notify(e instanceof Error ? e.message : "Something went wrong.", "error"); }
    setBusy(false);
  };

  const addApplicants = (ids: string[]) => run(async () => {
    const { error } = await supabase.from("applications").insert(ids.map((student_id) => ({ student_id, drive_id: drive.id })));
    if (error) throw new Error(error.message);
    notify(`${ids.length} applicant${ids.length === 1 ? "" : "s"} added.`);
    await refresh();
  });

  /** Updates one or many applications; selecting a student also marks them placed at this company. */
  const setStatuses = (applicationIds: number[], status: ApplicationStatus) => run(async () => {
    const { error } = await supabase.from("applications").update({ status }).in("id", applicationIds);
    if (error) throw new Error(error.message);
    let placedNow = 0;
    if (status === "selected") {
      const studentIds = applications
        .filter((a) => applicationIds.includes(a.id) && studentsById.get(a.student_id)?.placement_status !== "placed")
        .map((a) => a.student_id);
      if (studentIds.length) {
        const { error: placeError } = await supabase.from("students").update({
          placement_status: "placed", placed_company: companyName, placed_package: packageValue(drive.package_range), updated_at: new Date().toISOString(),
        }).in("id", studentIds);
        if (placeError) throw new Error(placeError.message);
        placedNow = studentIds.length;
      }
    }
    const who = applicationIds.length === 1 ? (studentsById.get(applications.find((a) => a.id === applicationIds[0])?.student_id ?? "")?.profiles?.full_name ?? "Applicant") : `${applicationIds.length} applicants`;
    notify(`${who} → ${applicationLabel[status].label}${placedNow ? ` · ${placedNow} marked placed at ${companyName}` : ""}.`);
    setChecked(new Set());
    await refresh();
  });

  const toggleChecked = (id: number) => setChecked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const removeApplication = (applicationId: number) => run(async () => {
    const { error } = await supabase.from("applications").delete().eq("id", applicationId);
    if (error) throw new Error(error.message);
    setChecked((prev) => { const next = new Set(prev); next.delete(applicationId); return next; });
    notify("Applicant removed.");
    await refresh();
  });

  const setDriveStatus = (status: DriveStatus) => run(async () => {
    const { error } = await supabase.from("drives").update({ status, updated_at: new Date().toISOString() }).eq("id", drive.id);
    if (error) throw new Error(error.message);
    notify(`Drive marked ${driveLabel[status].label.toLowerCase()}.`);
    await refresh();
  });

  const deleteDrive = () => run(async () => {
    const { error } = await supabase.from("drives").delete().eq("id", drive.id);
    if (error) throw new Error(error.message);
    notify("Drive deleted.");
    await refresh();
    onClose();
  });

  if (editing) return <DriveForm drive={drive} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />;

  const counts = applications.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.status]: (acc[a.status] ?? 0) + 1 }), {});

  return (
    <Modal title={companyName} subtitle={`${drive.role} · Drive ${formatDate(drive.drive_date)}${drive.application_deadline ? ` · Applications close ${formatDate(drive.application_deadline)}` : ""} · ${drive.package_range || "Package not set"}`} onClose={onClose} wide
      footer={<>
        <ConfirmButton label="Delete drive" confirmLabel={`Delete drive${applications.length ? ` and ${applications.length} applications` : ""}`} armed={confirmDelete} setArmed={setConfirmDelete} onConfirm={() => void deleteDrive()} disabled={busy} />
        <span className="spacer" />
        <button type="button" className="secondary-button" onClick={() => setEditing(true)}>Edit details</button>
        <button type="button" className="primary-button" onClick={onClose}>Done</button>
      </>}>
      <div className="detail-strip">
        <div><span>STATUS</span><StatusSelect value={drive.status} onChange={(s) => void setDriveStatus(s)} /></div>
        <div><span>ELIGIBILITY</span><strong>{describeEligibility(rules)}</strong></div>
        <div><span>PIPELINE</span><strong>{applications.length} applied · {counts.shortlisted ?? 0} shortlisted · {counts.selected ?? 0} selected</strong></div>
      </div>

      <div className="section-head">
        <h3>Applicants</h3>
        <button type="button" className="text-button" onClick={() => setAdding(!adding)}>{adding ? "Close" : `Add eligible students (${data.students.filter((s) => !appliedIds.has(s.id) && isEligible(s, rules)).length})`}</button>
      </div>

      {adding && (
        <div className="picker">
          <div className="picker-head">
            <div className="search-box"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search eligible students…" /></div>
            <button type="button" className="secondary-button" disabled={busy || candidates.length === 0} onClick={() => void addApplicants(candidates.map((s) => s.id))}>Add all {candidates.length}</button>
          </div>
          <div className="picker-list">
            {candidates.length === 0 && <p className="muted-note">No eligible students left to add.</p>}
            {candidates.slice(0, 50).map((s) => (
              <div className="picker-row" key={s.id}>
                <Avatar name={s.profiles?.full_name} seed={s.id} />
                <div className="student-name"><strong>{s.profiles?.full_name}</strong><span>{s.roll_no} · {s.department} · {studentScore(s)}</span></div>
                {s.placement_status === "placed" && <Badge tone="green">Placed</Badge>}
                <button type="button" className="text-button" disabled={busy} onClick={() => void addApplicants([s.id])}>Add</button>
              </div>
            ))}
            {candidates.length > 50 && <p className="muted-note">Showing 50 of {candidates.length}. Search to narrow down.</p>}
          </div>
        </div>
      )}

      {applications.length === 0
        ? <EmptyState title="No applicants yet">Add eligible students to start the pipeline.</EmptyState>
        : <>
        {checked.size > 0 && (
          <div className="bulk-bar">
            <strong>{checked.size} selected</strong>
            <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as ApplicationStatus)} aria-label="New status">
              {(Object.keys(applicationLabel) as ApplicationStatus[]).map((st) => <option key={st} value={st}>{applicationLabel[st].label}</option>)}
            </select>
            <button type="button" className="primary-button small-button" disabled={busy} onClick={() => void setStatuses([...checked], bulkStatus)}>Apply to selected</button>
            <button type="button" className="text-button" onClick={() => setChecked(new Set())}>Clear</button>
          </div>
        )}
        <div className="table-wrap"><table className="compact-table">
          <thead><tr>
            <th className="check-col"><input type="checkbox" aria-label="Select all applicants" checked={checked.size === applications.length} onChange={(e) => setChecked(e.target.checked ? new Set(applications.map((a) => a.id)) : new Set())} /></th>
            <th>STUDENT</th><th>SCORE</th><th>APPLIED</th><th>STATUS</th><th />
          </tr></thead>
          <tbody>{applications.map((a) => {
            const s = studentsById.get(a.student_id);
            return (
              <tr key={a.id}>
                <td className="check-col"><input type="checkbox" aria-label={`Select ${s?.profiles?.full_name ?? "applicant"}`} checked={checked.has(a.id)} onChange={() => toggleChecked(a.id)} /></td>
                <td><div className="table-person"><Avatar name={s?.profiles?.full_name} seed={a.student_id} /><div><strong>{s?.profiles?.full_name ?? "Unknown student"}</strong><span>{s?.roll_no} · {s?.department}</span></div></div></td>
                <td>{s ? studentScore(s) : "—"}</td>
                <td>{formatDate(a.applied_at)}</td>
                <td>
                  <select className={`status-select status-${a.status}`} value={a.status} disabled={busy} onChange={(e) => void setStatuses([a.id], e.target.value as ApplicationStatus)}>
                    {(Object.keys(applicationLabel) as ApplicationStatus[]).map((st) => <option key={st} value={st}>{applicationLabel[st].label}</option>)}
                  </select>
                </td>
                <td><button type="button" className="row-menu" disabled={busy} onClick={() => void removeApplication(a.id)} aria-label="Remove applicant">Remove</button></td>
              </tr>
            );
          })}</tbody>
        </table></div>
        </>}
    </Modal>
  );
}
