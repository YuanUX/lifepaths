import React from 'react';
import { Goal, Subtask, Status, DragState } from '../types';
import { Handle } from './Handle';

interface TimelineRowData {
  id: string;
  type: 'goal' | 'subtask' | 'add-subtask';
  data: Goal | Subtask;
  parentId?: string;
}

interface TimelineRowProps {
  row: TimelineRowData;
  ROW_HEIGHT: number;
  pxPerDay: number;
  dateToPx: (date: string | Date) => number;
  goals: Goal[];
  setDragState: (state: DragState | null) => void;
  setSelectedItemId: (id: { type: 'goal' | 'subtask'; id: string; parentId?: string }) => void;
  setIsDrawerOpen: (open: boolean) => void;
}

export function TimelineRow({
  row,
  ROW_HEIGHT,
  pxPerDay,
  dateToPx,
  goals,
  setDragState,
  setSelectedItemId,
  setIsDrawerOpen
}: TimelineRowProps) {
  const isGoal = row.type === 'goal';
  const isAddSubtask = row.type === 'add-subtask';

  // Don't render timeline bars for 'add-subtask' rows
  if (isAddSubtask) {
    return (
      <div style={{ height: ROW_HEIGHT }} className="relative w-full">
        <div className="absolute inset-x-0 bottom-0 border-b border-slate-50" />
      </div>
    );
  }

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
                setDragState({ type: 'goal-move', itemId: g.id, startX: e.clientX, originalData: {...g} });
              }}
              onClick={() => { setSelectedItemId({type: 'goal', id: g.id}); setIsDrawerOpen(true); }}
            >
              <Handle type="start" onDragStart={(e) => setDragState({ type: 'goal-resize-start', itemId: g.id, startX: e.clientX, originalData: {...g} })} />
              <span className="text-xs font-bold truncate w-full px-1 select-none">{g.title}</span>
              <Handle type="end" onDragStart={(e) => setDragState({ type: 'goal-resize-end', itemId: g.id, startX: e.clientX, originalData: {...g} })} />
            </div>
          );
        })()
      ) : (
        (() => {
          const s = row.data as Subtask;
          const g = goals.find(goal => goal.id === row.parentId);
          if (!g) return null;
          const startPx = dateToPx(g.startDate) + (s.startOffsetDays * pxPerDay);
          const width = s.durationDays * pxPerDay;
          return (
            <div 
              className="h-7 absolute top-2.5 rounded border shadow-sm flex items-center px-2 text-[11px] text-slate-600 cursor-pointer transition-all hover:border-indigo-300 hover:shadow-md bg-white z-10"
              style={{ left: startPx, width: Math.max(width, pxPerDay), borderColor: s.status === Status.DONE ? '#10b981' : '#e2e8f0', opacity: s.status === Status.DONE ? 0.6 : 1 }}
              onMouseDown={(e) => {
                if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
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
          );
        })()
      )}
    </div>
  );
}
