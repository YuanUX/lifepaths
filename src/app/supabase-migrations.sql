-- Migration to add color and notes fields

-- Add color column to life_milestones table
ALTER TABLE life_milestones 
ADD COLUMN IF NOT EXISTS color TEXT;

-- Add color column to goal_milestones table  
ALTER TABLE goal_milestones
ADD COLUMN IF NOT EXISTS color TEXT;

-- Add notes column to goals table
ALTER TABLE goals
ADD COLUMN IF NOT EXISTS notes TEXT;
