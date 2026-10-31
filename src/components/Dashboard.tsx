"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadDashboardData } from "@/lib/data";
import type { DashboardData, SessionUser } from "@/lib/types";
import { DashboardContext, type DashboardContextValue, type StudentFilter, type View } from "./dashboard-context";
import { Avatar, formatDate } from "./ui";
import { Overview } from "./views/Overview";
import { StudentsView } from "./views/Students";
import { AlumniView } from "./views/Alumni";
import { DrivesView } from "./views/Drives";
import { ImportView } from "./views/Import";
import { ReportsView } from "./views/Reports";
import { SettingsView } from "./views/Settings";
import { MemberHome } from "./views/MemberHome";

const workspaceNav: { label: View; icon: string }[] = [
  { label: "Overview", icon: "⌂" },
  { label: "Students", icon: "♧" },
  { label: "Alumni", icon: "◎" },
  { label: "Import data", icon: "↥" },
];
const manageNav: { label: View; icon: string; text: string }[] = [
  { label: "Drives", icon: "▣", text: "Placement drives" },
  { label: "Reports", icon: "▤", text: "Reports" },
  { label: "Settings", icon: "⚙", text: "Settings" },
];

const roleTitle = { admin: "TPO Admin", student: "Student", alumni: "Alumni" } as const;

function academicYear(date = new Date()): string {
  // Indian academic years start in June.
  const start = date.getMonth() >= 5 ? date.getFullYear() : date.getFullYear() - 1;
  return `${start}–${String(start + 1).slice(2)}`;
}

