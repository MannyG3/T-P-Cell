import type { ReactNode } from "react";
import { academicYearLabel } from "@/lib/academic-year";

function Brand({ className }: { className: string }) {
  return <div className={className}><span className="brand-mark">ct</span><span>campus<span>track</span></span></div>;
}

/** Two-column auth shell (navy art panel + form panel), shared by /login, /reset-password and /request-access. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="login-shell">
      <div className="login-art">
        <Brand className="login-brand" />
        <div className="login-message">
          <p className="eyebrow">TRAINING & PLACEMENT OFFICE</p>
          <h1>Make every opportunity count.</h1>
          <p>One calm workspace for your students, recruiters, and placement team.</p>
        </div>
        <div className="login-art-footer"><span>Academic year {academicYearLabel()}</span><span>Secure institute workspace</span></div>
      </div>
      <section className="login-panel"><div className="login-panel-inner"><Brand className="login-mobile-brand" />{children}</div></section>
    </main>
  );
}
