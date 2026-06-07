/**
 * Cloudflare Workers API Client
 * Replaces Supabase with Cloudflare Workers + D1
 */

const API_URL = import.meta.env.VITE_WORKERS_API_URL || 'http://localhost:8787';

// Storage for auth token
let authToken: string | null = localStorage.getItem('auth_token');
let currentUserId: string | null = localStorage.getItem('user_id');

// Helper to make authenticated requests
export async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Auth
export const auth = {
  async signUp(email: string, password: string) {
    const data = await fetchAPI('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    authToken = data.token;
    currentUserId = data.userId;
    localStorage.setItem('auth_token', authToken);
    localStorage.setItem('user_id', currentUserId);
    return { user: { id: currentUserId }, session: { access_token: authToken } };
  },

  async signIn(email: string, password: string) {
    const data = await fetchAPI('/api/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    authToken = data.token;
    currentUserId = data.userId;
    localStorage.setItem('auth_token', authToken);
    localStorage.setItem('user_id', currentUserId);
    return { user: { id: currentUserId }, session: { access_token: authToken } };
  },

  async signOut() {
    authToken = null;
    currentUserId = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_id');
  },

  getSession() {
    if (authToken && currentUserId) {
      return {
        data: {
          session: {
            access_token: authToken,
            user: { id: currentUserId },
          },
        },
      };
    }
    return { data: { session: null } };
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    // Simulate auth state change
    setTimeout(() => {
      const session = auth.getSession().data.session;
      callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);
    }, 0);
    return { data: { subscription: { unsubscribe: () => {} } } };
  },
};

// User Profile
export const userProfile = {
  async get() {
    return fetchAPI('/api/user');
  },

  async update(xp: number, level: number, nextLevelXp: number) {
    return fetchAPI('/api/user', {
      method: 'PUT',
      body: JSON.stringify({ xp, level, nextLevelXp }),
    });
  },
};

// Goals
export const goals = {
  async getAll() {
    return fetchAPI('/api/goals');
  },

  async create(goal: any) {
    return fetchAPI('/api/goals', {
      method: 'POST',
      body: JSON.stringify(goal),
    });
  },

  async update(goal: any) {
    return fetchAPI(`/api/goals/${goal.id}`, {
      method: 'PUT',
      body: JSON.stringify(goal),
    });
  },

  async delete(goalId: string) {
    return fetchAPI(`/api/goals/${goalId}`, {
      method: 'DELETE',
    });
  },
};

// Subtasks
export const subtasks = {
  async create(subtask: any) {
    return fetchAPI('/api/subtasks', {
      method: 'POST',
      body: JSON.stringify(subtask),
    });
  },

  async update(subtask: any) {
    return fetchAPI(`/api/subtasks/${subtask.id}`, {
      method: 'PUT',
      body: JSON.stringify(subtask),
    });
  },

  async delete(subtaskId: string) {
    return fetchAPI(`/api/subtasks/${subtaskId}`, {
      method: 'DELETE',
    });
  },
};

// Global Milestones
export const globalMilestones = {
  async getAll() {
    return fetchAPI('/api/milestones/global');
  },

  async create(milestone: any) {
    return fetchAPI('/api/milestones/global', {
      method: 'POST',
      body: JSON.stringify(milestone),
    });
  },

  async update(milestone: any) {
    return fetchAPI(`/api/milestones/global/${milestone.id}`, {
      method: 'PUT',
      body: JSON.stringify(milestone),
    });
  },

  async delete(milestoneId: string) {
    return fetchAPI(`/api/milestones/global/${milestoneId}`, {
      method: 'DELETE',
    });
  },
};

// Goal Milestones
export const goalMilestones = {
  async create(milestone: any) {
    return fetchAPI('/api/milestones/goal', {
      method: 'POST',
      body: JSON.stringify(milestone),
    });
  },

  async update(milestone: any) {
    return fetchAPI(`/api/milestones/goal/${milestone.id}`, {
      method: 'PUT',
      body: JSON.stringify(milestone),
    });
  },

  async delete(milestoneId: string) {
    return fetchAPI(`/api/milestones/goal/${milestoneId}`, {
      method: 'DELETE',
    });
  },
};

// AI Suggestions
export const ai = {
  async getSuggestions(prompt: string, totalDays: number) {
    return fetchAPI('/api/ai/suggestions', {
      method: 'POST',
      body: JSON.stringify({ prompt, totalDays }),
    });
  },
};

export const isWorkersConfigured = true;
