-- Add unit_no column to lecture_plans table

alter table lecture_plans
add column if not exists unit_no integer;
