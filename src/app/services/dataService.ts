import { supabase } from './supabaseClient';
import { Goal, Subtask, GoalMilestone, GlobalMilestone, UserProfile, AppState } from '../types';

// Fetch all app data for a user
export const fetchAppData = async (userId: string): Promise<AppState | null> => {
  try {
    // Fetch user profile (optional - for gamification)
    let profileData: any = null;
    try {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError && profileError.code === 'PGRST116') {
        // Profile doesn't exist yet, create it
        const newProfile = { id: userId, xp: 0, level: 1, next_level_xp: 300 };
        const { error: insertError } = await supabase.from('profiles').insert(newProfile);
        if (!insertError) {
          profileData = newProfile;
        }
      } else if (data) {
        profileData = data;
      }
    } catch (e) {
      // Profiles table doesn't exist - use default values
      console.log('Profiles table not found, using default XP/level');
    }

    // Fetch goals with their subtasks and goal milestones
    const { data: goalsData, error: goalsError } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId);

    if (goalsError) {
      console.error('Goals error:', goalsError);
      if (goalsError.code === 'PGRST204' || goalsError.code === 'PGRST205' || goalsError.message?.includes('does not exist') || goalsError.message?.includes('Could not find')) {
        throw new Error('MISSING_TABLES');
      }
      throw goalsError;
    }

    // Fetch all subtasks for this user's goals
    const goalIds = (goalsData || []).map((g: any) => g.id);
    let subtasksData: any[] = [];
    if (goalIds.length > 0) {
      const { data, error: subtasksError } = await supabase
        .from('subtasks')
        .select('*')
        .in('goal_id', goalIds);

      if (subtasksError) {
        console.error('Subtasks error:', subtasksError);
        if (subtasksError.code === 'PGRST204' || subtasksError.code === 'PGRST205' || subtasksError.message?.includes('Could not find')) {
          throw new Error('MISSING_TABLES');
        }
        throw subtasksError;
      }
      subtasksData = data || [];
    }

    // Fetch all goal milestones for this user's goals
    let goalMilestonesData: any[] = [];
    if (goalIds.length > 0) {
      const { data, error: goalMilestonesError } = await supabase
        .from('goal_milestones')
        .select('*')
        .in('goal_id', goalIds);

      if (goalMilestonesError) {
        console.error('Goal milestones error:', goalMilestonesError);
        if (goalMilestonesError.code === 'PGRST204' || goalMilestonesError.code === 'PGRST205' || goalMilestonesError.message?.includes('Could not find')) {
          throw new Error('MISSING_TABLES');
        }
        throw goalMilestonesError;
      }
      goalMilestonesData = data || [];
    }

    // Fetch life milestones
    const { data: lifeMilestonesData, error: lifeMilestonesError } = await supabase
      .from('life_milestones')
      .select('*')
      .eq('user_id', userId);

    if (lifeMilestonesError) {
      console.error('Life milestones error:', lifeMilestonesError);
      if (lifeMilestonesError.code === 'PGRST204' || lifeMilestonesError.code === 'PGRST205' || lifeMilestonesError.message?.includes('Could not find')) {
        throw new Error('MISSING_TABLES');
      }
      throw lifeMilestonesError;
    }

    // Assemble the data structure
    const goals: Goal[] = (goalsData || []).map((g: any) => {
      const subtasks = subtasksData
        .filter((s: any) => s.goal_id === g.id)
        .map((s: any) => ({
          id: s.id,
          title: s.title,
          startOffsetDays: s.start_offset_days,
          durationDays: s.duration_days,
          status: s.status === 'in-progress' ? 'In Progress' : s.status === 'completed' ? 'Done' : 'To Do',
          order: s.order !== undefined ? s.order : 0,
        }))
        .sort((a: any, b: any) => a.order - b.order); // Sort by order

      const milestones = goalMilestonesData
        .filter((m: any) => m.goal_id === g.id)
        .map((m: any) => ({
          id: m.id,
          title: m.title,
          date: m.date || new Date(g.start_date).toISOString().split('T')[0],
          isCompleted: m.is_completed,
          color: m.color,
        }));

      return {
        id: g.id,
        title: g.title,
        category: g.category,
        color: g.color,
        startDate: new Date(g.start_date).toISOString().split('T')[0],
        endDate: new Date(g.end_date).toISOString().split('T')[0],
        status: g.status === 'in-progress' ? 'In Progress' : g.status === 'completed' ? 'Done' : 'To Do',
        order: g.order !== undefined ? g.order : 0,
        notes: g.notes,
        subtasks,
        milestones,
      };
    });

    const globalMilestones: GlobalMilestone[] = (lifeMilestonesData || []).map((m: any) => ({
      id: m.id,
      title: m.title,
      date: new Date(m.date).toISOString().split('T')[0],
      isCompleted: m.is_completed,
      color: m.color,
    }));

    return {
      user: {
        xp: profileData?.xp || 0,
        level: profileData?.level || 1,
        nextLevelXp: profileData?.next_level_xp || 300,
      },
      goals,
      globalMilestones,
    };
  } catch (error) {
    console.error('Error fetching app data:', error);
    throw error;
  }
};

