import React from 'react';
import { Goal } from '../types';
import * as DataService from '../services/dataService';

interface GoalNotesProps {
  goal: Goal;
  onUpdate: (updated: Goal) => void;
  isDemoMode: boolean;
}

export function GoalNotes({ goal, onUpdate, isDemoMode }: GoalNotesProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    if (goal.notes) {
      try {
        // Try modern clipboard API first
        await navigator.clipboard.writeText(goal.notes);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        // Fallback for browsers that block clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = goal.notes;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (execErr) {
          console.error('Failed to copy text:', execErr);
        }
        document.body.removeChild(textArea);
      }
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-xs font-bold text-slate-500 uppercase">Notes</label>
        {goal.notes && (
          <button
            onClick={handleCopy}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
          >
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
        )}
      </div>
      <textarea 
        className="w-full border border-slate-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-y" 
        rows={4}
        placeholder="Add notes about this goal..."
        value={goal.notes || ''} 
        onChange={async (e) => {
          const updated = {...goal, notes: e.target.value};
          onUpdate(updated);
          if (!isDemoMode) await DataService.updateGoal(updated);
        }}
      />
    </div>
  );
}