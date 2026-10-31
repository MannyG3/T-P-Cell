"use client";

import { useMemo } from "react";
import { downloadCsv } from "@/lib/csv";
import { useDashboard } from "../dashboard-context";
import { Avatar, companyMark, daysUntil, driveLabel, Badge, EmptyState, formatDate, PlacementBadge, studentScore, toneFor } from "../ui";
import { studentReportRows } from "./Reports";

const PULSE_COLORS = ["#91b875", "#e4b85d", "#7f9dc2", "#dc8d78", "#a58fc9", "#6fb3a8"];

export function isIncomplete(student: { contact: string | null; resume_url: string | null; cgpa: number | null; percentage: number | null }) {
  return !student.contact || !student.resume_url || (student.cgpa === null && student.percentage === null);
}

export function Overview({ now }: { now: Date }) {
  const { user, data, openView, notify } = useDashboard();
  const { students, drives, applications } = data;

  const stats = useMemo(() => {
    const placed = students.filter((s) => s.placement_status === "placed");
    const eligible = students.filter((s) => s.placement_status !== "higher-studies");
    const top = placed.reduce<(typeof placed)[number] | null>((best, s) => (s.placed_package !== null && (best?.placed_package ?? -1) < s.placed_package ? s : best), null);
    const active = drives.filter((d) => d.status !== "completed");
    const closingSoon = active.filter((d) => d.status === "upcoming" && daysUntil(d.drive_date) >= 0 && daysUntil(d.drive_date) <= 7);

    const byDept = new Map<string, { total: number; placed: number }>();
    for (const s of students) {
      const entry = byDept.get(s.department) ?? { total: 0, placed: 0 };
      entry.total++;
      if (s.placement_status === "placed") entry.placed++;
      byDept.set(s.department, entry);
    }
    const pulse = [...byDept.entries()]
      .map(([department, v]) => ({ department, ...v, rate: Math.round((v.placed / v.total) * 100) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    const applicantCount = new Map<number, number>();
    for (const a of applications) applicantCount.set(a.drive_id, (applicantCount.get(a.drive_id) ?? 0) + 1);

    return {
      placedCount: placed.length,
      rate: eligible.length ? (placed.length / eligible.length) * 100 : 0,
      top,
      active,
      closingSoon,
      pulse,
      applicantCount,
      incomplete: students.filter(isIncomplete).length,
      awaitingDecision: applications.filter((a) => a.status === "shortlisted" || a.status === "interviewed").length,
    };
  }, [students, drives, applications]);

  const attention = [
    ...stats.closingSoon.map((d) => ({
      key: `drive-${d.id}`, dot: "dot-coral",
      title: `${d.companies?.name ?? "Drive"} drive ${daysUntil(d.drive_date) === 0 ? "is today" : `in ${daysUntil(d.drive_date)} day${daysUntil(d.drive_date) === 1 ? "" : "s"}`}`,
      detail: `${stats.applicantCount.get(d.id) ?? 0} applicants · ${d.role}`,
      onClick: () => openView("Drives", { driveId: d.id }),
    })),
    ...(stats.incomplete > 0 ? [{
      key: "incomplete", dot: "dot-yellow",
      title: `${stats.incomplete} student profile${stats.incomplete === 1 ? "" : "s"} incomplete`,
      detail: "Missing contact, resume or academic score",
      onClick: () => openView("Students", { studentFilter: "incomplete" }),
    }] : []),
    ...(stats.awaitingDecision > 0 ? [{
      key: "decisions", dot: "dot-blue",
      title: `${stats.awaitingDecision} application${stats.awaitingDecision === 1 ? "" : "s"} awaiting a decision`,
      detail: "Shortlisted or interviewed candidates",
      onClick: () => openView("Drives"),
    }] : []),
  ];

  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const recent = students.slice(0, 5);
  const upcoming = stats.active.slice(0, 4);

  return <>
    <div className="page-heading">
      <div>
        <p className="eyebrow">{now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase()}</p>
        <h1>{greeting}, {user.fullName.split(/\s+/)[0]} <span>✦</span></h1>
        <p className="subheading">Here&apos;s what&apos;s happening across your placement cell.</p>
      </div>
      <button className="primary-button" onClick={() => openView("Import data")}><span>＋</span> Import students</button>
    </div>

    <section className="metrics-grid">
      <article className="metric-card accent-coral">
        <div className="metric-top"><span>Total students</span><span className="metric-icon">♧</span></div>
        <strong>{students.length.toLocaleString("en-IN")}</strong>
        <div className="metric-foot"><span className="trend-neutral">{data.alumni.length.toLocaleString("en-IN")} alumni in network</span></div>
      </article>
      <article className="metric-card accent-lime">
        <div className="metric-top"><span>Placement rate</span><span className="metric-icon">◒</span></div>
        <strong>{stats.rate.toFixed(1)}<span className="unit">%</span></strong>
        <div className="metric-foot"><span className="trend-up">{stats.placedCount} placed</span><span>excl. higher studies</span></div>
      </article>
      <article className="metric-card accent-blue">
        <div className="metric-top"><span>Active drives</span><span className="metric-icon">↗</span></div>
        <strong>{stats.active.length}</strong>
        <div className="metric-foot"><span className="trend-neutral">{stats.closingSoon.length} in the next 7 days</span></div>
      </article>
      <article className="metric-card accent-yellow">
        <div className="metric-top"><span>Highest package</span><span className="metric-icon">₹</span></div>
        <strong>{stats.top?.placed_package != null ? <>{Number(stats.top.placed_package).toLocaleString("en-IN")}<span className="unit"> LPA</span></> : "—"}</strong>
        <div className="metric-foot"><span className="trend-neutral">{stats.top ? `${stats.top.placed_company ?? "Unknown company"}` : "No placements recorded yet"}</span></div>
      </article>
    </section>

    <div className="insight-grid">
      <section className="panel pulse-panel">
        <div className="panel-heading"><div><h2>Placement pulse</h2><p>Department-wise placement rate.</p></div><span className="live-label">LIVE</span></div>
        {stats.pulse.length === 0
          ? <EmptyState title="No students yet">Import students to see department progress.</EmptyState>
          : <div className="pulse-list">{stats.pulse.map((row, index) => (
            <div className="pulse-row" key={row.department}>
              <span title={`${row.placed} of ${row.total} placed`}>{row.department}</span>
              <div className="progress-track"><i style={{ width: `${row.rate}%`, background: PULSE_COLORS[index % PULSE_COLORS.length] }} /></div>
              <strong>{row.rate}%</strong>
            </div>
          ))}</div>}
      </section>
      <section className="panel attention-panel">
        <div className="panel-heading"><div><h2>Needs attention</h2><p>Small things worth handling today.</p></div><span className="attention-count">{attention.length}</span></div>
        {attention.length === 0
          ? <EmptyState title="All caught up">Nothing needs your attention right now.</EmptyState>
          : <div className="attention-list">{attention.slice(0, 5).map((item) => (
            <button key={item.key} onClick={item.onClick}>
              <span className={`attention-dot ${item.dot}`} />
              <span><strong>{item.title}</strong><small>{item.detail}</small></span>
              <b>→</b>
            </button>
          ))}</div>}
      </section>
    </div>

    <div className="content-grid">
      <section className="panel students-panel">
        <div className="panel-heading"><div><h2>Recently updated students</h2><p>The latest profile activity.</p></div><button className="text-button" onClick={() => openView("Students", { studentFilter: "all" })}>View all <span>→</span></button></div>
        {recent.length === 0
          ? <EmptyState title="No students yet" action={<button className="secondary-button" onClick={() => openView("Import data")}>Import students</button>} />
          : <div className="student-list">{recent.map((s) => (
            <div className="student-row" key={s.id}>
              <Avatar name={s.profiles?.full_name} seed={s.id} />
              <div className="student-name"><strong>{s.profiles?.full_name ?? "Unnamed"}</strong><span>{s.roll_no} · {s.department}</span></div>
              <div className="student-score">{studentScore(s)}</div>
              <PlacementBadge status={s.placement_status} />
            </div>
          ))}</div>}
      </section>
      <section className="panel action-panel">
        <div className="panel-heading"><div><h2>Quick actions</h2><p>Common tasks, right where you need them.</p></div></div>
        <div className="action-list">
          <button onClick={() => openView("Import data")}><span className="action-icon action-orange">↥</span><span><strong>Import student data</strong><small>Upload a CSV file</small></span><span className="action-arrow">→</span></button>
          <button onClick={() => openView("Drives", { createDrive: true })}><span className="action-icon action-green">＋</span><span><strong>Create a placement drive</strong><small>Add a new opportunity</small></span><span className="action-arrow">→</span></button>
          <button onClick={() => { downloadCsv(`placement-report-${new Date().toISOString().slice(0, 10)}.csv`, studentReportRows(students)); notify("Placement report downloaded."); }}><span className="action-icon action-purple">▤</span><span><strong>Export placement report</strong><small>Excel-ready CSV of all students</small></span><span className="action-arrow">→</span></button>
        </div>
      </section>
    </div>

    <section className="panel drives-panel">
      <div className="panel-heading"><div><h2>Upcoming placement drives</h2><p>Opportunities currently open for your students.</p></div><button className="text-button" onClick={() => openView("Drives")}>Manage drives <span>→</span></button></div>
      {upcoming.length === 0
        ? <EmptyState title="No active drives" action={<button className="secondary-button" onClick={() => openView("Drives", { createDrive: true })}>Create a drive</button>} />
        : <div className="drive-list">{upcoming.map((d) => (
          <div className="drive-row clickable" key={d.id} onClick={() => openView("Drives", { driveId: d.id })}>
            <div className={`company-mark mark-${toneFor(d.companies?.name ?? "")}`}>{companyMark(d.companies?.name ?? "?")}</div>
            <div className="drive-info"><strong>{d.companies?.name ?? "Unknown company"}</strong><span>{d.role}</span></div>
            <div className="drive-date"><span>DRIVE DATE</span><strong>{formatDate(d.drive_date)}</strong></div>
            <div className="drive-applicants"><span>APPLICANTS</span><strong>{stats.applicantCount.get(d.id) ?? 0}</strong></div>
            <div className="drive-package"><span>PACKAGE</span><strong>{d.package_range || "—"}</strong></div>
            <Badge tone={driveLabel[d.status].tone}>{driveLabel[d.status].label}</Badge>
          </div>
        ))}</div>}
    </section>
  </>;
}
