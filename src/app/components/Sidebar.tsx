import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Circle, CheckCircle2, Clock, MoreVertical, Plus } from 'lucide-react';
import { Goal, Subtask, LifeMilestone, GoalStatus } from '../types';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface SidebarProps {
  goals: Goal[];
  lifeMilestones: LifeMilestone[];
  expandedGoals: Set<string>;
  selectedItemId: string | null;
  onToggleGoal: (goalId: string) => void;
  onSelectItem: (id: string, type: 'goal' | 'subtask' | 'life-milestone') => void;
  onAddGoal: () => void;
  onAddLifeMilestone: () => void;
  onAddSubtask: (goalId: string) => void;
  onAddMilestone: (goalId: string) => void;
  onDeleteItem: (id: string, type: 'goal' | 'subtask' | 'life-milestone') => void;
  onUpdateStatus: (id: string, status: GoalStatus, type: 'goal' | 'subtask') => void;
}

export function Sidebar({
  goals,
  lifeMilestones,
  expandedGoals,
  selectedItemId,
  onToggleGoal,
  onSelectItem,
  onAddGoal,
  onAddLifeMilestone,
  onAddSubtask,
  onAddMilestone,
  onDeleteItem,
  onUpdateStatus,
}: SidebarProps) {
  const getStatusIcon = (status: GoalStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'in-progress':
        return <Clock className="w-4 h-4 text-blue-600" />;
      default:
        return <Circle className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="w-64 border-r border-border bg-background flex flex-col h-screen">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-base">
          <span className="text-xl">🎯</span>
          LifePath
        </h1>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Life Milestones Section */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs text-muted-foreground uppercase tracking-wide">
              Life Milestones
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={onAddLifeMilestone}
              className="h-5 w-5 p-0"
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>
          <div className="space-y-0.5">
            {lifeMilestones.map(milestone => (
              <div
                key={milestone.id}
                onClick={() => onSelectItem(milestone.id, 'life-milestone')}
                className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-accent/50 transition-colors ${ 
                  selectedItemId === milestone.id ? 'bg-accent' : ''
                }`}
              >
                <div className="w-2 h-2 bg-purple-500 rotate-45 shrink-0" />
                <span className="flex-1 text-sm truncate">{milestone.title}</span>
                <span className="text-xs text-muted-foreground">
                  {milestone.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Goals Section */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs text-muted-foreground uppercase tracking-wide">
              Goals
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={onAddGoal}
              className="h-5 w-5 p-0"
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>

          <div className="space-y-0.5">
            {goals.map(goal => {
              const isExpanded = expandedGoals.has(goal.id);
              const isSelected = selectedItemId === goal.id;

              return (
                <div key={goal.id} className="space-y-0">
                  {/* Goal Row */}
                  <div
                    className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-accent/50 transition-colors group ${
                      isSelected ? 'bg-accent' : ''
                    }`}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleGoal(goal.id);
                      }}
                      className="shrink-0 hover:bg-accent/50 rounded p-0.5 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </button>
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: goal.color }}
                    />
                    {getStatusIcon(goal.status)}
                    <span
                      className="flex-1 text-sm truncate"
                      onClick={() => onSelectItem(goal.id, 'goal')}
                    >
                      {goal.title}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onUpdateStatus(goal.id, 'completed', 'goal')}>
                          Mark Complete
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onUpdateStatus(goal.id, 'in-progress', 'goal')}>
                          Mark In Progress
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onUpdateStatus(goal.id, 'todo', 'goal')}>
                          Mark To Do
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onAddSubtask(goal.id)}>
                          Add Subtask
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDeleteItem(goal.id, 'goal')}
                          className="text-destructive"
                        >
                          Delete Goal
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Subtasks */}
                  {isExpanded && (
                    <div className="ml-5 space-y-0 relative before:absolute before:left-[3px] before:top-0 before:bottom-0 before:w-px before:bg-border">
                      {goal.subtasks.map(subtask => {
                        const isSubtaskSelected = selectedItemId === subtask.id;
                        return (
                          <div
                            key={subtask.id}
                            onClick={() => onSelectItem(subtask.id, 'subtask')}
                            className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-accent/50 transition-colors group ml-3 ${
                              isSubtaskSelected ? 'bg-accent' : ''
                            }`}
                          >
                            {getStatusIcon(subtask.status)}
                            <span className="flex-1 text-sm truncate text-muted-foreground">{subtask.title}</span>
                            <span className="text-xs text-muted-foreground">{subtask.durationDays}d</span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <MoreVertical className="w-3.5 h-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => onUpdateStatus(subtask.id, 'completed', 'subtask')}
                                >
                                  Mark Complete
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => onUpdateStatus(subtask.id, 'in-progress', 'subtask')}
                                >
                                  Mark In Progress
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => onUpdateStatus(subtask.id, 'todo', 'subtask')}
                                >
                                  Mark To Do
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => onDeleteItem(subtask.id, 'subtask')}
                                  className="text-destructive"
                                >
                                  Delete Subtask
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        );
                      })}
                      
                      {/* Add Subtask Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddSubtask(goal.id);
                        }}
                        className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground hover:bg-accent h-8 ml-3 text-sm font-medium border border-dashed border-transparent hover:border-border"
                      >
                        <Plus className="w-4 h-4" />
                        Add Subtask
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}