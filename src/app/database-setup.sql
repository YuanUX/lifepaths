-- LifePath Database Schema
-- Run this SQL in your Supabase SQL Editor to set up the tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Goals table
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('todo', 'in-progress', 'completed')),
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subtasks table
CREATE TABLE IF NOT EXISTS subtasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  duration_days INTEGER NOT NULL,
  start_offset_days INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('todo', 'in-progress', 'completed')),
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Goal milestones table
CREATE TABLE IF NOT EXISTS goal_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date_offset INTEGER NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Life milestones table
CREATE TABLE IF NOT EXISTS life_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Profiles table (for XP/level gamification)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  next_level_xp INTEGER DEFAULT 300,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_start_date ON goals(start_date);
CREATE INDEX IF NOT EXISTS idx_subtasks_goal_id ON subtasks(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_milestones_goal_id ON goal_milestones(goal_id);
CREATE INDEX IF NOT EXISTS idx_life_milestones_user_id ON life_milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_life_milestones_date ON life_milestones(date);
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);

-- Row Level Security (RLS) Policies
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE life_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Goals policies
DROP POLICY IF EXISTS "Users can view their own goals" ON goals;
CREATE POLICY "Users can view their own goals"
  ON goals FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own goals" ON goals;
CREATE POLICY "Users can insert their own goals"
  ON goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own goals" ON goals;
CREATE POLICY "Users can update their own goals"
  ON goals FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own goals" ON goals;
CREATE POLICY "Users can delete their own goals"
  ON goals FOR DELETE
  USING (auth.uid() = user_id);

-- Subtasks policies (access through parent goal)
DROP POLICY IF EXISTS "Users can view subtasks of their goals" ON subtasks;
CREATE POLICY "Users can view subtasks of their goals"
  ON subtasks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM goals WHERE goals.id = subtasks.goal_id AND goals.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert subtasks to their goals" ON subtasks;
CREATE POLICY "Users can insert subtasks to their goals"
  ON subtasks FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM goals WHERE goals.id = subtasks.goal_id AND goals.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update subtasks of their goals" ON subtasks;
CREATE POLICY "Users can update subtasks of their goals"
  ON subtasks FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM goals WHERE goals.id = subtasks.goal_id AND goals.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete subtasks of their goals" ON subtasks;
CREATE POLICY "Users can delete subtasks of their goals"
  ON subtasks FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM goals WHERE goals.id = subtasks.goal_id AND goals.user_id = auth.uid()
  ));

-- Goal milestones policies (access through parent goal)
DROP POLICY IF EXISTS "Users can view goal milestones of their goals" ON goal_milestones;
CREATE POLICY "Users can view goal milestones of their goals"
  ON goal_milestones FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM goals WHERE goals.id = goal_milestones.goal_id AND goals.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert goal milestones to their goals" ON goal_milestones;
CREATE POLICY "Users can insert goal milestones to their goals"
  ON goal_milestones FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM goals WHERE goals.id = goal_milestones.goal_id AND goals.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update goal milestones of their goals" ON goal_milestones;
CREATE POLICY "Users can update goal milestones of their goals"
  ON goal_milestones FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM goals WHERE goals.id = goal_milestones.goal_id AND goals.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete goal milestones of their goals" ON goal_milestones;
CREATE POLICY "Users can delete goal milestones of their goals"
  ON goal_milestones FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM goals WHERE goals.id = goal_milestones.goal_id AND goals.user_id = auth.uid()
  ));

-- Life milestones policies
DROP POLICY IF EXISTS "Users can view their own life milestones" ON life_milestones;
CREATE POLICY "Users can view their own life milestones"
  ON life_milestones FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own life milestones" ON life_milestones;
CREATE POLICY "Users can insert their own life milestones"
  ON life_milestones FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own life milestones" ON life_milestones;
CREATE POLICY "Users can update their own life milestones"
  ON life_milestones FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own life milestones" ON life_milestones;
CREATE POLICY "Users can delete their own life milestones"
  ON life_milestones FOR DELETE
  USING (auth.uid() = user_id);

-- Profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
DROP TRIGGER IF EXISTS update_goals_updated_at ON goals;
CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subtasks_updated_at ON subtasks;
CREATE TRIGGER update_subtasks_updated_at BEFORE UPDATE ON subtasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_goal_milestones_updated_at ON goal_milestones;
CREATE TRIGGER update_goal_milestones_updated_at BEFORE UPDATE ON goal_milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_life_milestones_updated_at ON life_milestones;
CREATE TRIGGER update_life_milestones_updated_at BEFORE UPDATE ON life_milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, xp, level, next_level_xp) 
  VALUES (new.id, new.email, 0, 1, 300);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();