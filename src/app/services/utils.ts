import { Goal, GlobalMilestone } from '../types';

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const diffDays = (date1: Date, date2: Date): number => {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((date1.getTime() - date2.getTime()) / oneDay);
};

export const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const generateId = (): string => {
  // Generate a proper UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const startOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

export const parseLocalDate = (dateString: string): Date => {
  // Parse YYYY-MM-DD as local date, not UTC
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const getLevelInfo = (xp: number, currentLevel: number, currentThreshold: number) => {
  if (xp >= currentThreshold) {
    const newLevel = currentLevel + 1;
    const newThreshold = Math.floor(currentThreshold * 1.5);
    return { newLevel, newXp: xp, newThreshold };
  }
  return null;
};

export const CATEGORY_COLORS = [
  { name: 'Career', hex: '#3b82f6' },
  { name: 'Health', hex: '#10b981' },
  { name: 'Learning', hex: '#f59e0b' },
  { name: 'Travel', hex: '#8b5cf6' },
  { name: 'Personal', hex: '#ec4899' },
  { name: 'Finance', hex: '#14b8a6' },
  { name: 'Creative', hex: '#f97316' },
];

// Keywords that hint at a category, used to auto-pick the type (and therefore
// the color) from a goal's title. Lowercase; matched as whole words.
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Career: ['job', 'work', 'career', 'promotion', 'interview', 'resume', 'cv',
    'business', 'startup', 'company', 'client', 'network', 'linkedin', 'office',
    'manager', 'leadership', 'hire', 'hiring', 'freelance', 'portfolio'],
  Health: ['gym', 'run', 'running', 'workout', 'fitness', 'exercise', 'weight',
    'diet', 'marathon', 'yoga', 'health', 'healthy', 'sleep', 'meditate',
    'meditation', 'doctor', 'nutrition', 'hike', 'hiking', 'swim', 'cycle',
    'cycling', 'lift', 'lifting', 'steps', 'pushups', 'strength'],
  Learning: ['learn', 'study', 'course', 'read', 'reading', 'book', 'degree',
    'language', 'french', 'spanish', 'german', 'japanese', 'certification',
    'certificate', 'exam', 'skill', 'tutorial', 'practice', 'math', 'code',
    'coding', 'programming', 'school', 'class', 'lecture', 'research'],
  Travel: ['travel', 'trip', 'vacation', 'flight', 'visit', 'explore', 'tour',
    'japan', 'europe', 'asia', 'country', 'countries', 'passport', 'backpack',
    'roadtrip', 'cruise', 'abroad', 'holiday', 'adventure'],
  Personal: ['family', 'friends', 'relationship', 'marriage', 'wedding', 'home',
    'move', 'organize', 'declutter', 'habit', 'mindfulness', 'self', 'volunteer',
    'parenting', 'pet', 'garden', 'cook', 'cooking', 'clean'],
  Finance: ['save', 'saving', 'savings', 'money', 'invest', 'investing', 'budget',
    'debt', 'retirement', 'stock', 'stocks', 'crypto', 'fund', 'income',
    'expense', 'mortgage', 'tax', 'taxes', 'emergency', 'wealth', 'salary'],
  Creative: ['write', 'writing', 'paint', 'painting', 'music', 'art', 'design',
    'draw', 'drawing', 'photography', 'photo', 'song', 'novel', 'blog', 'video',
    'craft', 'guitar', 'piano', 'film', 'podcast', 'sketch', 'sculpt'],
};

// Pick the most likely category for a goal title by counting keyword hits.
// Falls back to 'Personal' when nothing matches. The chosen category maps to a
// color via CATEGORY_COLORS, giving title -> type -> color.
export const inferCategory = (title: string): string => {
  const words = title.toLowerCase().match(/[a-z]+/g) || [];
  if (words.length === 0) return 'Personal';
  const wordSet = new Set(words);

  let best = 'Personal';
  let bestScore = 0;
  for (const { name } of CATEGORY_COLORS) {
    const keywords = CATEGORY_KEYWORDS[name] || [];
    const score = keywords.reduce((n, kw) => n + (wordSet.has(kw) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = name;
    }
  }
  return best;
};

export const generateICS = (goals: Goal[], globalMilestones: GlobalMilestone[]): string => {
  let ics = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//LifePath//EN\n';
  
  goals.forEach(goal => {
    ics += 'BEGIN:VEVENT\n';
    ics += `UID:${goal.id}\n`;
    ics += `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z\n`;
    ics += `DTSTART:${goal.startDate.replace(/[-]/g, '')}\n`;
    ics += `DTEND:${goal.endDate.replace(/[-]/g, '')}\n`;
    ics += `SUMMARY:${goal.title}\n`;
    ics += `DESCRIPTION:Category: ${goal.category}\n`;
    ics += 'END:VEVENT\n';
  });
  
  globalMilestones.forEach(milestone => {
    ics += 'BEGIN:VEVENT\n';
    ics += `UID:${milestone.id}\n`;
    ics += `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z\n`;
    ics += `DTSTART:${milestone.date.replace(/[-]/g, '')}\n`;
    ics += `SUMMARY:${milestone.title}\n`;
    ics += 'DESCRIPTION:Global Milestone\n';
    ics += 'END:VEVENT\n';
  });
  
  ics += 'END:VCALENDAR';
  return ics;
};