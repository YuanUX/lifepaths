# ⚠️ DATABASE MIGRATION REQUIRED

## If you see the error: "Could not find the 'order' column of 'subtasks'"

You need to run this SQL in your Supabase SQL Editor to add the order column to your existing database:

## Migration SQL - Copy and paste this into Supabase SQL Editor:

```sql
-- Add order column to subtasks table
ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS "order" INTEGER DEFAULT 0;

-- Create an index on order for better query performance
CREATE INDEX IF NOT EXISTS idx_subtasks_order ON subtasks(goal_id, "order");

-- Update existing subtasks to have sequential order values
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
```

## Steps:
1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"
4. Copy and paste the SQL above
5. Click "Run" or press Cmd/Ctrl + Enter
6. Refresh your LifePath app

## For New Databases:
If you're setting up a fresh database, use the complete `/database-setup.sql` file instead, which already includes the order column.
