-- Add section column to assignments table (S1, S2, S3, etc.)
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS section text;
