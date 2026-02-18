-- Add subject field to assessment_theory and assessment_practical tables

alter table assessment_theory
add column if not exists subject text;

alter table assessment_practical
add column if not exists subject text;
