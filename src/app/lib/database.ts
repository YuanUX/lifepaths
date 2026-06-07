import { supabase } from './supabase';
import { Goal, Subtask, GoalMilestone, LifeMilestone } from '../types';

// Goals
export async function fetchGoals(userId: string): Promise<Goal[]> {
  const { data: goalsData, error: goalsError } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('start_date', { ascending: true });

  if (goalsError) throw goalsError;

  const goals: Goal[] = await Promise.all(
    (goalsData || []).map(async (goal) => {
      // Fetch subtasks
      const { data: subtasksData } = await supabase
        .from('subtasks')
        .select('*')
        .eq('goal_id', goal.id)
        .order('start_offset_days', { ascending: true });

      // Fetch milestones
      const { data: milestonesData } = await supabase
        .from('goal_milestones')
        .select('*')
        .eq('goal_id', goal.id)
        .order('date_offset', { ascending: true });

      return {
        id: goal.id,
        title: goal.title,
        category: goal.category,
        startDate: new Date(goal.start_date),
        endDate: new Date(goal.end_date),
        status: goal.status as any,
        color: goal.color,
        subtasks: (subtasksData || []).map((st) => ({
          id: st.id,
          parentGoalId: st.goal_id,
          title: st.title,
          durationDays: st.duration_days,
          startOffsetDays: st.start_offset_days,
          status: st.status as any,
        })),
        milestones: (milestonesData || []).map((m) => ({
          id: m.id,
          parentGoalId: m.goal_id,
          title: m.title,
          dateOffset: m.date_offset,
          isCompleted: m.is_completed,
        })),
      };
    })
  );

  return goals;
}

export async function createGoal(userId: string, goal: Omit<Goal, 'id' | 'subtasks' | 'milestones'>) {
  const { data, error } = await supabase
    .from('goals')
    .insert({
      user_id: userId,
      title: goal.title,
      category: goal.category,
      start_date: goal.startDate.toISOString(),
      end_date: goal.endDate.toISOString(),
      status: goal.status,
      color: goal.color,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateGoal(goalId: string, updates: Partial<Goal>) {
  const updateData: any = {};
  
  if (updates.title) updateData.title = updates.title;
  if (updates.category) updateData.category = updates.category;
  if (updates.startDate) updateData.start_date = updates.startDate.toISOString();
  if (updates.endDate) updateData.end_date = updates.endDate.toISOString();
  if (updates.status) updateData.status = updates.status;
  if (updates.color) updateData.color = updates.color;
  
  updateData.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('goals')
    .update(updateData)
    .eq('id', goalId);

  if (error) throw error;
}

export async function deleteGoal(goalId: string) {
  // Delete related subtasks and milestones first
  await supabase.from('subtasks').delete().eq('goal_id', goalId);
  await supabase.from('goal_milestones').delete().eq('goal_id', goalId);
  
  const { error } = await supabase.from('goals').delete().eq('id', goalId);
  if (error) throw error;
}

// Subtasks
export async function createSubtask(subtask: Omit<Subtask, 'id'>) {
  const { data, error } = await supabase
    .from('subtasks')
    .insert({
      goal_id: subtask.parentGoalId,
      title: subtask.title,
      duration_days: subtask.durationDays,
      start_offset_days: subtask.startOffsetDays,
      status: subtask.status,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSubtask(subtaskId: string, updates: Partial<Subtask>) {
  const updateData: any = {};
  
  if (updates.title) updateData.title = updates.title;
  if (updates.durationDays !== undefined) updateData.duration_days = updates.durationDays;
  if (updates.startOffsetDays !== undefined) updateData.start_offset_days = updates.startOffsetDays;
  if (updates.status) updateData.status = updates.status;
  
  updateData.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('subtasks')
    .update(updateData)
    .eq('id', subtaskId);

  if (error) throw error;
}

export async function deleteSubtask(subtaskId: string) {
  const { error } = await supabase.from('subtasks').delete().eq('id', subtaskId);
  if (error) throw error;
}

// Goal Milestones
export async function createGoalMilestone(milestone: Omit<GoalMilestone, 'id'>) {
  const { data, error } = await supabase
    .from('goal_milestones')
    .insert({
      goal_id: milestone.parentGoalId,
      title: milestone.title,
      date_offset: milestone.dateOffset,
      is_completed: milestone.isCompleted,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateGoalMilestone(milestoneId: string, updates: Partial<GoalMilestone>) {
  const updateData: any = {};
  
  if (updates.title) updateData.title = updates.title;
  if (updates.dateOffset !== undefined) updateData.date_offset = updates.dateOffset;
  if (updates.isCompleted !== undefined) updateData.is_completed = updates.isCompleted;
  
  updateData.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('goal_milestones')
    .update(updateData)
    .eq('id', milestoneId);

  if (error) throw error;
}

export async function deleteGoalMilestone(milestoneId: string) {
  const { error } = await supabase.from('goal_milestones').delete().eq('id', milestoneId);
  if (error) throw error;
}

// Life Milestones
export async function fetchLifeMilestones(userId: string): Promise<LifeMilestone[]> {
  const { data, error } = await supabase
    .from('life_milestones')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true });

  if (error) throw error;

  return (data || []).map((m) => ({
    id: m.id,
    title: m.title,
    date: new Date(m.date),
    isCompleted: m.is_completed,
  }));
}

export async function createLifeMilestone(userId: string, milestone: Omit<LifeMilestone, 'id'>) {
  const { data, error } = await supabase
    .from('life_milestones')
    .insert({
      user_id: userId,
      title: milestone.title,
      date: milestone.date.toISOString(),
      is_completed: milestone.isCompleted,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateLifeMilestone(milestoneId: string, updates: Partial<LifeMilestone>) {
  const updateData: any = {};
  
  if (updates.title) updateData.title = updates.title;
  if (updates.date) updateData.date = updates.date.toISOString();
  if (updates.isCompleted !== undefined) updateData.is_completed = updates.isCompleted;
  
  updateData.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('life_milestones')
    .update(updateData)
    .eq('id', milestoneId);

  if (error) throw error;
}

export async function deleteLifeMilestone(milestoneId: string) {
  const { error } = await supabase.from('life_milestones').delete().eq('id', milestoneId);
  if (error) throw error;
}
