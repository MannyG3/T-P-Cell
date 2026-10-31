"use client";

import { useRef, useState } from "react";
import { isStoredResume, MAX_RESUME_BYTES, openResume, RESUME_BUCKET, resumePath } from "@/lib/resume";
import { useDashboard } from "../dashboard-context";
import { AccessRequestsCard, InviteUserCard } from "./UsersAccess";
import { Field } from "../ui";

export function SettingsView() {
  const { user, data } = useDashboard();
  const me = user.role === "student" ? data.students.find((s) => s.id === user.id) : null;
  const meAlumnus = user.role === "alumni" ? data.alumni.find((a) => a.id === user.id) : null;

  return <>
    <div className="page-heading view-heading">
      <div><p className="eyebrow">ACCOUNT</p><h1>Settings</h1><p className="subheading">Your profile and sign-in details.</p></div>
    </div>
    <div className="settings-grid">
      <ProfileCard />
      <PasswordCard />
      {me && <StudentDetailsCard key={me.id} />}
      {meAlumnus && <AlumnusDetailsCard key={meAlumnus.id} />}
      {user.role === "tpo_admin" && <><InviteUserCard /><AccessRequestsCard /></>}
    </div>
  </>;
}

function ProfileCard() {
  const { supabase, user, notify, onUserUpdated, refresh, signOut } = useDashboard();
  const [name, setName] = useState(user.fullName);
  const [busy, setBusy] = useState(false);

  const save = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ full_name: name.trim(), updated_at: new Date().toISOString() }).eq("id", user.id);
    setBusy(false);
    if (error) return notify(error.message, "error");
    onUserUpdated({ ...user, fullName: name.trim() });
    notify("Profile updated.");
    await refresh();
  };

  return (
    <section className="panel settings-card">
      <div className="panel-heading"><div><h2>Profile</h2><p>How you appear across CampusTrack.</p></div></div>
      <form className="settings-form" onSubmit={save}>
        <Field label="Full name"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Email"><input value={user.email} disabled /></Field>
        <div className="settings-actions">
          <button className="danger-link" type="button" onClick={() => void signOut()}>Sign out</button>
          <button className="primary-button" disabled={busy || !name.trim() || name.trim() === user.fullName}>{busy ? "Saving…" : "Save profile"}</button>
        </div>
      </form>
    </section>
  );
}

function PasswordCard() {
  const { supabase, notify } = useDashboard();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setBusy(true); setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) return setError(updateError.message);
    setPassword(""); setConfirm("");
    notify("Password changed.");
  };

  return (
    <section className="panel settings-card">
      <div className="panel-heading"><div><h2>Password</h2><p>Choose a new password for signing in.</p></div></div>
      <form className="settings-form" onSubmit={save}>
        <Field label="New password"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></Field>
        <Field label="Confirm new password"><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></Field>
        {error && <p className="form-error">{error}</p>}
        <div className="settings-actions"><span /><button className="primary-button" disabled={busy || !password}>{busy ? "Updating…" : "Change password"}</button></div>
      </form>
    </section>
  );
}

