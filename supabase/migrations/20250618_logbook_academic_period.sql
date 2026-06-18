-- Scope assignments, tests, and extra classes by academic year and semester type
alter table assignments
  add column if not exists academic_year text,
  add column if not exists semester_type text;

alter table tests
  add column if not exists academic_year text,
  add column if not exists semester_type text;

alter table extra_classes
  add column if not exists academic_year text,
  add column if not exists semester_type text;

update assignments
set
  academic_year = coalesce(academic_year, '2025-2026'),
  semester_type = coalesce(semester_type, 'Even')
where academic_year is null or semester_type is null;

update tests
set
  academic_year = coalesce(academic_year, '2025-2026'),
  semester_type = coalesce(semester_type, 'Even')
where academic_year is null or semester_type is null;

update extra_classes
set
  academic_year = coalesce(academic_year, '2025-2026'),
  semester_type = coalesce(semester_type, 'Even')
where academic_year is null or semester_type is null;
