-- Function to get all lecture plans (bypassing RLS)
create or replace function admin_get_lecture_plans()
returns setof lecture_plans
language sql
security definer
as $$
  select * from lecture_plans;
$$;

-- Function to get all tests
create or replace function admin_get_tests()
returns setof tests
language sql
security definer
as $$
  select * from tests;
$$;

-- Function to get all assignments
create or replace function admin_get_assignments()
returns setof assignments
language sql
security definer
as $$
  select * from assignments;
$$;

-- Function to get all extra classes
create or replace function admin_get_extra_classes()
returns setof extra_classes
language sql
security definer
as $$
  select * from extra_classes;
$$;

-- Function to get all theory assessments
create or replace function admin_get_assessment_theory()
returns setof assessment_theory
language sql
security definer
as $$
  select * from assessment_theory;
$$;

-- Function to get all practical assessments
create or replace function admin_get_assessment_practical()
returns setof assessment_practical
language sql
security definer
as $$
  select * from assessment_practical;
$$;

-- Function to get all workload
create or replace function admin_get_workload()
returns setof workload
language sql
security definer
as $$
  select * from workload;
$$;
