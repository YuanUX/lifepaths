import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Goal, Subtask, LifeMilestone, GoalMilestone, GoalStatus } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { addDays, formatDate } from '../lib/utils';

interface SideDrawerProps {
  isOpen: boolean;
  itemId: string | null;
  itemType: 'goal' | 'subtask' | 'life-milestone' | 'goal-milestone' | null;
  goals: Goal[];
  lifeMilestones: LifeMilestone[];
  onClose: () => void;
  onUpdateGoal: (goalId: string, updates: Partial<Goal>) => void;
  onUpdateSubtask: (subtaskId: string, goalId: string, updates: Partial<Subtask>) => void;
  onUpdateLifeMilestone: (milestoneId: string, updates: Partial<LifeMilestone>) => void;
  onUpdateGoalMilestone: (milestoneId: string, goalId: string, updates: Partial<GoalMilestone>) => void;
  onAddMilestone: (goalId: string) => void;
  onDeleteItem: (id: string, type: 'goal' | 'subtask' | 'life-milestone' | 'goal-milestone') => void;
}

export function SideDrawer({
  isOpen,
  itemId,
  itemType,
  goals,
  lifeMilestones,
  onClose,
  onUpdateGoal,
  onUpdateSubtask,
  onUpdateLifeMilestone,
  onUpdateGoalMilestone,
  onAddMilestone,
  onDeleteItem,
}: SideDrawerProps) {
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    if (!isOpen || !itemId || !itemType) {
      setFormData({});
      return;
    }

    if (itemType === 'goal') {
      const goal = goals.find(g => g.id === itemId);
      if (goal) {
        setFormData({
          title: goal.title,
          category: goal.category,
          startDate: formatDate(goal.startDate),
          endDate: formatDate(goal.endDate),
          status: goal.status,
          color: goal.color,
        });
      }
    } else if (itemType === 'subtask') {
      let subtask: Subtask | undefined;
      let goalId: string | undefined;
      for (const goal of goals) {
        subtask = goal.subtasks.find(s => s.id === itemId);
        if (subtask) {
          goalId = goal.id;
          break;
        }
      }
      if (subtask) {
        setFormData({
          title: subtask.title,
          durationDays: subtask.durationDays,
          startOffsetDays: subtask.startOffsetDays,
          status: subtask.status,
          goalId,
        });
      }
    } else if (itemType === 'life-milestone') {
      const milestone = lifeMilestones.find(m => m.id === itemId);
      if (milestone) {
        setFormData({
          title: milestone.title,
          date: formatDate(milestone.date),
          isCompleted: milestone.isCompleted,
        });
      }
    } else if (itemType === 'goal-milestone') {
      let milestone: GoalMilestone | undefined;
      let goalId: string | undefined;
      for (const goal of goals) {
        milestone = goal.milestones.find(m => m.id === itemId);
        if (milestone) {
          goalId = goal.id;
          break;
        }
      }
      if (milestone) {
        setFormData({
          title: milestone.title,
          date: milestone.date,
          isCompleted: milestone.isCompleted,
          goalId,
        });
      }
    }
  }, [isOpen, itemId, itemType, goals, lifeMilestones]);

  const handleSave = () => {
    if (!itemId || !itemType) return;

    if (itemType === 'goal') {
      onUpdateGoal(itemId, {
        title: formData.title,
        category: formData.category,
        startDate: new Date(formData.startDate),
        endDate: new Date(formData.endDate),
        status: formData.status,
        color: formData.color,
      });
    } else if (itemType === 'subtask') {
      onUpdateSubtask(itemId, formData.goalId, {
        title: formData.title,
        durationDays: parseInt(formData.durationDays),
        startOffsetDays: parseInt(formData.startOffsetDays),
        status: formData.status,
      });
    } else if (itemType === 'life-milestone') {
      onUpdateLifeMilestone(itemId, {
        title: formData.title,
        date: new Date(formData.date),
        isCompleted: formData.isCompleted,
      });
    } else if (itemType === 'goal-milestone') {
      onUpdateGoalMilestone(itemId, formData.goalId, {
        title: formData.title,
        date: formData.date,
        isCompleted: formData.isCompleted,
      });
    }

    onClose();
  };

  if (!isOpen) return null;

  const renderContent = () => {
    if (itemType === 'goal') {
      const goal = goals.find(g => g.id === itemId);
      return (
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Goal Title</Label>
            <Input
              id="title"
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={formData.category || ''}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate || ''}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate || ''}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status || 'todo'}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="color">Color</Label>
            <div className="flex gap-2 mt-1">
              {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map(color => (
                <button
                  key={color}
                  className={`w-8 h-8 rounded-full border-2 ${
                    formData.color === color ? 'border-black' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setFormData({ ...formData, color })}
                />
              ))}
            </div>
          </div>

          {goal && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-2">
                <Label>Milestones</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAddMilestone(goal.id)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Milestone
                </Button>
              </div>
              <div className="space-y-2">
                {goal.milestones.map(milestone => (
                  <div key={milestone.id} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{milestone.title}</span>
                    <span className="text-xs text-muted-foreground">
                      Day {milestone.dateOffset}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} className="flex-1">
              Save Changes
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDeleteItem(itemId!, 'goal');
                onClose();
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      );
    }

    if (itemType === 'subtask') {
      return (
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Subtask Title</Label>
            <Input
              id="title"
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startOffset">Start Offset (days)</Label>
              <Input
                id="startOffset"
                type="number"
                value={formData.startOffsetDays || 0}
                onChange={(e) => setFormData({ ...formData, startOffsetDays: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="duration">Duration (days)</Label>
              <Input
                id="duration"
                type="number"
                value={formData.durationDays || 1}
                onChange={(e) => setFormData({ ...formData, durationDays: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status || 'todo'}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} className="flex-1">
              Save Changes
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDeleteItem(itemId!, 'subtask');
                onClose();
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      );
    }

    if (itemType === 'life-milestone') {
      return (
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Milestone Title</Label>
            <Input
              id="title"
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={formData.date || ''}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="mt-1"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="completed"
              checked={formData.isCompleted || false}
              onChange={(e) => setFormData({ ...formData, isCompleted: e.target.checked })}
              className="w-4 h-4"
            />
            <Label htmlFor="completed">Completed</Label>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} className="flex-1">
              Save Changes
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDeleteItem(itemId!, 'life-milestone');
                onClose();
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      );
    }

    if (itemType === 'goal-milestone') {
      return (
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Milestone Title</Label>
            <Input
              id="title"
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={formData.date || ''}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="mt-1"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="completed"
              checked={formData.isCompleted || false}
              onChange={(e) => setFormData({ ...formData, isCompleted: e.target.checked })}
              className="w-4 h-4"
            />
            <Label htmlFor="completed">Completed</Label>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} className="flex-1">
              Save Changes
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDeleteItem(itemId!, 'goal-milestone');
                onClose();
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/20 z-40 transition-opacity ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-full w-[360px] bg-background border-l border-border z-50 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2>
            {itemType === 'goal' && 'Edit Goal'}
            {itemType === 'subtask' && 'Edit Subtask'}
            {itemType === 'life-milestone' && 'Edit Life Milestone'}
            {itemType === 'goal-milestone' && 'Edit Milestone'}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-4 overflow-y-auto" style={{ height: 'calc(100% - 65px)' }}>
          {renderContent()}
        </div>
      </div>
    </>
  );
}