// User Profile
export const updateUserProfile = async (userId: string, profile: UserProfile) => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        xp: profile.xp,
        level: profile.level,
        next_level_xp: profile.nextLevelXp,
      })
      .eq('id', userId);

    if (error) {
      // If profiles table doesn't exist, just skip (gamification will work in memory)
      if (error.code === 'PGRST204' || error.code === 'PGRST205') {
        console.log('Profiles table not found, skipping XP update');
        return;
      }
      throw error;
    }
  } catch (e) {
    console.log('Could not update profile, using localStorage fallback');
  }
};

// Goals
export const createGoal = async (userId: string, goal: Goal) => {
  const { error } = await supabase.from('goals').insert({
    id: goal.id,
    user_id: userId,
    title: goal.title,
    category: goal.category,
    color: goal.color,
    start_date: goal.startDate,
    end_date: goal.endDate,
    status: goal.status === 'In Progress' ? 'in-progress' : goal.status === 'Done' ? 'completed' : 'todo',
    order: goal.order,
    notes: goal.notes,
  });

  if (error) throw error;

  // Create subtasks
  if (goal.subtasks.length > 0) {
    const subtaskInserts = goal.subtasks.map(s => ({
      id: s.id,
      goal_id: goal.id,
      title: s.title,
      start_offset_days: s.startOffsetDays,
      duration_days: s.durationDays,
      status: s.status === 'In Progress' ? 'in-progress' : s.status === 'Done' ? 'completed' : 'todo',
      order: s.order,
    }));
    await supabase.from('subtasks').insert(subtaskInserts);
  }

  // Create milestones
  if (goal.milestones.length > 0) {
    const milestoneInserts = goal.milestones.map(m => ({
      id: m.id,
      goal_id: goal.id,
      title: m.title,
      date: m.date || null,
      is_completed: m.isCompleted,
      color: m.color,
    }));
    await supabase.from('goal_milestones').insert(milestoneInserts);
  }
};

export const updateGoal = async (goal: Goal) => {
  console.log('Updating goal:', goal.id, 'with status:', goal.status);
  const statusValue = goal.status === 'In Progress' ? 'in-progress' : goal.status === 'Done' ? 'completed' : 'todo';
  console.log('Mapped status value:', statusValue);
  
  const { error } = await supabase
    .from('goals')
    .update({
      title: goal.title,
      category: goal.category,
      color: goal.color,
      start_date: goal.startDate,
      end_date: goal.endDate,
      status: statusValue,
      order: goal.order,
      notes: goal.notes,
    })
    .eq('id', goal.id);

  if (error) {
    console.error('Error updating goal:', error);
    throw error;
  }
  console.log('Goal updated successfully');
};

