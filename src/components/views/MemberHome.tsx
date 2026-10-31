"use client";

import { useState } from "react";
import { useDashboard } from "../dashboard-context";
import { applicationLabel, Badge, companyMark, driveLabel, EmptyState, formatDate, formatLpa, PlacementBadge, studentScore, toneFor } from "../ui";
import { applicationsOpen, DeadlineNote, describeEligibility, isEligible } from "./Drives";

/** Home screen for student and alumni accounts. */
export function MemberHome() {
  const { supabase, user, data, notify, refresh, openView } = useDashboard();
  const [busyId, setBusyId] = useState<number | null>(null);
  const me = user.role === "student" ? data.students.find((s) => s.id === user.id) ?? null : null;
  const myApplications = new Map(data.applications.filter((a) => a.student_id === user.id).map((a) => [a.drive_id, a]));
  const activeDrives = data.drives.filter((d) => d.status !== "completed");

  const apply = async (driveId: number) => {
    setBusyId(driveId);
    const { error } = await supabase.from("applications").insert({ student_id: user.id, drive_id: driveId });
    setBusyId(null);
    if (error) return notify(error.code === "23505" ? "You've already applied to this drive." : error.message, "error");
    notify("Application submitted.");
    await refresh();
  };

  const withdraw = async (applicationId: number) => {
    setBusyId(applicationId);
    // RLS only allows deleting your own application while it is still "applied".
    const { error, count } = await supabase.from("applications").delete({ count: "exact" }).eq("id", applicationId);
    setBusyId(null);
    if (error || count === 0) return notify(error?.message ?? "This application can no longer be withdrawn.", "error");
    notify("Application withdrawn.");
    await refresh();
  };

  return <>
    <div className="page-heading view-heading">
      <div>
        <p className="eyebrow">{user.role === "student" ? "STUDENT SPACE" : "ALUMNI SPACE"}</p>
        <h1>Hello, {user.fullName.split(/\s+/)[0]} <span>✦</span></h1>
        <p className="subheading">{user.role === "student" ? "Drives you can apply to and where your applications stand." : "Current openings at the institute. Refer someone great!"}</p>
      </div>
      <button className="secondary-button" onClick={() => openView("Settings")}>Edit my profile</button>
    </div>

    {me && (
      <section className="metrics-grid">
        <article className="metric-card accent-coral"><div className="metric-top"><span>Status</span></div><strong className="metric-badge"><PlacementBadge status={me.placement_status} /></strong><div className="metric-foot"><span>{me.placed_company ? `${me.placed_company} · ${formatLpa(me.placed_package)}` : me.department}</span></div></article>
        <article className="metric-card accent-lime"><div className="metric-top"><span>Academic score</span></div><strong>{studentScore(me)}</strong><div className="metric-foot"><span>{me.backlog_count} backlogs</span></div></article>
        <article className="metric-card accent-blue"><div className="metric-top"><span>Applications</span></div><strong>{myApplications.size}</strong></article>
        <article className="metric-card accent-yellow"><div className="metric-top"><span>Eligible open drives</span></div><strong>{activeDrives.filter((d) => applicationsOpen(d) && isEligible(me, d.eligibility_criteria ?? {})).length}</strong></article>
      </section>
    )}

    <section className="panel drives-panel">
      <div className="panel-heading"><div><h2>Open placement drives</h2><p>{activeDrives.length} active opportunities</p></div></div>
      {activeDrives.length === 0 ? <EmptyState title="No open drives right now">Check back soon — new drives appear here as soon as they&apos;re posted.</EmptyState> : (
        <div className="drive-list">{activeDrives.map((d) => {
          const application = myApplications.get(d.id);
          const eligible = me ? isEligible(me, d.eligibility_criteria ?? {}) : false;
          return (
            <div className="drive-row" key={d.id}>
              <div className={`company-mark mark-${toneFor(d.companies?.name ?? "")}`}>{companyMark(d.companies?.name ?? "?")}</div>
              <div className="drive-info"><strong>{d.companies?.name}</strong><span>{d.role} · {describeEligibility(d.eligibility_criteria ?? {})}</span></div>
              <div className="drive-date"><span>DRIVE DATE</span><strong>{formatDate(d.drive_date)}</strong><DeadlineNote deadline={d.application_deadline} /></div>
              <div className="drive-package"><span>PACKAGE</span><strong>{d.package_range || "—"}</strong></div>
              <span className="member-action">
                {user.role !== "student" ? <Badge tone={driveLabel[d.status].tone}>{driveLabel[d.status].label}</Badge>
                  : application ? <>
                    <Badge tone={applicationLabel[application.status].tone}>{applicationLabel[application.status].label}</Badge>
                    {application.status === "applied" && <button className="text-button" disabled={busyId === application.id} onClick={() => void withdraw(application.id)}>{busyId === application.id ? "Withdrawing…" : "Withdraw"}</button>}
                  </>
                    : !eligible ? <Badge tone="gray">Not eligible</Badge>
                      : !applicationsOpen(d) ? <Badge tone="gray">Closed</Badge>
                        : <button className="primary-button small-button" disabled={busyId === d.id} onClick={() => void apply(d.id)}>{busyId === d.id ? "Applying…" : "Apply"}</button>}
              </span>
            </div>
          );
        })}</div>
      )}
    </section>

    {data.notifications.length > 0 && (
      <section className="panel report-panel">
        <div className="panel-heading"><div><h2>Announcements</h2><p>From your Training &amp; Placement Office.</p></div></div>
        <div className="notification-list wide-list">{data.notifications.slice(0, 5).map((n) => (
          <div className="notification-item" key={n.id}><strong>{n.title}</strong><p>{n.message}</p><small>{formatDate(n.created_at)}</small></div>
        ))}</div>
      </section>
    )}
  </>;
}
