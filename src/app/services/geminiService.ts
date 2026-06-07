export interface AISuggestion {
  type: 'subtask' | 'milestone';
  title: string;
  startOffsetDays: number;
  durationDays: number;
}

// Cloudflare Workers AI Configuration
const CLOUDFLARE_ACCOUNT_ID = import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID || '';
const CLOUDFLARE_API_TOKEN = import.meta.env.VITE_CLOUDFLARE_API_TOKEN || '';

// Check if Cloudflare AI is configured
export const isCloudflareAIConfigured = Boolean(CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_API_TOKEN);

function normalizeSuggestion(s: any): AISuggestion | null {
  if (!s || !s.type || !s.title) return null;
  const startOffsetDays = Number(s.startOffsetDays);
  const durationDays = Number(s.durationDays);
  if (isNaN(startOffsetDays) || isNaN(durationDays)) return null;
  return {
    type: s.type,
    title: s.title,
    startOffsetDays,
    durationDays,
  };
}

export const getGoalBreakdown = async (prompt: string, totalDays: number): Promise<AISuggestion[]> => {
  // Hardcoded URL for Figma Make (env vars require server restart)
  const WORKERS_API_URL = 'https://lifepath-api.yuanyuan-hu.workers.dev';

  console.log('🔧 Using Workers AI:', WORKERS_API_URL);

  // Try Workers AI endpoint first
  if (WORKERS_API_URL) {
    try {
      console.log('🤖 Calling Workers AI for suggestions...', {
        url: WORKERS_API_URL,
        prompt,
        totalDays
      });

      const response = await fetch(`${WORKERS_API_URL}/api/ai/suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, totalDays }),
      });

      console.log('📡 Response status:', response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log('📦 Raw AI response:', data);

        let aiText = data.suggestions;

        // If suggestions is already an object/array, use it directly
        if (typeof aiText === 'object') {
          const rawSuggestions: AISuggestion[] = Array.isArray(aiText) ? aiText : [aiText];
          const validSuggestions = rawSuggestions
            .map(normalizeSuggestion)
            .filter((s): s is AISuggestion => s !== null);

          if (validSuggestions.length > 0) {
            console.log('✅ AI suggestions received:', validSuggestions);
            return validSuggestions;
          }
        }

        // If it's a string, try to extract JSON
        if (typeof aiText === 'string') {
          console.log('📝 Parsing string response...');

          // Remove markdown code blocks if present
          aiText = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

          // Try to extract and fix JSON
          try {
            // Find the start of the JSON array
            const startIdx = aiText.indexOf('[');
            if (startIdx === -1) {
              throw new Error('No JSON array found');
            }

            let jsonStr = aiText.substring(startIdx);

            // Try to find the end bracket
            let endIdx = jsonStr.lastIndexOf(']');

            if (endIdx === -1) {
              // No closing bracket found, try to fix incomplete JSON
              console.log('⚠️ Incomplete JSON detected, attempting to fix...');

              // Count opening vs closing braces to find valid complete objects
              let depth = 0;
              let lastCompleteEnd = -1;
              for (let i = 0; i < jsonStr.length; i++) {
                if (jsonStr[i] === '{') depth++;
                else if (jsonStr[i] === '}') {
                  depth--;
                  if (depth === 0) lastCompleteEnd = i;
                }
              }

              if (lastCompleteEnd !== -1 && depth >= 0) {
                jsonStr = jsonStr.substring(0, lastCompleteEnd + 1);
                jsonStr += ']';
                console.log('🔧 Fixed incomplete JSON by closing after last balanced object');
              } else {
                console.warn('⚠️ No complete objects found in response');
                jsonStr = '[]';
              }
            } else {
              jsonStr = jsonStr.substring(0, endIdx + 1);
            }

            console.log('📝 Final JSON to parse:', jsonStr.length, 'characters');
            console.log('📄 Full JSON:', jsonStr);

            const rawSuggestions: AISuggestion[] = JSON.parse(jsonStr);
            console.log('🔢 Parsed count:', rawSuggestions.length, 'items');

            const validSuggestions = rawSuggestions
              .map(normalizeSuggestion)
              .filter((s): s is AISuggestion => s !== null);

            console.log('🔢 Valid count:', validSuggestions.length, 'items');

            if (validSuggestions.length > 0) {
              console.log('✅ Returning suggestions:', validSuggestions);
              return validSuggestions;
            } else {
              console.warn('⚠️ No valid suggestions after filtering');
            }
          } catch (parseError) {
            console.error('❌ JSON parse error:', parseError);
            console.log('Raw response that failed:', aiText.substring(0, 200));
          }
        }
      } else {
        console.error('❌ API error:', response.status, await response.text());
      }
    } catch (error) {
      console.error('❌ Workers AI failed:', error);
    }
  } else {
    console.log('⚠️ No WORKERS_API_URL configured');
  }

  // Fallback to intelligent pattern matching
  console.log('💡 Using intelligent pattern matching');
  await new Promise(resolve => setTimeout(resolve, 800));
  return getIntelligentSuggestions(prompt, totalDays);

};

// Intelligent suggestions with pattern matching
function getIntelligentSuggestions(prompt: string, totalDays: number): AISuggestion[] {
  const suggestions: AISuggestion[] = [];
  const lower = prompt.toLowerCase();

  // Learning & Education
  if (lower.match(/learn|study|course|master|practice|tutorial/)) {
    const subject = prompt.split(/learn|study|master/i)[1]?.trim() || 'the subject';
    suggestions.push(
      { type: 'subtask', title: `Research ${subject} resources`, startOffsetDays: 0, durationDays: 2 },
      { type: 'subtask', title: 'Complete fundamentals', startOffsetDays: 2, durationDays: Math.floor(totalDays * 0.3) },
      { type: 'milestone', title: 'Basics mastered', startOffsetDays: Math.floor(totalDays * 0.35), durationDays: 0 },
      { type: 'subtask', title: 'Build practice project', startOffsetDays: Math.floor(totalDays * 0.35), durationDays: Math.floor(totalDays * 0.4) },
      { type: 'milestone', title: 'Project complete', startOffsetDays: Math.floor(totalDays * 0.8), durationDays: 0 },
      { type: 'subtask', title: 'Review and consolidate', startOffsetDays: Math.floor(totalDays * 0.8), durationDays: Math.floor(totalDays * 0.2) },
    );
  }
  // Travel & Trip Planning
  else if (lower.match(/travel|trip|vacation|visit|tour/)) {
    suggestions.push(
      { type: 'subtask', title: 'Research destinations and activities', startOffsetDays: 0, durationDays: 3 },
      { type: 'subtask', title: 'Book flights and accommodation', startOffsetDays: 3, durationDays: 2 },
      { type: 'milestone', title: 'All bookings confirmed', startOffsetDays: 5, durationDays: 0 },
      { type: 'subtask', title: 'Plan daily itinerary', startOffsetDays: 5, durationDays: 3 },
      { type: 'subtask', title: 'Arrange documents and insurance', startOffsetDays: 8, durationDays: 2 },
      { type: 'milestone', title: 'Ready to travel', startOffsetDays: Math.max(10, totalDays - 1), durationDays: 0 },
    );
  }
  // Fitness & Health
  else if (lower.match(/fitness|gym|workout|exercise|health|weight|run|marathon/)) {
    suggestions.push(
      { type: 'subtask', title: 'Set baseline and goals', startOffsetDays: 0, durationDays: 1 },
      { type: 'subtask', title: 'Create workout routine', startOffsetDays: 1, durationDays: 2 },
      { type: 'milestone', title: 'First week complete', startOffsetDays: 7, durationDays: 0 },
      { type: 'subtask', title: 'Build consistency', startOffsetDays: 7, durationDays: Math.floor(totalDays * 0.5) },
      { type: 'milestone', title: 'Halfway checkpoint', startOffsetDays: Math.floor(totalDays * 0.5), durationDays: 0 },
      { type: 'subtask', title: 'Push to finish strong', startOffsetDays: Math.floor(totalDays * 0.5), durationDays: Math.floor(totalDays * 0.5) },
    );
  }
  // Career & Job Search
  else if (lower.match(/job|career|interview|resume|portfolio|job search|apply/)) {
    suggestions.push(
      { type: 'subtask', title: 'Update resume and portfolio', startOffsetDays: 0, durationDays: 3 },
      { type: 'subtask', title: 'Research companies and roles', startOffsetDays: 3, durationDays: 3 },
      { type: 'milestone', title: 'Applications ready', startOffsetDays: 6, durationDays: 0 },
      { type: 'subtask', title: 'Submit applications', startOffsetDays: 6, durationDays: 5 },
      { type: 'subtask', title: 'Interview preparation', startOffsetDays: 11, durationDays: 4 },
      { type: 'milestone', title: 'Ready for interviews', startOffsetDays: Math.max(15, totalDays - 1), durationDays: 0 },
    );
  }
  // Writing & Content Creation
  else if (lower.match(/write|book|blog|article|content|novel|essay/)) {
    suggestions.push(
      { type: 'subtask', title: 'Outline and research', startOffsetDays: 0, durationDays: Math.floor(totalDays * 0.15) },
      { type: 'milestone', title: 'Outline complete', startOffsetDays: Math.floor(totalDays * 0.15), durationDays: 0 },
      { type: 'subtask', title: 'First draft', startOffsetDays: Math.floor(totalDays * 0.15), durationDays: Math.floor(totalDays * 0.5) },
      { type: 'milestone', title: 'Draft complete', startOffsetDays: Math.floor(totalDays * 0.65), durationDays: 0 },
      { type: 'subtask', title: 'Edit and revise', startOffsetDays: Math.floor(totalDays * 0.65), durationDays: Math.floor(totalDays * 0.25) },
      { type: 'milestone', title: 'Final version ready', startOffsetDays: Math.floor(totalDays * 0.95), durationDays: 0 },
    );
  }
  // Building/Development Projects
  else if (lower.match(/build|develop|create|make|design|app|website|project/)) {
    suggestions.push(
      { type: 'subtask', title: 'Planning and design', startOffsetDays: 0, durationDays: Math.floor(totalDays * 0.2) },
      { type: 'milestone', title: 'Design approved', startOffsetDays: Math.floor(totalDays * 0.2), durationDays: 0 },
      { type: 'subtask', title: 'Core development', startOffsetDays: Math.floor(totalDays * 0.2), durationDays: Math.floor(totalDays * 0.5) },
      { type: 'milestone', title: 'MVP complete', startOffsetDays: Math.floor(totalDays * 0.7), durationDays: 0 },
      { type: 'subtask', title: 'Testing and polish', startOffsetDays: Math.floor(totalDays * 0.7), durationDays: Math.floor(totalDays * 0.3) },
    );
  }
  // Generic fallback
  else {
    const third = Math.floor(totalDays / 3);
    suggestions.push(
      { type: 'subtask', title: 'Research and planning', startOffsetDays: 0, durationDays: third },
      { type: 'milestone', title: 'Planning complete', startOffsetDays: third, durationDays: 0 },
      { type: 'subtask', title: 'Implementation phase', startOffsetDays: third, durationDays: third },
      { type: 'milestone', title: 'Review checkpoint', startOffsetDays: third * 2, durationDays: 0 },
      { type: 'subtask', title: 'Final execution', startOffsetDays: third * 2, durationDays: third },
    );
  }

  return suggestions;
}