export const deleteGoal = async (goalId: string) => {
  const { error } = await supabase.from('goals').delete().eq('id', goalId);
  if (error) throw error;
};

// Subtasks
export const createSubtask = async (subtask: Subtask & { goalId: string }) => {
  const { error } = await supabase.from('subtasks').insert({
    id: subtask.id,
    goal_id: subtask.goalId,
    title: subtask.title,
    start_offset_days: subtask.startOffsetDays,
    duration_days: subtask.durationDays,
    status: subtask.status === 'In Progress' ? 'in-progress' : subtask.status === 'Done' ? 'completed' : 'todo',
    order: subtask.order,
  });

  if (error) throw error;
};

export const updateSubtask = async (subtask: Subtask) => {
  console.log('Updating subtask:', subtask.id, 'with status:', subtask.status);
  const statusValue = subtask.status === 'In Progress' ? 'in-progress' : subtask.status === 'Done' ? 'completed' : 'todo';
  console.log('Mapped status value:', statusValue);
  
  const { error } = await supabase
    .from('subtasks')
    .update({
      title: subtask.title,
      start_offset_days: subtask.startOffsetDays,
      duration_days: subtask.durationDays,
      status: statusValue,
      order: subtask.order,
    })
    .eq('id', subtask.id);

  if (error) {
    // Provide helpful error message if order column is missing
    if (
      error.message?.includes("order") || 
      error.message?.includes("column") ||
      error.code === 'PGRST204' || 
      error.code === '42703'  // PostgreSQL undefined column error
    ) {
      throw new Error('DATABASE_MIGRATION_REQUIRED: The subtasks table needs to be updated. Please run the migration SQL from MIGRATION-REQUIRED.md file in your Supabase SQL Editor.');
    }
    console.error('Error updating subtask:', error);
    throw error;
  }
  console.log('Subtask updated successfully');
};

export const deleteSubtask = async (subtaskId: string) => {
  const { error } = await supabase.from('subtasks').delete().eq('id', subtaskId);
  if (error) throw error;
};

// Goal Milestones
export const createGoalMilestone = async (goalId: string, milestone: GoalMilestone) => {
  const { error } = await supabase.from('goal_milestones').insert({
    id: milestone.id,
    goal_id: goalId,
    title: milestone.title,
    date_offset: milestone.offsetDays,
    is_completed: milestone.isCompleted,
    color: milestone.color,
  });

  if (error) throw error;
};

export const updateGoalMilestone = async (milestone: GoalMilestone) => {
  const { error } = await supabase
    .from('goal_milestones')
    .update({
      title: milestone.title,
      date_offset: milestone.offsetDays,
      is_completed: milestone.isCompleted,
      color: milestone.color,
    })
    .eq('id', milestone.id);

  if (error) throw error;
};

export const deleteGoalMilestone = async (milestoneId: string) => {
  const { error } = await supabase.from('goal_milestones').delete().eq('id', milestoneId);
  if (error) throw error;
};

// Global Milestones (Life Milestones)
export const createGlobalMilestone = async (userId: string, milestone: GlobalMilestone) => {
  const { error } = await supabase.from('life_milestones').insert({
    id: milestone.id,
    user_id: userId,
    title: milestone.title,
    date: milestone.date,
    is_completed: milestone.isCompleted,
    color: milestone.color,
  });

  if (error) throw error;
};

export const updateGlobalMilestone = async (milestone: GlobalMilestone) => {
  const { error } = await supabase
    .from('life_milestones')
    .update({
      title: milestone.title,
      date: milestone.date,
      is_completed: milestone.isCompleted,
      color: milestone.color,
    })
    .eq('id', milestone.id);

  if (error) throw error;
};

export const deleteGlobalMilestone = async (milestoneId: string) => {
  const { error } = await supabase.from('life_milestones').delete().eq('id', milestoneId);
  if (error) throw error;
};