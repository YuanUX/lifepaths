export type GoalStatus = 'todo' | 'in-progress' | 'completed';

export interface GoalMilestone {
  id: string;
  parentGoalId: string;
  title: string;
  dateOffset: number; // days from goal start
  isCompleted: boolean;
}

export interface LifeMilestone {
  id: string;
  title: string;
  date: Date;
  isCompleted: boolean;
}

export interface Subtask {
  id: string;
  parentGoalId: string;
  title: string;
  durationDays: number;
  startOffsetDays: number; // days from goal start
  status: GoalStatus;
  order: number; // Display order within parent goal
}

export interface Goal {
  id: string;
  title: string;
  category: string;
  startDate: Date;
  endDate: Date;
  status: GoalStatus;
  color: string;
  subtasks: Subtask[];
  milestones: GoalMilestone[];
}

export interface TimelineItem {
  type: 'goal' | 'subtask';
  id: string;
  parentGoalId?: string;
  rowIndex: number;
  data: Goal | Subtask;
}

export interface User {
  id: string;
  email: string;
  name: string;
}