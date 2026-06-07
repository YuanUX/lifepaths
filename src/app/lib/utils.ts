import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Goal, Subtask, GoalMilestone, LifeMilestone } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Date utilities
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function parseDate(dateString: string): Date {
  return new Date(dateString);
}

export function getDaysDifference(start: Date, end: Date): number {
  const diffTime = end.getTime() - start.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Timeline calculations
export function getTimelinePosition(date: Date, timelineStart: Date, dayWidth: number): number {
  const days = getDaysDifference(timelineStart, date);
  return days * dayWidth;
}

export function getDateFromPosition(position: number, timelineStart: Date, dayWidth: number): Date {
  const days = Math.round(position / dayWidth);
  return addDays(timelineStart, days);
}

// ICS Export
export function generateICS(goals: Goal[], lifeMilestones: LifeMilestone[]): string {
  const events: string[] = [];
  
  // Add goals
  goals.forEach(goal => {
    events.push(createICSEvent(
      goal.title,
      goal.startDate,
      goal.endDate,
      `Category: ${goal.category}\nStatus: ${goal.status}`
    ));
    
    // Add subtasks
    goal.subtasks.forEach(subtask => {
      const start = addDays(goal.startDate, subtask.startOffsetDays);
      const end = addDays(start, subtask.durationDays);
      events.push(createICSEvent(
        `${goal.title} - ${subtask.title}`,
        start,
        end,
        `Status: ${subtask.status}`
      ));
    });
    
    // Add goal milestones
    goal.milestones.forEach(milestone => {
      const date = addDays(goal.startDate, milestone.dateOffset);
      events.push(createICSEvent(
        `Milestone: ${milestone.title}`,
        date,
        date,
        `Goal: ${goal.title}\nCompleted: ${milestone.isCompleted}`
      ));
    });
  });
  
  // Add life milestones
  lifeMilestones.forEach(milestone => {
    events.push(createICSEvent(
      milestone.title,
      milestone.date,
      milestone.date,
      `Life Milestone\nCompleted: ${milestone.isCompleted}`
    ));
  });
  
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//LifePath//EN
CALSCALE:GREGORIAN
${events.join('\n')}
END:VCALENDAR`;
}

function createICSEvent(title: string, start: Date, end: Date, description: string): string {
  const formatICSDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };
  
  return `BEGIN:VEVENT
UID:${Date.now()}-${Math.random().toString(36).substr(2, 9)}@lifepath.app
DTSTAMP:${formatICSDate(new Date())}
DTSTART:${formatICSDate(start)}
DTEND:${formatICSDate(end)}
SUMMARY:${title}
DESCRIPTION:${description.replace(/\n/g, '\\n')}
END:VEVENT`;
}

export function downloadICS(content: string, filename: string = 'life_path.ics') {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
