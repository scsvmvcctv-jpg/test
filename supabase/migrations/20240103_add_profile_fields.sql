-- Add new columns to profiles table to match external API data

alter table profiles
add column if not exists emp_id text,
add column if not exists user_id_external text,
add column if not exists father_name text,
add column if not exists gender text,
add column if not exists dob date,
add column if not exists doj date,
add column if not exists mobile_no text,
add column if not exists department_no text,
add column if not exists department_name text,
add column if not exists designation_no text,
add column if not exists designation_name text,
add column if not exists status_external text;

-- Update RLS if needed (existing policies should cover these new columns as they are on the same table)
