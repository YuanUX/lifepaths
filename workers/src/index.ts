/**
 * LifePath API - Cloudflare Workers Backend
 * Handles authentication, data storage, and AI suggestions
 */

export interface Env {
  DB: D1Database;
  AI: any;
  JWT_SECRET: string;
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle CORS preflight
function handleOptions() {
  return new Response(null, {
    headers: corsHeaders,
  });
}

// Helper to create JSON response
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

// Simple JWT implementation
async function createToken(userId: string, secret: string): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ userId, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 }));
  const signature = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${header}.${payload}.${secret}`));
  return `${header}.${payload}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;
}

async function verifyToken(token: string, secret: string): Promise<string | null> {
  try {
    const [header, payload] = token.split('.');
    const data = JSON.parse(atob(payload));
    if (data.exp < Date.now()) return null;
    return data.userId;
  } catch {
    return null;
  }
}

// Hash password (simple implementation)
async function hashPassword(password: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    // Routes
    try {
      // Auth routes
      if (path === '/api/auth/signup' && request.method === 'POST') {
        const { email, password } = await request.json();
        const hashedPassword = await hashPassword(password);
        const userId = crypto.randomUUID();

        await env.DB.prepare(
          'INSERT INTO users (id, email, password, xp, level, next_level_xp) VALUES (?, ?, ?, 0, 1, 300)'
        ).bind(userId, email, hashedPassword).run();

        const token = await createToken(userId, env.JWT_SECRET || 'default-secret');
        return jsonResponse({ token, userId });
      }

      if (path === '/api/auth/signin' && request.method === 'POST') {
        const { email, password } = await request.json();
        const hashedPassword = await hashPassword(password);

        const result = await env.DB.prepare(
          'SELECT id FROM users WHERE email = ? AND password = ?'
        ).bind(email, hashedPassword).first();

        if (!result) {
          return jsonResponse({ error: 'Invalid credentials' }, 401);
        }

        const token = await createToken(result.id as string, env.JWT_SECRET || 'default-secret');
        return jsonResponse({ token, userId: result.id });
      }

      // AI Suggestions (public endpoint - no auth required)
      if (path === '/api/ai/suggestions' && request.method === 'POST') {
        const { prompt, totalDays } = await request.json();

        const systemPrompt = `You are an AI assistant that breaks down goals into actionable subtasks and milestones.
Given a goal and total duration in days, create a breakdown with 5 subtasks and milestones:
- Subtasks: specific actionable steps with start offset (days from goal start) and duration (days to complete)
- Milestones: key checkpoints with start offset (no duration needed, durationDays: 0)

Respond ONLY with a valid JSON array. No markdown, no explanation, ONLY the JSON array in this exact format:
[
  {"type": "subtask", "title": "Descriptive task name", "startOffsetDays": 0, "durationDays": 3},
  {"type": "milestone", "title": "Milestone name", "startOffsetDays": 3, "durationDays": 0}
]

IMPORTANT: Use numbers (not strings) for startOffsetDays and durationDays. Make the suggestions specific to the goal.`;

        const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Goal: "${prompt}"\nTotal duration: ${totalDays} days\n\nCreate subtasks and milestones. Return ONLY a JSON array with each item having type, title, startOffsetDays (number), durationDays (number):` }
          ],
          max_tokens: 1200,
        });

        // Extract the text response
        const rawText = response.response || response.content || '';
        if (typeof rawText !== 'string' || !rawText.trim()) {
          return jsonResponse({ suggestions: '[]' });
        }

        // Try to parse and validate on the server side
        try {
          const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const startIdx = cleaned.indexOf('[');
          if (startIdx !== -1) {
            const endIdx = cleaned.lastIndexOf(']');
            if (endIdx !== -1 && endIdx > startIdx) {
              const jsonStr = cleaned.substring(startIdx, endIdx + 1);
              const parsed = JSON.parse(jsonStr);
              if (Array.isArray(parsed)) {
                const validated = parsed.filter((s: any) => s && s.type && s.title);
                return jsonResponse({ suggestions: validated });
              }
            }
          }
        } catch {
          // If server-side parsing fails, send raw text for client to handle
        }

        return jsonResponse({ suggestions: rawText });
      }

      // Protected routes - require auth
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }

      const token = authHeader.substring(7);
      const userId = await verifyToken(token, env.JWT_SECRET || 'default-secret');
      if (!userId) {
        return jsonResponse({ error: 'Invalid token' }, 401);
      }

      // User profile
      if (path === '/api/user' && request.method === 'GET') {
        const user = await env.DB.prepare(
          'SELECT id, email, xp, level, next_level_xp FROM users WHERE id = ?'
        ).bind(userId).first();
        return jsonResponse(user);
      }

      // Composite: fetch all user data (goals + subtasks + milestones)
      if (path === '/api/user/data' && request.method === 'GET') {
        const user = await env.DB.prepare(
          'SELECT xp, level, next_level_xp FROM users WHERE id = ?'
        ).bind(userId).first();

        const goals = await env.DB.prepare(
          'SELECT * FROM goals WHERE user_id = ? ORDER BY "order"'
        ).bind(userId).all();

        for (const goal of goals.results) {
          const subtasks = await env.DB.prepare(
            'SELECT * FROM subtasks WHERE goal_id = ? ORDER BY "order"'
          ).bind(goal.id).all();

          const milestones = await env.DB.prepare(
            'SELECT * FROM goal_milestones WHERE goal_id = ?'
          ).bind(goal.id).all();

          goal.subtasks = subtasks.results;
          goal.milestones = milestones.results;
        }

        const globalMilestones = await env.DB.prepare(
          'SELECT * FROM global_milestones WHERE user_id = ?'
        ).bind(userId).all();

        return jsonResponse({
          user: {
            xp: (user as any)?.xp || 0,
            level: (user as any)?.level || 1,
            nextLevelXp: (user as any)?.next_level_xp || 300,
          },
          goals: goals.results,
          globalMilestones: globalMilestones.results,
        });
      }

      if (path === '/api/user' && request.method === 'PUT') {
        const { xp, level, nextLevelXp } = await request.json();
        await env.DB.prepare(
          'UPDATE users SET xp = ?, level = ?, next_level_xp = ? WHERE id = ?'
        ).bind(xp, level, nextLevelXp, userId).run();
        return jsonResponse({ success: true });
      }

      // Goals
      if (path === '/api/goals' && request.method === 'GET') {
        const goals = await env.DB.prepare(
          'SELECT * FROM goals WHERE user_id = ? ORDER BY "order"'
        ).bind(userId).all();

        // Fetch subtasks and milestones for each goal
        for (const goal of goals.results) {
          const subtasks = await env.DB.prepare(
            'SELECT * FROM subtasks WHERE goal_id = ? ORDER BY "order"'
          ).bind(goal.id).all();

          const milestones = await env.DB.prepare(
            'SELECT * FROM goal_milestones WHERE goal_id = ?'
          ).bind(goal.id).all();

          goal.subtasks = subtasks.results;
          goal.milestones = milestones.results;
        }

        return jsonResponse(goals.results);
      }

      if (path === '/api/goals' && request.method === 'POST') {
        const goal = await request.json();
        await env.DB.prepare(
          `INSERT INTO goals (id, user_id, title, category, color, start_date, end_date, status, "order", notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          goal.id, userId, goal.title, goal.category, goal.color,
          goal.startDate, goal.endDate, goal.status, goal.order, goal.notes || ''
        ).run();

        // Create nested subtasks
        if (goal.subtasks && Array.isArray(goal.subtasks)) {
          for (const subtask of goal.subtasks) {
            await env.DB.prepare(
              `INSERT INTO subtasks (id, goal_id, title, start_offset_days, duration_days, status, "order")
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              subtask.id, goal.id, subtask.title, subtask.startOffsetDays,
              subtask.durationDays, subtask.status, subtask.order
            ).run();
          }
        }

        // Create nested milestones
        if (goal.milestones && Array.isArray(goal.milestones)) {
          for (const milestone of goal.milestones) {
            await env.DB.prepare(
              'INSERT INTO goal_milestones (id, goal_id, title, date, is_completed, color) VALUES (?, ?, ?, ?, ?, ?)'
            ).bind(
              milestone.id, goal.id, milestone.title, milestone.date,
              milestone.isCompleted ? 1 : 0, milestone.color || null
            ).run();
          }
        }

        return jsonResponse({ success: true });
      }

      if (path.startsWith('/api/goals/') && request.method === 'PUT') {
        const goalId = path.split('/')[3];
        const goal = await request.json();
        await env.DB.prepare(
          `UPDATE goals SET title = ?, category = ?, color = ?, start_date = ?,
           end_date = ?, status = ?, "order" = ?, notes = ? WHERE id = ? AND user_id = ?`
        ).bind(
          goal.title, goal.category, goal.color, goal.startDate,
          goal.endDate, goal.status, goal.order, goal.notes || '', goalId, userId
        ).run();
        return jsonResponse({ success: true });
      }

      if (path.startsWith('/api/goals/') && request.method === 'DELETE') {
        const goalId = path.split('/')[3];
        await env.DB.prepare('DELETE FROM goals WHERE id = ? AND user_id = ?').bind(goalId, userId).run();
        await env.DB.prepare('DELETE FROM subtasks WHERE goal_id = ?').bind(goalId).run();
        await env.DB.prepare('DELETE FROM goal_milestones WHERE goal_id = ?').bind(goalId).run();
        return jsonResponse({ success: true });
      }

      // Subtasks
      if (path === '/api/subtasks' && request.method === 'POST') {
        const subtask = await request.json();
        await env.DB.prepare(
          `INSERT INTO subtasks (id, goal_id, title, start_offset_days, duration_days, status, "order")
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          subtask.id, subtask.goalId, subtask.title, subtask.startOffsetDays,
          subtask.durationDays, subtask.status, subtask.order
        ).run();
        return jsonResponse({ success: true });
      }

      if (path.startsWith('/api/subtasks/') && request.method === 'PUT') {
        const subtaskId = path.split('/')[3];
        const subtask = await request.json();
        await env.DB.prepare(
          `UPDATE subtasks SET title = ?, start_offset_days = ?, duration_days = ?, status = ?, "order" = ?
           WHERE id = ?`
        ).bind(
          subtask.title, subtask.startOffsetDays, subtask.durationDays,
          subtask.status, subtask.order, subtaskId
        ).run();
        return jsonResponse({ success: true });
      }

      if (path.startsWith('/api/subtasks/') && request.method === 'DELETE') {
        const subtaskId = path.split('/')[3];
        await env.DB.prepare('DELETE FROM subtasks WHERE id = ?').bind(subtaskId).run();
        return jsonResponse({ success: true });
      }

      // Global Milestones
      if (path === '/api/milestones/global' && request.method === 'GET') {
        const milestones = await env.DB.prepare(
          'SELECT * FROM global_milestones WHERE user_id = ?'
        ).bind(userId).all();
        return jsonResponse(milestones.results);
      }

      if (path === '/api/milestones/global' && request.method === 'POST') {
        const milestone = await request.json();
        await env.DB.prepare(
          'INSERT INTO global_milestones (id, user_id, title, date, is_completed, color) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(milestone.id, userId, milestone.title, milestone.date, milestone.isCompleted ? 1 : 0, milestone.color || null).run();
        return jsonResponse({ success: true });
      }

      if (path.startsWith('/api/milestones/global/') && request.method === 'PUT') {
        const milestoneId = path.split('/')[4];
        const milestone = await request.json();
        await env.DB.prepare(
          'UPDATE global_milestones SET title = ?, date = ?, is_completed = ?, color = ? WHERE id = ? AND user_id = ?'
        ).bind(milestone.title, milestone.date, milestone.isCompleted ? 1 : 0, milestone.color || null, milestoneId, userId).run();
        return jsonResponse({ success: true });
      }

      if (path.startsWith('/api/milestones/global/') && request.method === 'DELETE') {
        const milestoneId = path.split('/')[4];
        await env.DB.prepare('DELETE FROM global_milestones WHERE id = ? AND user_id = ?').bind(milestoneId, userId).run();
        return jsonResponse({ success: true });
      }

      // Goal Milestones
      if (path === '/api/milestones/goal' && request.method === 'POST') {
        const milestone = await request.json();
        await env.DB.prepare(
          'INSERT INTO goal_milestones (id, goal_id, title, date, is_completed, color) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(milestone.id, milestone.goalId, milestone.title, milestone.date, milestone.isCompleted ? 1 : 0, milestone.color || null).run();
        return jsonResponse({ success: true });
      }

      if (path.startsWith('/api/milestones/goal/') && request.method === 'PUT') {
        const milestoneId = path.split('/')[4];
        const milestone = await request.json();
        await env.DB.prepare(
          'UPDATE goal_milestones SET title = ?, date = ?, is_completed = ?, color = ? WHERE id = ?'
        ).bind(milestone.title, milestone.date, milestone.isCompleted ? 1 : 0, milestone.color || null, milestoneId).run();
        return jsonResponse({ success: true });
      }

      if (path.startsWith('/api/milestones/goal/') && request.method === 'DELETE') {
        const milestoneId = path.split('/')[4];
        await env.DB.prepare('DELETE FROM goal_milestones WHERE id = ?').bind(milestoneId).run();
        return jsonResponse({ success: true });
      }

      return jsonResponse({ error: 'Not found' }, 404);

    } catch (error: any) {
      console.error('Error:', error);
      return jsonResponse({ error: error.message }, 500);
    }
  },
};
