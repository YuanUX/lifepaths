import React, { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Copy, ExternalLink, Check } from 'lucide-react';

const SQL_SCRIPT = `-- LifePath Database Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

CREATE TABLE IF NOT EXISTS goal_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date_offset INTEGER NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS life_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_start_date ON goals(start_date);
CREATE INDEX IF NOT EXISTS idx_subtasks_goal_id ON subtasks(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_milestones_goal_id ON goal_milestones(goal_id);
CREATE INDEX IF NOT EXISTS idx_life_milestones_user_id ON life_milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_life_milestones_date ON life_milestones(date);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE life_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own goals"
  ON goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own goals"
  ON goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own goals"
  ON goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own goals"
  ON goals FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view subtasks of their goals"
  ON subtasks FOR SELECT
  USING (EXISTS (SELECT 1 FROM goals WHERE goals.id = subtasks.goal_id AND goals.user_id = auth.uid()));
CREATE POLICY "Users can insert subtasks to their goals"
  ON subtasks FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM goals WHERE goals.id = subtasks.goal_id AND goals.user_id = auth.uid()));
CREATE POLICY "Users can update subtasks of their goals"
  ON subtasks FOR UPDATE
  USING (EXISTS (SELECT 1 FROM goals WHERE goals.id = subtasks.goal_id AND goals.user_id = auth.uid()));
CREATE POLICY "Users can delete subtasks of their goals"
  ON subtasks FOR DELETE
  USING (EXISTS (SELECT 1 FROM goals WHERE goals.id = subtasks.goal_id AND goals.user_id = auth.uid()));

CREATE POLICY "Users can view goal milestones of their goals"
  ON goal_milestones FOR SELECT
  USING (EXISTS (SELECT 1 FROM goals WHERE goals.id = goal_milestones.goal_id AND goals.user_id = auth.uid()));
CREATE POLICY "Users can insert goal milestones to their goals"
  ON goal_milestones FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM goals WHERE goals.id = goal_milestones.goal_id AND goals.user_id = auth.uid()));
CREATE POLICY "Users can update goal milestones of their goals"
  ON goal_milestones FOR UPDATE
  USING (EXISTS (SELECT 1 FROM goals WHERE goals.id = goal_milestones.goal_id AND goals.user_id = auth.uid()));
CREATE POLICY "Users can delete goal milestones of their goals"
  ON goal_milestones FOR DELETE
  USING (EXISTS (SELECT 1 FROM goals WHERE goals.id = goal_milestones.goal_id AND goals.user_id = auth.uid()));

CREATE POLICY "Users can view their own life milestones"
  ON life_milestones FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own life milestones"
  ON life_milestones FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own life milestones"
  ON life_milestones FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own life milestones"
  ON life_milestones FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subtasks_updated_at BEFORE UPDATE ON subtasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_goal_milestones_updated_at BEFORE UPDATE ON goal_milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_life_milestones_updated_at BEFORE UPDATE ON life_milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`;

export function DatabaseSetupRequired({ onRetry }: { onRetry: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SQL_SCRIPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Fallback: select the text
      const pre = document.querySelector('pre');
      if (pre) {
        const range = document.createRange();
        range.selectNodeContents(pre);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        alert('SQL script selected! Press Ctrl+C (or Cmd+C) to copy.');
      }
    }
  };

  const handleDownload = () => {
    const blob = new Blob([SQL_SCRIPT], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lifepath-setup.sql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="mb-2">Database Setup Required</h1>
          <p className="text-muted-foreground">
            Your Supabase database tables need to be created before you can use LifePath.
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-muted p-4 rounded-lg">
            <h3 className="mb-3">Quick Setup (3 steps):</h3>
            <ol className="space-y-3 text-sm">
              <li className="flex gap-2">
                <span className="flex-shrink-0 font-bold">1.</span>
                <span>
                  Copy the SQL script below (click the Copy button)
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0 font-bold">2.</span>
                <span>
                  Open your Supabase SQL Editor{' '}
                  <a
                    href="https://usfevtqyobjjkftjzsio.supabase.co/project/usfevtqyobjjkftjzsio/sql/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    here
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0 font-bold">3.</span>
                <span>
                  Paste the SQL script and click <strong>RUN</strong>
                </span>
              </li>
            </ol>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>SQL Script:</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy SQL
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="gap-2"
                >
                  Download SQL
                </Button>
              </div>
            </div>
            <div className="bg-secondary p-4 rounded-lg max-h-64 overflow-auto custom-scrollbar">
              <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">
                {SQL_SCRIPT}
              </pre>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={onRetry}
              className="flex-1"
            >
              I've Run the SQL - Retry Connection
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open('https://usfevtqyobjjkftjzsio.supabase.co/project/usfevtqyobjjkftjzsio/sql/new', '_blank')}
              className="gap-2"
            >
              Open SQL Editor
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center pt-4 border-t">
            <p>
              This creates 4 tables (goals, subtasks, goal_milestones, life_milestones) with proper security policies.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-medium">{children}</label>;
}