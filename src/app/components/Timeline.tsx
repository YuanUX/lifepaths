import React, { useState, useRef, useEffect } from 'react';
import { Goal, Subtask, LifeMilestone, GoalMilestone, GoalStatus } from '../types';
import { getTimelinePosition, getDateFromPosition, getDaysDifference, addDays } from '../lib/utils';
import { MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Button } from './ui/button';

const ROW_HEIGHT = 52;
const TIMELINE_TOP_OFFSET = 80; // Space for milestone track + month/day headers
const DAY_WIDTH = 24;
const MONTH_HEADER_HEIGHT = 30;
const DAY_HEADER_HEIGHT = 24;

interface TimelineProps {
  goals: Goal[];
  lifeMilestones: LifeMilestone[];
  expandedGoals: Set<string>;
  selectedItemId: string | null;
  onSelectItem: (id: string, type: 'goal' | 'subtask' | 'life-milestone' | 'goal-milestone') => void;
  onUpdateGoalDates: (goalId: string, startDate: Date, endDate: Date) => void;
  onUpdateSubtaskDates: (subtaskId: string, goalId: string, startOffsetDays: number, durationDays: number) => void;
  onUpdateStatus: (id: string, status: GoalStatus, type: 'goal' | 'subtask') => void;
  onAddSubtask: (goalId: string) => void;
  onAddMilestone: (goalId: string) => void;
  onDeleteItem: (id: string, type: 'goal' | 'subtask') => void;
}

