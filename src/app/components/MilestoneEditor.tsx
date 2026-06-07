import React from 'react';
import { Trash2 } from './Icons';
import { ColorPicker } from './ColorPicker';
import { GlobalMilestone, GoalMilestone } from '../types';
import * as WorkersDataService from '../services/workersDataService';

interface MilestoneEditorProps {
  milestone: GlobalMilestone | GoalMilestone;
  isGlobal: boolean;
  parentGoalId?: string;
  isDemoMode: boolean;
  onUpdate: (updater: (prev: any) => any) => void;
  onClose: () => void;
}

export function MilestoneEditor({ 
  milestone, 
  isGlobal, 
  parentGoalId, 
  isDemoMode, 
  onUpdate, 
  onClose 
}: MilestoneEditorProps) {
  
  const handleTitleChange = async (val: string) => {
    if (isGlobal) {
      const m = milestone as GlobalMilestone;
      const updated = {...m, title: val};
      onUpdate(prev => ({...prev, globalMilestones: prev.globalMilestones.map(x => x.id === m.id ? updated : x)}));
      if (!isDemoMode) await WorkersDataService.updateGlobalMilestone(updated);
    } else {
      const m = milestone as GoalMilestone;
      const gId = parentGoalId!;
      onUpdate(prev => {
        const newGoals = prev.goals.map(g => g.id === gId ? {...g, milestones: g.milestones.map(x => x.id === m.id ? {...x, title: val} : x)} : g);
        return {...prev, goals: newGoals};
      });
      if (!isDemoMode) await WorkersDataService.updateGoalMilestone({...m, title: val, goalId: gId});
    }
  };

  const handleDateChange = async (val: string) => {
    if (isGlobal) {
      const m = milestone as GlobalMilestone;
      const updated = {...m, date: val};
      onUpdate(prev => ({...prev, globalMilestones: prev.globalMilestones.map(x => x.id === m.id ? updated : x)}));
      if (!isDemoMode) await WorkersDataService.updateGlobalMilestone(updated);
    } else {
      const m = milestone as GoalMilestone;
      const gId = parentGoalId!;
      onUpdate(prev => {
        const newGoals = prev.goals.map(g => g.id === gId ? {...g, milestones: g.milestones.map(x => x.id === m.id ? {...x, date: val} : x)} : g);
        return {...prev, goals: newGoals};
      });
      if (!isDemoMode) await WorkersDataService.updateGoalMilestone({...m, date: val, goalId: gId});
    }
  };

  const handleColorChange = async (color: string) => {
    if (isGlobal) {
      const m = milestone as GlobalMilestone;
      const updated = {...m, color};
      onUpdate(prev => ({...prev, globalMilestones: prev.globalMilestones.map(x => x.id === m.id ? updated : x)}));
      if (!isDemoMode) await WorkersDataService.updateGlobalMilestone(updated);
    } else {
      const m = milestone as GoalMilestone;
      const gId = parentGoalId!;
      onUpdate(prev => {
        const newGoals = prev.goals.map(g => g.id === gId ? {...g, milestones: g.milestones.map(x => x.id === m.id ? {...x, color} : x)} : g);
        return {...prev, goals: newGoals};
      });
      if (!isDemoMode) await WorkersDataService.updateGoalMilestone({...m, color, goalId: gId});
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this milestone? This action cannot be undone.')) return;
    
    const msId = milestone.id;
    
    if (isGlobal) {
      onUpdate(prev => ({...prev, globalMilestones: prev.globalMilestones.filter(m => m.id !== msId)}));
      if (!isDemoMode) await WorkersDataService.deleteGlobalMilestone(msId);
    } else {
      const gId = parentGoalId!;
      onUpdate(prev => ({
        ...prev, 
        goals: prev.goals.map(g => g.id === gId ? {...g, milestones: g.milestones.filter(m => m.id !== msId)} : g)
      }));
      if (!isDemoMode) await WorkersDataService.deleteGoalMilestone(msId);
    }
    onClose();
  };

  return (
    <>
      <div>
        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Title</label>
        <input 
          className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-indigo-500" 
          value={milestone.title || ''}
          onChange={(e) => handleTitleChange(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Date</label>
        <input 
          type="date" 
          className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-indigo-500" 
          value={milestone.date || ''}
          onChange={(e) => handleDateChange(e.target.value)}
        />
      </div>
      <div className="pt-2">
        <ColorPicker 
          selectedColor={milestone.color}
          onColorChange={handleColorChange}
        />
      </div>
      <div className="border-t border-slate-200 pt-4 mt-6">
        <button 
          className="w-full py-2.5 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 hover:border-red-400 text-sm font-medium flex justify-center items-center gap-2 transition-all"
          onClick={handleDelete}
        >
          <Trash2 className="w-4 h-4" /> Delete Milestone
        </button>
      </div>
    </>
  );
}
