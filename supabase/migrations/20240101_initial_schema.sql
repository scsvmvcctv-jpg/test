-- Create profiles table
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  department text,
  designation text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table profiles enable row level security;

-- Create policies for profiles
create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);

-- Workload Table
create table workload (
  id uuid default gen_random_uuid() primary key,
  staff_id uuid references auth.users not null,
  day_of_week text not null, -- Mon, Tue, Wed, Thu, Fri, Sat
  period_1 text,
  period_2 text,
  period_3 text,
  period_4 text,
  period_5 text,
  period_6 text,
  period_7 text,
  period_8 text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table workload enable row level security;

create policy "Staff can view own workload" on workload
  for select using (auth.uid() = staff_id);

create policy "Staff can insert own workload" on workload
  for insert with check (auth.uid() = staff_id);

create policy "Staff can update own workload" on workload
  for update using (auth.uid() = staff_id);

create policy "Staff can delete own workload" on workload
  for delete using (auth.uid() = staff_id);

-- Lecture Plan Table
create table lecture_plans (
  id uuid default gen_random_uuid() primary key,
  staff_id uuid references auth.users not null,
  subject text not null,
  period_no integer,
  proposed_date date,
  topic text,
  actual_completion_date date,
  remarks text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table lecture_plans enable row level security;

create policy "Staff can CRUD own lecture plans" on lecture_plans
  for all using (auth.uid() = staff_id);

-- Tests Table
create table tests (
  id uuid default gen_random_uuid() primary key,
  staff_id uuid references auth.users not null,
  subject text not null,
  proposed_test_date date,
  actual_date date,
  date_returned date, -- corrected books
  remarks text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table tests enable row level security;

create policy "Staff can CRUD own tests" on tests
  for all using (auth.uid() = staff_id);

-- Assignments / Lab Records Table
create table assignments (
  id uuid default gen_random_uuid() primary key,
  staff_id uuid references auth.users not null,
  subject text not null,
  type text not null, -- Assignment, Lab Record, Home Assignment
  proposed_date date,
  actual_date date,
  date_returned date,
  remarks text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table assignments enable row level security;

create policy "Staff can CRUD own assignments" on assignments
  for all using (auth.uid() = staff_id);

-- Extra Classes Table
create table extra_classes (
  id uuid default gen_random_uuid() primary key,
  staff_id uuid references auth.users not null,
  date date not null,
  period integer,
  topic text,
  remarks text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table extra_classes enable row level security;

create policy "Staff can CRUD own extra classes" on extra_classes
  for all using (auth.uid() = staff_id);

-- Assessment Theory Table
create table assessment_theory (
  id uuid default gen_random_uuid() primary key,
  staff_id uuid references auth.users not null,
  student_id text, -- or name
  internal_1 numeric,
  internal_2 numeric,
  assignment_attendance numeric,
  total numeric generated always as (coalesce(internal_1, 0) + coalesce(internal_2, 0) + coalesce(assignment_attendance, 0)) stored,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table assessment_theory enable row level security;

create policy "Staff can CRUD own theory assessments" on assessment_theory
  for all using (auth.uid() = staff_id);

-- Assessment Practical Table
create table assessment_practical (
  id uuid default gen_random_uuid() primary key,
  staff_id uuid references auth.users not null,
  student_id text,
  observations numeric,
  model_test numeric,
  record_attendance numeric,
  total numeric generated always as (coalesce(observations, 0) + coalesce(model_test, 0) + coalesce(record_attendance, 0)) stored,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table assessment_practical enable row level security;

create policy "Staff can CRUD own practical assessments" on assessment_practical
  for all using (auth.uid() = staff_id);

-- Inspections Table
create table inspections (
  id uuid default gen_random_uuid() primary key,
  staff_id uuid references auth.users not null,
  date date not null,
  deviations text,
  corrective_action text,
  remarks text,
  hod_initial_url text,
  dean_initial_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table inspections enable row level security;

create policy "Staff can CRUD own inspections" on inspections
  for all using (auth.uid() = staff_id);

-- Function to handle new user creation
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
