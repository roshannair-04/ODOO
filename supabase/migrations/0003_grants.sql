-- =============================================================================
-- Explicit table/schema privilege grants.
--
-- Supabase normally wires these up automatically when a project is
-- bootstrapped through the dashboard. If your tables ever come back with
-- "permission denied for table X" even though RLS policies look right, run
-- this file — it means the automatic grants didn't take for some reason
-- (seen when migrations are applied through some non-dashboard paths).
-- Safe to run more than once.
-- =============================================================================

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant select on all tables in schema public to anon;

grant usage, select on all sequences in schema public to authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public
  grant select on tables to anon;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;
