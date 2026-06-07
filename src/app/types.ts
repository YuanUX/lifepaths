export enum Status {
  TODO = 'To Do',
  IN_PROGRESS = 'In Progress',
  DONE = 'Done'
}

export interface Subtask {
  id: string;
  title: string;
  startOffsetDays: number;
  durationDays: number;
  status: Status;
  order: number;
}

export interface GoalMilestone {
  id: string;
  title: string;
  date: string;
  isCompleted: boolean;
  color?: string;
}

export interface Goal {
  id: string;
  title: string;
  category: string;
  color: string;
  startDate: string;
  endDate: string;
  status: Status;
  subtasks: Subtask[];
  milestones: GoalMilestone[];
  order: number;
  notes?: string;
}

export interface GlobalMilestone {
  id: string;
  title: string;
  date: string;
  isCompleted: boolean;
  color?: string;
}

export interface UserProfile {
  xp: number;
  level: number;
  nextLevelXp: number;
}

export interface AppState {
  user: UserProfile;
  goals: Goal[];
  globalMilestones: GlobalMilestone[];
}

export interface DragState {
  type: 'goal-move' | 'goal-resize-start' | 'goal-resize-end' | 'subtask-move' | 'subtask-resize-end' | 'milestone-move' | 'global-milestone-move';
  itemId: string;
  parentId?: string;
  startX: number;
  originalData: any;
}