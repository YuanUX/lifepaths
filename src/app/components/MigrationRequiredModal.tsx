import { useState } from 'react';
import { AlertTriangle, Copy, Check, X } from 'lucide-react';
import { Button } from './ui/button';

interface MigrationRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MIGRATION_SQL = `-- Add order column to subtasks table
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
ALTER TABLE subtasks ALTER COLUMN "order" SET NOT NULL;`;

export function MigrationRequiredModal({ isOpen, onClose }: MigrationRequiredModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(MIGRATION_SQL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-[90vw] max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl">Database Migration Required</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Subtask ordering needs a database update
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="space-y-3">
            <p className="text-gray-700 dark:text-gray-300">
              Your database needs to be updated to support the new subtask ordering feature. 
              This is a one-time migration that adds an <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-sm">order</code> column to your subtasks table.
            </p>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="text-sm mb-2 text-blue-900 dark:text-blue-100">Steps to run the migration:</h3>
              <ol className="text-sm space-y-1 text-blue-800 dark:text-blue-200 list-decimal list-inside">
                <li>Copy the SQL below</li>
                <li>Go to your Supabase project dashboard</li>
                <li>Click "SQL Editor" in the left sidebar</li>
                <li>Click "New Query"</li>
                <li>Paste and run the SQL (Cmd/Ctrl + Enter)</li>
                <li>Refresh this page</li>
              </ol>
            </div>
          </div>

          {/* SQL Code Block */}
          <div className="relative">
            <div className="absolute top-3 right-3 z-10">
              <Button
                onClick={handleCopy}
                size="sm"
                variant="secondary"
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
            </div>
            <pre className="bg-gray-900 dark:bg-black text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
              <code>{MIGRATION_SQL}</code>
            </pre>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <p className="text-sm text-amber-900 dark:text-amber-100">
              <strong>Note:</strong> The app will continue to work without this migration, but subtask order changes won't be saved to the database until you complete it.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <Button onClick={onClose} variant="outline">
            I'll do this later
          </Button>
          <Button
            onClick={() => {
              handleCopy();
              window.open('https://supabase.com/dashboard/project/_/sql/new', '_blank');
            }}
            className="gap-2"
          >
            Copy & Open Supabase
          </Button>
        </div>
      </div>
    </div>
  );
}
