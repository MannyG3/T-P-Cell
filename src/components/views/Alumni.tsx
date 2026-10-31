"use client";

import { useMemo, useState } from "react";
import { adminRequest } from "@/lib/data";
import { downloadCsv } from "@/lib/csv";
import type { Alumnus } from "@/lib/types";
import { useDashboard } from "../dashboard-context";
import { Avatar, Badge, ConfirmButton, EmptyState, Field, Modal } from "../ui";
import { AddPersonModal } from "./Students";

export function AlumniView() {
  const { data, notify } = useDashboard();
  const [query, setQuery] = useState("");
  const [only, setOnly] = useState<"all" | "refer" | "mentor">("all");
  const [editing, setEditing] = useState<Alumnus | null>(null);
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.alumni.filter((a) =>
      (!q || `${a.profiles?.full_name ?? ""} ${a.profiles?.email ?? ""} ${a.department} ${a.batch_year} ${a.current_company ?? ""} ${a.designation ?? ""} ${a.location ?? ""}`.toLowerCase().includes(q))
      && (only === "all" || (only === "refer" ? a.willing_to_refer : a.willing_to_mentor)));
  }, [data.alumni, query, only]);

  const exportDirectory = () => {
    downloadCsv(`alumni-directory-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["full_name", "email", "department", "batch_year", "current_company", "designation", "location", "linkedin_url", "contact", "willing_to_refer", "willing_to_mentor"],
      ...filtered.map((a) => [a.profiles?.full_name, a.profiles?.email, a.department, a.batch_year, a.current_company, a.designation, a.location, a.linkedin_url, a.contact, a.willing_to_refer ? "yes" : "no", a.willing_to_mentor ? "yes" : "no"]),
    ]);
    notify(`Exported ${filtered.length} alumni.`);
  };

  return <>
    <div className="page-heading view-heading">
      <div><p className="eyebrow">NETWORK</p><h1>Alumni directory</h1><p className="subheading">Connect students with the people already out there.</p></div>
      <div className="heading-actions">
        <button className="secondary-button" onClick={() => setAdding(true)}>Add alumnus</button>
        <button className="primary-button" onClick={exportDirectory} disabled={filtered.length === 0}><span>↓</span> Export directory</button>
      </div>
    </div>
    <section className="panel directory-panel">
      <div className="directory-toolbar">
        <div className="search-box"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, company, batch, city…" /></div>
        <button className={`filter-button ${only === "all" ? "selected-filter" : ""}`} onClick={() => setOnly("all")}>Everyone</button>
        <button className={`filter-button ${only === "refer" ? "selected-filter" : ""}`} onClick={() => setOnly("refer")}>Can refer</button>
        <button className={`filter-button ${only === "mentor" ? "selected-filter" : ""}`} onClick={() => setOnly("mentor")}>Can mentor</button>
        <span className="result-count">{filtered.length} of {data.alumni.length}</span>
      </div>
      {filtered.length === 0
        ? <EmptyState title={data.alumni.length === 0 ? "No alumni yet" : "No alumni match"}>{data.alumni.length === 0 ? "Import alumni from the Import data page." : "Try a different search."}</EmptyState>
        : <div className="table-wrap"><table>
          <thead><tr><th>ALUMNUS</th><th>BATCH</th><th>CURRENT ROLE</th><th>LOCATION</th><th>HELPS WITH</th><th /></tr></thead>
          <tbody>{filtered.map((a) => (
            <tr key={a.id} className="clickable" onClick={() => setEditing(a)}>
              <td><div className="table-person"><Avatar name={a.profiles?.full_name} seed={a.id} /><div><strong>{a.profiles?.full_name ?? "Unnamed"}</strong><span>{a.profiles?.email}</span></div></div></td>
              <td>{a.department} · {a.batch_year}</td>
              <td>{a.designation || a.current_company ? <>{a.designation ?? "—"}<span className="muted-inline"> at {a.current_company ?? "—"}</span></> : "—"}</td>
              <td>{a.location ?? "—"}</td>
              <td className="badge-stack">{a.willing_to_refer && <Badge tone="green">Referrals</Badge>}{a.willing_to_mentor && <Badge tone="lavender">Mentoring</Badge>}{!a.willing_to_refer && !a.willing_to_mentor && "—"}</td>
              <td><button className="row-menu">Edit</button></td>
            </tr>
          ))}</tbody>
        </table></div>}
    </section>
    {editing && <AlumnusEditor alumnus={editing} onClose={() => setEditing(null)} />}
    {adding && <AddPersonModal kind="alumni" onClose={() => setAdding(false)} />}
  </>;
}

function AlumnusEditor({ alumnus, onClose }: { alumnus: Alumnus; onClose: () => void }) {
  const { supabase, refresh, notify } = useDashboard();
  const [form, setForm] = useState({
    full_name: alumnus.profiles?.full_name ?? "",
    department: alumnus.department,
    batch_year: String(alumnus.batch_year),
    current_company: alumnus.current_company ?? "",
    designation: alumnus.designation ?? "",
    location: alumnus.location ?? "",
    linkedin_url: alumnus.linkedin_url ?? "",
    contact: alumnus.contact ?? "",
    willing_to_refer: alumnus.willing_to_refer,
    willing_to_mentor: alumnus.willing_to_mentor,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const save = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const batch = Number(form.batch_year);
    if (!form.full_name.trim() || !form.department.trim()) return setError("Name and department are required.");
    if (!Number.isInteger(batch) || batch < 1950 || batch > 2100) return setError("Enter a valid batch year.");
    setBusy(true); setError("");
    const [a, p] = await Promise.all([
      supabase.from("alumni").update({
        department: form.department.trim(), batch_year: batch,
        current_company: form.current_company.trim() || null, designation: form.designation.trim() || null,
        location: form.location.trim() || null, linkedin_url: form.linkedin_url.trim() || null, contact: form.contact.trim() || null,
        willing_to_refer: form.willing_to_refer, willing_to_mentor: form.willing_to_mentor, updated_at: new Date().toISOString(),
      }).eq("id", alumnus.id),
      supabase.from("profiles").update({ full_name: form.full_name.trim(), updated_at: new Date().toISOString() }).eq("id", alumnus.id),
    ]);
    setBusy(false);
    if (a.error ?? p.error) return setError((a.error ?? p.error)!.message);
    notify(`${form.full_name.trim()} updated.`);
    await refresh();
    onClose();
  };

  const remove = async () => {
    setBusy(true);
    try {
      await adminRequest(supabase, "/api/admin/people/delete", { id: alumnus.id });
      notify(`${alumnus.profiles?.full_name ?? "Alumnus"} deleted.`);
      await refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
      setBusy(false);
    }
  };

  return (
    <Modal title={alumnus.profiles?.full_name ?? "Edit alumnus"} subtitle={alumnus.profiles?.email} onClose={onClose} wide
      footer={<>
        <ConfirmButton label="Delete alumnus" confirmLabel="Delete permanently" armed={confirmDelete} setArmed={setConfirmDelete} onConfirm={() => void remove()} disabled={busy} />
        <span className="spacer" />
        <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
        <button type="submit" form="alumnus-form" className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
      </>}>
      <form id="alumnus-form" className="form-grid" onSubmit={save}>
        <Field label="Full name" wide><input value={form.full_name} onChange={set("full_name")} /></Field>
        <Field label="Department"><input value={form.department} onChange={set("department")} /></Field>
        <Field label="Batch year"><input type="number" value={form.batch_year} onChange={set("batch_year")} /></Field>
        <Field label="Current company"><input value={form.current_company} onChange={set("current_company")} /></Field>
        <Field label="Designation"><input value={form.designation} onChange={set("designation")} /></Field>
        <Field label="Location"><input value={form.location} onChange={set("location")} /></Field>
        <Field label="Contact number"><input value={form.contact} onChange={set("contact")} /></Field>
        <Field label="LinkedIn URL" wide><input type="url" value={form.linkedin_url} onChange={set("linkedin_url")} placeholder="https://linkedin.com/in/…" /></Field>
        <label className="check-field"><input type="checkbox" checked={form.willing_to_refer} onChange={set("willing_to_refer")} /> Willing to refer students</label>
        <label className="check-field"><input type="checkbox" checked={form.willing_to_mentor} onChange={set("willing_to_mentor")} /> Willing to mentor students</label>
        {error && <p className="form-error">{error}</p>}
      </form>
    </Modal>
  );
}
