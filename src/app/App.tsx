import React, { useState, useEffect, useRef, useMemo, useSyncExternalStore } from 'react';
import {
  ChevronRight, ChevronDown, Plus, Calendar,
  Flag, Trash2, Download, Wand2,
  CheckCircle, Circle, Diamond, X,
  PanelLeft, PanelLeftClose, LogIn, LogOut,
  ZoomIn, ZoomOut, ArrowUp, ArrowDown,
  AddGoal, AddMilestone, MoreVertical
} from './components/Icons';
import { AddSubtaskButton } from './components/AddSubtaskButton';
import { TimelineRow } from './components/TimelineRow';
import { ColorPicker } from './components/ColorPicker';
import { MilestoneEditor } from './components/MilestoneEditor';
import { MigrationRequiredModal } from './components/MigrationRequiredModal';
import { GoalNotes } from './components/GoalNotes';
import { MilestoneLabel } from './components/MilestoneLabel';
import { GoalTimelineRow } from './components/GoalTimelineRow';
import { 
  Goal, Subtask, GlobalMilestone, AppState, 
  Status, DragState, GoalMilestone
} from './types';
import { 
  addDays, diffDays, formatDate, generateId, startOfDay,
  parseLocalDate, getLevelInfo, CATEGORY_COLORS, generateICS 
} from './services/utils';
import { getGoalBreakdown, AISuggestion } from './services/geminiService';
import * as WorkersClient from './services/workersClient';
import * as WorkersDataService from './services/workersDataService';

// --- Constants & Initial Data ---
const INITIAL_START_DATE = startOfDay(new Date());
INITIAL_START_DATE.setDate(INITIAL_START_DATE.getDate() - 5); 

const ROW_HEIGHT = 48;
const DEFAULT_PX_PER_DAY = 15;
const MILESTONE_TOP_POSITION = 16;

const INITIAL_STATE: AppState = {
  user: { xp: 0, level: 1, nextLevelXp: 300 },
  goals: [],
  globalMilestones: []
};

