-- Migration: Add order column to subtasks table
-- This allows subtasks to be reordered within their parent goal

-- Add order column with default value
ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS "order" INTEGER DEFAULT 0;

-- Create an index on order for better query performance
CREATE INDEX IF NOT EXISTS idx_subtasks_order ON subtasks(goal_id, "order");

-- Update existing subtasks to have sequential order values
-- This ensures existing data has proper order values
WITH ordered_subtasks AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY goal_id ORDER BY created_at) - 1 AS new_order
  FROM subtasks
  WHERE "order" = 0 OR "order" IS NULL
)
UPDATE subtasks
SET "order" = ordered_subtasks.new_order
FROM ordered_subtasks
WHERE subtasks.id = ordered_subtasks.id;

-- Make order NOT NULL now that all rows have values
ALTER TABLE subtasks ALTER COLUMN "order" SET NOT NULL;
