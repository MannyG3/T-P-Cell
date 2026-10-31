"use client";

import { useRef, useState } from "react";
import { adminRequest } from "@/lib/data";
import { downloadCsv, parseCsv, rowsToRecords } from "@/lib/csv";
import { useDashboard } from "../dashboard-context";
import { Modal } from "../ui";

type Kind = "students" | "alumni";
type ImportResult = { created: number; failed: number; results: { row: number; email: string; ok: boolean; error?: string }[] };

const TEMPLATES: Record<Kind, { required: string[]; optional: string[]; sample: string[][] }> = {
  students: {
    required: ["full_name", "email", "roll_no", "department", "batch_year"],
    optional: ["division", "contact", "cgpa", "percentage", "backlog_count", "skills", "placement_status", "placed_company", "placed_package"],
    sample: [
      ["Aarav Shah", "aarav.shah@institute.edu", "CO-22104", "Computer Engineering", "2025", "A", "9876543210", "8.7", "", "0", "Java; SQL", "unplaced", "", ""],
      ["Sneha Nair", "sneha.nair@institute.edu", "EL-22111", "Electronics & Telecom", "2025", "B", "9876500000", "9.1", "", "0", "Embedded C", "placed", "Larsen & Toubro", "5.4"],
    ],
  },
  alumni: {
    required: ["full_name", "email", "department", "batch_year"],
    optional: ["current_company", "designation", "location", "linkedin_url", "contact", "willing_to_refer", "willing_to_mentor"],
    sample: [["Rahul Patil", "rahul.patil@example.com", "Mechanical Engineering", "2019", "Tata Motors", "Production Engineer", "Pune", "https://linkedin.com/in/rahulpatil", "9800000000", "yes", "no"]],
  },
};

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_IMPORT_ROWS = 5000;
// Rows per API request: keeps each request well inside the serverless time limit.
export const IMPORT_CHUNK_SIZE = 50;

