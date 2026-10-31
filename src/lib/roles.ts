export const ROLES = ["tpo_admin", "dept_coordinator", "student", "alumni"] as const;
export type AccountRole = (typeof ROLES)[number];

export const roleLabel: Record<AccountRole, string> = {
  tpo_admin: "TPO Admin",
  dept_coordinator: "Department Coordinator",
  student: "Student",
  alumni: "Alumni",
};

/** Tabs on the login page. The tab only changes the form; the role always comes from `profiles`. */
export const LOGIN_TABS = ["staff", "student", "alumni"] as const;
export type LoginTab = (typeof LOGIN_TABS)[number];

export const loginTabLabel: Record<LoginTab, string> = { staff: "TPO Admin", student: "Student", alumni: "Alumni" };

/** Which account roles may sign in through each tab. Coordinators use the staff tab. */
export const tabRoles: Record<LoginTab, AccountRole[]> = {
  staff: ["tpo_admin", "dept_coordinator"],
  student: ["student"],
  alumni: ["alumni"],
};

export const tabForRole = (role: AccountRole): LoginTab => (role === "student" ? "student" : role === "alumni" ? "alumni" : "staff");

/** Landing route after sign-in. Phase 3 gives roles separate areas; for now everyone starts at /dashboard. */
const ROLE_HOME: Record<AccountRole, string> = {
  tpo_admin: "/dashboard",
  dept_coordinator: "/dashboard",
  student: "/dashboard",
  alumni: "/dashboard",
};
export const homeForRole = (role: AccountRole): string => ROLE_HOME[role];

export const isLoginTab = (value: unknown): value is LoginTab => typeof value === "string" && (LOGIN_TABS as readonly string[]).includes(value);
export const isAccountRole = (value: unknown): value is AccountRole => typeof value === "string" && (ROLES as readonly string[]).includes(value);

/** Only allow same-site relative redirects (blocks //evil.com and absolute URLs). */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}
