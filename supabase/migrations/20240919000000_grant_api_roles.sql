-- Newer Supabase projects do not auto-grant privileges on tables created in
-- the public schema, so the Data API roles must be granted explicitly.
-- Row Level Security policies still decide which rows each user can touch.
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on function public.current_role() to authenticated, service_role;

-- Apply the same grants to tables created by future migrations.
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to authenticated, service_role;
