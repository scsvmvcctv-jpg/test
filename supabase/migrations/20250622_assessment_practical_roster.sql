-- Persist imported practical assessment student rosters per subject and period
create table if not exists assessment_practical_roster (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references auth.users not null,
  subject text not null,
  academic_year text not null,
  semester_type text not null,
  registrationno text not null,
  student_name text not null,
  section text,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  unique (staff_id, subject, academic_year, semester_type, registrationno)
);

alter table assessment_practical_roster enable row level security;

create policy "Staff can CRUD own practical roster" on assessment_practical_roster
  for all using (auth.uid() = staff_id);
