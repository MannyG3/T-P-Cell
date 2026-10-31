# CampusTrack: T&P Portal

A Training & Placement portal for polytechnic institutes. TPO admins manage students, alumni, placement drives and reports. Students apply to drives and track their applications. Alumni keep their profile current and see openings they can refer people to.

Built with **Next.js 16** (App Router), **React 19**, **TypeScript**, and **Supabase** (Postgres, Auth, Storage, Row Level Security).

## Features

| Area | What it does |
| --- | --- |
| Overview | Live metrics, department-wise placement rate, "needs attention" alerts, upcoming drives |
| Students | Search and filter (status, department, batch); edit academics and placement; resume access; placement history; password-setup emails |
| Alumni | Directory with referral and mentoring flags, CSV export |
| Drives | Eligibility rules (CGPA, backlogs, departments), application deadlines, applicant pipeline with bulk status updates. Selecting a student marks them placed automatically. |
| Import | CSV import of students or alumni with preview, per-row error report, chunked uploads and optional invite emails |
| Reports | Department and recruiter tables, average and median package, CSV exports |
| Students and alumni | Home page with eligible drives, apply/withdraw, resume PDF upload, profile settings |
| Security | Closed sign-up (accounts are created by the TPO), RLS on every table, column-level guards so students can't edit their own grades or placement, audit trail |

## Local development

Requirements: Node.js **22.18+**.

```bash
npm install
cp .env.example .env.local   # then fill in the three values
npm run dev                  # http://localhost:3000
```

> **Windows:** npm's `.cmd` shims break when the folder path contains `&` (for example `T&P APP`). The `dev`, `build` and `start` scripts call Next via `node` to work around this, but tools like `npx` will still fail. Renaming the folder (for example to `TnP-APP`) avoids the problem entirely.

### Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | client and server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client and server | Public anon key (safe to expose; RLS protects data) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Creating and deleting accounts (import, add, delete) and the keep-alive cron. Never prefix it with `NEXT_PUBLIC_`. |
| `CRON_SECRET` | server (Vercel) | Protects `/api/cron/keep-alive` |
| `NEXT_PUBLIC_SITE_URL` | client and server | Base URL for emailed links (invite, reset). Falls back to the request origin. |
| `DEMO_TPO_EMAIL`, `DEMO_TPO_PASSWORD`, `DEMO_TPO_NAME` | local only | `npm run seed:tpo` creates this TPO Admin. |
| `DEMO_USER_PASSWORD` | local only | Password for every account `npm run seed` creates. |

### Database

Migrations live in `supabase/migrations/` and must be applied in filename order.

- **With the Supabase CLI (recommended):**
  ```bash
  supabase link --project-ref <your-project-ref>
  supabase db push
  ```
  If some migrations were already applied by hand in the SQL Editor, first mark them as applied so the CLI doesn't rerun them:
  ```bash
  supabase migration repair --status applied 20240916000000 20240917000000 20240918000000 20240919000000 20240920000000 20240921000000
  ```
- **Without the CLI:** paste each file into Supabase → SQL Editor, in order, and run it.

### Demo data

```bash
npm run seed         # 18 students, 5 alumni, companies, drives, applications (password: demo1234)
npm run seed:reset   # removes exactly what the seed added
```

Create the first TPO Admin from env vars (no credentials in code):

```bash
npm run seed:tpo     # uses DEMO_TPO_EMAIL / DEMO_TPO_PASSWORD from .env.local
```

Every other staff member, student and alumnus is invited from **Settings → Users & access**.

## Tests

```bash
npm test            # unit tests (Node's built-in test runner)
npm run test:e2e    # Playwright end-to-end tests against the Supabase project in .env.local
```

The end-to-end tests expect the seeded demo data. Point them at a **test** project, not production. Override the accounts they use with `E2E_TPO_EMAIL`, `E2E_STUDENT_EMAIL`, `E2E_ALUMNI_EMAIL` (and the matching `_PASSWORD` variables).

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests and a build on every push and pull request. To also run the end-to-end tests in CI:
1. Set the repository variable `E2E_ENABLED=true`.
2. Add the secrets `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY` and `E2E_SUPABASE_SERVICE_ROLE_KEY` for a seeded test project.

## Deployment (Vercel + Supabase)

1. **Vercel → Settings → Environment Variables:** add the four variables above for Production (and Preview if you use it).
2. **Supabase → Authentication → URL Configuration:** set **Site URL** to your production URL and add it under **Redirect URLs**. Password-setup and reset links redirect there.
3. **Supabase → Authentication → Emails → SMTP:** configure a real email provider (Resend, Brevo, SES, Gmail SMTP). Supabase's built-in mailer only delivers to your project team's own addresses, so without this, students never receive password links.
4. **Supabase → Authentication → Sign In / Providers:** turn off "Allow new users to sign up". The database already rejects self-sign-up; this also stops it at the Auth API.
5. **Keep the free tier awake:** `vercel.json` schedules `/api/cron/keep-alive` daily. Alternatively, upgrade Supabase to Pro, which never pauses.
6. Push to `main`. Vercel builds and deploys automatically.
7. Before real use: run `npm run seed:reset` (or use a separate production project), and give the TPO admin a strong password.

## Authentication

- **Sessions:** cookie sessions via `@supabase/ssr`. `src/proxy.ts` refreshes the session on every request and sends signed-out visitors to `/login?next=…`; pages verify the user again on the server.
- **Remember me:** ticked keeps a 400-day cookie. Unticked turns the auth cookies into browser-session cookies (see `src/lib/auth/remember.ts`).
- **Roles:** `tpo_admin`, `dept_coordinator`, `student`, `alumni`, stored in `profiles.role` and set only on the server. The login tab only changes the form; a mismatched tab is rejected.
- **Accounts:** no self-sign-up. TPO Admins invite staff, students and alumni. Alumni can also request access at `/request-access`, which a TPO approves.
- **Email links** all land on `/auth/confirm` and then `/reset-password`.

## Project structure

```
src/app/                 entry page, layouts, error boundaries, API routes
  api/admin/people/      create (import/add) and delete accounts (admin only)
  api/cron/keep-alive/   daily ping that keeps Supabase awake
src/components/          Dashboard shell, login, and one file per view
src/lib/                 Supabase clients, data loading, CSV, types
supabase/migrations/     schema, RLS policies, triggers
scripts/seed-demo.mjs    demo data
tests/                   unit (node:test) and e2e (Playwright)
```
