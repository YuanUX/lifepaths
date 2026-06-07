import { Goal, Subtask, GoalMilestone, GlobalMilestone, UserProfile, AppState, Status } from '../types';
import * as WorkersClient from './workersClient';

function mapDBGoal(g: any): Goal {
  return {
    id: g.id,
    title: g.title,
    category: g.category,
    color: g.color,
    startDate: g.start_date,
    endDate: g.end_date,
    status: g.status === 'in-progress' ? Status.IN_PROGRESS : g.status === 'completed' ? Status.DONE : Status.TODO,
    order: g.order || 0,
    notes: g.notes || '',
    subtasks: (g.subtasks || []).map((s: any) => ({
      id: s.id,
      title: s.title,
      startOffsetDays: s.start_offset_days,
      durationDays: s.duration_days,
      status: s.status === 'in-progress' ? Status.IN_PROGRESS : s.status === 'completed' ? Status.DONE : Status.TODO,
      order: s.order || 0,
    })).sort((a: Subtask, b: Subtask) => a.order - b.order),
    milestones: (g.milestones || []).map((m: any) => ({
      id: m.id,
      title: m.title,
      date: m.date,
      isCompleted: !!m.is_completed,
      color: m.color,
    })),
  };
}

export async function fetchAppData(userId: string): Promise<AppState | null> {
  try {
    const data = await WorkersClient.fetchAPI('/api/user/data');
    return {
      user: {
        xp: data.user?.xp || 0,
        level: data.user?.level || 1,
        nextLevelXp: data.user?.nextLevelXp || 300,
      },
      goals: (data.goals || []).map(mapDBGoal),
      globalMilestones: (data.globalMilestones || []).map((m: any) => ({
        id: m.id,
        title: m.title,
        date: m.date,
        isCompleted: !!m.is_completed,
        color: m.color,
      })),
    };
  } catch (e) {
    console.error('fetchAppData error:', e);
    throw e;
  }
}

export async function updateUserProfile(userId: string, profile: UserProfile) {
  return WorkersClient.userProfile.update(profile.xp, profile.level, profile.nextLevelXp);
}

export async function createGoal(userId: string, goal: Goal) {
  const payload = {
    id: goal.id,
    title: goal.title,
    category: goal.category,
    color: goal.color,
    startDate: goal.startDate,
    endDate: goal.endDate,
    status: goal.status === Status.IN_PROGRESS ? 'in-progress' : goal.status === Status.DONE ? 'completed' : 'todo',
    order: goal.order,
    notes: goal.notes || '',
    subtasks: goal.subtasks.map(s => ({
      id: s.id,
      title: s.title,
      startOffsetDays: s.startOffsetDays,
      durationDays: s.durationDays,
      status: s.status === Status.IN_PROGRESS ? 'in-progress' : s.status === Status.DONE ? 'completed' : 'todo',
      order: s.order,
    })),
    milestones: goal.milestones.map(m => ({
      id: m.id,
      title: m.title,
      date: m.date,
      isCompleted: m.isCompleted,
      color: m.color,
    })),
  };
  return WorkersClient.goals.create(payload);
}

export async function updateGoal(goal: Goal) {
  return WorkersClient.goals.update({
    id: goal.id,
    title: goal.title,
    category: goal.category,
    color: goal.color,
    startDate: goal.startDate,
    endDate: goal.endDate,
    status: goal.status === Status.IN_PROGRESS ? 'in-progress' : goal.status === Status.DONE ? 'completed' : 'todo',
    order: goal.order,
    notes: goal.notes || '',
  });
}

export async function deleteGoal(goalId: string) {
  return WorkersClient.goals.delete(goalId);
}

export async function createSubtask(subtask: Subtask & { goalId: string }) {
  return WorkersClient.subtasks.create(subtask);
}

export async function updateSubtask(subtask: Subtask) {
  return WorkersClient.subtasks.update(subtask);
}

export async function deleteSubtask(subtaskId: string) {
  return WorkersClient.subtasks.delete(subtaskId);
}

export async function createGlobalMilestone(userId: string, milestone: GlobalMilestone) {
  return WorkersClient.globalMilestones.create({ ...milestone, userId });
}

export async function updateGlobalMilestone(milestone: GlobalMilestone) {
  return WorkersClient.globalMilestones.update(milestone);
}

export async function deleteGlobalMilestone(milestoneId: string) {
  return WorkersClient.globalMilestones.delete(milestoneId);
}

export async function createGoalMilestone(goalId: string, milestone: GoalMilestone) {
  return WorkersClient.goalMilestones.create({ ...milestone, goalId });
}

export async function updateGoalMilestone(milestone: GoalMilestone & { goalId: string }) {
  return WorkersClient.goalMilestones.update(milestone);
}

export async function deleteGoalMilestone(milestoneId: string) {
  return WorkersClient.goalMilestones.delete(milestoneId);
}