const DEMO_STATE: AppState = {
  user: { xp: 120, level: 2, nextLevelXp: 300 },
  goals: [
    {
      id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      title: 'Learn React Native',
      category: 'Career',
      color: '#3b82f6',
      startDate: formatDate(INITIAL_START_DATE),
      endDate: formatDate(addDays(INITIAL_START_DATE, 14)),
      status: Status.IN_PROGRESS,
      order: 0,
      subtasks: [
        { id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', title: 'Setup Environment', startOffsetDays: 0, durationDays: 7, status: Status.DONE, order: 0 },
        { id: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', title: 'Build First App', startOffsetDays: 8, durationDays: 7, status: Status.TODO, order: 1 }
      ],
      milestones: [
        { id: 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a', title: 'Published to Store', date: '2025-02-04', isCompleted: false }
      ]
    },
    {
      id: 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b',
      title: 'Japan Trip Planning',
      category: 'Travel',
      color: '#8b5cf6',
      startDate: formatDate(addDays(INITIAL_START_DATE, 5)),
      endDate: formatDate(addDays(INITIAL_START_DATE, 20)),
      status: Status.TODO,
      order: 1,
      subtasks: [
        { id: 'f6a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c', title: 'Book Flights', startOffsetDays: 0, durationDays: 7, status: Status.TODO, order: 0 },
        { id: 'a7b8c9d0-e1f2-4a3b-4c5d-6e7f8a9b0c1d', title: 'Reserve Hotels', startOffsetDays: 8, durationDays: 7, status: Status.TODO, order: 1 }
      ],
      milestones: []
    }
  ],
  globalMilestones: [
    { id: 'b8c9d0e1-f2a3-4b4c-5d6e-7f8a9b0c1d2e', title: 'New Year 2025', date: '2025-01-01', isCompleted: false }
  ]
};

export default function App() {
  // -- State --
  const [session, setSession] = useState<{ user: { id: string }; access_token: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPass, setAuthPass] = useState('');

  const [data, setData] = useState<AppState>(INITIAL_STATE);
  const [dbError, setDbError] = useState<boolean>(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  
  const [timelineStart, setTimelineStart] = useState<Date>(INITIAL_START_DATE);
  const [pxPerDay, setPxPerDay] = useState<number>(DEFAULT_PX_PER_DAY);

  const [selectedItemId, setSelectedItemId] = useState<{type: 'goal' | 'subtask' | 'milestone', id: string, parentId?: string} | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    // Default to closed on mobile (width < 768px)
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });
  const [collapsedGoalIds, setCollapsedGoalIds] = useState<Set<string>>(new Set());
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // AI State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Save state — reflects real persistence status (the app auto-saves every change)
  const saveState = useSyncExternalStore(WorkersDataService.subscribeSaveStatus, WorkersDataService.getSaveState);

  // Refs for synced scrolling
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const isScrollingSidebar = useRef(false);
  const isScrollingTimeline = useRef(false);

  // -- Init & Auth Effects --

  useEffect(() => {
    if (isDemoMode) {
      setData(DEMO_STATE);
      setIsLoading(false);
      return;
    }

    const existing = WorkersClient.auth.getSession();
    const sess = existing.data.session;
    if (sess) {
      setSession({ user: sess.user, access_token: sess.access_token });
      loadUserData(sess.user.id);
    } else {
      setIsLoading(false);
    }

    const sub = WorkersClient.auth.onAuthStateChange((_event, session) => {
      setSession(session ? { user: session.user, access_token: session.access_token } : null);
      if (session) {
        loadUserData(session.user.id);
      } else {
        setData(INITIAL_STATE);
        setIsLoading(false);
      }
    });

    return () => sub.data.subscription.unsubscribe();
  }, [isDemoMode]);

  const loadUserData = async (userId: string) => {
    setIsLoading(true);
    try {
      const fetchedData = await WorkersDataService.fetchAppData(userId);
      if (fetchedData) {
        const goalsWithOrder = fetchedData.goals.map((g, index) => ({
          ...g,
          order: g.order !== undefined ? g.order : index,
          subtasks: g.subtasks.map((s, sIndex) => ({
            ...s,
            order: s.order !== undefined ? s.order : sIndex
          }))
        }));
        setData({ ...fetchedData, goals: goalsWithOrder });
      }
    } catch (err: any) {
      alert('Failed to load data: ' + (err.message || 'Server error'));
    }
    setIsLoading(false);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (authMode === 'signup') {
        await WorkersClient.auth.signUp(authEmail, authPass);
        alert('Account created! Please sign in.');
        setAuthMode('signin');
      } else {
        const result = await WorkersClient.auth.signIn(authEmail, authPass);
        setSession({ user: result.user, access_token: result.session.access_token });
        await loadUserData(result.user.id);
      }
    } catch (error: any) {
      alert(error.message);
    }
    setIsLoading(false);
  };

  const handleLogout = async () => {
    if (isDemoMode) {
      setIsDemoMode(false);
      setData(INITIAL_STATE);
    } else {
      await WorkersClient.auth.signOut();
      setSession(null);
    }
  };

  // Flatten Goals and Subtasks for 1:1 Mapping
  const timelineRows = useMemo(() => {
    const rows: Array<{
      id: string;
      type: 'goal' | 'subtask';
      data: Goal | Subtask;
      parentId?: string;
      depth: number;
      color?: string;
    }> = [];

    // Sort goals by order
    const sortedGoals = [...data.goals].sort((a, b) => a.order - b.order);

    sortedGoals.forEach(g => {
      rows.push({
        id: g.id,
        type: 'goal',
        data: g,
        depth: 0,
        color: g.color
      });

      if (!collapsedGoalIds.has(g.id)) {
        // Sort subtasks by order
        const sortedSubtasks = [...g.subtasks].sort((a, b) => a.order - b.order);
        sortedSubtasks.forEach(s => {
          rows.push({
            id: s.id,
            type: 'subtask',
            data: s,
            parentId: g.id,
            depth: 1,
            color: g.color
          });
        });
      }
    });
    return rows;
  }, [data.goals, collapsedGoalIds]);

  // Filter timeline rows for rendering (all rows are now renderable)
  const renderableTimelineRows = useMemo(() => {
    return timelineRows;
  }, [timelineRows]);

  // Combined Milestones
  const unifiedMilestones = useMemo(() => {
    const globalMs = data.globalMilestones.map(m => ({
      ...m,
      dateObj: startOfDay(parseLocalDate(m.date)),
      type: 'global-milestone' as const,
      parentId: null,
      displayColor: m.color || '#8b5cf6',
      isGlobal: true
    }));

    const goalMs = data.goals.flatMap(g => g.milestones.map(m => ({
      id: m.id,
      title: m.title,
      isCompleted: m.isCompleted,
      dateObj: startOfDay(parseLocalDate(m.date)),
      type: 'milestone' as const,
      parentId: g.id,
      displayColor: m.color || '#8b5cf6',
      isGlobal: false,
      originalDate: m.date
    })));

    return [...globalMs, ...goalMs].sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  }, [data]);


  // -- Drag Logic with Persistence --
  
  // Handle Mouse Move (Visual Update Only)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState) return;
      e.preventDefault();

      const deltaPx = e.clientX - dragState.startX;
      const deltaDays = Math.round(deltaPx / pxPerDay);

      if (deltaDays === 0 && dragState.type.includes('move')) return;

      const goalsCopy = [...data.goals];
      let milestonesCopy = [...data.globalMilestones];

      if (dragState.type === 'goal-move') {
        const goalIndex = goalsCopy.findIndex(g => g.id === dragState.itemId);
        if (goalIndex !== -1) {
          const goal = goalsCopy[goalIndex];
          const originalStart = parseLocalDate(dragState.originalData.startDate);
          const originalEnd = parseLocalDate(dragState.originalData.endDate);
          goal.startDate = formatDate(addDays(originalStart, deltaDays));
          goal.endDate = formatDate(addDays(originalEnd, deltaDays));
          setData(prev => ({ ...prev, goals: goalsCopy }));
        }
      }
      else if (dragState.type === 'goal-resize-start') {
        const goalIndex = goalsCopy.findIndex(g => g.id === dragState.itemId);
        if (goalIndex !== -1) {
          const goal = goalsCopy[goalIndex];
          const originalStart = parseLocalDate(dragState.originalData.startDate);
          const currentEnd = parseLocalDate(goal.endDate);
          let newStart = addDays(originalStart, deltaDays);
          if (newStart >= currentEnd) newStart = addDays(currentEnd, -1); 
          goal.startDate = formatDate(newStart);
          setData(prev => ({ ...prev, goals: goalsCopy }));
        }
      }
      else if (dragState.type === 'goal-resize-end') {
        const goalIndex = goalsCopy.findIndex(g => g.id === dragState.itemId);
        if (goalIndex !== -1) {
          const goal = goalsCopy[goalIndex];
          const originalEnd = parseLocalDate(dragState.originalData.endDate);
          const currentStart = parseLocalDate(goal.startDate);
          let newEnd = addDays(originalEnd, deltaDays);
          if (newEnd <= currentStart) newEnd = addDays(currentStart, 1);
          goal.endDate = formatDate(newEnd);
          setData(prev => ({ ...prev, goals: goalsCopy }));
        }
      }
      else if (dragState.type === 'subtask-move') {
        const goalIndex = goalsCopy.findIndex(g => g.id === dragState.parentId);
        if (goalIndex !== -1) {
          const subtaskIndex = goalsCopy[goalIndex].subtasks.findIndex(s => s.id === dragState.itemId);
          if (subtaskIndex !== -1) {
            const subtask = goalsCopy[goalIndex].subtasks[subtaskIndex];
            let newOffset = dragState.originalData.startOffsetDays + deltaDays;
            if (newOffset < 0) newOffset = 0;
            subtask.startOffsetDays = newOffset;
            setData(prev => ({ ...prev, goals: goalsCopy }));
          }
        }
      }
      else if (dragState.type === 'subtask-resize-end') {
        const goalIndex = goalsCopy.findIndex(g => g.id === dragState.parentId);
        if (goalIndex !== -1) {
          const subtaskIndex = goalsCopy[goalIndex].subtasks.findIndex(s => s.id === dragState.itemId);
          if (subtaskIndex !== -1) {
            const subtask = goalsCopy[goalIndex].subtasks[subtaskIndex];
            let newDuration = dragState.originalData.durationDays + deltaDays;
            if (newDuration < 1) newDuration = 1;
            subtask.durationDays = newDuration;
            setData(prev => ({ ...prev, goals: goalsCopy }));
          }
        }
      }
      else if (dragState.type === 'milestone-move') {
        const goalIndex = goalsCopy.findIndex(g => g.id === dragState.parentId);
        if (goalIndex !== -1) {
          const mIndex = goalsCopy[goalIndex].milestones.findIndex(m => m.id === dragState.itemId);
          if (mIndex !== -1) {
             const originalDate = dragState.originalData.dateObj || parseLocalDate(dragState.originalData.date);
             if (!originalDate || isNaN(originalDate.getTime())) return;
             const newDate = addDays(originalDate, deltaDays);
             goalsCopy[goalIndex].milestones[mIndex].date = formatDate(newDate);
             setData(prev => ({ ...prev, goals: goalsCopy }));
          }
        }
      }
      else if (dragState.type === 'global-milestone-move') {
         const mIndex = milestonesCopy.findIndex(m => m.id === dragState.itemId);
         if (mIndex !== -1) {
            const originalDate = dragState.originalData.dateObj || parseLocalDate(dragState.originalData.date);
            if (!originalDate || isNaN(originalDate.getTime())) return;
            milestonesCopy[mIndex].date = formatDate(addDays(originalDate, deltaDays));
            setData(prev => ({...prev, globalMilestones: milestonesCopy}));
         }
      }
    };

    // Handle Mouse Up (Commit to Backend)
    const handleMouseUp = async () => {
      if (!dragState) {
        return;
      }
      
      if (!session && !isDemoMode) {
        setDragState(null);
        return;
      }

      if (!isDemoMode) {
        try {
          const { type, itemId, parentId } = dragState;

          if (type.startsWith('goal')) {
            const goal = data.goals.find(g => g.id === itemId);
            if (goal) await WorkersDataService.updateGoal(goal);
          } 
          else if (type.startsWith('subtask')) {
            const goal = data.goals.find(g => g.id === parentId);
            const subtask = goal?.subtasks.find(s => s.id === itemId);
            if (subtask) await WorkersDataService.updateSubtask(subtask);
          }
          else if (type === 'milestone-move') {
            const goal = data.goals.find(g => g.id === parentId);
            const milestone = goal?.milestones.find(m => m.id === itemId);
            if (milestone) await WorkersDataService.updateGoalMilestone({ ...milestone, goalId: parentId });
          }
          else if (type === 'global-milestone-move') {
            const milestone = data.globalMilestones.find(m => m.id === itemId);
            if (milestone) await WorkersDataService.updateGlobalMilestone(milestone);
          }

        } catch (error) {
          console.error("Failed to sync drag to backend", error);
          // In a real app, revert state here
        }
      }

      setDragState(null);
    };

    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, data, session, isDemoMode, pxPerDay]);

  // Warn before leaving only if a save is still in flight or the last one failed —
  // i.e. there really is data at risk. (Changes auto-save, so a clean state is safe.)
  useEffect(() => {
    if (saveState !== 'saving' && saveState !== 'error') return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [saveState]);

  // -- Logic Helpers --

  // -- Logic Helpers --

  const awardXP = (amount: number) => {
    // In demo mode, we update local state but not backend
    const { xp, level, nextLevelXp } = data.user;
    const newXp = xp + amount;
    const levelUp = getLevelInfo(newXp, level, nextLevelXp);

    let updatedUser = { ...data.user, xp: newXp };
    if (levelUp) {
       alert(`🎉 Level Up! You are now Level ${levelUp.newLevel}`);
       updatedUser = { xp: levelUp.newXp, level: levelUp.newLevel, nextLevelXp: levelUp.newThreshold };
    }

    setData(prev => ({ ...prev, user: updatedUser }));
    
    if (session && !isDemoMode) {
      WorkersDataService.updateUserProfile(session.user.id, updatedUser);
    }
  };

  const toggleGoalCollapse = (goalId: string) => {
    setCollapsedGoalIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(goalId)) newSet.delete(goalId);
      else newSet.add(goalId);
      return newSet;
    });
  };

  const dateToPx = (dateStr: string | Date) => {
    const date = typeof dateStr === 'string' ? parseLocalDate(dateStr) : dateStr;
    if (isNaN(date.getTime())) return 0;
    const normalizedDate = startOfDay(date);
    const normalizedStart = startOfDay(timelineStart);
    return diffDays(normalizedDate, normalizedStart) * pxPerDay;
  };
  
  // Helper to center point-in-time elements (milestones, TODAY marker) at noon
  const dateToPxCentered = (dateStr: string | Date) => {
    return dateToPx(dateStr) + (pxPerDay * 0.5);
  };
  
  const todayPx = dateToPxCentered(new Date());

  const handleZoomIn = () => setPxPerDay(prev => Math.min(prev + 10, 200));
  const handleZoomOut = () => setPxPerDay(prev => Math.max(prev - 10, 10));

  // Sync vertical scroll between sidebar and timeline
  const handleSidebarScroll = () => {
    if (isScrollingTimeline.current) return;
    isScrollingSidebar.current = true;
    if (sidebarScrollRef.current && timelineScrollRef.current) {
      timelineScrollRef.current.scrollTop = sidebarScrollRef.current.scrollTop;
    }
    requestAnimationFrame(() => {
      isScrollingSidebar.current = false;
    });
  };

  const handleTimelineScroll = () => {
    if (isScrollingSidebar.current) return;
    isScrollingTimeline.current = true;
    if (timelineScrollRef.current && sidebarScrollRef.current) {
      sidebarScrollRef.current.scrollTop = timelineScrollRef.current.scrollTop;
    }
    requestAnimationFrame(() => {
      isScrollingTimeline.current = false;
    });
  };

  const handleAddSubtask = async (goalId: string) => {
    const goal = data.goals.find(g => g.id === goalId);
    if (!goal) return;

    const lastSubtask = goal.subtasks[goal.subtasks.length - 1];
    const newStartOffset = lastSubtask ? lastSubtask.startOffsetDays + lastSubtask.durationDays + 1 : 0;
    
    const newSubtask: Subtask = {
      id: generateId(),
      title: 'New Subtask',
      startOffsetDays: newStartOffset,
      durationDays: 7,
      status: Status.TODO,
      order: goal.subtasks.length
    };

    // Optimistic update
    setData(prev => ({
      ...prev,
      goals: prev.goals.map(g => 
        g.id === goalId 
          ? { ...g, subtasks: [...g.subtasks, newSubtask] }
          : g
      )
    }));

    // Async Backend Update
    if (!isDemoMode && session) {
      try {
        await WorkersDataService.createSubtask({ ...newSubtask, goalId });
      } catch (err) {
        console.error("Failed to create subtask in DB", err);
      }
    }

    // Open drawer for editing
    setSelectedItemId({ type: 'subtask', id: newSubtask.id, parentId: goalId });
    setIsDrawerOpen(true);
  };

  const handleMoveGoalUp = async (goalId: string) => {
    const sortedGoals = [...data.goals].sort((a, b) => a.order - b.order);
    const sortedIndex = sortedGoals.findIndex(g => g.id === goalId);
    if (sortedIndex <= 0) return; // Already at top

    // Swap orders with previous goal
    const currentGoal = sortedGoals[sortedIndex];
    const previousGoal = sortedGoals[sortedIndex - 1];
    
    const updatedGoals = data.goals.map(g => {
      if (g.id === currentGoal.id) return { ...g, order: previousGoal.order };
      if (g.id === previousGoal.id) return { ...g, order: currentGoal.order };
      return g;
    });

    setData(prev => ({ ...prev, goals: updatedGoals }));

    // Update in database
    if (!isDemoMode && session) {
      try {
        await Promise.all([
          WorkersDataService.updateGoal(updatedGoals.find(g => g.id === currentGoal.id)!),
          WorkersDataService.updateGoal(updatedGoals.find(g => g.id === previousGoal.id)!)
        ]);
      } catch (err) {
        console.error("Failed to update goal order in DB", err);
      }
    }
  };

  const handleMoveGoalDown = async (goalId: string) => {
    const sortedGoals = [...data.goals].sort((a, b) => a.order - b.order);
    const sortedIndex = sortedGoals.findIndex(g => g.id === goalId);
    if (sortedIndex < 0 || sortedIndex >= sortedGoals.length - 1) return; // Already at bottom

    // Swap orders with next goal
    const currentGoal = sortedGoals[sortedIndex];
    const nextGoal = sortedGoals[sortedIndex + 1];
    
    const updatedGoals = data.goals.map(g => {
      if (g.id === currentGoal.id) return { ...g, order: nextGoal.order };
      if (g.id === nextGoal.id) return { ...g, order: currentGoal.order };
      return g;
    });

    setData(prev => ({ ...prev, goals: updatedGoals }));

    // Update in database
    if (!isDemoMode && session) {
      try {
        await Promise.all([
          WorkersDataService.updateGoal(updatedGoals.find(g => g.id === currentGoal.id)!),
          WorkersDataService.updateGoal(updatedGoals.find(g => g.id === nextGoal.id)!)
        ]);
      } catch (err) {
        console.error("Failed to update goal order in DB", err);
      }
    }
  };

  const handleMoveSubtaskUp = async (goalId: string, subtaskId: string) => {
    const goal = data.goals.find(g => g.id === goalId);
    if (!goal) return;

    const sortedSubtasks = [...goal.subtasks].sort((a, b) => a.order - b.order);
    const sortedIndex = sortedSubtasks.findIndex(s => s.id === subtaskId);
    if (sortedIndex <= 0) return; // Already at top

    // Swap orders with previous subtask
    const currentSubtask = sortedSubtasks[sortedIndex];
    const previousSubtask = sortedSubtasks[sortedIndex - 1];
    
    const updatedSubtasks = goal.subtasks.map(s => {
      if (s.id === currentSubtask.id) return { ...s, order: previousSubtask.order };
      if (s.id === previousSubtask.id) return { ...s, order: currentSubtask.order };
      return s;
    });

    const updatedGoals = data.goals.map(g => 
      g.id === goalId ? { ...g, subtasks: updatedSubtasks } : g
    );

    setData(prev => ({ ...prev, goals: updatedGoals }));

    // Update in database
    if (!isDemoMode && session) {
      try {
        await Promise.all([
          WorkersDataService.updateSubtask(updatedSubtasks.find(s => s.id === currentSubtask.id)!),
          WorkersDataService.updateSubtask(updatedSubtasks.find(s => s.id === previousSubtask.id)!)
        ]);
      } catch (err: any) {
        console.error("Failed to update subtask order in DB", err);
        if (err?.message?.includes('DATABASE_MIGRATION_REQUIRED')) {
          setShowMigrationModal(true);
        }
      }
    }
  };

  const handleMoveSubtaskDown = async (goalId: string, subtaskId: string) => {
    const goal = data.goals.find(g => g.id === goalId);
    if (!goal) return;

    const sortedSubtasks = [...goal.subtasks].sort((a, b) => a.order - b.order);
    const sortedIndex = sortedSubtasks.findIndex(s => s.id === subtaskId);
    if (sortedIndex < 0 || sortedIndex >= sortedSubtasks.length - 1) return; // Already at bottom

    // Swap orders with next subtask
    const currentSubtask = sortedSubtasks[sortedIndex];
    const nextSubtask = sortedSubtasks[sortedIndex + 1];
    
    const updatedSubtasks = goal.subtasks.map(s => {
      if (s.id === currentSubtask.id) return { ...s, order: nextSubtask.order };
      if (s.id === nextSubtask.id) return { ...s, order: currentSubtask.order };
      return s;
    });

    const updatedGoals = data.goals.map(g => 
      g.id === goalId ? { ...g, subtasks: updatedSubtasks } : g
    );

    setData(prev => ({ ...prev, goals: updatedGoals }));

    // Update in database
    if (!isDemoMode && session) {
      try {
        await Promise.all([
          WorkersDataService.updateSubtask(updatedSubtasks.find(s => s.id === currentSubtask.id)!),
          WorkersDataService.updateSubtask(updatedSubtasks.find(s => s.id === nextSubtask.id)!)
        ]);
      } catch (err: any) {
        console.error("Failed to update subtask order in DB", err);
        if (err?.message?.includes('DATABASE_MIGRATION_REQUIRED')) {
          setShowMigrationModal(true);
        }
      }
    }
  };


  // -- Render Helpers --
  const renderTimelineHeader = () => {
    const daysToRender = 200;
    const months: React.ReactNode[] = [];
    let currentMonth = -1;
    for (let i = 0; i < daysToRender; i++) {
      const d = addDays(timelineStart, i);
      const month = d.getMonth();
      if (month !== currentMonth) {
        currentMonth = month;
        const left = i * pxPerDay;
        months.push(
          <div key={`month-${i}`} className="absolute top-0 text-xs font-bold text-slate-400 uppercase tracking-wider border-l border-slate-300 pl-2 h-full flex items-center" style={{ left: `${left}px` }}>
            {d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </div>
        );
      }
    }
    return months;
  };

  const renderGrid = () => {
    const lines = [];
    for (let i = 0; i < 200; i++) {
      const d = addDays(timelineStart, i);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      lines.push(
        <div key={i} className={`absolute top-0 bottom-0 border-r border-slate-100 box-border ${isWeekend ? 'bg-slate-50/50' : ''}`} style={{ left: i * pxPerDay, width: pxPerDay }} />
      );
    }
    return lines;
  };

  // -- Action Handlers --

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session && !isDemoMode) return;
    
    const form = e.target as HTMLFormElement;
    const title = (form.elements.namedItem('title') as HTMLInputElement).value;
    const category = (form.elements.namedItem('category') as HTMLSelectElement).value;
    const color = CATEGORY_COLORS.find(c => c.name === category)?.hex || '#3b82f6';

    const newGoal: Goal = {
      id: generateId(),
      title,
      category,
      color,
      startDate: formatDate(new Date()),
      endDate: formatDate(addDays(new Date(), 7)),
      status: Status.TODO,
      order: data.goals.length,
      subtasks: [],
      milestones: [],
      notes: ''
    };

    // Apply AI Suggestions
    if (aiSuggestions.length > 0) {
       let subtaskOrder = 0;
       aiSuggestions.forEach(s => {
          if (s.type === 'subtask') {
            newGoal.subtasks.push({
              id: generateId(),
              title: s.title,
              startOffsetDays: s.startOffsetDays,
              durationDays: s.durationDays,
              status: Status.TODO,
              order: subtaskOrder++
            });
          } else {
             const milestoneDate = addDays(parseLocalDate(newGoal.startDate), s.startOffsetDays);
             newGoal.milestones.push({
               id: generateId(),
               title: s.title,
               date: formatDate(milestoneDate),
               isCompleted: false
             });
          }
       });
       console.log('✅ Created goal with', newGoal.subtasks.length, 'subtasks and', newGoal.milestones.length, 'milestones');
    }

    // Optimistic Update
    setData(prev => ({ ...prev, goals: [...prev.goals, newGoal] }));
    setIsCreateModalOpen(false);
    setAiSuggestions([]);
    setAiPrompt('');

    // Async Backend Update
    if (!isDemoMode && session) {
      try {
        await WorkersDataService.createGoal(session.user.id, newGoal);
      } catch (err) {
        console.error("Failed to create goal in DB", err);
        // Revert optimistic update (not implemented for brevity)
      }
    }
  };

  const handleGetAiSuggestions = async () => {
    if (!aiPrompt) return;
    setIsAiLoading(true);
    const suggestions = await getGoalBreakdown(aiPrompt, 14);
    console.log('🎯 Received AI suggestions:', suggestions.length, 'items');
    console.log('📋 Suggestions:', suggestions);
    setAiSuggestions(suggestions);
    setIsAiLoading(false);
  };
  
  const exportICS = () => {
    const text = generateICS(data.goals, data.globalMilestones);
    const element = document.createElement("a");
    const file = new Blob([text], {type: 'text/calendar'});
    element.href = URL.createObjectURL(file);
    element.download = "lifepath.ics";
    document.body.appendChild(element);
    element.click();
  };

  // --- Auth View ---
  if (!session && !isDemoMode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
          <div className="flex justify-center mb-6">
             <div className="w-12 h-12 bg-indigo-600 rounded-xl text-white flex items-center justify-center text-2xl shadow-lg font-bold">L</div>
          </div>
          <h1 className="text-2xl font-bold text-center text-slate-800 mb-2">Welcome to LifePath</h1>
          <p className="text-center text-slate-500 mb-8">Plan your life goals on a visual timeline.</p>
          
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input 
                type="email" required 
                className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                value={authEmail} onChange={e => setAuthEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input 
                type="password" required 
                className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                value={authPass} onChange={e => setAuthPass(e.target.value)}
              />
            </div>
            <button type="submit" disabled={isLoading} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50">
              {isLoading ? 'Loading...' : (authMode === 'signin' ? 'Sign In' : 'Sign Up')}
            </button>
          </form>
          
          <div className="mt-4">
             <button onClick={() => setIsDemoMode(true)} className="w-full py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-bold hover:bg-slate-50 transition-all">
               Try Demo Mode (No Backend)
             </button>
          </div>

          <div className="mt-6 text-center text-sm text-slate-600">
            {authMode === 'signin' ? (
              <p>Don't have an account? <button onClick={() => setAuthMode('signup')} className="text-indigo-600 font-bold hover:underline">Sign Up</button></p>
            ) : (
              <p>Already have an account? <button onClick={() => setAuthMode('signin')} className="text-indigo-600 font-bold hover:underline">Sign In</button></p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- Main App View ---
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white">
      
      {/* --- Demo Banner --- */}
      {isDemoMode && (
        <div className="shrink-0 bg-amber-100 text-amber-800 text-xs font-bold text-center py-1 z-[60] border-b border-amber-200">
          DEMO MODE - Changes will not be saved
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {/* --- Left Sidebar --- */}
        <aside className={`${isSidebarOpen ? 'w-72' : 'w-0'} transition-all duration-300 ease-in-out border-r border-slate-200 flex flex-col bg-slate-50 z-50 shadow-sm relative`}>
          <div className="overflow-hidden shrink-0 border-b border-slate-200 h-28">
             <div className="px-4 border-b border-slate-200 flex items-center justify-between bg-white h-14 box-border">
              <div className="font-bold text-xl text-slate-800 flex items-center gap-2 whitespace-nowrap">
                <div className="w-7 h-7 bg-indigo-600 rounded-lg text-white flex items-center justify-center text-sm shadow-sm">L</div>
                LifePath
              </div>
              <div className="flex items-center gap-2">
                {/* Add Actions Group */}
                  <button 
                    onClick={() => setIsCreateModalOpen(true)} 
                    className="p-1.5 hover:bg-indigo-50 rounded-md transition-colors text-slate-600 hover:text-indigo-600" 
                    title="New Goal"
                  >
                    <AddGoal className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={() => {
                      const newId = generateId();
                      const newMs: GlobalMilestone = {
                        id: newId,
                        title: 'New Milestone',
                        date: formatDate(new Date()),
                        isCompleted: false
                      };
                      setData(prev => ({...prev, globalMilestones: [...prev.globalMilestones, newMs]}));
                      if (!isDemoMode && session) WorkersDataService.createGlobalMilestone(session.user.id, newMs);
                      setSelectedItemId({type: 'milestone', id: newId});
                      setIsDrawerOpen(true);
                    }} 
                    className="p-1.5 hover:bg-indigo-50 rounded-md transition-colors text-indigo-500 hover:text-indigo-600" 
                    title="Add Milestone"
                  >
                    <AddMilestone className="w-6 h-6" />
                  </button>
              </div>
            </div>
            <div className="px-5 py-2.5 bg-indigo-50 whitespace-nowrap h-14 flex flex-col justify-center box-border">
              <div className="flex justify-between items-baseline text-indigo-900 mb-1.5">
                <span className="text-sm font-bold">Lvl {data.user.level}</span>
                <span className="text-xs font-medium opacity-70">{data.user.xp} / {data.user.nextLevelXp} XP</span>
              </div>
              <div className="w-full h-2 bg-indigo-200 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all duration-500 ease-out rounded-full" style={{ width: `${(data.user.xp / data.user.nextLevelXp) * 100}%` }} />
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50 no-scrollbar" ref={sidebarScrollRef} onScroll={handleSidebarScroll}>
               <div className="py-2">
                 {timelineRows.map((row) => (
                   <div 
                     key={`${row.type}-${row.id}`} 
                     style={{ height: ROW_HEIGHT }}
                     className={`flex items-center px-4 hover:bg-white/50 transition-colors cursor-pointer border-b border-transparent hover:border-slate-100 group ${row.type === 'goal' ? 'mt-4 first:mt-0' : ''}`}
                     onClick={() => {
                       if (row.type === 'goal') {
                         setSelectedItemId({type: 'goal', id: row.id});
                         setIsDrawerOpen(true);
                       } else if (row.type === 'subtask') {
                         setSelectedItemId({type: 'subtask', id: row.id, parentId: row.parentId});
                         setIsDrawerOpen(true);
                       }
                     }}
                   >
                      {row.type === 'goal' ? (
                        <div className="flex items-center gap-2 w-full overflow-hidden">
                           <button 
                              onClick={(e) => { e.stopPropagation(); toggleGoalCollapse(row.id); }}
                              className="p-0.5 hover:bg-slate-200 rounded text-slate-500 transition-colors shrink-0"
                           >
                             {collapsedGoalIds.has(row.id) ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                           </button>
                           <div className="w-3 h-3 rounded-sm shadow-sm flex-shrink-0" style={{ backgroundColor: (row.data as Goal).color }} />
                           <span className="font-semibold text-sm text-slate-700 truncate flex-1">{(row.data as Goal).title}</span>
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                handleMoveGoalUp(row.id); 
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-100 rounded text-slate-600 transition-all shrink-0"
                              title="Move Up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                           <button 
                             onClick={(e) => { 
                               e.stopPropagation(); 
                               handleAddSubtask(row.id); 
                             }}
                             className="opacity-0 group-hover:opacity-100 p-1 hover:bg-indigo-50 rounded text-indigo-600 transition-all shrink-0"
                             title="Add Subtask"
                           >
                             <Plus className="w-3.5 h-3.5" />
                           </button>
                        </div>
                      ) : row.type === 'subtask' ? (
                        <div className="flex items-center gap-2 pl-8 w-full overflow-hidden">
                           <div className="w-3 h-4 border-l border-b border-slate-300 rounded-bl-md -ml-4 mr-1" />
                           <StatusIcon status={(row.data as Subtask).status} />
                           <span className={`text-xs text-slate-600 truncate flex-1 ${(row.data as Subtask).status === Status.DONE ? 'line-through text-slate-400' : ''}`}>
                             {(row.data as Subtask).title}
                           </span>
                           <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button 
                               onClick={(e) => { 
                                 e.stopPropagation(); 
                                 handleMoveSubtaskUp(row.parentId!, row.id); 
                               }}
                               className="p-0.5 hover:bg-slate-100 rounded text-slate-500 transition-all shrink-0"
                               title="Move Up"
                             >
                               <ArrowUp className="w-3 h-3" />
                             </button>
                             <button 
                               onClick={(e) => { 
                                 e.stopPropagation(); 
                                 handleMoveSubtaskDown(row.parentId!, row.id); 
                               }}
                               className="p-0.5 hover:bg-slate-100 rounded text-slate-500 transition-all shrink-0"
                               title="Move Down"
                             >
                               <ArrowDown className="w-3 h-3" />
                             </button>
                           </div>
                        </div>
                      ) : null}
                   </div>
                 ))}
                 <div className="h-32" />
               </div>
          </div>

          {isDemoMode ? (
            <div className="p-4 bg-white border-t border-slate-200 shrink-0">
              <button
                onClick={() => {
                  setIsDemoMode(false);
                  setSession(null);
                }}
                className="w-full py-2.5 px-4 text-sm font-medium rounded-lg transition-all shadow-sm border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:shadow"
                title="Sign in to save your data"
              >
                Sign In
              </button>
            </div>
          ) : session && (saveState === 'saving' || saveState === 'error') && (
            <div className="p-4 bg-white border-t border-slate-200 shrink-0">
              <div
                className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium rounded-lg ${
                  saveState === 'error'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-slate-50 text-slate-500 border border-slate-200'
                }`}
                title={
                  saveState === 'error'
                    ? "Some changes couldn't be saved — check your connection"
                    : 'Saving your changes…'
                }
              >
                {saveState === 'error' ? (
                  <>⚠️ Couldn't save changes</>
                ) : (
                  <>Saving…</>
                )}
              </div>
            </div>
          )}
        </aside>

        {/* --- Main Timeline View --- */}
        <main className="flex-1 relative flex flex-col overflow-hidden bg-white">
          {/* Toggle Button (Floating outside scroll) */}
          <div className="absolute top-4 left-4 z-50">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                className="p-2 bg-white border border-slate-200 shadow hover:shadow-md rounded-lg text-slate-500 hover:text-indigo-600 transition-all"
                title={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
              >
                {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
              </button>
           </div>

          {/* Floating top right buttons */}
          <div className="absolute top-4 right-6 z-50 flex items-center gap-1.5">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow hover:shadow-md transition-all text-xs flex items-center gap-1.5"
              title="Add Quest"
            >
              <Plus className="w-4 h-4" />
              Add Quest
            </button>
            <button
              onClick={() => exportICS()}
              className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow hover:shadow-md transition-all text-slate-500 hover:text-indigo-600"
              title="Export to Calendar"
            >
              <Download className="w-4 h-4" />
            </button>
            <div className="relative">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow hover:shadow-md transition-all text-slate-500"
                title="More options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {isMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                  <div className="absolute right-0 mt-1.5 w-44 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50">
                    {(session || isDemoMode) && (
                      <button
                        onClick={() => {
                          handleLogout();
                          setIsMenuOpen(false);
                        }}
                        className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        {isDemoMode ? 'Exit Demo Mode' : 'Sign Out'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Zoom Controls (Floating bottom right) */}
          <div className="absolute bottom-6 right-6 z-50">
            <div className="flex items-center gap-0.5 bg-white rounded-lg border border-slate-200 shadow p-1">
              <button 
                onClick={handleZoomOut} 
                className="p-1.5 hover:bg-slate-50 rounded transition-colors text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed" 
                disabled={pxPerDay <= 10} 
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs text-slate-500 font-medium min-w-[36px] text-center px-1">{Math.round(pxPerDay)}px</span>
              <button 
                onClick={handleZoomIn} 
                className="p-1.5 hover:bg-slate-50 rounded transition-colors text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed" 
                disabled={pxPerDay >= 200} 
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Single Scroll Container for Header and Body */}
          <div className="flex-1 overflow-auto custom-scrollbar relative" ref={timelineScrollRef} onScroll={handleTimelineScroll}>
             
             {/* Unified Content Wrapper - Forces width for both header and body */}
             <div className="min-w-[8000px] relative min-h-full flex flex-col">
                
                {/* Sticky Header */}
                <div className="sticky top-0 z-30 bg-white border-b border-slate-200 h-28 shrink-0 shadow-sm">
                   <div className="absolute inset-0 overflow-hidden">
                       <div className="h-16 border-b border-slate-100 bg-slate-50/30 relative">
                         {unifiedMilestones.map((m, idx) => {
                           const left = dateToPxCentered(m.dateObj);
                           const topPos = MILESTONE_TOP_POSITION; 
                           return (
                             <div 
                                key={m.id}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  const dragType = m.isGlobal ? 'global-milestone-move' : 'milestone-move';
                                  setDragState({ type: dragType, itemId: m.id, parentId: m.parentId || undefined, startX: e.clientX, originalData: {...m} });
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedItemId({ type: 'milestone', id: m.id, parentId: m.parentId || undefined });
                                  setIsDrawerOpen(true);
                                }}
                                className="absolute flex flex-col items-center group cursor-pointer z-30 hover:z-40"
                                style={{ left: `${left}px`, top: `${topPos}px`, transform: 'translateX(-50%)' }}
                             >
                               <div className="w-3 h-3 rotate-45 border-2 border-white shadow-md group-hover:scale-125 transition-transform mb-1" style={{ backgroundColor: m.displayColor }} />
                               <span className="text-[10px] font-bold text-slate-600 whitespace-nowrap px-1.5 py-0.5 rounded bg-white/80 backdrop-blur-sm border border-slate-100 shadow-sm opacity-90 group-hover:opacity-100">
                                 {m.title}
                               </span>
                             </div>
                           )
                         })}
                         
                         {/* TODAY Marker in Header */}
                         <div className="absolute top-0 bottom-0 z-20 pointer-events-none" style={{ left: todayPx }}>
                            <div className="absolute left-0 top-1 -translate-x-1/2 bg-indigo-600 text-white text-[9px] font-bold px-1 py-0.5 rounded-sm shadow-sm">TODAY</div>
                             <div className="absolute inset-y-0 left-0 border-l-2 border-dotted border-indigo-400/60" style={{ top: '24px' }} />
                         </div>

                       </div>
                       <div className="h-12 w-full relative bg-slate-50/80">{renderTimelineHeader()}</div>
                    </div>
                </div>

                {/* Timeline Body */}
                <div className="relative flex-1 pb-32 pt-2">
                   {renderGrid()}
                   <div className="absolute top-0 bottom-0 z-0 pointer-events-none" style={{ left: todayPx }}>
                      <div className="absolute inset-y-0 left-0 border-l-2 border-dotted border-indigo-400/60" />
                   </div>

                   {renderableTimelineRows.map((row) => {
                      const isGoal = row.type === 'goal';
                      return (
                         <div key={`tl-${row.id}`} className={`relative w-full ${isGoal ? 'mt-4 first:mt-0' : ''}`} style={{ height: ROW_HEIGHT }}>
                             <div className="absolute inset-x-0 bottom-0 border-b border-slate-50" />
                             {isGoal ? (
                                (() => {
                                  const g = row.data as Goal;
                                  const startPx = dateToPx(g.startDate);
                                  const endPx = dateToPx(g.endDate);
                                  const width = Math.max(endPx - startPx, pxPerDay);
                                  return (
                                    <div 
                                      className="h-9 absolute top-1.5 rounded-md shadow-sm flex items-center px-3 cursor-move select-none ring-1 ring-transparent hover:ring-black/5 transition-all active:ring-2 active:ring-offset-1 z-10"
                                      style={{ left: startPx, width, backgroundColor: g.color + '20', borderColor: g.color, borderWidth: '1px', borderStyle: 'solid', color: g.color }}
                                      onMouseDown={(e) => {
                                         if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
                                         e.preventDefault();
                                         setDragState({ type: 'goal-move', itemId: g.id, startX: e.clientX, originalData: {...g} });
                                      }}
                                      onClick={() => { setSelectedItemId({type: 'goal', id: g.id}); setIsDrawerOpen(true); }}
                                    >
                                       <Handle type="start" onDragStart={(e) => setDragState({ type: 'goal-resize-start', itemId: g.id, startX: e.clientX, originalData: {...g} })} />
                                       <span className="text-xs font-bold truncate w-full px-1 select-none">{g.title}</span>
                                       <Handle type="end" onDragStart={(e) => setDragState({ type: 'goal-resize-end', itemId: g.id, startX: e.clientX, originalData: {...g} })} />
                                    </div>
                                  )
                                })()
                             ) : (
                                (() => {
                                  const s = row.data as Subtask;
                                  const g = data.goals.find(goal => goal.id === row.parentId);
                                  if (!g) return null;
                                  const startPx = dateToPx(g.startDate) + (s.startOffsetDays * pxPerDay);
                                  const width = s.durationDays * pxPerDay;
                                  return (
                                    <div 
                                      className="h-7 absolute top-2.5 rounded border shadow-sm flex items-center px-2 text-[11px] text-slate-600 cursor-pointer transition-all hover:border-indigo-300 hover:shadow-md bg-white z-10"
                                      style={{ left: startPx, width: Math.max(width, pxPerDay), borderColor: s.status === Status.DONE ? '#10b981' : '#e2e8f0', opacity: s.status === Status.DONE ? 0.6 : 1 }}
                                      onMouseDown={(e) => {
                                          if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
                                          e.preventDefault();
                                          setDragState({ type: 'subtask-move', itemId: s.id, parentId: g.id, startX: e.clientX, originalData: {...s} });
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedItemId({type: 'subtask', id: s.id, parentId: g.id});
                                        setIsDrawerOpen(true);
                                      }}
                                    >
                                      <span className={`truncate font-medium select-none ${s.status === Status.DONE ? 'line-through' : ''}`}>{s.title}</span>
                                      <Handle type="end" onDragStart={(e) => setDragState({ type: 'subtask-resize-end', itemId: s.id, parentId: g.id, startX: e.clientX, originalData: {...s} })} />
                                    </div>
                                  )
                                })()
                             )}
                         </div>
                      )
                   })}
                </div>
             </div>
          </div>
        </main>

        {/* --- Edit Drawer / Bottom Sheet --- */}
        {isDrawerOpen && (
          <div className="w-full md:w-80 h-[50vh] md:h-full bg-white shadow-2xl z-50 md:border-l border-t md:border-t-0 border-slate-200 flex flex-col overflow-y-auto absolute bottom-0 md:bottom-auto right-0 left-0 md:left-auto md:right-0 md:top-0 rounded-t-2xl md:rounded-none animate-slide-in-bottom md:animate-slide-in-right">
             <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h2 className="font-bold text-slate-800">Edit {selectedItemId?.type}</h2>
                <button onClick={() => setIsDrawerOpen(false)} className="p-1 hover:bg-slate-200 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
             </div>
             <div className="p-5 space-y-6">
               {selectedItemId?.type === 'goal' && (() => {
                 const goal = data.goals.find(g => g.id === selectedItemId.id);
                 if (!goal) return null;
                 return (
                   <>
                     <div>
                       <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Title</label>
                       <input className="w-full border border-slate-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={goal.title || ''}
                         onChange={async (e) => {
                           const updated = {...goal, title: e.target.value};
                           setData({...data, goals: data.goals.map(g => g.id === goal.id ? updated : g)});
                           if (!isDemoMode) await WorkersDataService.updateGoal(updated);
                         }}
                       />
                     </div>
                     <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Start</label>
                          <input 
                            type="date" 
                            className="w-full border border-slate-300 rounded-md p-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none" 
                            value={goal.startDate || ''} 
                            onChange={(e) => {
                              const updated = {...goal, startDate: e.target.value};
                              setData({...data, goals: data.goals.map(g => g.id === goal.id ? updated : g)});
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">End</label>
                          <input 
                            type="date" 
                            className="w-full border border-slate-300 rounded-md p-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none" 
                            value={goal.endDate} 
                            onChange={(e) => {
                              const updated = {...goal, endDate: e.target.value};
                              setData({...data, goals: data.goals.map(g => g.id === goal.id ? updated : g)});
                            }}
                          />
                        </div>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Status</label>
                        <select className="w-full border border-slate-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={goal.status || Status.TODO}
                          onChange={async (e) => {
                             const newStatus = e.target.value as Status;
                             if (newStatus === Status.DONE && goal.status !== Status.DONE) awardXP(100);
                             const updated = {...goal, status: newStatus};
                             setData({...data, goals: data.goals.map(g => g.id === goal.id ? updated : g)});
                             if (!isDemoMode) await WorkersDataService.updateGoal(updated);
                          }}
                        >
                          {Object.values(Status).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                     </div>
                      <GoalNotes 
                        goal={goal} 
                        onUpdate={(updated) => setData({...data, goals: data.goals.map(g => g.id === goal.id ? updated : g)})} 
                        isDemoMode={isDemoMode}
                      />

                      {/* Subtasks */}
                      <div className="border-t border-slate-200 pt-4">
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Subtasks ({goal.subtasks.length})</label>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const newSubtask: Subtask = {
                                id: generateId(),
                                title: 'New Subtask',
                                startOffsetDays: 0,
                                durationDays: 7,
                                status: Status.TODO,
                                order: goal.subtasks.length
                              };
                              const updated = {...goal, subtasks: [...goal.subtasks, newSubtask]};
                              setData({...data, goals: data.goals.map(g => g.id === goal.id ? updated : g)});
                            }}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                          >+ Add</button>
                        </div>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {goal.subtasks.map(subtask => (
                            <div
                              key={subtask.id}
                              onClick={() => { setSelectedItemId({ type: 'subtask', id: subtask.id, parentId: goal.id }); }}
                              className="flex items-center gap-2 p-2 rounded-md hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200 transition-all group"
                            >
                              <div className={`w-2 h-2 rounded-full shrink-0 ${subtask.status === Status.DONE ? 'bg-green-500' : subtask.status === Status.IN_PROGRESS ? 'bg-amber-500' : 'bg-slate-300'}`} />
                              <span className={`text-xs flex-1 truncate ${subtask.status === Status.DONE ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                {subtask.title}
                              </span>
                              <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100">{subtask.startOffsetDays}d&rarr;{subtask.startOffsetDays + subtask.durationDays}d</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Milestones */}
                      <div className="border-t border-slate-200 pt-4">
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Milestones ({goal.milestones.length})</label>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const newMilestone: GoalMilestone = {
                                id: generateId(),
                                title: 'New Milestone',
                                date: formatDate(new Date()),
                                isCompleted: false
                              };
                              const updated = {...goal, milestones: [...goal.milestones, newMilestone]};
                              setData({...data, goals: data.goals.map(g => g.id === goal.id ? updated : g)});
                            }}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                          >+ Add</button>
                        </div>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {goal.milestones.map(milestone => (
                            <div
                              key={milestone.id}
                              onClick={() => { setSelectedItemId({ type: 'milestone', id: milestone.id, parentId: goal.id }); setIsDrawerOpen(true); }}
                              className="flex items-center gap-2 p-2 rounded-md hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200 transition-all group"
                            >
                              <div className="w-2 h-2 rotate-45 bg-indigo-400 shrink-0" />
                              <span className={`text-xs flex-1 truncate ${milestone.isCompleted ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                {milestone.title}
                              </span>
                              <span className="text-[10px] text-slate-400">{milestone.date}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="border-t border-slate-200 pt-4 mt-2">
                        <button 
                          className="w-full py-2.5 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 hover:border-red-400 text-sm font-medium flex justify-center items-center gap-2 transition-all"
                          onClick={async (e) => {
                           e.stopPropagation();
                           e.preventDefault();
                           if(!window.confirm('Delete this goal? This action cannot be undone.')) return;
                           
                           const idToDelete = goal.id;
                           setData(prev => ({
                             ...prev, 
                             goals: prev.goals.filter(g => g.id !== idToDelete)
                           }));
                           setIsDrawerOpen(false);
                           setSelectedItemId(null);

                           if (!isDemoMode) {
                             try {
                               await WorkersDataService.deleteGoal(idToDelete);
                             } catch (error) {
                               console.error(error);
                               alert('Failed to delete goal on server');
                             }
                           }
                         }}
                       >
                         <Trash2 className="w-4 h-4" /> Delete Goal
                       </button>
                     </div>
                   </>
                 );
               })()}

               {selectedItemId?.type === 'subtask' && (() => {
                 const goal = data.goals.find(g => g.id === selectedItemId.parentId);
                 if(!goal) return null;
                 const task = goal.subtasks.find(t => t.id === selectedItemId.id);
                 if(!task) return null;
                 return (
                    <>
                      <div>
                       <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Title</label>
                       <input className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-indigo-500" value={task.title || ''}
                         onChange={async (e) => {
                           const updated = {...task, title: e.target.value};
                           const newSubtasks = goal.subtasks.map(t => t.id === task.id ? updated : t);
                           setData({...data, goals: data.goals.map(g => g.id === goal.id ? {...g, subtasks: newSubtasks} : g)});
                           if (!isDemoMode) await WorkersDataService.updateSubtask(updated);
                         }}
                       />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Status</label>
                        <select className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-indigo-500" value={task.status || Status.TODO}
                          onChange={async (e) => {
                             const newStatus = e.target.value as Status;
                             if (newStatus === Status.DONE && task.status !== Status.DONE) awardXP(10);
                             const updated = {...task, status: newStatus};
                             const newSubtasks = goal.subtasks.map(t => t.id === task.id ? updated : t);
                             setData({...data, goals: data.goals.map(g => g.id === goal.id ? {...g, subtasks: newSubtasks} : g)});
                             if (!isDemoMode) await WorkersDataService.updateSubtask(updated);
                          }}
                        >
                          {Object.values(Status).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                     </div>
                     <div className="border-t border-slate-200 pt-4 mt-6">
                       <button 
                         className="w-full py-2.5 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 hover:border-red-400 text-sm font-medium flex justify-center items-center gap-2 transition-all"
                         onClick={async (e) => {
                           e.stopPropagation();
                           e.preventDefault();
                           if(!window.confirm('Delete this subtask? This action cannot be undone.')) return;

                           const parentId = goal.id;
                           const taskId = task.id;
                           
                           setData(prev => {
                             const newGoals = prev.goals.map(g => {
                               if (g.id === parentId) {
                                 return { ...g, subtasks: g.subtasks.filter(t => t.id !== taskId) };
                               }
                               return g;
                             });
                             return {...prev, goals: newGoals};
                           });
                           
                           setIsDrawerOpen(false);
                           setSelectedItemId(null);
                           
                           if (!isDemoMode) {
                              try {
                                await WorkersDataService.deleteSubtask(taskId);
                              } catch (error) {
                                console.error(error);
                                alert('Failed to delete subtask on server');
                              }
                           }
                         }}
                       >
                         <Trash2 className="w-4 h-4" /> Delete Subtask
                       </button>
                     </div>
                    </>
                 )
               })()}
               
              {selectedItemId?.type === 'milestone' && (() => {
                 const isGlobal = !selectedItemId.parentId;
                 const milestone = isGlobal 
                    ? data.globalMilestones.find(m => m.id === selectedItemId.id)
                    : data.goals.find(g => g.id === selectedItemId.parentId)?.milestones.find(m => m.id === selectedItemId.id);
                 
                 if (!milestone) return null;
              
                 return (
                   <MilestoneEditor 
                     milestone={milestone}
                     isGlobal={isGlobal}
                     parentGoalId={selectedItemId.parentId}
                     isDemoMode={isDemoMode}
                     onUpdate={setData}
                     onClose={() => {
                       setIsDrawerOpen(false);
                       setSelectedItemId(null);
                     }}
                   />
                 )
              })()}
             </div>
          </div>
        )}
      </div>

      {/* --- Create Modal --- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center animate-fade-in">
           <div className="bg-white rounded-xl shadow-2xl w-[500px] overflow-hidden transform transition-all scale-100">
             <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <h2 className="text-lg font-bold text-slate-800">Start a New Quest</h2>
               <button onClick={() => setIsCreateModalOpen(false)} className="p-1 hover:bg-slate-200 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
             </div>
             <div className="p-6">
                <form onSubmit={handleCreateGoal} className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Goal Title</label>
                    <div className="flex gap-2">
                      <input name="title" className="flex-1 border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. Learn French" required value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} />
                      <button type="button" onClick={handleGetAiSuggestions} disabled={isAiLoading || !aiPrompt} className="bg-indigo-50 text-indigo-600 px-4 rounded-lg border border-indigo-100 hover:bg-indigo-100 flex items-center gap-2 text-sm font-medium disabled:opacity-50">
                        <Wand2 className="w-4 h-4" /> {isAiLoading ? 'Thinking...' : 'AI Plan'}
                      </button>
                    </div>
                  </div>
                  {aiSuggestions.length > 0 && (
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm animate-slide-down">
                      <p className="font-bold text-indigo-700 mb-2 flex items-center gap-2"><Wand2 className="w-3 h-3"/> AI Strategy Found:</p>
                      <ul className="space-y-2 pl-1 text-slate-600">
                        {aiSuggestions.map((s, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${s.type === 'subtask' ? 'bg-slate-400' : 'bg-indigo-400 rotate-45'}`} />
                            <span className="font-medium">{s.title}</span>
                            <span className="text-xs bg-slate-200 px-1.5 rounded text-slate-500">{s.durationDays > 0 ? `${s.durationDays}d` : 'Milestone'}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Category</label>
                    <select name="category" className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500">
                      {CATEGORY_COLORS.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                    <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Cancel</button>
                    <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-sm hover:shadow transition-all">Create Quest</button>
                  </div>
                </form>
             </div>
           </div>
        </div>
      )}

      {/* --- Migration Required Modal --- */}
      <MigrationRequiredModal 
        isOpen={showMigrationModal} 
        onClose={() => setShowMigrationModal(false)} 
      />
    </div>
  );
}

function StatusIcon({ status }: { status: Status }) {
  if (status === Status.DONE) return <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
  if (status === Status.IN_PROGRESS) return <Circle className="w-3.5 h-3.5 text-indigo-500 shrink-0 fill-indigo-100" />;
  return <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0" />;
}

function Handle({ type, onDragStart }: { type: 'start' | 'end', onDragStart: (e: React.MouseEvent) => void }) {
  return (
    <div className={`resize-handle w-3 h-full absolute ${type === 'start' ? 'left-0 rounded-l-md' : 'right-0 rounded-r-md'} top-0 cursor-${type === 'start' ? 'w' : 'e'}-resize hover:bg-black/5 flex items-center justify-center group/handle z-20`} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onDragStart(e); }}>
      <div className="w-1 h-3 bg-current opacity-0 group-hover/handle:opacity-30 rounded-full" />
    </div>
  );
}
