-- Phase 1: roles, departments, invite-only accounts, alumni access requests.
-- Apply AFTER 20240921000000_production_hardening.sql.
--
-- Note: a value added with ALTER TYPE ... ADD VALUE cannot be used in the same
-- transaction, so functions below compare roles as text.

-- 1. Roles ---------------------------------------------------------------------
alter type public.app_role rename value 'admin' to 'tpo_admin';
alter type public.app_role add value if not exists 'dept_coordinator';

-- SQL-language bodies are re-parsed at call time, so the old 'admin' literal must go.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select auth.uid() is null or coalesce(public.current_role()::text = 'tpo_admin', false) $$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select coalesce(public.current_role()::text in ('tpo_admin', 'dept_coordinator'), false) $$;

grant execute on function public.is_staff() to authenticated, service_role;

-- 2. Departments ------------------------------------------------------------------
create table if not exists public.departments (
  id bigint generated always as identity primary key,
  code text not null unique,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.departments (code, name) values
  ('CO', 'Computer Engineering'),
  ('IF', 'Information Technology'),
  ('EJ', 'Electronics & Telecom'),
  ('ME', 'Mechanical Engineering'),
  ('CE', 'Civil Engineering'),
  ('EE', 'Electrical Engineering')
on conflict (code) do nothing;

alter table public.departments enable row level security;
grant select on public.departments to anon, authenticated;
grant insert, update, delete on public.departments to authenticated;
drop policy if exists "anyone can read departments" on public.departments;
create policy "anyone can read departments" on public.departments for select using (true);
drop policy if exists "admins manage departments" on public.departments;
create policy "admins manage departments" on public.departments for all using (public.is_admin()) with check (public.is_admin());

-- 3. Profiles: coordinator department + account status -----------------------------
alter table public.profiles add column if not exists department_id bigint references public.departments(id) on delete set null;
alter table public.profiles add column if not exists status text not null default 'active' check (status in ('active', 'disabled'));

-- 4. Invite-only account creation ------------------------------------------------------
-- Accounts come from (a) a TPO invite (invited_at is set) or (b) a server-side
-- import/seed that sets app_metadata.provisioned. app_metadata can only be written
-- with the service-role key, so a browser can never choose its own role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  requested_role text := coalesce(meta ->> 'role', 'student');
  dept_id bigint := nullif(meta ->> 'department_id', '')::bigint;
  dept_name text;
  batch_year_text text := nullif(meta ->> 'batch_year', '');
  account_batch_year integer;
begin
  if new.invited_at is null and coalesce(new.raw_app_meta_data ->> 'provisioned', 'false') <> 'true' then
    raise exception 'Self sign-up is disabled. Ask your Training & Placement Office for an account.'
      using errcode = '42501';
  end if;

  if requested_role not in ('tpo_admin', 'dept_coordinator', 'student', 'alumni') then
    raise exception 'Unknown role %', requested_role using errcode = '22023';
  end if;

  select name into dept_name from public.departments where id = dept_id;
  dept_name := coalesce(dept_name, nullif(meta ->> 'department', ''));

  account_batch_year := case
    when batch_year_text ~ '^\d{4}$' then batch_year_text::integer
    else extract(year from now())::integer
  end;

  insert into public.profiles (id, role, full_name, email, department_id)
  values (
    new.id,
    requested_role::public.app_role,
    coalesce(nullif(meta ->> 'full_name', ''), split_part(new.email, '@', 1)),
    new.email,
    case when requested_role = 'dept_coordinator' then dept_id end
  )
  on conflict (id) do nothing;

  if requested_role = 'student' then
    insert into public.students (id, roll_no, department, batch_year)
    values (new.id, coalesce(nullif(meta ->> 'roll_no', ''), new.id::text), coalesce(dept_name, 'Pending'), account_batch_year)
    on conflict (id) do nothing;
  elsif requested_role = 'alumni' then
    insert into public.alumni (id, batch_year, department, current_company, designation)
    values (new.id, account_batch_year, coalesce(dept_name, 'Pending'), nullif(meta ->> 'current_company', ''), nullif(meta ->> 'designation', ''))
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

-- 5. Alumni access requests --------------------------------------------------------------
create table if not exists public.alumni_requests (
  id bigint generated always as identity primary key,
  full_name text not null check (length(trim(full_name)) between 2 and 120),
  personal_email text not null check (personal_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  department_id bigint references public.departments(id) on delete set null,
  passing_year integer check (passing_year between 1950 and 2100),
  roll_no text,
  current_company text,
  message text check (length(message) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- At most one open request per email.
create unique index if not exists alumni_requests_pending_email_idx
  on public.alumni_requests (lower(personal_email)) where status = 'pending';

alter table public.alumni_requests enable row level security;
grant select, update on public.alumni_requests to authenticated;
-- Requests are inserted by a server action with the service role (validated there);
-- only TPO admins can read or review them.
drop policy if exists "admins manage alumni requests" on public.alumni_requests;
create policy "admins manage alumni requests" on public.alumni_requests for all using (public.is_admin()) with check (public.is_admin());
