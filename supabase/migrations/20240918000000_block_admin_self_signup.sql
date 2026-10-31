-- Self-service sign-up must never grant the admin role: raw_user_meta_data is
-- fully controlled by the client calling auth.signUp(). Admins are promoted by
-- an existing admin (or via the dashboard / service role) by updating
-- public.profiles.role directly.
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
