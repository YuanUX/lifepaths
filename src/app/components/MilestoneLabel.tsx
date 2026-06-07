import React from 'react';

interface MilestoneLabelProps {
  title: string;
  milestoneX: number;
  todayX: number;
}

export function MilestoneLabel({ title, milestoneX, todayX }: MilestoneLabelProps) {
  // Calculate distance from TODAY marker to avoid overlap
  const distanceFromToday = Math.abs(milestoneX - todayX);
  const isNearToday = distanceFromToday < 60; // If within 60px of TODAY marker
  const isLeftOfToday = milestoneX < todayX;
  
  // Adjust positioning if near TODAY marker
  let transformStyle = 'translateX(-50%)'; // Default: centered
  if (isNearToday) {
    transformStyle = isLeftOfToday ? 'translateX(-100%) translateX(-8px)' : 'translateX(8px)';
  }
  
  return (
    <span 
      className="text-[10px] font-bold text-slate-600 whitespace-nowrap px-1.5 py-0.5 rounded bg-white/80 backdrop-blur-sm border border-slate-100 shadow-sm opacity-90 group-hover:opacity-100"
      style={{ transform: transformStyle }}
    >
      {title}
    </span>
  );
}
