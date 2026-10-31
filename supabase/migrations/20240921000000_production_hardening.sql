-- Production hardening: closed sign-up, application deadlines, withdrawals,
-- resume storage access and an audit trail of placement decisions.

-- 1. Closed sign-up --------------------------------------------------------
-- Accounts may only be created by a TPO admin (import / "Add student", which
-- sets app_metadata.provisioned via the service role) or by an invite.
-- app_metadata, unlike user_metadata, cannot be set by the person signing up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data ->> 'role', 'student');
  account_role public.app_role;
  batch_year_text text := nullif(new.raw_user_meta_data ->> 'batch_year', '');
  account_batch_year integer;
begin
  if new.invited_at is null and coalesce(new.raw_app_meta_data ->> 'provisioned', 'false') <> 'true' then
    raise exception 'Self sign-up is disabled. Ask your Training & Placement Office for an account.'
      using errcode = '42501';
  end if;

  if requested_role not in ('student', 'alumni') then
    raise exception 'Self sign-up is only available for student and alumni accounts'
      using errcode = '42501';
  end if;
  account_role := requested_role::public.app_role;

  account_batch_year := case
    when batch_year_text ~ '^\d{4}$' then batch_year_text::integer
    else extract(year from now())::integer
  end;

  insert into public.profiles (id, role, full_name, email)
  values (new.id, account_role, coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)), new.email)
  on conflict (id) do nothing;

  if account_role = 'student' then
    insert into public.students (id, roll_no, department, batch_year)
    values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'roll_no', ''), new.id::text), coalesce(nullif(new.raw_user_meta_data ->> 'department', ''), 'Pending'), account_batch_year)
    on conflict (id) do nothing;
  elsif account_role = 'alumni' then
    insert into public.alumni (id, batch_year, department, current_company, designation)
    values (new.id, account_batch_year, coalesce(nullif(new.raw_user_meta_data ->> 'department', ''), 'Pending'), nullif(new.raw_user_meta_data ->> 'current_company', ''), nullif(new.raw_user_meta_data ->> 'designation', ''))
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

-- 2. Application deadlines ----------------------------------------------------
alter table public.drives add column if not exists application_deadline date;

create or replace function public.check_student_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.status := 'applied';
    new.applied_at := now();
    if not exists (
      select 1 from public.drives
      where id = new.drive_id
        and status <> 'completed'
        and (application_deadline is null or application_deadline >= (now() at time zone 'Asia/Kolkata')::date)
    ) then
      raise exception 'Applications for this drive are closed' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- 3. Students may withdraw an application until it has been processed -----------
drop policy if exists "students can withdraw" on public.applications;
create policy "students can withdraw" on public.applications for delete
using (student_id = auth.uid() and status = 'applied');

-- 4. Resume storage --------------------------------------------------------------
update storage.buckets
set file_size_limit = 5 * 1024 * 1024, allowed_mime_types = array['application/pdf']
where id = 'student-files';

drop policy if exists "admins read student files" on storage.objects;
create policy "admins read student files" on storage.objects for select
using (bucket_id = 'student-files' and public.current_role() = 'admin');

-- 5. Audit trail -------------------------------------------------------------------
create table if not exists public.placement_events (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  drive_id bigint references public.drives(id) on delete set null,
  kind text not null check (kind in ('placement', 'application')),
  from_value text,
  to_value text,
  detail text,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists placement_events_student_idx on public.placement_events(student_id, created_at desc);

alter table public.placement_events enable row level security;
grant select on public.placement_events to authenticated, service_role;
drop policy if exists "admins read events" on public.placement_events;
create policy "admins read events" on public.placement_events for select using (public.current_role() = 'admin');
drop policy if exists "students read own events" on public.placement_events;
create policy "students read own events" on public.placement_events for select using (student_id = auth.uid());

create or replace function public.log_student_placement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.placement_status is distinct from old.placement_status
     or new.placed_company is distinct from old.placed_company
     or new.placed_package is distinct from old.placed_package then
    insert into public.placement_events (student_id, kind, from_value, to_value, detail, actor_id)
    values (new.id, 'placement', old.placement_status::text, new.placement_status::text,
            nullif(concat_ws(' · ', new.placed_company, new.placed_package::text || ' LPA'), ''), auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists log_student_placement on public.students;
create trigger log_student_placement after update on public.students
for each row execute procedure public.log_student_placement();

create or replace function public.log_application_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  label text;
begin
  select c.name || ' — ' || d.role into label
  from public.drives d join public.companies c on c.id = d.company_id
  where d.id = new.drive_id;

  if tg_op = 'INSERT' then
    insert into public.placement_events (student_id, drive_id, kind, from_value, to_value, detail, actor_id)
    values (new.student_id, new.drive_id, 'application', null, new.status::text, label, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.placement_events (student_id, drive_id, kind, from_value, to_value, detail, actor_id)
    values (new.student_id, new.drive_id, 'application', old.status::text, new.status::text, label, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists log_application_status on public.applications;
create trigger log_application_status after insert or update on public.applications
for each row execute procedure public.log_application_status();
