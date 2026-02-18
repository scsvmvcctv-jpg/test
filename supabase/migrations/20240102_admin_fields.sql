-- Add status and admin_comments to all tables

do $$
declare
  t text;
begin
  foreach t in array array['workload', 'lecture_plans', 'tests', 'assignments', 'extra_classes', 'assessment_theory', 'assessment_practical', 'inspections']
  loop
    execute format('alter table %I add column if not exists status text default ''Pending'';', t);
    execute format('alter table %I add column if not exists admin_comments text;', t);
  end loop;
end;
$$;