export function Timeline({
  goals,
  lifeMilestones,
  expandedGoals,
  selectedItemId,
  onSelectItem,
  onUpdateGoalDates,
  onUpdateSubtaskDates,
  onUpdateStatus,
  onAddSubtask,
  onAddMilestone,
  onDeleteItem,
}: TimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{
    id: string;
    type: 'goal' | 'subtask';
    mode: 'move' | 'resize-start' | 'resize-end';
    startX: number;
    originalStart: Date;
    originalEnd: Date;
    goalId?: string;
  } | null>(null);

  // Calculate timeline bounds
  const getTimelineBounds = () => {
    const today = new Date();
    const allDates: Date[] = [today];
    
    goals.forEach(goal => {
      allDates.push(goal.startDate, goal.endDate);
      goal.subtasks.forEach(subtask => {
        const start = addDays(goal.startDate, subtask.startOffsetDays);
        const end = addDays(start, subtask.durationDays);
        allDates.push(start, end);
      });
    });
    
    lifeMilestones.forEach(m => allDates.push(m.date));
    
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    
    // Add padding
    minDate.setDate(minDate.getDate() - 30);
    maxDate.setDate(maxDate.getDate() + 90);
    
    return { minDate, maxDate };
  };

  const { minDate, maxDate } = getTimelineBounds();
  const totalDays = getDaysDifference(minDate, maxDate);
  const timelineWidth = totalDays * DAY_WIDTH;

  // Generate timeline items with row indices
  const timelineItems: Array<{
    id: string;
    type: 'goal' | 'subtask';
    rowIndex: number;
    data: Goal | Subtask;
    goalId?: string;
  }> = [];

  let currentRowIndex = 0;
  goals.forEach(goal => {
    timelineItems.push({
      id: goal.id,
      type: 'goal',
      rowIndex: currentRowIndex,
      data: goal,
    });
    currentRowIndex++;

    if (expandedGoals.has(goal.id)) {
      goal.subtasks.forEach(subtask => {
        timelineItems.push({
          id: subtask.id,
          type: 'subtask',
          rowIndex: currentRowIndex,
          data: subtask,
          goalId: goal.id,
        });
        currentRowIndex++;
      });
    }
  });

  const totalHeight = TIMELINE_TOP_OFFSET + (currentRowIndex * ROW_HEIGHT) + 100;

  // Generate months and days
  const generateMonths = () => {
    const months: Array<{ label: string; x: number; width: number }> = [];
    const current = new Date(minDate);
    
    while (current <= maxDate) {
      const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
      
      const startX = getTimelinePosition(monthStart, minDate, DAY_WIDTH);
      const endX = getTimelinePosition(monthEnd, minDate, DAY_WIDTH);
      
      months.push({
        label: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        x: Math.max(0, startX),
        width: endX - startX + DAY_WIDTH,
      });
      
      current.setMonth(current.getMonth() + 1);
    }
    
    return months;
  };

  const generateDays = () => {
    const days: Array<{ label: string; x: number }> = [];
    const current = new Date(minDate);
    
    for (let i = 0; i < totalDays; i++) {
      const x = i * DAY_WIDTH;
      const day = current.getDate();
      
      // Show day numbers for 1st, 5th, 10th, 15th, 20th, 25th
      if ([1, 5, 10, 15, 20, 25].includes(day)) {
        days.push({ label: day.toString(), x });
      }
      
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  };

  const months = generateMonths();
  const days = generateDays();

  // Mouse handlers for drag and resize
  const handleMouseDown = (
    e: React.MouseEvent,
    id: string,
    type: 'goal' | 'subtask',
    mode: 'move' | 'resize-start' | 'resize-end',
    startDate: Date,
    endDate: Date,
    goalId?: string
  ) => {
    e.stopPropagation();
    setDragging({
      id,
      type,
      mode,
      startX: e.clientX,
      originalStart: startDate,
      originalEnd: endDate,
      goalId,
    });
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current) return;

      const deltaX = e.clientX - dragging.startX;
      const deltaDays = Math.round(deltaX / DAY_WIDTH);

      if (dragging.mode === 'move') {
        const newStart = addDays(dragging.originalStart, deltaDays);
        const newEnd = addDays(dragging.originalEnd, deltaDays);
        
        // Update preview (you could add visual feedback here)
      } else if (dragging.mode === 'resize-start') {
        const newStart = addDays(dragging.originalStart, deltaDays);
        // Prevent start from going past end
        if (newStart < dragging.originalEnd) {
          // Update preview
        }
      } else if (dragging.mode === 'resize-end') {
        const newEnd = addDays(dragging.originalEnd, deltaDays);
        // Prevent end from going before start
        if (newEnd > dragging.originalStart) {
          // Update preview
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!dragging) return;

      const deltaX = e.clientX - dragging.startX;
      const deltaDays = Math.round(deltaX / DAY_WIDTH);

      if (dragging.type === 'goal') {
        if (dragging.mode === 'move') {
          const newStart = addDays(dragging.originalStart, deltaDays);
          const newEnd = addDays(dragging.originalEnd, deltaDays);
          onUpdateGoalDates(dragging.id, newStart, newEnd);
        } else if (dragging.mode === 'resize-start') {
          const newStart = addDays(dragging.originalStart, deltaDays);
          if (newStart < dragging.originalEnd) {
            onUpdateGoalDates(dragging.id, newStart, dragging.originalEnd);
          }
        } else if (dragging.mode === 'resize-end') {
          const newEnd = addDays(dragging.originalEnd, deltaDays);
          if (newEnd > dragging.originalStart) {
            onUpdateGoalDates(dragging.id, dragging.originalStart, newEnd);
          }
        }
      } else if (dragging.type === 'subtask' && dragging.goalId) {
        const goal = goals.find(g => g.id === dragging.goalId);
        if (!goal) return;
        
        const subtask = goal.subtasks.find(s => s.id === dragging.id);
        if (!subtask) return;

        if (dragging.mode === 'move') {
          const newStartOffset = subtask.startOffsetDays + deltaDays;
          onUpdateSubtaskDates(dragging.id, dragging.goalId, Math.max(0, newStartOffset), subtask.durationDays);
        } else if (dragging.mode === 'resize-start') {
          const newStartOffset = subtask.startOffsetDays + deltaDays;
          const newDuration = subtask.durationDays - deltaDays;
          if (newDuration > 0) {
            onUpdateSubtaskDates(dragging.id, dragging.goalId, Math.max(0, newStartOffset), newDuration);
          }
        } else if (dragging.mode === 'resize-end') {
          const newDuration = subtask.durationDays + deltaDays;
          if (newDuration > 0) {
            onUpdateSubtaskDates(dragging.id, dragging.goalId, subtask.startOffsetDays, newDuration);
          }
        }
      }

      setDragging(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, goals, onUpdateGoalDates, onUpdateSubtaskDates]);

  const renderTimelineBar = (item: typeof timelineItems[0]) => {
    let startDate: Date;
    let endDate: Date;
    let title: string;
    let color: string;
    let status: GoalStatus;

    if (item.type === 'goal') {
      const goal = item.data as Goal;
      startDate = goal.startDate;
      endDate = goal.endDate;
      title = goal.title;
      color = goal.color;
      status = goal.status;
    } else {
      const subtask = item.data as Subtask;
      const goal = goals.find(g => g.id === item.goalId)!;
      startDate = addDays(goal.startDate, subtask.startOffsetDays);
      endDate = addDays(startDate, subtask.durationDays);
      title = subtask.title;
      color = goal.color;
      status = subtask.status;
    }

    const x = getTimelinePosition(startDate, minDate, DAY_WIDTH);
    const width = getTimelinePosition(endDate, minDate, DAY_WIDTH) - x;
    const y = TIMELINE_TOP_OFFSET + (item.rowIndex * ROW_HEIGHT);

    const isSelected = selectedItemId === item.id;
    const opacity = status === 'completed' ? 0.6 : 1;

    return (
      <g key={item.id}>
        {/* Timeline bar */}
        <rect
          x={x}
          y={y + 12}
          width={width}
          height={28}
          rx={6}
          fill={color}
          opacity={opacity}
          stroke={isSelected ? '#000' : 'none'}
          strokeWidth={isSelected ? 2 : 0}
          className="cursor-move hover:brightness-90 transition-all"
          onMouseDown={(e) => handleMouseDown(e, item.id, item.type, 'move', startDate, endDate, item.goalId)}
          onClick={(e) => {
            if (e.detail === 1) {
              setTimeout(() => {
                if (!dragging) {
                  onSelectItem(item.id, item.type);
                }
              }, 200);
            }
          }}
        />
        
        {/* Resize handle - start */}
        <rect
          x={x}
          y={y + 12}
          width={8}
          height={28}
          fill="rgba(0,0,0,0.2)"
          className="cursor-ew-resize hover:fill-black/40"
          onMouseDown={(e) => handleMouseDown(e, item.id, item.type, 'resize-start', startDate, endDate, item.goalId)}
        />
        
        {/* Resize handle - end */}
        <rect
          x={x + width - 8}
          y={y + 12}
          width={8}
          height={28}
          fill="rgba(0,0,0,0.2)"
          className="cursor-ew-resize hover:fill-black/40"
          onMouseDown={(e) => handleMouseDown(e, item.id, item.type, 'resize-end', startDate, endDate, item.goalId)}
        />

        {/* Title */}
        <text
          x={x + 12}
          y={y + 31}
          fill="white"
          fontSize="13"
          fontWeight="500"
          className="pointer-events-none select-none"
        >
          {title}
        </text>

        {/* Action menu */}
        <foreignObject
          x={x + width - 28}
          y={y + 14}
          width={24}
          height={24}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 bg-black/20 hover:bg-black/40"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-3 h-3 text-white" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onUpdateStatus(item.id, 'completed', item.type)}>
                Mark Complete
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onUpdateStatus(item.id, 'in-progress', item.type)}>
                Mark In Progress
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onUpdateStatus(item.id, 'todo', item.type)}>
                Mark To Do
              </DropdownMenuItem>
              {item.type === 'goal' && (
                <>
                  <DropdownMenuItem onClick={() => onAddSubtask(item.id)}>
                    Add Subtask
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem
                onClick={() => onDeleteItem(item.id, item.type)}
                className="text-destructive"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </foreignObject>
      </g>
    );
  };

  const renderGoalMilestones = () => {
    const elements: JSX.Element[] = [];
    
    goals.forEach((goal, goalIndex) => {
      const goalRowIndex = timelineItems.find(item => item.id === goal.id)?.rowIndex;
      if (goalRowIndex === undefined) return;

      goal.milestones.forEach(milestone => {
        const milestoneDate = addDays(goal.startDate, milestone.dateOffset);
        const x = getTimelinePosition(milestoneDate, minDate, DAY_WIDTH);
        const y = TIMELINE_TOP_OFFSET + (goalRowIndex * ROW_HEIGHT) + 26;

        elements.push(
          <g key={milestone.id}>
            {/* Diamond shape */}
            <rect
              x={x - 6}
              y={y - 6}
              width={12}
              height={12}
              fill={milestone.isCompleted ? '#22c55e' : goal.color}
              transform={`rotate(45 ${x} ${y})`}
              className="cursor-pointer hover:scale-110 transition-transform"
              onClick={() => onSelectItem(milestone.id, 'goal-milestone')}
            />
            {/* Tooltip on hover */}
            <title>{milestone.title}</title>
          </g>
        );
      });
    });

    return elements;
  };

  const renderLifeMilestones = () => {
    return lifeMilestones.map(milestone => {
      const x = getTimelinePosition(milestone.date, minDate, DAY_WIDTH);

      return (
        <g key={milestone.id}>
          {/* Vertical dotted line */}
          <line
            x1={x}
            y1={30}
            x2={x}
            y2={totalHeight}
            stroke="#a855f7"
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.5}
          />
          
          {/* Diamond */}
          <rect
            x={x - 8}
            y={14}
            width={16}
            height={16}
            fill={milestone.isCompleted ? '#22c55e' : '#a855f7'}
            transform={`rotate(45 ${x} 22)`}
            className="cursor-pointer hover:scale-110 transition-transform"
            onClick={() => onSelectItem(milestone.id, 'life-milestone')}
          />
          
          {/* Label */}
          <text
            x={x}
            y={8}
            fill="currentColor"
            fontSize="11"
            fontWeight="500"
            textAnchor="middle"
            className="pointer-events-none"
          >
            {milestone.title}
          </text>
        </g>
      );
    });
  };

  const renderTodayMarker = () => {
    const today = new Date();
    const x = getTimelinePosition(today, minDate, DAY_WIDTH);

    return (
      <g>
        {/* Vertical line */}
        <line
          x1={x}
          y1={30}
          x2={x}
          y2={totalHeight}
          stroke="#a855f7"
          strokeWidth={2}
          strokeDasharray="4 4"
        />
        
        {/* Diamond at top */}
        <rect
          x={x - 8}
          y={14}
          width={16}
          height={16}
          fill="#a855f7"
          transform={`rotate(45 ${x} 22)`}
        />
        
        {/* TODAY label */}
        <text
          x={x}
          y={8}
          fill="#a855f7"
          fontSize="11"
          fontWeight="600"
          textAnchor="middle"
        >
          TODAY
        </text>
      </g>
    );
  };

  return (
    <div ref={timelineRef} className="flex-1 overflow-auto custom-scrollbar bg-background">
      <svg width={timelineWidth} height={totalHeight}>
        {/* Row backgrounds (zebra stripes) */}
        {timelineItems.map((item, idx) => (
          <rect
            key={`bg-${item.id}`}
            x={0}
            y={TIMELINE_TOP_OFFSET + (item.rowIndex * ROW_HEIGHT)}
            width={timelineWidth}
            height={ROW_HEIGHT}
            fill={item.rowIndex % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)'}
          />
        ))}

        {/* Month headers */}
        {months.map((month, i) => (
          <g key={i}>
            <rect
              x={month.x}
              y={0}
              width={month.width}
              height={MONTH_HEADER_HEIGHT}
              fill="hsl(var(--muted))"
              stroke="hsl(var(--border))"
              strokeWidth={1}
            />
            <text
              x={month.x + month.width / 2}
              y={20}
              fill="currentColor"
              fontSize="13"
              fontWeight="600"
              textAnchor="middle"
            >
              {month.label}
            </text>
          </g>
        ))}

        {/* Day labels */}
        {days.map((day, i) => (
          <text
            key={i}
            x={day.x + DAY_WIDTH / 2}
            y={MONTH_HEADER_HEIGHT + 18}
            fill="hsl(var(--muted-foreground))"
            fontSize="11"
            textAnchor="middle"
          >
            {day.label}
          </text>
        ))}

        {/* Grid lines */}
        {Array.from({ length: totalDays }).map((_, i) => (
          <line
            key={i}
            x1={i * DAY_WIDTH}
            y1={MONTH_HEADER_HEIGHT + DAY_HEADER_HEIGHT}
            x2={i * DAY_WIDTH}
            y2={totalHeight}
            stroke="hsl(var(--border))"
            strokeWidth={i % 5 === 0 ? 1 : 0.5}
            opacity={i % 5 === 0 ? 0.3 : 0.15}
          />
        ))}

        {/* Today marker */}
        {renderTodayMarker()}

        {/* Life milestones */}
        {renderLifeMilestones()}

        {/* Timeline bars */}
        {timelineItems.map(renderTimelineBar)}

        {/* Goal milestones */}
        {renderGoalMilestones()}
      </svg>
    </div>
  );
}