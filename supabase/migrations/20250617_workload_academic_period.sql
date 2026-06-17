-- Scope weekly schedule rows by academic year and semester type
alter table workload
  add column if not exists academic_year text,
  add column if not exists semester_type text;

-- Backfill legacy rows so existing schedules stay under the prior period
update workload
set
  academic_year = coalesce(academic_year, '2025-2026'),
  semester_type = coalesce(semester_type, 'Even')
where academic_year is null or semester_type is null;

-- Remove duplicates before adding the unique index (keep newest row per staff/day/period)
delete from workload
where id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by staff_id, day_of_week, academic_year, semester_type
        order by updated_at desc nulls last, created_at desc nulls last, id desc
      ) as rn
    from workload
  ) ranked
  where rn > 1
);

create unique index if not exists workload_staff_period_day_idx
  on workload (staff_id, day_of_week, academic_year, semester_type);
