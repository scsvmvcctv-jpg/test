-- Tie inspections to academic year and semester for per-period logbook lock
alter table inspections
  add column if not exists academic_year text,
  add column if not exists semester_type text;
