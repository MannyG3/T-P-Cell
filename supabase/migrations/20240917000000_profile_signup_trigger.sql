create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  account_role public.app_role := coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'student');
begin
  insert into public.profiles (id, role, full_name, email)
  values (new.id, account_role, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)), new.email)
  on conflict (id) do nothing;

  if account_role = 'student' then
    insert into public.students (id, roll_no, department, batch_year)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'roll_no', new.id::text), coalesce(new.raw_user_meta_data ->> 'department', 'Pending'), coalesce((new.raw_user_meta_data ->> 'batch_year')::integer, extract(year from now())::integer))
    on conflict (id) do nothing;
  elsif account_role = 'alumni' then
    insert into public.alumni (id, batch_year, department, current_company, designation)
    values (new.id, coalesce((new.raw_user_meta_data ->> 'batch_year')::integer, extract(year from now())::integer), coalesce(new.raw_user_meta_data ->> 'department', 'Pending'), new.raw_user_meta_data ->> 'current_company', new.raw_user_meta_data ->> 'designation')
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into public.profiles (id, role, full_name, email)
select id,
  coalesce((raw_user_meta_data ->> 'role')::public.app_role, 'student'),
  coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1)),
  email
from auth.users
on conflict (id) do nothing;
