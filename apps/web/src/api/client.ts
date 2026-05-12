import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  MeResponse,
  MatchDTO,
} from '@botifarra/shared';

const BASE = '/api';

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const api = {
  auth: {
    register: (data: RegisterRequest) =>
      request<RegisterResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    login: (data: LoginRequest) =>
      request<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    me: (token: string) => request<MeResponse>('/users/me', {}, token),
  },

  matches: {
    list: (token: string) => request<MatchDTO[]>('/matches', {}, token),
    get: (matchId: string, token: string) =>
      request<MatchDTO>(`/matches/${matchId}`, {}, token),
  },

  rankings: {
    list: (token?: string) =>
      request<RankingEntry[]>('/rankings', {}, token),
  },

  rooms: {
    create: (token: string) =>
      request<{ inviteCode: string }>('/rooms/create', { method: 'POST' }, token),
    lookup: (code: string, token: string) =>
      request<{ inviteCode: string; roomId: string | null; hostUserId: string }>(`/rooms/${code}`, {}, token),
    join: (code: string, token: string) =>
      request<{ roomId: string; inviteCode: string }>(`/rooms/${code}/join`, { method: 'POST' }, token),
  },

  // ---------------------------------------------------------------------------
  // Admin
  // ---------------------------------------------------------------------------

  admin: {
    _headers: (adminSecret: string): Record<string, string> => ({
      'X-Admin-Secret': adminSecret,
    }),

    getStats: (adminSecret: string) =>
      requestRaw<AdminStats>('/admin/stats', {
        headers: { 'X-Admin-Secret': adminSecret },
      }),

    listUsers: (adminSecret: string, params?: { page?: number; limit?: number; search?: string }) => {
      const q = new URLSearchParams();
      if (params?.page) q.set('page', String(params.page));
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.search) q.set('search', params.search);
      const qs = q.toString();
      return requestRaw<AdminUserList>(`/admin/users${qs ? '?' + qs : ''}`, {
        headers: { 'X-Admin-Secret': adminSecret },
      });
    },

    getUser: (adminSecret: string, userId: string) =>
      requestRaw<AdminUserDetail>(`/admin/users/${userId}`, {
        headers: { 'X-Admin-Secret': adminSecret },
      }),

    deleteUser: (adminSecret: string, userId: string) =>
      requestRaw<{ message: string; userId: string }>(`/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Secret': adminSecret },
      }),

    listMatches: (adminSecret: string, params?: { page?: number; limit?: number; status?: string; mode?: string }) => {
      const q = new URLSearchParams();
      if (params?.page) q.set('page', String(params.page));
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.status) q.set('status', params.status);
      if (params?.mode) q.set('mode', params.mode);
      const qs = q.toString();
      return requestRaw<AdminMatchList>(`/admin/matches${qs ? '?' + qs : ''}`, {
        headers: { 'X-Admin-Secret': adminSecret },
      });
    },

    getMatch: (adminSecret: string, matchId: string) =>
      requestRaw<AdminMatchDetail>(`/admin/matches/${matchId}`, {
        headers: { 'X-Admin-Secret': adminSecret },
      }),

    deleteMatch: (adminSecret: string, matchId: string) =>
      requestRaw<{ message: string; matchId: string }>(`/admin/matches/${matchId}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Secret': adminSecret },
      }),

    cleanupMatches: (adminSecret: string, olderThanMinutes = 60) =>
      requestRaw<{ message: string; deletedCount: number }>('/admin/matches/cleanup', {
        method: 'POST',
        headers: { 'X-Admin-Secret': adminSecret },
        body: JSON.stringify({ olderThanMinutes }),
      }),
  },

  // ---------------------------------------------------------------------------
  // Monitoring
  // ---------------------------------------------------------------------------

  monitoring: {
    getSnapshot: (adminSecret: string) =>
      requestRaw<MonitoringSnapshot>('/monitoring/snapshot', {
        headers: { 'X-Admin-Secret': adminSecret },
      }),
  },
};

// ---------------------------------------------------------------------------
// Admin types
// ---------------------------------------------------------------------------

export interface AdminStats {
  totalUsers: number;
  totalMatches: number;
  activeMatches: number;
  finishedMatches: number;
  waitingMatches: number;
  newUsersLast24h: number;
}

export interface AdminUser {
  id: string;
  username: string;
  createdAt: string;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  rating: number;
  totalMatchRecords: number;
}

export interface AdminUserList {
  users: AdminUser[];
  pagination: Pagination;
}

export interface AdminUserDetail {
  id: string;
  username: string;
  createdAt: string;
  stats: { matchesPlayed: number; matchesWon: number; matchesLost: number; rating: number } | null;
  recentMatches: { matchId: string; status: string; mode: string; score: string; createdAt: string }[];
}

export interface AdminMatch {
  id: string;
  mode: string;
  status: string;
  score0: number;
  score1: number;
  winner: number | null;
  targetScore: number;
  createdAt: string;
  finishedAt: string | null;
  players: { userId: string; username: string; seat: number }[];
}

export interface AdminMatchList {
  matches: AdminMatch[];
  pagination: Pagination;
}

export interface AdminMatchDetail extends AdminMatch {
  events: { seq: number; type: string; payload: unknown; createdAt: string }[];
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Monitoring types
// ---------------------------------------------------------------------------

export interface MonitoringSnapshot {
  uptime: number;
  timestamp: string;
  nodeVersion: string;
  platform: string;
  pid: number;
  memory: { rss: number; heapTotal: number; heapUsed: number; external: number };
  cpuUsage: number;
  requests: {
    total: number;
    last1min: number;
    last5min: number;
    avgDurationMs: number;
    errorRate: number;
    perRoute: { method: string; route: string; totalRequests: number; avgDurationMs: number; p95DurationMs: number; errorCount: number }[];
  };
  queue: { size: number; singles: number; pairs: number };
  rooms: {
    active: number;
    roomList: { roomId: string; name: string; clients: number; maxClients: number; createdAt: string }[];
  };
  errors: {
    total: number;
    recent: { message: string; timestamp: string; route?: string }[];
  };
}

// ---------------------------------------------------------------------------
// Internal request helper (no token, uses raw headers)
// ---------------------------------------------------------------------------

async function requestRaw<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Re-exported types used by other files
// ---------------------------------------------------------------------------

export interface RankingEntry {
  rank: number;
  userId: string;
  username: string;
  rating: number;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  winRate: number;
}
