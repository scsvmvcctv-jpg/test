-- Scope lecture plan rows by academic year and semester type
alter table lecture_plans
  add column if not exists academic_year text,
  add column if not exists semester_type text;

-- Backfill legacy rows to the previous academic period
update lecture_plans
set
  academic_year = coalesce(academic_year, '2025-2026'),
  semester_type = coalesce(semester_type, 'Even')
where academic_year is null or semester_type is null;
