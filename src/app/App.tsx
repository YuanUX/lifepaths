import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useSyncExternalStore } from 'react';
import { useNavigate, useLocation } from 'react-router';
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
  parseLocalDate, getLevelInfo, CATEGORY_COLORS, generateICS, inferCategory
} from './services/utils';
import { getGoalBreakdown, AISuggestion } from './services/geminiService';
import * as WorkersClient from './services/workersClient';
import * as WorkersDataService from './services/workersDataService';

// Short, human-friendly date for the drag tooltip, e.g. "Jun 23, 2026".
const formatTooltipDate = (dateStr: string): string => {
  const d = parseLocalDate(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

// --- Constants & Initial Data ---
const INITIAL_START_DATE = startOfDay(new Date());
INITIAL_START_DATE.setDate(INITIAL_START_DATE.getDate() - 5); 

const ROW_HEIGHT = 48;
const DEFAULT_PX_PER_DAY = 15;
// Desktop edit-drawer width (Tailwind md breakpoint + w-80). Used to animate the
// drawer open in lockstep with the zoom and to keep zoom centering accurate.
const DRAWER_WIDTH = 320;
// A press must move at least this many pixels before it counts as a drag, so a
// click with a little mouse jitter doesn't accidentally move an item.
const DRAG_THRESHOLD = 5;
const MD_BREAKPOINT = '(min-width: 48rem)';
const MILESTONE_TOP_POSITION = 16;
// How many days of empty space to keep before the earliest / after the latest item,
// so there's always room to scroll into the past and future.
const TIMELINE_PADDING_DAYS = 30;
// Always render at least this many days, even for an empty/short timeline.
const MIN_TIMELINE_DAYS = 200;
// Don't nag trial users to save until they've spent at least this long exploring,
// so the exit-intent prompt can't fire in the first moments of the session.
const MIN_DEMO_DWELL_MS = 15000;

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

// Signature of the untouched demo seed, so we can tell when a trial user has
// actually changed the plan (vs. just looking at the example quests).
const DEMO_SEED_SIGNATURE = JSON.stringify({ goals: DEMO_STATE.goals, globalMilestones: DEMO_STATE.globalMilestones });

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  // The canvas lives at /app; everything else is the marketing landing page.
  const onCanvasRoute = location.pathname.startsWith('/app');

  // Preview mode (?preview=1): boot straight into the demo canvas with no chrome,
  // so the landing page can embed it as a live, read-only iframe preview.
  const isPreview = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === '1';

  // -- State --
  const [session, setSession] = useState<{ user: { id: string }; access_token: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPass, setAuthPass] = useState('');

  const [data, setData] = useState<AppState>(INITIAL_STATE);
  const [dbError, setDbError] = useState<boolean>(false);
  const [isDemoMode, setIsDemoMode] = useState(isPreview);
  
  const [pxPerDay, setPxPerDay] = useState<number>(DEFAULT_PX_PER_DAY);

  const [selectedItemId, setSelectedItemId] = useState<{type: 'goal' | 'subtask' | 'milestone', id: string, parentId?: string} | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  // Inline title editing for a subtask bar (entered via double-click).
  const [editingSubtask, setEditingSubtask] = useState<{ id: string; parentId: string; value: string } | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  // Category for the create modal. Auto-inferred from the title keywords until
  // the user manually changes it (questCategoryTouched), giving title -> type -> color.
  const [questCategory, setQuestCategory] = useState(CATEGORY_COLORS[0].name);
  const [questCategoryTouched, setQuestCategoryTouched] = useState(false);
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
  // "Before you go" prompt for demo mode: lets a trial user keep the plan they
  // built by signing up (carried into their account) or downloading an .ics.
  const [showSaveDemoModal, setShowSaveDemoModal] = useState(false);
  // Login/sign-up dialog shown over the (blurred) landing page.
  const [showAuthModal, setShowAuthModal] = useState(false);
  // Demo plan stashed when the user chooses to sign up, persisted after auth.
  const pendingDemoDataRef = useRef<AppState | null>(null);
  // Exit-intent prompt should only auto-appear once per demo session.
  const exitIntentShownRef = useRef(false);
  // When the current demo session began, used to enforce a minimum dwell time.
  const demoStartedAtRef = useRef<number>(0);
  
  // AI State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Save state — reflects real persistence status (the app auto-saves every change)
  const saveState = useSyncExternalStore(WorkersDataService.subscribeSaveStatus, WorkersDataService.getSaveState);

  // Refs for synced scrolling
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  // The canvas content wrapper; holds the --ppd (px-per-day) CSS variable that
  // drives every horizontal position. Animated imperatively for smooth zoom.
  const canvasContentRef = useRef<HTMLDivElement>(null);
  // Stashed by a quest click; consumed in a layout effect once the drawer has
  // mounted so the zoom (and drawer-width) animation starts after layout.
  const pendingZoomRef = useRef<{ targetPx: number; targetScroll: number; animateWidth: boolean } | null>(null);
  const isScrollingSidebar = useRef(false);
  const isScrollingTimeline = useRef(false);
  // Auto-fit the zoom to all quests once, the first time a plan is loaded.
  const didAutoFitRef = useRef(false);
  // Holds the in-flight requestAnimationFrame id for the zoom-to-quest tween.
  const zoomAnimRef = useRef<number | null>(null);
  // Distinguishes a single click (open drawer) from a double click (inline edit)
  // on a subtask bar by deferring the single-click action briefly.
  const subtaskClickTimerRef = useRef<number | null>(null);
  // Whether we've done the one-time "logged-in users land on the canvas" redirect.
  const didInitialRouteRef = useRef(false);

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

  // Route based on login state once auth has resolved:
  //  - logged-in visitors landing on "/" are sent to the canvas (one time only,
  //    so they can still click the logo to come back to the landing page);
  //  - the canvas route is guarded — logged-out, non-demo users go to "/".
  useEffect(() => {
    if (isLoading || isPreview) return;

    if (!didInitialRouteRef.current) {
      didInitialRouteRef.current = true;
      if (session && location.pathname === '/') {
        navigate('/app', { replace: true });
        return;
      }
    }

    if (onCanvasRoute && !session && !isDemoMode) {
      navigate('/', { replace: true });
    }
  }, [isLoading, session, isDemoMode, onCanvasRoute, location.pathname, isPreview, navigate]);

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

      // Carry over a plan built in demo mode: persist it to the account. Only do
      // this when the user actually changed the demo seed (not just viewed the
      // examples), and assign fresh IDs so we never collide with existing rows.
      const pending = pendingDemoDataRef.current;
      pendingDemoDataRef.current = null;
      const pendingChanged = pending &&
        JSON.stringify({ goals: pending.goals, globalMilestones: pending.globalMilestones }) !== DEMO_SEED_SIGNATURE;
      if (pending && pendingChanged && pending.goals.length > 0) {
        const migratedGoals = pending.goals.map(g => ({
          ...g,
          id: generateId(),
          subtasks: g.subtasks.map(s => ({ ...s, id: generateId() })),
          milestones: g.milestones.map(m => ({ ...m, id: generateId() })),
        }));
        const migratedGlobals = pending.globalMilestones.map(m => ({ ...m, id: generateId() }));

        for (const goal of migratedGoals) {
          await WorkersDataService.createGoal(userId, goal);
        }
        for (const milestone of migratedGlobals) {
          await WorkersDataService.createGlobalMilestone(userId, milestone);
        }
        // Merge into whatever the account already had.
        setData(prev => ({
          ...prev,
          goals: [...prev.goals, ...migratedGoals.map((g, i) => ({ ...g, order: prev.goals.length + i }))],
          globalMilestones: [...prev.globalMilestones, ...migratedGlobals],
        }));
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
        // Signed in: leave demo mode (if active), dismiss the modal, go to canvas.
        setIsDemoMode(false);
        setShowAuthModal(false);
        navigate('/app');
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
    navigate('/');
  };

  // Enter the demo and navigate to the canvas route.
  const openDemo = () => {
    setIsDemoMode(true);
    navigate('/app');
  };

  // Leaving demo mode: if there's a plan worth keeping, prompt to save it first;
  // otherwise just exit.
  const requestExitDemo = () => {
    if (isDemoMode && data.goals.length > 0) {
      setShowSaveDemoModal(true);
    } else {
      handleLogout();
    }
  };

  // Stash the demo plan and send the user to sign up; it's persisted to their
  // account in loadUserData once they're authenticated.
  // Open the sign-up modal over the demo canvas (kept blurred behind it) and
  // stash the plan; it's persisted once the user authenticates. Staying in demo
  // mode means the user keeps their work as the backdrop instead of being thrown
  // back to the landing page.
  const saveDemoViaSignup = () => {
    pendingDemoDataRef.current = data;
    setAuthMode('signup');
    setShowSaveDemoModal(false);
    setShowAuthModal(true);
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

  // Derive the visible timeline range from the data so the timeline always spans
  // from before the earliest item to after the latest one. This lets users scroll
  // left into the past instead of being pinned to ~today.
  const computedRange = useMemo(() => {
    const dates: Date[] = [startOfDay(new Date())];

    data.goals.forEach(g => {
      const gStart = parseLocalDate(g.startDate);
      const gEnd = parseLocalDate(g.endDate);
      if (!isNaN(gStart.getTime())) dates.push(gStart);
      if (!isNaN(gEnd.getTime())) dates.push(gEnd);
      if (!isNaN(gStart.getTime())) {
        g.subtasks.forEach(s => {
          const sStart = addDays(gStart, s.startOffsetDays);
          dates.push(sStart, addDays(sStart, s.durationDays));
        });
      }
      g.milestones.forEach(m => {
        const md = parseLocalDate(m.date);
        if (!isNaN(md.getTime())) dates.push(md);
      });
    });

    data.globalMilestones.forEach(m => {
      const md = parseLocalDate(m.date);
      if (!isNaN(md.getTime())) dates.push(md);
    });

    const times = dates.map(d => d.getTime());
    const start = startOfDay(addDays(new Date(Math.min(...times)), -TIMELINE_PADDING_DAYS));
    const end = startOfDay(addDays(new Date(Math.max(...times)), TIMELINE_PADDING_DAYS));
    const days = Math.max(MIN_TIMELINE_DAYS, diffDays(end, start));

    return { timelineStart: start, timelineDays: days };
  }, [data]);

  // Freeze the timeline range while dragging. The range is derived from the
  // data, so updating an item's dates mid-drag would otherwise shift
  // timelineStart / grow timelineDays and re-lay-out the whole canvas, making
  // the dragged node jump out from under the cursor. Hold the pre-drag range
  // until the drag ends, then let it recompute to fit the new positions.
  const frozenRangeRef = useRef(computedRange);
  if (!dragState) {
    frozenRangeRef.current = computedRange;
  }
  const { timelineStart, timelineDays } = dragState ? frozenRangeRef.current : computedRange;


  // -- Drag Logic with Persistence --

  // Arm a drag but don't actually start it until the pointer crosses
  // DRAG_THRESHOLD px. A plain click (with minor jitter) stays a click.
  const startDrag = (payload: DragState, e: React.MouseEvent) => {
    const startX = e.clientX;
    const startY = e.clientY;
    const onMove = (ev: MouseEvent) => {
      if (Math.abs(ev.clientX - startX) >= DRAG_THRESHOLD || Math.abs(ev.clientY - startY) >= DRAG_THRESHOLD) {
        cleanup();
        setDragState(payload);
      }
    };
    const cleanup = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', cleanup);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', cleanup);
  };

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

  // Track when the demo session started so the save prompt can require a minimum
  // dwell time before nagging.
  useEffect(() => {
    if (isDemoMode) {
      demoStartedAtRef.current = Date.now();
      exitIntentShownRef.current = false;
    }
  }, [isDemoMode]);

  // A plan is worth prompting to save once the user has actually changed it from
  // the demo seed — added/edited/moved a quest — not just by viewing the examples.
  const demoPlanIsMeaningful =
    JSON.stringify({ goals: data.goals, globalMilestones: data.globalMilestones }) !== DEMO_SEED_SIGNATURE;

  // Demo mode isn't persisted, so a built-up plan is at risk on leave. Warn on
  // actual tab/window close, and surface a "save before you go" prompt once the
  // cursor leaves the top of the window (classic exit intent) — but only after a
  // meaningful plan exists and the user has spent a little time exploring.
  useEffect(() => {
    if (!isDemoMode || isPreview || data.goals.length === 0) return;

    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const onMouseOut = (e: MouseEvent) => {
      const dwellElapsed = Date.now() - demoStartedAtRef.current > MIN_DEMO_DWELL_MS;
      if (e.relatedTarget === null && e.clientY <= 0 && demoPlanIsMeaningful && dwellElapsed && !exitIntentShownRef.current) {
        exitIntentShownRef.current = true;
        setShowSaveDemoModal(true);
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('mouseout', onMouseOut);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('mouseout', onMouseOut);
    };
  }, [isDemoMode, data.goals.length, demoPlanIsMeaningful]);

  // Auto-fit: the first time quests are present, set the default view to span
  // from one week before today to the end of the last quest, and scroll there.
  // Quests that start further in the past are still reachable by scrolling left.
  useEffect(() => {
    if (didAutoFitRef.current || isLoading || data.goals.length === 0) return;

    let maxEnd = -Infinity;
    data.goals.forEach(g => {
      const e = parseLocalDate(g.endDate).getTime();
      if (!isNaN(e)) maxEnd = Math.max(maxEnd, e);
    });
    if (!isFinite(maxEnd)) return;

    // Default window: one week before today → last quest's end.
    const minStart = startOfDay(addDays(new Date(), -7));
    const endDay = startOfDay(new Date(maxEnd));
    const spanDays = Math.max(1, diffDays(endDay, minStart));

    // The canvas may not be laid out the instant data lands, so retry across a
    // few frames until it has a measurable width before computing the zoom.
    let raf = 0;
    let attempts = 0;
    const tryFit = () => {
      const container = timelineScrollRef.current;
      if (!container || container.clientWidth === 0) {
        if (attempts++ < 30) raf = requestAnimationFrame(tryFit);
        return;
      }
      didAutoFitRef.current = true;
      // Take over scroll positioning from the default "scroll to today" effect.
      hasScrolledToToday.current = true;

      // Use ~90% of the width so the window has a little breathing room.
      const fitPx = Math.max(10, Math.min(200, (container.clientWidth * 0.9) / spanDays));
      setPxPerDay(fitPx);

      // Scroll so the start of the window (a week before today) sits near the
      // left edge. timelineStart doesn't depend on pxPerDay, so it's stable here.
      raf = requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = timelineScrollRef.current;
        if (!el) return;
        const leftPx = diffDays(minStart, startOfDay(timelineStart)) * fitPx;
        el.scrollLeft = Math.max(0, leftPx - el.clientWidth * 0.05);
      }));
    };
    raf = requestAnimationFrame(tryFit);
    return () => cancelAnimationFrame(raf);
  }, [isLoading, data.goals.length, timelineStart]);

  // Stop any in-flight zoom-to-quest animation when the canvas unmounts.
  useEffect(() => () => {
    if (zoomAnimRef.current !== null) cancelAnimationFrame(zoomAnimRef.current);
  }, []);

  // Keep the --ppd CSS variable in sync with the committed zoom level. Using a
  // layout effect (before paint) avoids a flash, and keeping --ppd out of the
  // React style prop means a mid-animation re-render can't clobber the value the
  // animation loop is imperatively driving.
  useLayoutEffect(() => {
    canvasContentRef.current?.style.setProperty('--ppd', `${pxPerDay}px`);
  }, [pxPerDay]);

  // The data source changed (signed in/out, entered/left demo). Re-arm the
  // one-time auto-fit so the freshly loaded plan opens at the default window
  // (a week before today → the last quest's end) instead of staying put.
  useEffect(() => {
    didAutoFitRef.current = false;
    hasScrolledToToday.current = false;
  }, [session?.user?.id, isDemoMode]);

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

  // Save (or discard) an in-progress inline subtask title edit.
  const commitSubtaskEdit = () => {
    setEditingSubtask(prev => {
      if (!prev) return null;
      const trimmed = prev.value.trim();
      const goal = data.goals.find(g => g.id === prev.parentId);
      const task = goal?.subtasks.find(t => t.id === prev.id);
      if (task && trimmed && trimmed !== task.title) {
        const updated = { ...task, title: trimmed };
        setData(d => ({ ...d, goals: d.goals.map(g => g.id === prev.parentId ? { ...g, subtasks: g.subtasks.map(t => t.id === prev.id ? updated : t) } : g) }));
        if (!isDemoMode) WorkersDataService.updateSubtask(updated);
      }
      return null;
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

  // Zoom-independent day offset from the timeline start. Every horizontal
  // position is rendered as calc(var(--ppd) * offset) using this, so the whole
  // canvas can be re-scaled by animating one CSS variable (--ppd) imperatively —
  // no React re-render per frame, no text distortion.
  const dayOffsetOf = (dateStr: string | Date) => {
    const date = typeof dateStr === 'string' ? parseLocalDate(dateStr) : dateStr;
    if (isNaN(date.getTime())) return 0;
    return diffDays(startOfDay(date), startOfDay(timelineStart));
  };
  const ppx = (days: number) => `calc(var(--ppd, ${DEFAULT_PX_PER_DAY}px) * ${days})`;
  // Centered (noon) offset for point-in-time markers.
  const todayOffset = dayOffsetOf(new Date()) + 0.5;

  // On first load, scroll so "today" is in view rather than the far-left past padding.
  const hasScrolledToToday = useRef(false);
  useEffect(() => {
    if (isLoading || hasScrolledToToday.current) return;
    if (timelineScrollRef.current) {
      timelineScrollRef.current.scrollLeft = Math.max(0, todayPx - 120);
      hasScrolledToToday.current = true;
    }
  }, [isLoading, todayPx]);

  // The zoom level currently shown. During an animation this is the live --ppd
  // being driven imperatively; at rest it equals the committed pxPerDay state.
  const currentPpd = () => {
    const v = canvasContentRef.current ? parseFloat(canvasContentRef.current.style.getPropertyValue('--ppd')) : NaN;
    return isNaN(v) ? pxPerDay : v;
  };

  // Zoom about the viewport center: keep whatever day sits at the middle of the
  // canvas fixed while the scale changes, then animate to the new position.
  const zoomBy = (delta: number) => {
    const fromPx = currentPpd();
    const targetPx = Math.max(10, Math.min(200, fromPx + delta));
    const el = timelineScrollRef.current;
    if (!el || el.clientWidth === 0 || targetPx === fromPx) { setPxPerDay(targetPx); return; }
    const dayAtCenter = (el.scrollLeft + el.clientWidth / 2) / fromPx;
    const targetScroll = Math.max(0, dayAtCenter * targetPx - el.clientWidth / 2);
    animateTimeline(targetPx, targetScroll);
  };
  const handleZoomIn = () => zoomBy(10);
  const handleZoomOut = () => zoomBy(-10);

  // Smoothly tween zoom (pxPerDay) and horizontal scroll together over ~350ms.
  // Driving both from a single rAF loop keeps the grid, quest bars, milestones
  // and scroll position moving in lockstep for a clean zoom animation. When
  // `animateWidth` is set, the drawer's width is grown from 0 in the same loop
  // so the canvas eases to its smaller size instead of snapping.
  const animateTimeline = (targetPx: number, targetScroll: number, duration = 350, animateWidth = false) => {
    const el = timelineScrollRef.current;
    if (!el) { setPxPerDay(targetPx); return; }
    if (zoomAnimRef.current !== null) cancelAnimationFrame(zoomAnimRef.current);

    const fromPx = currentPpd();
    const fromScroll = el.scrollLeft;
    const canvas = canvasContentRef.current;

    // Resolve the drawer-width tween (all values toward DRAWER_WIDTH = full):
    //  - opening fresh: 0 -> full
    //  - a prior open was interrupted (var still set): current -> full
    //  - otherwise: leave the width alone.
    const drawer = drawerRef.current;
    let widthFrom: number | null = null;
    if (drawer) {
      const current = drawer.style.getPropertyValue('--drawer-w');
      if (animateWidth) widthFrom = 0;
      else if (current !== '') widthFrom = parseFloat(current) || 0;
      if (widthFrom !== null) drawer.style.setProperty('--drawer-w', `${widthFrom}px`);
    }

    const t0 = performance.now();
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const e = easeOutCubic(t);
      // Drive the zoom by the CSS variable only — the whole canvas reflows from
      // calc(var(--ppd) * …) with no React render. State is committed once at the
      // end so subsequent interaction (zoom buttons, drag) stays in sync.
      if (canvas) canvas.style.setProperty('--ppd', `${fromPx + (targetPx - fromPx) * e}px`);
      const live = timelineScrollRef.current;
      if (live) live.scrollLeft = fromScroll + (targetScroll - fromScroll) * e;
      if (drawer && widthFrom !== null) {
        drawer.style.setProperty('--drawer-w', `${widthFrom + (DRAWER_WIDTH - widthFrom) * e}px`);
      }
      if (t < 1) {
        zoomAnimRef.current = requestAnimationFrame(step);
      } else {
        zoomAnimRef.current = null;
        setPxPerDay(targetPx);
        // Hand the width back to the default (CSS var fallback = full width).
        if (drawer && widthFrom !== null) drawer.style.removeProperty('--drawer-w');
      }
    };
    zoomAnimRef.current = requestAnimationFrame(step);
  };

  // Select a quest, open the edit drawer, and queue a zoom-to-quest animation.
  // The zoom is stashed and run from a layout effect (once the drawer has
  // mounted) so we measure against the final, drawer-shrunken canvas width.
  const openGoal = (g: Goal) => {
    const wasOpen = isDrawerOpen;
    setSelectedItemId({ type: 'goal', id: g.id });
    setIsDrawerOpen(true);

    const el = timelineScrollRef.current;
    const start = parseLocalDate(g.startDate);
    const end = parseLocalDate(g.endDate);
    if (!el || isNaN(start.getTime()) || isNaN(end.getTime())) return;

    const startDay = startOfDay(start);
    const spanDays = Math.max(1, diffDays(startOfDay(end), startDay));
    // On desktop, opening the drawer shrinks the canvas by DRAWER_WIDTH. Measure
    // against that final width so the quest still centers; if the drawer is
    // already open the current width is already final.
    const isDesktop = window.matchMedia(MD_BREAKPOINT).matches;
    const animateWidth = isDesktop && !wasOpen;
    const finalW = animateWidth ? Math.max(1, el.clientWidth - DRAWER_WIDTH) : el.clientWidth;

    const targetPx = Math.max(10, Math.min(200, (finalW * 0.7) / spanDays));
    const startPx = diffDays(startDay, startOfDay(timelineStart)) * targetPx;
    const center = startPx + (spanDays * targetPx) / 2;
    const targetScroll = Math.max(0, center - finalW / 2);
    pendingZoomRef.current = { targetPx, targetScroll, animateWidth };
  };

  // Run the queued quest zoom once the drawer has committed to the DOM. Using a
  // layout effect (before paint) lets us start the drawer at width 0 with no
  // flash of the full-width drawer first.
  useLayoutEffect(() => {
    const pending = pendingZoomRef.current;
    if (!pending) return;
    pendingZoomRef.current = null;
    animateTimeline(pending.targetPx, pending.targetScroll, 350, pending.animateWidth);
  }, [selectedItemId, isDrawerOpen]);

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
    const daysToRender = timelineDays;
    const months: React.ReactNode[] = [];
    let currentMonth = -1;
    for (let i = 0; i < daysToRender; i++) {
      const d = addDays(timelineStart, i);
      const month = d.getMonth();
      if (month !== currentMonth) {
        currentMonth = month;
        months.push(
          <div key={`month-${i}`} className="absolute top-0 text-xs font-bold text-slate-400 uppercase tracking-wider border-l border-slate-300 pl-2 h-full flex items-center" style={{ left: ppx(i) }}>
            {d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </div>
        );
      }
    }
    return months;
  };

  // Day grid + weekend shading drawn as two CSS repeating gradients on a single
  // element, instead of one div per day. This keeps the canvas cheap to repaint
  // every frame while zooming (the previous per-day divs — hundreds of nodes —
  // made the zoom animation stutter).
  const renderGrid = () => {
    // Shift the weekend band so it lands on the real Saturday/Sunday columns.
    const offsetToSat = (6 - startOfDay(timelineStart).getDay() + 7) % 7;
    const v = `var(--ppd, ${DEFAULT_PX_PER_DAY}px)`;
    const dayLines = `repeating-linear-gradient(to right, transparent 0, transparent calc(${v} - 1px), #f1f5f9 calc(${v} - 1px), #f1f5f9 ${v})`;
    const weekend = `repeating-linear-gradient(to right, rgba(248,250,252,0.5) 0, rgba(248,250,252,0.5) calc(${v} * 2), transparent calc(${v} * 2), transparent calc(${v} * 7))`;
    return (
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `${weekend}, ${dayLines}`,
          backgroundPosition: `calc(${v} * ${offsetToSat}) 0, 0 0`,
        }}
      />
    );
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
    setQuestCategory(CATEGORY_COLORS[0].name);
    setQuestCategoryTouched(false);

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

  // Login / sign-up dialog. Rendered over a blurred backdrop — either the
  // landing page (logged-out) or the demo canvas (so a trial user keeps their
  // work visible behind the form instead of being sent back to the landing page).
  const authModalEl = showAuthModal ? (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-md animate-fade-in"
      onClick={() => setShowAuthModal(false)}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => setShowAuthModal(false)}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-2xl font-bold text-white shadow-lg">L</div>
        </div>
        <h2 className="mb-2 text-center text-2xl font-bold text-slate-800">
          {authMode === 'signin' ? 'Welcome back' : 'Create your account'}
        </h2>
        <p className="mb-8 text-center text-slate-500">Plan your life goals on a visual timeline.</p>

        {pendingDemoDataRef.current && pendingDemoDataRef.current.goals.length > 0 && (
          <div className="mb-6 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-center text-sm text-indigo-700">
            ✨ Create an account and your {pendingDemoDataRef.current.goals.length === 1 ? 'demo quest' : `${pendingDemoDataRef.current.goals.length} demo quests`} will be saved to it.
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email" required
              className="w-full rounded-lg border border-slate-300 p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
              value={authEmail} onChange={e => setAuthEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password" required
              className="w-full rounded-lg border border-slate-300 p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
              value={authPass} onChange={e => setAuthPass(e.target.value)}
            />
          </div>
          <button type="submit" disabled={isLoading} className="w-full rounded-lg bg-indigo-600 py-3 font-bold text-white shadow-lg transition-all hover:bg-indigo-700 hover:shadow-xl disabled:opacity-50">
            {isLoading ? 'Loading...' : (authMode === 'signin' ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-600">
          {authMode === 'signin' ? (
            <p>Don't have an account? <button onClick={() => setAuthMode('signup')} className="font-bold text-indigo-600 hover:underline">Sign Up</button></p>
          ) : (
            <p>Already have an account? <button onClick={() => setAuthMode('signin')} className="font-bold text-indigo-600 hover:underline">Sign In</button></p>
          )}
        </div>
      </div>
    </div>
  ) : null;

  // --- Landing Page (with login modal over a blurred backdrop) ---
  if (!onCanvasRoute && !isPreview) {
    return (
      <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-slate-50">
        {/* Decorative background blobs */}
        <div className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full bg-indigo-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-violet-200/40 blur-3xl" />

        {/* Top bar */}
        <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-lg font-bold text-white shadow-md">L</div>
            <span className="text-lg font-bold text-slate-800">LifePath</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { setAuthMode('signin'); setShowAuthModal(true); }}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-white/70"
            >
              Log in
            </button>
            <button
              onClick={() => { setAuthMode('signup'); setShowAuthModal(true); }}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
            >
              Sign up
            </button>
          </div>
        </header>

        {/* Hero */}
        <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
          <span className="mb-5 inline-flex items-center rounded-full border border-indigo-100 bg-white/70 px-3 py-1 text-xs font-semibold text-indigo-600 shadow-sm">
            ✨ Visual goal planning
          </span>
          <h1 className="max-w-2xl text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            Plan your life goals on a visual timeline
          </h1>
          <p className="mt-4 max-w-lg text-lg text-slate-500">
            Map out quests, break them into milestones, and drag them across a timeline. Try it instantly — no account required.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <button
              onClick={openDemo}
              className="rounded-xl bg-indigo-600 px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 hover:shadow-xl"
            >
              Try it free →
            </button>
            <button
              onClick={() => { setAuthMode('signin'); setShowAuthModal(true); }}
              className="rounded-xl border border-slate-300 bg-white px-7 py-3.5 text-base font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
            >
              Log in
            </button>
          </div>
          <p className="mt-4 text-sm text-slate-400">No sign-up needed to explore the demo.</p>

          {/* Live preview of the demo canvas — click anywhere to open it for real */}
          <div
            role="button"
            tabIndex={0}
            onClick={openDemo}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDemo(); } }}
            aria-label="Open the interactive demo"
            className="group mt-12 w-full max-w-6xl cursor-pointer rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-indigo-600/10 transition-all hover:-translate-y-1 hover:shadow-indigo-600/20 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {/* Browser chrome */}
            <div className="flex items-center gap-1.5 px-3 py-2">
              <span className="h-3 w-3 rounded-full bg-red-400" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-green-400" />
              <span className="ml-3 truncate text-xs text-slate-400">lifepath — your timeline</span>
            </div>
            <div className="relative overflow-hidden rounded-lg border border-slate-100">
              <iframe
                src="/app?preview=1"
                title="LifePath demo preview"
                tabIndex={-1}
                scrolling="no"
                className="pointer-events-none h-[640px] w-full bg-white"
              />
              {/* Hover veil + call to action */}
              <div className="absolute inset-0 flex items-center justify-center bg-indigo-600/0 transition-colors group-hover:bg-indigo-600/5">
                <span className="rounded-full bg-white/95 px-5 py-2.5 text-sm font-bold text-indigo-700 opacity-0 shadow-lg ring-1 ring-indigo-100 transition-opacity group-hover:opacity-100">
                  Open the interactive demo →
                </span>
              </div>
            </div>
          </div>
        </main>

        {authModalEl}
      </div>
    );
  }

  // --- Main App View ---
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white">
      
      {/* --- Demo Banner --- */}
      {isDemoMode && !isPreview && (
        <div className="shrink-0 bg-amber-100 text-amber-800 text-xs font-bold text-center py-1 z-[60] border-b border-amber-200">
          DEMO MODE - Changes will not be saved
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {/* --- Left Sidebar --- */}
        <aside className={`${isSidebarOpen ? 'w-72' : 'w-0'} transition-all duration-300 ease-in-out border-r border-slate-200 flex flex-col bg-slate-50 z-50 shadow-sm relative`}>
          <div className="overflow-hidden shrink-0 border-b border-slate-200 h-28">
             <div className="px-4 border-b border-slate-200 flex items-center justify-between bg-white h-14 box-border">
              <button
                onClick={() => navigate('/')}
                className="font-bold text-xl text-slate-800 flex items-center gap-2 whitespace-nowrap rounded-md hover:opacity-80 transition-opacity"
                title="Back to home"
              >
                <div className="w-7 h-7 bg-indigo-600 rounded-lg text-white flex items-center justify-center text-sm shadow-sm">L</div>
                LifePath
              </button>
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
                 {timelineRows.map((row) => {
                   const isRowSelected = selectedItemId?.type === row.type && selectedItemId.id === row.id;
                   return (
                   <div
                     key={`${row.type}-${row.id}`}
                     style={{ height: ROW_HEIGHT }}
                     className={`flex items-center px-4 transition-colors cursor-pointer border-b group ${row.type === 'goal' ? 'mt-4 first:mt-0' : ''} ${isRowSelected ? 'bg-indigo-50 border-indigo-100' : 'border-transparent hover:bg-white/50 hover:border-slate-100'}`}
                     onClick={() => {
                       if (row.type === 'goal') {
                         openGoal(row.data as Goal);
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
                   );
                 })}
                 <div className="h-32" />
               </div>
          </div>

          {isDemoMode ? (
            <div className="p-4 bg-white border-t border-slate-200 shrink-0">
              <button
                onClick={() => {
                  if (data.goals.length > 0) pendingDemoDataRef.current = data;
                  setAuthMode('signin');
                  setShowAuthModal(true);
                }}
                className="w-full py-2.5 px-4 text-sm font-bold rounded-lg transition-all bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 hover:shadow-xl"
                title="Sign in to save your data"
              >
                Sign In to Save
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
                          isDemoMode ? requestExitDemo() : handleLogout();
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
             <div ref={canvasContentRef} className="min-w-full relative min-h-full flex flex-col" style={{ width: ppx(timelineDays) }}>
                
                {/* Sticky Header */}
                <div className="sticky top-0 z-30 bg-white border-b border-slate-200 h-28 shrink-0 shadow-sm">
                   <div className="absolute inset-0 overflow-hidden">
                       <div className="h-16 border-b border-slate-100 bg-slate-50/30 relative">
                         {unifiedMilestones.map((m, idx) => {
                           const left = ppx(dayOffsetOf(m.dateObj) + 0.5);
                           const topPos = MILESTONE_TOP_POSITION;
                           return (
                             <div 
                                key={m.id}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  const dragType = m.isGlobal ? 'global-milestone-move' : 'milestone-move';
                                  startDrag({ type: dragType, itemId: m.id, parentId: m.parentId || undefined, startX: e.clientX, originalData: {...m} }, e);
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedItemId({ type: 'milestone', id: m.id, parentId: m.parentId || undefined });
                                  setIsDrawerOpen(true);
                                }}
                                className="absolute flex flex-col items-center group cursor-pointer z-30 hover:z-40"
                                style={{ left, top: `${topPos}px`, transform: 'translateX(-50%)' }}
                             >
                               <div className="w-3 h-3 rotate-45 border-2 border-white shadow-md group-hover:scale-125 transition-transform mb-1" style={{ backgroundColor: m.displayColor }} />
                               <span className="text-[10px] font-bold text-slate-600 whitespace-nowrap px-1.5 py-0.5 rounded bg-white/80 backdrop-blur-sm border border-slate-100 shadow-sm opacity-90 group-hover:opacity-100">
                                 {m.title}
                               </span>
                             </div>
                           )
                         })}
                         
                         {/* TODAY Marker in Header */}
                         <div className="absolute top-0 bottom-0 z-20 pointer-events-none" style={{ left: ppx(todayOffset) }}>
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
                   <div className="absolute top-0 bottom-0 z-0 pointer-events-none" style={{ left: ppx(todayOffset) }}>
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
                                  const startOffset = dayOffsetOf(g.startDate);
                                  const spanDays = Math.max(dayOffsetOf(g.endDate) - startOffset, 1);
                                  const isMoving = dragState?.type === 'goal-move' && dragState.itemId === g.id;
                                  const isSelected = selectedItemId?.type === 'goal' && selectedItemId.id === g.id;
                                  return (
                                    <div
                                      className={`h-9 absolute top-1.5 rounded-md flex items-center px-3 cursor-move select-none transition-shadow ${isSelected ? 'z-20' : 'shadow-sm ring-1 ring-transparent hover:ring-black/5 active:ring-2 active:ring-offset-1 z-10'}`}
                                      style={{
                                        left: ppx(startOffset),
                                        width: ppx(spanDays),
                                        backgroundColor: g.color + '20',
                                        borderColor: g.color,
                                        borderWidth: '1px',
                                        borderStyle: 'solid',
                                        color: g.color,
                                        ...(isSelected ? { boxShadow: `0 0 0 2px #fff, 0 0 0 3px ${g.color}` } : {}),
                                      }}
                                      onMouseDown={(e) => {
                                         if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
                                         e.preventDefault();
                                         startDrag({ type: 'goal-move', itemId: g.id, startX: e.clientX, originalData: {...g} }, e);
                                      }}
                                      onClick={() => openGoal(g)}
                                    >
                                       {isMoving && (
                                         <div className="absolute -top-9 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap rounded-md bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-lg ring-1 ring-black/10 pointer-events-none">
                                           {formatTooltipDate(g.startDate)} <span className="text-slate-400">→</span> {formatTooltipDate(g.endDate)}
                                         </div>
                                       )}
                                       <Handle type="start" onDragStart={(e) => startDrag({ type: 'goal-resize-start', itemId: g.id, startX: e.clientX, originalData: {...g} }, e)} />
                                       <span className="text-xs font-bold truncate w-full px-1 select-none">{g.title}</span>
                                       <Handle type="end" onDragStart={(e) => startDrag({ type: 'goal-resize-end', itemId: g.id, startX: e.clientX, originalData: {...g} }, e)} />
                                    </div>
                                  )
                                })()
                             ) : (
                                (() => {
                                  const s = row.data as Subtask;
                                  const g = data.goals.find(goal => goal.id === row.parentId);
                                  if (!g) return null;
                                  const startOffset = dayOffsetOf(g.startDate) + s.startOffsetDays;
                                  const spanDays = Math.max(s.durationDays, 1);
                                  const isEditing = editingSubtask?.id === s.id;
                                  const isSelected = isEditing || (selectedItemId?.type === 'subtask' && selectedItemId.id === s.id);
                                  const isMoving = (dragState?.type === 'subtask-move' || dragState?.type === 'subtask-resize-end') && dragState.itemId === s.id;
                                  const sStartDate = addDays(parseLocalDate(g.startDate), s.startOffsetDays);
                                  const sEndDate = addDays(sStartDate, s.durationDays);
                                  return (
                                    <div
                                      className={`h-7 absolute top-2.5 rounded border flex items-center px-2 text-[11px] text-slate-600 cursor-pointer transition-[border-color,box-shadow] bg-white ${isSelected ? 'z-20' : 'shadow-sm hover:border-indigo-300 hover:shadow-md z-10'}`}
                                      style={{ left: ppx(startOffset), width: ppx(spanDays), borderColor: s.status === Status.DONE ? '#10b981' : '#e2e8f0', opacity: s.status === Status.DONE ? 0.6 : 1, ...(isSelected ? { boxShadow: `0 0 0 2px #fff, 0 0 0 3px ${g.color}` } : {}) }}
                                      onMouseDown={(e) => {
                                          if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
                                          e.preventDefault();
                                          startDrag({ type: 'subtask-move', itemId: s.id, parentId: g.id, startX: e.clientX, originalData: {...s} }, e);
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (editingSubtask?.id === s.id) return;
                                        // Defer so a double-click (inline edit) can cancel it.
                                        if (subtaskClickTimerRef.current) window.clearTimeout(subtaskClickTimerRef.current);
                                        subtaskClickTimerRef.current = window.setTimeout(() => {
                                          subtaskClickTimerRef.current = null;
                                          setSelectedItemId({type: 'subtask', id: s.id, parentId: g.id});
                                          setIsDrawerOpen(true);
                                        }, 200);
                                      }}
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        if (subtaskClickTimerRef.current) { window.clearTimeout(subtaskClickTimerRef.current); subtaskClickTimerRef.current = null; }
                                        setEditingSubtask({ id: s.id, parentId: g.id, value: s.title });
                                      }}
                                    >
                                      {isMoving && (
                                        <div className="absolute -top-9 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap rounded-md bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-lg ring-1 ring-black/10 pointer-events-none">
                                          {formatTooltipDate(formatDate(sStartDate))} <span className="text-slate-400">→</span> {formatTooltipDate(formatDate(sEndDate))}
                                        </div>
                                      )}
                                      {editingSubtask?.id === s.id ? (
                                        <input
                                          autoFocus
                                          value={editingSubtask.value}
                                          onChange={(e) => setEditingSubtask(prev => prev && { ...prev, value: e.target.value })}
                                          onFocus={(e) => e.target.select()}
                                          onMouseDown={(e) => e.stopPropagation()}
                                          onClick={(e) => e.stopPropagation()}
                                          onBlur={commitSubtaskEdit}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') { e.preventDefault(); commitSubtaskEdit(); }
                                            else if (e.key === 'Escape') { e.preventDefault(); setEditingSubtask(null); }
                                          }}
                                          className="w-full min-w-0 bg-transparent outline-none text-[11px] font-medium text-slate-700"
                                        />
                                      ) : (
                                        <span className={`truncate font-medium select-none ${s.status === Status.DONE ? 'line-through' : ''}`}>{s.title}</span>
                                      )}
                                      <Handle type="end" onDragStart={(e) => startDrag({ type: 'subtask-resize-end', itemId: s.id, parentId: g.id, startX: e.clientX, originalData: {...s} }, e)} />
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
          <div ref={drawerRef} className="w-full drawer-animated md:flex-shrink-0 h-[50vh] md:h-full bg-white shadow-2xl z-50 md:border-l border-t md:border-t-0 border-slate-200 flex flex-col overflow-y-auto md:overflow-x-hidden absolute md:static bottom-0 right-0 left-0 rounded-t-2xl md:rounded-none animate-slide-in-bottom md:animate-drawer-in">
             <div className="w-full md:w-80 p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h2 className="font-bold text-slate-800">Edit {selectedItemId?.type}</h2>
                <button onClick={() => setIsDrawerOpen(false)} className="p-1 hover:bg-slate-200 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
             </div>
             <div className="w-full md:w-80 p-5 space-y-6">
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

                      {/* Subtasks */}
                      <div>
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
                      <div>
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

                      <GoalNotes
                        goal={goal}
                        onUpdate={(updated) => setData({...data, goals: data.goals.map(g => g.id === goal.id ? updated : g)})}
                        isDemoMode={isDemoMode}
                      />

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
               <button onClick={() => { setIsCreateModalOpen(false); setQuestCategoryTouched(false); }} className="p-1 hover:bg-slate-200 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
             </div>
             <div className="p-6">
                <form onSubmit={handleCreateGoal} className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Goal Title</label>
                    <div className="flex gap-2">
                      <input name="title" className="flex-1 border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. Learn French" required value={aiPrompt} onChange={(e) => {
                        setAiPrompt(e.target.value);
                        if (!questCategoryTouched) setQuestCategory(inferCategory(e.target.value));
                      }} />
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
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full pointer-events-none" style={{ backgroundColor: CATEGORY_COLORS.find(c => c.name === questCategory)?.hex }} />
                      <select
                        name="category"
                        value={questCategory}
                        onChange={(e) => { setQuestCategory(e.target.value); setQuestCategoryTouched(true); }}
                        className="w-full border border-slate-300 rounded-lg p-2.5 pl-8 outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {CATEGORY_COLORS.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                    <button type="button" onClick={() => { setIsCreateModalOpen(false); setQuestCategoryTouched(false); }} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Cancel</button>
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

      {/* Login / sign-up over the (blurred) canvas, e.g. when saving a demo plan */}
      {authModalEl}

      {/* --- Save-your-demo-plan Modal --- */}
      {showSaveDemoModal && (
        <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <h2 className="text-lg font-bold text-slate-800">Before you go — keep your plan</h2>
              <p className="text-sm text-slate-500 mt-1">
                You're in demo mode, so this {data.goals.length === 1 ? 'quest' : `${data.goals.length} quests`} won't be saved. Create an account to carry it over, or download a calendar file.
              </p>
              <div className="mt-6 space-y-2.5">
                <button
                  onClick={saveDemoViaSignup}
                  className="w-full py-2.5 px-4 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-sm hover:shadow transition-all"
                >
                  Sign up &amp; save my plan
                </button>
                <button
                  onClick={() => exportICS()}
                  className="w-full py-2.5 px-4 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-all"
                >
                  Download .ics calendar
                </button>
              </div>
              <button
                onClick={() => setShowSaveDemoModal(false)}
                className="w-full mt-3 py-2 text-sm text-slate-500 hover:text-slate-700 font-medium"
              >
                Keep exploring
              </button>
            </div>
          </div>
        </div>
      )}
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