export function ImportView() {
  const { supabase, refresh, notify } = useDashboard();
  const inputs = { students: useRef<HTMLInputElement>(null), alumni: useRef<HTMLInputElement>(null) };
  const [preview, setPreview] = useState<{ kind: Kind; fileName: string; headers: string[]; records: Record<string, string>[]; missing: string[] } | null>(null);
  const [result, setResult] = useState<(ImportResult & { kind: Kind }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [sendInvites, setSendInvites] = useState(false);

  const downloadTemplate = (kind: Kind) => {
    const t = TEMPLATES[kind];
    downloadCsv(`campustrack-${kind}-template.csv`, [[...t.required, ...t.optional], ...t.sample]);
  };

  const onFile = async (kind: Kind, file: File | undefined) => {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) return notify("Please choose a .csv file. In Excel use File → Save As → CSV UTF-8.", "error");
    if (file.size > MAX_FILE_BYTES) return notify("File is larger than 10 MB.", "error");
    const { headers, records } = rowsToRecords(parseCsv(await file.text()));
    if (records.length === 0) return notify("That file has no data rows.", "error");
    if (records.length > MAX_IMPORT_ROWS) return notify(`That file has ${records.length} rows. Split it into files of at most ${MAX_IMPORT_ROWS}.`, "error");
    setPreview({ kind, fileName: file.name, headers, records, missing: TEMPLATES[kind].required.filter((c) => !headers.includes(c)) });
  };

  const runImport = async () => {
    if (!preview) return;
    const { kind, records } = preview;
    const total: ImportResult = { created: 0, failed: 0, results: [] };
    setBusy(true);
    setProgress({ done: 0, total: records.length });
    try {
      for (let start = 0; start < records.length; start += IMPORT_CHUNK_SIZE) {
        const response = await adminRequest<ImportResult>(supabase, "/api/admin/people", {
          kind, rows: records.slice(start, start + IMPORT_CHUNK_SIZE), rowOffset: start, sendInvites,
        });
        total.created += response.created;
        total.failed += response.failed;
        total.results.push(...response.results);
        setProgress({ done: Math.min(start + IMPORT_CHUNK_SIZE, records.length), total: records.length });
      }
      notify(`Imported ${total.created} ${kind}${total.failed ? `, ${total.failed} skipped` : ""}.`, total.created ? "success" : "error");
    } catch (e) {
      // Earlier chunks are already saved; report what got through.
      notify(`${e instanceof Error ? e.message : "Import failed."} ${total.created} rows were imported before the error.`, "error");
    }
    setResult({ ...total, kind });
    setPreview(null);
    setProgress(null);
    setBusy(false);
    await refresh();
  };

  const card = (kind: Kind, title: string, blurb: string, primary: boolean) => (
    <div className="upload-card">
      <div className={`upload-icon ${kind === "alumni" ? "icon-lavender" : ""}`}>{kind === "alumni" ? "◎" : "↥"}</div>
      <h2>{title}</h2>
      <p>{blurb}</p>
      <input ref={inputs[kind]} type="file" accept=".csv,text/csv" hidden onChange={(e) => { void onFile(kind, e.target.files?.[0]); e.target.value = ""; }} />
      <div className="card-actions">
        <button className={primary ? "primary-button" : "secondary-button"} onClick={() => inputs[kind].current?.click()}>Choose CSV file <span>→</span></button>
        <button className="text-button" onClick={() => downloadTemplate(kind)}>Download template ↓</button>
      </div>
      <span className="upload-hint">Required columns: {TEMPLATES[kind].required.join(", ")}</span>
    </div>
  );

  return <div className="import-view">
    <div className="page-heading view-heading">
      <div><p className="eyebrow">DATA MANAGEMENT</p><h1>Import data</h1><p className="subheading">Bring your student and alumni records into CampusTrack.</p></div>
    </div>
    <div className="import-grid">
      {card("students", "Import students", "Upload a CSV with one student per row. Each student gets a CampusTrack account they can activate with “Forgot password?”.", true)}
      {card("alumni", "Import alumni", "Add alumni records in bulk to start building your institute's network.", false)}
    </div>
    <div className="import-note">
      <span>✦</span>
      <div><strong>Working from Excel?</strong><p>Download a template, fill it in, then use File → Save As → <b>CSV UTF-8</b>. Rows with problems are skipped and listed so you can fix and re-upload them.</p></div>
    </div>

    {result && (
      <section className="panel import-result">
        <div className="panel-heading">
          <div><h2>Last import</h2><p>{result.created} {result.kind} created · {result.failed} skipped</p></div>
          <button className="text-button" onClick={() => setResult(null)}>Dismiss</button>
        </div>
        {result.results.some((r) => !r.ok || r.error) && (
          <div className="table-wrap"><table className="compact-table">
            <thead><tr><th>ROW</th><th>EMAIL</th><th>RESULT</th></tr></thead>
            <tbody>{result.results.filter((r) => !r.ok || r.error).map((r) => (
              <tr key={r.row}><td>{r.row}</td><td>{r.email || "—"}</td><td className={r.ok ? "" : "error-text"}>{r.error}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    )}

    {preview && (
      <Modal title={`Import ${preview.records.length} ${preview.kind}?`} subtitle={preview.fileName} onClose={() => !busy && setPreview(null)} wide
        footer={<>
          <span className="spacer" />
          <button type="button" className="secondary-button" onClick={() => setPreview(null)} disabled={busy}>Cancel</button>
          <button type="button" className="primary-button" onClick={() => void runImport()} disabled={busy || preview.missing.length > 0}>{busy && progress ? `Importing ${progress.done} / ${progress.total}…` : "Import"}</button>
        </>}>
        <label className="check-field invite-option">
          <input type="checkbox" checked={sendInvites} onChange={(e) => setSendInvites(e.target.checked)} disabled={busy} />
          Email each new account a link to set their password <em>(needs custom SMTP configured in Supabase)</em>
        </label>
        {progress && <div className="progress-track import-progress"><i style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>}
        {preview.missing.length > 0
          ? <p className="form-error">Missing required column{preview.missing.length > 1 ? "s" : ""}: <b>{preview.missing.join(", ")}</b>. Download the template to see the expected headers.</p>
          : <p className="muted-note">Columns detected: {preview.headers.filter(Boolean).join(", ")}. Showing the first {Math.min(5, preview.records.length)} rows.</p>}
        <div className="table-wrap"><table className="compact-table">
          <thead><tr>{preview.headers.map((h, i) => <th key={i}>{h.toUpperCase()}</th>)}</tr></thead>
          <tbody>{preview.records.slice(0, 5).map((r, i) => <tr key={i}>{preview.headers.map((h, j) => <td key={j}>{r[h]}</td>)}</tr>)}</tbody>
        </table></div>
      </Modal>
    )}
  </div>;
}
