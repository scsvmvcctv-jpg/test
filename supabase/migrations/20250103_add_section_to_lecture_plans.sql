-- Add section column to lecture_plans table (e.g. S1, S2, S3)
ALTER TABLE lecture_plans
ADD COLUMN IF NOT EXISTS section text;
