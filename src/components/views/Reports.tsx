"use client";

import { useMemo } from "react";
import { downloadCsv } from "@/lib/csv";
import type { Student } from "@/lib/types";
import { useDashboard } from "../dashboard-context";
import { EmptyState, formatLpa, placementLabel } from "../ui";

export function studentReportRows(students: Student[]) {
  return [
    ["roll_no", "full_name", "email", "department", "batch_year", "division", "cgpa", "percentage", "backlog_count", "placement_status", "placed_company", "placed_package_lpa", "contact"],
    ...students.map((s) => [s.roll_no, s.profiles?.full_name, s.profiles?.email, s.department, s.batch_year, s.division, s.cgpa, s.percentage, s.backlog_count, placementLabel[s.placement_status].label, s.placed_company, s.placed_package, s.contact]),
  ];
}

const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export function ReportsView() {
  const { data, notify } = useDashboard();
  const { students, drives, applications } = data;
  const today = new Date().toISOString().slice(0, 10);

  const report = useMemo(() => {
    const packages = students.filter((s) => s.placement_status === "placed" && s.placed_package !== null).map((s) => Number(s.placed_package));
    const departments = new Map<string, Student[]>();
    for (const s of students) departments.set(s.department, [...(departments.get(s.department) ?? []), s]);
    const deptRows = [...departments.entries()].map(([department, list]) => {
      const placed = list.filter((s) => s.placement_status === "placed");
      const eligible = list.filter((s) => s.placement_status !== "higher-studies").length;
      const pk = placed.map((s) => s.placed_package).filter((p): p is number => p !== null).map(Number);
      return {
        department,
        total: list.length,
        placed: placed.length,
        higher: list.filter((s) => s.placement_status === "higher-studies").length,
        rate: eligible ? (placed.length / eligible) * 100 : 0,
        avgCgpa: avg(list.map((s) => s.cgpa).filter((c): c is number => c !== null).map(Number)),
        highest: pk.length ? Math.max(...pk) : null,
        average: avg(pk),
      };
    }).sort((a, b) => b.total - a.total);

    const companies = new Map<string, { hires: number; packages: number[] }>();
    for (const s of students) {
      if (s.placement_status !== "placed" || !s.placed_company) continue;
      const entry = companies.get(s.placed_company) ?? { hires: 0, packages: [] };
      entry.hires++;
      if (s.placed_package !== null) entry.packages.push(Number(s.placed_package));
      companies.set(s.placed_company, entry);
    }
    const companyRows = [...companies.entries()].map(([name, v]) => ({ name, hires: v.hires, highest: v.packages.length ? Math.max(...v.packages) : null })).sort((a, b) => b.hires - a.hires);

    const eligibleTotal = students.filter((s) => s.placement_status !== "higher-studies").length;
    const placedTotal = students.filter((s) => s.placement_status === "placed").length;
    return {
      deptRows, companyRows, placedTotal,
      rate: eligibleTotal ? (placedTotal / eligibleTotal) * 100 : 0,
      highest: packages.length ? Math.max(...packages) : null,
      average: avg(packages),
      median: median(packages),
    };
  }, [students]);

  const exportStudents = () => { downloadCsv(`student-placement-report-${today}.csv`, studentReportRows(students)); notify("Student report downloaded."); };
  const exportDepartments = () => {
    downloadCsv(`department-summary-${today}.csv`, [
      ["department", "students", "placed", "higher_studies", "placement_rate_pct", "avg_cgpa", "highest_package_lpa", "average_package_lpa"],
      ...report.deptRows.map((d) => [d.department, d.total, d.placed, d.higher, d.rate.toFixed(1), d.avgCgpa?.toFixed(2), d.highest, d.average?.toFixed(2)]),
    ]);
    notify("Department summary downloaded.");
  };
  const exportDrives = () => {
    downloadCsv(`drives-${today}.csv`, [
      ["company", "role", "drive_date", "status", "package", "applicants", "shortlisted", "selected"],
      ...drives.map((d) => {
        const apps = applications.filter((a) => a.drive_id === d.id);
        return [d.companies?.name, d.role, d.drive_date, d.status, d.package_range, apps.length, apps.filter((a) => a.status === "shortlisted").length, apps.filter((a) => a.status === "selected").length];
      }),
    ]);
    notify("Drive report downloaded.");
  };

  return <>
    <div className="page-heading view-heading">
      <div><p className="eyebrow">INSIGHTS</p><h1>Reports</h1><p className="subheading">Placement outcomes by department and company, ready to export.</p></div>
    </div>
    <section className="metrics-grid">
      <article className="metric-card accent-lime"><div className="metric-top"><span>Placement rate</span></div><strong>{report.rate.toFixed(1)}<span className="unit">%</span></strong><div className="metric-foot"><span>{report.placedTotal} of {students.length} students</span></div></article>
      <article className="metric-card accent-yellow"><div className="metric-top"><span>Highest package</span></div><strong>{report.highest ?? "—"}<span className="unit"> LPA</span></strong></article>
      <article className="metric-card accent-blue"><div className="metric-top"><span>Average package</span></div><strong>{report.average?.toFixed(2) ?? "—"}<span className="unit"> LPA</span></strong></article>
      <article className="metric-card accent-coral"><div className="metric-top"><span>Median package</span></div><strong>{report.median?.toFixed(2) ?? "—"}<span className="unit"> LPA</span></strong></article>
    </section>

    <section className="panel report-panel">
      <div className="panel-heading"><div><h2>Exports</h2><p>CSV files open directly in Excel.</p></div></div>
      <div className="export-row">
        <button className="secondary-button" onClick={exportStudents} disabled={!students.length}>Student placement report ↓</button>
        <button className="secondary-button" onClick={exportDepartments} disabled={!students.length}>Department summary ↓</button>
        <button className="secondary-button" onClick={exportDrives} disabled={!drives.length}>Drives &amp; applications ↓</button>
      </div>
    </section>

    <section className="panel report-panel">
      <div className="panel-heading"><div><h2>Department-wise placement</h2><p>Rate excludes students who chose higher studies.</p></div></div>
      {report.deptRows.length === 0 ? <EmptyState title="No students yet" /> : <div className="table-wrap"><table>
        <thead><tr><th>DEPARTMENT</th><th>STUDENTS</th><th>PLACED</th><th>HIGHER STUDIES</th><th>RATE</th><th>AVG CGPA</th><th>HIGHEST</th><th>AVERAGE</th></tr></thead>
        <tbody>{report.deptRows.map((d) => (
          <tr key={d.department}><td><strong className="cell-strong">{d.department}</strong></td><td>{d.total}</td><td>{d.placed}</td><td>{d.higher}</td><td><div className="rate-cell"><div className="progress-track"><i style={{ width: `${d.rate}%` }} /></div>{d.rate.toFixed(0)}%</div></td><td>{d.avgCgpa?.toFixed(2) ?? "—"}</td><td>{formatLpa(d.highest)}</td><td>{formatLpa(d.average)}</td></tr>
        ))}</tbody>
      </table></div>}
    </section>

    <section className="panel report-panel">
      <div className="panel-heading"><div><h2>Top recruiters</h2><p>Companies by number of students placed.</p></div></div>
      {report.companyRows.length === 0 ? <EmptyState title="No placements recorded yet" /> : <div className="table-wrap"><table>
        <thead><tr><th>COMPANY</th><th>STUDENTS HIRED</th><th>HIGHEST PACKAGE</th></tr></thead>
        <tbody>{report.companyRows.map((c) => <tr key={c.name}><td><strong className="cell-strong">{c.name}</strong></td><td>{c.hires}</td><td>{formatLpa(c.highest)}</td></tr>)}</tbody>
      </table></div>}
    </section>
  </>;
}
