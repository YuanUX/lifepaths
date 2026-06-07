import React from 'react';
import { Plus } from 'lucide-react';
import { Goal, Subtask, Status } from '../types';

interface AddSubtaskButtonProps {
  goal: Goal;
  onAdd: (newSubtask: Subtask) => void;
  generateId: () => string;
  ROW_HEIGHT: number;
}

export function AddSubtaskButton({ goal, onAdd, generateId, ROW_HEIGHT }: AddSubtaskButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const lastSubtask = goal.subtasks[goal.subtasks.length - 1];
    const newStartOffset = lastSubtask ? lastSubtask.startOffsetDays + lastSubtask.durationDays + 1 : 0;
    const newSubtask: Subtask = {
      id: generateId(),
      title: 'New Subtask',
      startOffsetDays: newStartOffset,
      durationDays: 3,
      status: Status.TODO
    };
    onAdd(newSubtask);
  };

  return (
    <div 
      style={{ height: ROW_HEIGHT }}
      className="flex items-center px-4 hover:bg-white/50 transition-colors border-b border-transparent hover:border-slate-100 group"
    >
      <button 
        className="flex items-center gap-2 pl-8 w-full text-left text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 -mx-4 px-12 py-2 transition-colors"
        onClick={handleClick}
      >
        <Plus className="w-3.5 h-3.5" />
        <span className="text-xs font-medium">Add Subtask</span>
      </button>
    </div>
  );
}
