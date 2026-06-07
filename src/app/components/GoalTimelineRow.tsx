import React from 'react';
import { Goal, GoalMilestone, DragState } from '../types';

interface Handle {
  type: 'start' | 'end';
  onDragStart: (e: React.MouseEvent) => void;
}

const Handle = ({ type, onDragStart }: Handle) => (
  <div
    className="resize-handle absolute top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 z-20"
    style={{ [type === 'start' ? 'left' : 'right']: 0 }}
    onMouseDown={onDragStart}
  />
);

interface GoalTimelineRowProps {
  goal: Goal;
  startPx: number;
  endPx: number;
  pxPerDay: number;
  dateToPx: (date: string | Date) => number;
  onMoveStart: () => void;
  onResizeStartHandle: () => void;
  onResizeEndHandle: () => void;
  onMilestoneMove: (milestoneId: string, e: React.MouseEvent, milestone: GoalMilestone) => void;
  onMilestoneClick: (milestoneId: string, e: React.MouseEvent) => void;
  onGoalClick: () => void;
}

export function GoalTimelineRow({
  goal,
  startPx,
  endPx,
  pxPerDay,
  dateToPx,
  onMoveStart,
  onResizeStartHandle,
  onResizeEndHandle,
  onMilestoneMove,
  onMilestoneClick,
  onGoalClick
}: GoalTimelineRowProps) {
  const width = Math.max(endPx - startPx, pxPerDay);

  return (
    <>
      <div 
        className="h-9 absolute top-1.5 rounded-md shadow-sm flex items-center px-3 cursor-move select-none ring-1 ring-transparent hover:ring-black/5 transition-all active:ring-2 active:ring-offset-1 z-10"
        style={{ 
          left: startPx, 
          width, 
          backgroundColor: goal.color + '20', 
          borderColor: goal.color, 
          borderWidth: '1px', 
          borderStyle: 'solid', 
          color: goal.color 
        }}
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
          onMoveStart();
        }}
        onClick={onGoalClick}
      >
        <Handle type="start" onDragStart={onResizeStartHandle} />
        <span className="text-xs font-bold truncate w-full px-1 select-none">{goal.title}</span>
        <Handle type="end" onDragStart={onResizeEndHandle} />
      </div>
      
      {/* Render goal-specific milestones on this row */}
      {goal.milestones.map(m => {
        const milestonePx = dateToPx(m.date);
        return (
          <div
            key={m.id}
            className="absolute top-1/2 -translate-y-1/2 group cursor-pointer z-20"
            style={{ left: `${milestonePx}px`, transform: 'translateX(-50%) translateY(-50%)' }}
            onMouseDown={(e) => {
              e.stopPropagation();
              onMilestoneMove(m.id, e, m);
            }}
            onClick={(e) => {
              e.stopPropagation();
              onMilestoneClick(m.id, e);
            }}
          >
            <div 
              className="w-3 h-3 rotate-45 border-2 border-white shadow-md group-hover:scale-125 transition-transform" 
              style={{ backgroundColor: m.color || goal.color }}
            />
          </div>
        );
      })}
    </>
  );
}
