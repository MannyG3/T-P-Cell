create type public.app_role as enum ('admin', 'student', 'alumni');
create type public.placement_status as enum ('placed', 'unplaced', 'higher-studies');
create type public.drive_status as enum ('upcoming', 'ongoing', 'completed');
create type public.application_status as enum ('applied', 'shortlisted', 'interviewed', 'selected', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'student',
  full_name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key references public.profiles(id) on delete cascade,
  roll_no text not null unique,
  department text not null,
  batch_year integer not null,
  division text,
  contact text,
  resume_url text,
  skills text[] not null default '{}',
  cgpa numeric(4, 2),
  percentage numeric(5, 2),
  backlog_count integer not null default 0 check (backlog_count >= 0),
  placement_status public.placement_status not null default 'unplaced',
  placed_company text,
  placed_package numeric(8, 2),
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.alumni (
  id uuid primary key references public.profiles(id) on delete cascade,
  batch_year integer not null,
  department text not null,
  current_company text,
  designation text,
  location text,
  linkedin_url text,
  contact text,
  willing_to_refer boolean not null default false,
  willing_to_mentor boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.companies (
  id bigint generated always as identity primary key,
  name text not null,
  sector text,
  website text,
  hr_contact text,
  created_at timestamptz not null default now()
);

create table public.drives (
  id bigint generated always as identity primary key,
  company_id bigint not null references public.companies(id) on delete restrict,
  role text not null,
  package_range text,
  eligibility_criteria jsonb not null default '{}'::jsonb,
  drive_date date not null,
  status public.drive_status not null default 'upcoming',
  jd_file_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.applications (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  drive_id bigint not null references public.drives(id) on delete cascade,
  status public.application_status not null default 'applied',
  applied_at timestamptz not null default now(),
  unique (student_id, drive_id)
);

create table public.notifications (
  id bigint generated always as identity primary key,
  title text not null,
  message text not null,
  target_audience jsonb not null default '{"type":"all"}'::jsonb,
  created_at timestamptz not null default now()
);

create index applications_drive_id_idx on public.applications(drive_id);
create index applications_student_id_idx on public.applications(student_id);
create index drives_status_date_idx on public.drives(status, drive_date);
create index students_department_batch_idx on public.students(department, batch_year);

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.alumni enable row level security;
alter table public.companies enable row level security;
alter table public.drives enable row level security;
alter table public.applications enable row level security;
alter table public.notifications enable row level security;

create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create policy "users can view own profile" on public.profiles for select using (id = auth.uid());
create policy "admins can manage profiles" on public.profiles for all using (public.current_role() = 'admin');
create policy "students can view own record" on public.students for select using (id = auth.uid());
create policy "students can update own record" on public.students for update using (id = auth.uid());
create policy "admins can manage students" on public.students for all using (public.current_role() = 'admin');
create policy "alumni can view own record" on public.alumni for select using (id = auth.uid());
create policy "alumni can update own record" on public.alumni for update using (id = auth.uid());
create policy "admins can manage alumni" on public.alumni for all using (public.current_role() = 'admin');
create policy "authenticated users can view companies" on public.companies for select to authenticated using (true);
create policy "admins can manage companies" on public.companies for all using (public.current_role() = 'admin');
create policy "authenticated users can view drives" on public.drives for select to authenticated using (true);
create policy "admins can manage drives" on public.drives for all using (public.current_role() = 'admin');
create policy "students can view own applications" on public.applications for select using (student_id = auth.uid());
create policy "students can apply" on public.applications for insert with check (student_id = auth.uid());
create policy "admins can manage applications" on public.applications for all using (public.current_role() = 'admin');
create policy "authenticated users can view notifications" on public.notifications for select to authenticated using (true);
create policy "admins can manage notifications" on public.notifications for all using (public.current_role() = 'admin');

insert into storage.buckets (id, name, public) values ('student-files', 'student-files', false)
on conflict (id) do nothing;

create policy "students manage own files" on storage.objects for all
using (bucket_id = 'student-files' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'student-files' and (storage.foldername(name))[1] = auth.uid()::text);