"use client";

import { useEffect, type ReactNode } from "react";
import type { ApplicationStatus, DriveStatus, PlacementStatus, Student } from "@/lib/types";

const TONES = ["coral", "lime", "blue", "lavender", "yellow"] as const;

export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function toneFor(seed: string): (typeof TONES)[number] {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length];
}

export function Avatar({ name, seed }: { name: string | null | undefined; seed?: string }) {
  return <div className={`avatar avatar-${toneFor(seed ?? name ?? "")}`}>{initials(name)}</div>;
}

export type Tone = "green" | "yellow" | "blue" | "lavender" | "red" | "gray";

export function Badge({ children, tone }: { children: ReactNode; tone: Tone }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export const placementLabel: Record<PlacementStatus, { label: string; tone: Tone }> = {
  placed: { label: "Placed", tone: "green" },
  unplaced: { label: "Looking", tone: "blue" },
  "higher-studies": { label: "Higher studies", tone: "lavender" },
};

export const driveLabel: Record<DriveStatus, { label: string; tone: Tone }> = {
  upcoming: { label: "Upcoming", tone: "blue" },
  ongoing: { label: "Ongoing", tone: "yellow" },
  completed: { label: "Completed", tone: "gray" },
};

export const applicationLabel: Record<ApplicationStatus, { label: string; tone: Tone }> = {
  applied: { label: "Applied", tone: "gray" },
  shortlisted: { label: "Shortlisted", tone: "yellow" },
  interviewed: { label: "Interviewed", tone: "lavender" },
  selected: { label: "Selected", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
};

export function PlacementBadge({ status }: { status: PlacementStatus }) {
  const { label, tone } = placementLabel[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function studentScore(student: Pick<Student, "cgpa" | "percentage">): string {
  if (student.cgpa !== null) return `${Number(student.cgpa).toFixed(2)} CGPA`;
  if (student.percentage !== null) return `${Number(student.percentage).toFixed(1)}%`;
  return "—";
}

export function formatLpa(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })} LPA`;
}

export function formatDate(value: string): string {
  // Date-only strings ("2024-09-18") are parsed as UTC; format in UTC to avoid off-by-one days.
  return new Date(value.length === 10 ? `${value}T00:00:00Z` : value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: value.length === 10 ? "UTC" : undefined });
}

/** Whole days from today (local) until a YYYY-MM-DD date. Negative if in the past. */
export function daysUntil(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function companyMark(name: string): string {
  const words = name.replace(/[^A-Za-z0-9& ]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
}

export function Modal({ title, subtitle, onClose, children, footer, wide }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`field ${wide ? "field-wide" : ""}`}><span>{label}</span>{children}</label>;
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/** Two-step delete button: first click arms it, second confirms. */
export function ConfirmButton({ label, confirmLabel, onConfirm, armed, setArmed, disabled }: { label: string; confirmLabel: string; onConfirm: () => void; armed: boolean; setArmed: (armed: boolean) => void; disabled?: boolean }) {
  return armed
    ? <span className="confirm-group"><button type="button" className="danger-button" onClick={onConfirm} disabled={disabled}>{confirmLabel}</button><button type="button" className="text-button" onClick={() => setArmed(false)}>Cancel</button></span>
    : <button type="button" className="danger-link" onClick={() => setArmed(true)} disabled={disabled}>{label}</button>;
}
