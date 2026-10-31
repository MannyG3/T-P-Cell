-- RLS decides *which rows* a student/alumnus can update; these triggers decide
-- *which columns*. Without them a student could raise their own CGPA or mark
-- themselves placed through the API. Admins and the service role (auth.uid()
-- is null) are unrestricted.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select auth.uid() is null or coalesce(public.current_role() = 'admin', false) $$;

grant execute on function public.is_admin() to authenticated, service_role;

-- Students may edit only their contact details, resume and skills.
create or replace function public.protect_student_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.roll_no := old.roll_no;
    new.department := old.department;
    new.batch_year := old.batch_year;
    new.cgpa := old.cgpa;
    new.percentage := old.percentage;
    new.backlog_count := old.backlog_count;
    new.placement_status := old.placement_status;
    new.placed_company := old.placed_company;
    new.placed_package := old.placed_package;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_student_columns on public.students;
create trigger protect_student_columns before update on public.students
for each row execute procedure public.protect_student_columns();

-- Alumni may not move themselves to another batch or department.
create or replace function public.protect_alumni_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.batch_year := old.batch_year;
    new.department := old.department;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_alumni_columns on public.alumni;
create trigger protect_alumni_columns before update on public.alumni
for each row execute procedure public.protect_alumni_columns();

-- Everyone can fix their own display name, but never their role or email.
drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.email := old.email;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_columns on public.profiles;
create trigger protect_profile_columns before update on public.profiles
for each row execute procedure public.protect_profile_columns();

-- A student's own application always starts as 'applied', and only for drives that are still open.
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
    if not exists (select 1 from public.drives where id = new.drive_id and status <> 'completed') then
      raise exception 'This drive is no longer accepting applications' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists check_student_application on public.applications;
create trigger check_student_application before insert on public.applications
for each row execute procedure public.check_student_application();
