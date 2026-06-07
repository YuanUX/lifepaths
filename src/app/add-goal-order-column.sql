-- Add order column to goals table
-- Run this SQL in your Supabase SQL Editor to add goal ordering support

ALTER TABLE goals ADD COLUMN IF NOT EXISTS "order" INTEGER DEFAULT 0;

-- Create index for better performance when sorting by order
CREATE INDEX IF NOT EXISTS idx_goals_order ON goals("order");

-- Update existing rows to have sequential order based on created_at
UPDATE goals 
SET "order" = subquery.row_num - 1
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) as row_num
  FROM goals
) AS subquery
WHERE goals.id = subquery.id;
