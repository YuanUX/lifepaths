import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card } from './ui/card';
import { AIStrategist } from './AIStrategist';
import { formatDate, getDaysDifference } from '../lib/utils';

interface NewGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateGoal: (goal: {
    title: string;
    category: string;
    startDate: Date;
    endDate: Date;
    color: string;
    subtasks?: Array<{ title: string; durationDays: number; startOffsetDays: number }>;
  }) => void;
}

export function NewGoalModal({ isOpen, onClose, onCreateGoal }: NewGoalModalProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [startDate, setStartDate] = useState(formatDate(new Date()));
  const [endDate, setEndDate] = useState(formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)));
  const [color, setColor] = useState('#3b82f6');
  const [useAI, setUseAI] = useState(false);
  const [aiSubtasks, setAiSubtasks] = useState<Array<{ title: string; durationDays: number; startOffsetDays: number }>>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateGoal({
      title,
      category,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      color,
      subtasks: useAI ? aiSubtasks : undefined,
    });
    handleClose();
  };

  const handleClose = () => {
    setTitle('');
    setCategory('');
    setStartDate(formatDate(new Date()));
    setEndDate(formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)));
    setColor('#3b82f6');
    setUseAI(false);
    setAiSubtasks([]);
    onClose();
  };

  const handleAcceptSuggestions = (suggestions: Array<{ title: string; durationDays: number; startOffsetDays: number }>) => {
    setAiSubtasks([...aiSubtasks, ...suggestions]);
  };

  const goalDurationDays = getDaysDifference(new Date(startDate), new Date(endDate));

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
        onClick={handleClose}
      >
        <Card
          className="w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between">
            <h2>Create New Goal</h2>
            <Button variant="ghost" size="sm" onClick={handleClose} className="h-8 w-8 p-0">
              <X className="w-4 h-4" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div>
              <Label htmlFor="title">Goal Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Learn React"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., Career, Personal, Health"
                required
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Color</Label>
              <div className="flex gap-2 mt-1">
                {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`w-10 h-10 rounded-full border-2 ${
                      color === c ? 'border-black scale-110' : 'border-gray-300'
                    } transition-transform`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  id="useAI"
                  checked={useAI}
                  onChange={(e) => setUseAI(e.target.checked)}
                  className="w-4 h-4"
                />
                <Label htmlFor="useAI" className="cursor-pointer">
                  Use AI Strategist to break down this goal
                </Label>
              </div>

              {useAI && title && (
                <AIStrategist
                  goalTitle={title}
                  goalDurationDays={goalDurationDays}
                  onAcceptSuggestions={handleAcceptSuggestions}
                />
              )}

              {aiSubtasks.length > 0 && (
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <p className="text-sm mb-2">
                    {aiSubtasks.length} subtask{aiSubtasks.length !== 1 ? 's' : ''} will be added
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" className="flex-1">
                Create Goal
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