function StudentDetailsCard() {
  const { supabase, user, data, notify, refresh } = useDashboard();
  const me = data.students.find((s) => s.id === user.id)!;
  const [form, setForm] = useState({ contact: me.contact ?? "", division: me.division ?? "", resume_url: isStoredResume(me.resume_url) ? "" : me.resume_url ?? "", skills: me.skills.join(", ") });
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const stored = isStoredResume(me.resume_url);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf") return notify("Upload your resume as a PDF.", "error");
    if (file.size > MAX_RESUME_BYTES) return notify("Resume must be 5 MB or smaller.", "error");
    setBusy(true);
    const path = resumePath(user.id);
    const { error: uploadError } = await supabase.storage.from(RESUME_BUCKET).upload(path, file, { upsert: true, contentType: "application/pdf" });
    const { error } = uploadError ? { error: uploadError } : await supabase.from("students").update({ resume_url: path, updated_at: new Date().toISOString() }).eq("id", user.id);
    setBusy(false);
    if (error) return notify(`Upload failed: ${error.message}`, "error");
    notify("Resume uploaded.");
    await refresh();
  };
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  const save = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("students").update({
      contact: form.contact.trim() || null, division: form.division.trim() || null,
      // Keep an uploaded PDF unless the student typed a link to replace it.
      resume_url: form.resume_url.trim() || (stored ? me.resume_url : null),
      skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean), updated_at: new Date().toISOString(),
    }).eq("id", user.id);
    setBusy(false);
    if (error) return notify(error.message, "error");
    notify("Details saved.");
    await refresh();
  };

  return (
    <section className="panel settings-card">
      <div className="panel-heading"><div><h2>Placement profile</h2><p>{me.roll_no} · {me.department} · Batch {me.batch_year}. Academic scores are managed by your TPO.</p></div></div>
      <form className="settings-form" onSubmit={save}>
        <Field label="Contact number"><input value={form.contact} onChange={set("contact")} /></Field>
        <Field label="Division"><input value={form.division} onChange={set("division")} /></Field>
        <div className="field">
          <span>Resume (PDF, max 5 MB)</span>
          <div className="resume-row">
            {stored && <button type="button" className="secondary-button" onClick={() => void openResume(supabase, me.resume_url!).catch((e: Error) => notify(e.message, "error"))}>View uploaded PDF ↗</button>}
            <button type="button" className={stored ? "text-button" : "secondary-button"} disabled={busy} onClick={() => fileInput.current?.click()}>{stored ? "Replace PDF" : "Upload PDF"}</button>
            <input ref={fileInput} type="file" accept="application/pdf" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
        </div>
        <Field label={stored ? "…or use a link instead" : "…or paste a link"}><input type="url" value={form.resume_url} onChange={set("resume_url")} placeholder="https://drive.google.com/…" /></Field>
        <Field label="Skills (comma separated)"><input value={form.skills} onChange={set("skills")} /></Field>
        <div className="settings-actions"><span /><button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save details"}</button></div>
      </form>
    </section>
  );
}

function AlumnusDetailsCard() {
  const { supabase, user, data, notify, refresh } = useDashboard();
  const me = data.alumni.find((a) => a.id === user.id)!;
  const [form, setForm] = useState({
    current_company: me.current_company ?? "", designation: me.designation ?? "", location: me.location ?? "",
    linkedin_url: me.linkedin_url ?? "", contact: me.contact ?? "", willing_to_refer: me.willing_to_refer, willing_to_mentor: me.willing_to_mentor,
  });
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const save = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("alumni").update({
      current_company: form.current_company.trim() || null, designation: form.designation.trim() || null, location: form.location.trim() || null,
      linkedin_url: form.linkedin_url.trim() || null, contact: form.contact.trim() || null,
      willing_to_refer: form.willing_to_refer, willing_to_mentor: form.willing_to_mentor, updated_at: new Date().toISOString(),
    }).eq("id", user.id);
    setBusy(false);
    if (error) return notify(error.message, "error");
    notify("Details saved.");
    await refresh();
  };

  return (
    <section className="panel settings-card">
      <div className="panel-heading"><div><h2>Alumni profile</h2><p>{me.department} · Batch {me.batch_year}</p></div></div>
      <form className="settings-form" onSubmit={save}>
        <Field label="Current company"><input value={form.current_company} onChange={set("current_company")} /></Field>
        <Field label="Designation"><input value={form.designation} onChange={set("designation")} /></Field>
        <Field label="Location"><input value={form.location} onChange={set("location")} /></Field>
        <Field label="LinkedIn URL"><input type="url" value={form.linkedin_url} onChange={set("linkedin_url")} /></Field>
        <Field label="Contact number"><input value={form.contact} onChange={set("contact")} /></Field>
        <label className="check-field"><input type="checkbox" checked={form.willing_to_refer} onChange={set("willing_to_refer")} /> I can refer students</label>
        <label className="check-field"><input type="checkbox" checked={form.willing_to_mentor} onChange={set("willing_to_mentor")} /> I can mentor students</label>
        <div className="settings-actions"><span /><button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save details"}</button></div>
      </form>
    </section>
  );
}
