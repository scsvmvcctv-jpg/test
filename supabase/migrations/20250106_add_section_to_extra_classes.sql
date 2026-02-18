-- Add section column to extra_classes table (S1, S2, S3, etc.)
ALTER TABLE extra_classes ADD COLUMN IF NOT EXISTS section text;