export function Dashboard({ supabase, user: initialUser, onSignOut }: { supabase: SupabaseClient; user: SessionUser; onSignOut: () => void }) {
  const [user, setUser] = useState(initialUser);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [activeView, setActiveView] = useState<View>("Overview");
  const [studentFilter, setStudentFilter] = useState<StudentFilter>("all");
  // Consumed as initial state by DrivesView, which remounts on every navigation to it.
  const [driveRequest, setDriveRequest] = useState<{ create?: boolean; driveId?: number }>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [popover, setPopover] = useState<"none" | "notifications" | "account">("none");
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);
  const [batch, setBatch] = useState<"all" | number>("all");
  const isAdmin = user.role === "admin";

  const refresh = useCallback(async () => {
    try {
      setData(await loadDashboardData(supabase));
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load data.");
    }
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    loadDashboardData(supabase).then(
      (result) => { if (!cancelled) { setData(result); setLoadError(""); } },
      (error: unknown) => { if (!cancelled) setLoadError(error instanceof Error ? error.message : "Could not load data."); },
    );
    return () => { cancelled = true; };
  }, [supabase]);

  // Each notify() creates a new toast object, which restarts this timer.
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toast.kind === "error" ? 6000 : 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notify = useCallback((message: string, kind: "success" | "error" = "success") => setToast({ message, kind }), []);

  const openView = useCallback<DashboardContextValue["openView"]>((view, options) => {
    setActiveView(view);
    setMenuOpen(false);
    setPopover("none");
    if (options?.studentFilter) setStudentFilter(options.studentFilter);
    setDriveRequest({ create: options?.createDrive, driveId: options?.driveId });
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    onSignOut();
  }, [supabase, onSignOut]);

  const batches = useMemo(() => [...new Set((data?.students ?? []).map((s) => s.batch_year))].sort((a, b) => b - a), [data]);

  // The batch selector scopes students (and their applications) across every view.
  const scopedData = useMemo<DashboardData | null>(() => {
    if (!data || batch === "all") return data;
    const students = data.students.filter((s) => s.batch_year === batch);
    const ids = new Set(students.map((s) => s.id));
    return { ...data, students, applications: data.applications.filter((a) => ids.has(a.student_id)) };
  }, [data, batch]);

  const context = useMemo<DashboardContextValue | null>(() => scopedData && ({
    supabase, user, data: scopedData, refresh, notify, openView, signOut, onUserUpdated: setUser,
  }), [supabase, user, scopedData, refresh, notify, openView, signOut]);

  const [now] = useState(() => new Date());
  const navButton = (view: View, icon: string, text: string, extra?: React.ReactNode) => (
    <button className={`nav-item ${activeView === view ? "active" : ""}`} key={view} onClick={() => openView(view)}>
      <span className="nav-icon">{icon}</span>{text}{extra}
    </button>
  );

  return (
    <main className="app-shell">
      {menuOpen && <div className="sidebar-scrim" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand"><span className="brand-mark">ct</span><span>campus<span>track</span></span></div>
        {isAdmin ? <>
          <div className="workspace-label">WORKSPACE</div>
          <nav>{workspaceNav.map((item) => navButton(item.label, item.icon, item.label))}</nav>
          <div className="sidebar-rule" /><div className="workspace-label">MANAGE</div>
          <nav>{manageNav.map((item) => navButton(item.label, item.icon, item.text))}</nav>
        </> : <>
          <div className="workspace-label">MY SPACE</div>
          <nav>
            {navButton("Overview", "⌂", user.role === "student" ? "Drives & applications" : "Opportunities")}
            {navButton("Settings", "⚙", "My account")}
          </nav>
        </>}
        <div className="sidebar-bottom">
          <div className="profile-mini">
            <Avatar name={user.fullName} seed={user.id} />
            <div className="profile-mini-text"><strong>{user.fullName}</strong><span>{roleTitle[user.role]}</span></div>
            <button aria-label="Account menu" onClick={() => setPopover(popover === "account" ? "none" : "account")}>•••</button>
          </div>
        </div>
      </aside>

      <section className="main-content">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">☰</button>
          {isAdmin && batches.length > 0 ? (
            <label className="breadcrumb batch-picker">
              <span>Batch</span>
              <select value={batch} onChange={(e) => setBatch(e.target.value === "all" ? "all" : Number(e.target.value))} aria-label="Filter by batch">
                <option value="all">All batches</option>
                {batches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              <span className="batch-year">AY {academicYear(now)}</span>
            </label>
          ) : (
            <div className="breadcrumb"><span>Academic year</span><strong>{academicYear(now)}</strong></div>
          )}
          <div className="top-actions">
            <button className="icon-button" onClick={() => setPopover(popover === "notifications" ? "none" : "notifications")} aria-label="Notifications">
              ♢{data && data.notifications.length > 0 && <i />}
            </button>
            <button className="top-avatar" onClick={() => setPopover(popover === "account" ? "none" : "account")} aria-label="Account menu">
              {user.fullName.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
            </button>
          </div>
          {popover !== "none" && <div className="popover-scrim" onClick={() => setPopover("none")} />}
          {popover === "account" && (
            <div className="popover account-popover">
              <div className="popover-user"><strong>{user.fullName}</strong><span>{user.email}</span><span>{roleTitle[user.role]}</span></div>
              <button onClick={() => openView("Settings")}>Account settings</button>
              <button className="danger-link" onClick={() => void signOut()}>Sign out</button>
            </div>
          )}
          {popover === "notifications" && data && (
            <NotificationsPopover isAdmin={isAdmin} supabase={supabase} notifications={data.notifications} refresh={refresh} notify={notify} />
          )}
        </header>

        <div className="page-wrap">
          {toast && <div className={`toast ${toast.kind === "error" ? "toast-error" : ""}`} role="status">{toast.kind === "error" ? "!" : "✓"} {toast.message}</div>}
          {!data && !loadError && <div className="loading-state"><span className="spinner" /> Loading your workspace…</div>}
          {!data && loadError && (
            <div className="empty-state">
              <strong>Couldn&apos;t load data</strong>
              <p>{loadError}</p>
              <button className="primary-button" onClick={() => void refresh()}>Try again</button>
            </div>
          )}
          {context && (
            <DashboardContext.Provider value={context}>
              {loadError && <div className="inline-error">Last refresh failed: {loadError}</div>}
              {!isAdmin && activeView === "Overview" && <MemberHome />}
              {isAdmin && activeView === "Overview" && <Overview now={now} />}
              {isAdmin && activeView === "Students" && <StudentsView filter={studentFilter} setFilter={setStudentFilter} />}
              {isAdmin && activeView === "Alumni" && <AlumniView />}
              {isAdmin && activeView === "Drives" && <DrivesView request={driveRequest} />}
              {isAdmin && activeView === "Import data" && <ImportView />}
              {isAdmin && activeView === "Reports" && <ReportsView />}
              {activeView === "Settings" && <SettingsView />}
            </DashboardContext.Provider>
          )}
        </div>
      </section>
    </main>
  );
}

function NotificationsPopover({ isAdmin, supabase, notifications, refresh, notify }: { isAdmin: boolean; supabase: SupabaseClient; notifications: DashboardData["notifications"]; refresh: () => Promise<void>; notify: DashboardContextValue["notify"] }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const post = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !message.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("notifications").insert({ title: title.trim(), message: message.trim() });
    setBusy(false);
    if (error) { notify(error.message, "error"); return; }
    setTitle(""); setMessage("");
    notify("Announcement posted.");
    await refresh();
  };

  return (
    <div className="popover notifications-popover">
      <div className="popover-title">Announcements</div>
      {isAdmin && (
        <form className="announce-form" onSubmit={post}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" maxLength={120} />
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message to students and alumni" rows={2} maxLength={1000} />
          <button className="primary-button" disabled={busy || !title.trim() || !message.trim()}>{busy ? "Posting…" : "Post announcement"}</button>
        </form>
      )}
      <div className="notification-list">
        {notifications.length === 0 && <p className="muted-note">No announcements yet.</p>}
        {notifications.slice(0, 8).map((n) => (
          <div className="notification-item" key={n.id}>
            <strong>{n.title}</strong>
            <p>{n.message}</p>
            <small>{formatDate(n.created_at)}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
