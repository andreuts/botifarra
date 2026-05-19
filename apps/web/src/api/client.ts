import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  MeResponse,
  RecentGameDTO,
  MatchDTO,
  PlayerStatsDTO,
  FriendsListResponse,
  FriendRequestDTO,
  PairInviteDTO,
  TournamentListDTO,
  TournamentDetailDTO,
  TournamentDTO,
  NewsPostListDTO,
  NewsPostDetailDTO,
  NewsPostSummaryDTO,
  CreateNewsPostRequest,
  UpdateNewsPostRequest,
} from '@botifarra/shared';

const BASE = '/api';

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
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
    list: (token: string) => request<RecentGameDTO[]>('/matches', {}, token),
    get: (matchId: string, token: string) => request<MatchDTO>(`/matches/${matchId}`, {}, token),
    resume: (matchId: string, token: string) =>
      request<{ roomId: string }>(`/matches/${matchId}/resume`, { method: 'POST' }, token),
  },

  users: {
    myStats: (token: string) => request<PlayerStatsDTO>('/users/me/stats', {}, token),
  },

  rankings: {
    list: (token?: string) => request<RankingEntry[]>('/rankings', {}, token),
  },

  rooms: {
    create: (token: string) =>
      request<{ inviteCode: string }>('/rooms/create', { method: 'POST' }, token),
    lookup: (code: string, token: string) =>
      request<{ inviteCode: string; roomId: string | null; hostUserId: string }>(
        `/rooms/${code}`,
        {},
        token,
      ),
    join: (code: string, token: string) =>
      request<{ roomId: string; inviteCode: string }>(
        `/rooms/${code}/join`,
        { method: 'POST' },
        token,
      ),
  },

  // ---------------------------------------------------------------------------
  // Friends
  // ---------------------------------------------------------------------------

  friends: {
    list: (token: string) => request<FriendsListResponse>('/friends', {}, token),

    sendRequest: (username: string, token: string) =>
      request<FriendRequestDTO>('/friends/request', {
        method: 'POST',
        body: JSON.stringify({ username }),
      }, token),

    respond: (friendshipId: string, action: 'accept' | 'reject', token: string) =>
      request<{ message: string }>('/friends/respond', {
        method: 'POST',
        body: JSON.stringify({ friendshipId, action }),
      }, token),

    remove: (friendUserId: string, token: string) =>
      request<{ message: string }>(`/friends/${friendUserId}`, {
        method: 'DELETE',
      }, token),
  },

  // ---------------------------------------------------------------------------
  // Pair Invites
  // ---------------------------------------------------------------------------

  pairInvite: {
    send: (friendUserId: string, token: string, ranked = false) =>
      request<PairInviteDTO>('/pair-invite/send', {
        method: 'POST',
        body: JSON.stringify({ friendUserId, ranked }),
      }, token),

    respond: (inviteId: string, action: 'accept' | 'reject', token: string) =>
      request<{ message: string }>('/pair-invite/respond', {
        method: 'POST',
        body: JSON.stringify({ inviteId, action }),
      }, token),

    pending: (token: string) =>
      request<PairInviteDTO[]>('/pair-invite/pending', {}, token),

    cancel: (inviteId: string, token: string) =>
      request<{ message: string }>(`/pair-invite/${inviteId}`, {
        method: 'DELETE',
      }, token),
  },

  // ---------------------------------------------------------------------------
  // Tournaments
  // ---------------------------------------------------------------------------

  tournaments: {
    list: (token: string) => request<TournamentListDTO>('/tournaments', {}, token),

    get: (id: string, token: string) =>
      request<TournamentDetailDTO>(`/tournaments/${id}`, {}, token),

    create: (name: string, format: 'eliminatory' | 'swiss', token: string, password?: string) =>
      request<TournamentDTO>('/tournaments', {
        method: 'POST',
        body: JSON.stringify({ name, format, ...(password ? { password } : {}) }),
      }, token),

    registerCouple: (tournamentId: string, partnerUserId: string, token: string, password?: string) =>
      request<{ coupleId: string }>(`/tournaments/${tournamentId}/register-couple`, {
        method: 'POST',
        body: JSON.stringify({ partnerUserId, ...(password ? { password } : {}) }),
      }, token),

    registerSolo: (tournamentId: string, token: string, password?: string) =>
      request<{ message: string }>(`/tournaments/${tournamentId}/register-solo`, {
        method: 'POST',
        body: JSON.stringify(password ? { password } : {}),
      }, token),

    pairSolos: (tournamentId: string, token: string) =>
      request<{ pairedCount: number; remainingSolos: number }>(
        `/tournaments/${tournamentId}/pair-solos`,
        { method: 'POST' },
        token,
      ),

    start: (tournamentId: string, token: string) =>
      request<{ message: string; activeRound: number }>(
        `/tournaments/${tournamentId}/start`,
        { method: 'POST' },
        token,
      ),

    submitResult: (
      tournamentId: string,
      matchId: string,
      score0: number,
      score1: number,
      token: string,
      winnerId?: string,
    ) =>
      request<{ message: string; winnerId: string | null; status: string }>(
        `/tournaments/${tournamentId}/submit-result`,
        {
          method: 'POST',
          body: JSON.stringify({ matchId, score0, score1, winnerId }),
        },
        token,
      ),

    nextRound: (tournamentId: string, token: string) =>
      request<{ message: string; activeRound: number; isFinal?: boolean }>(
        `/tournaments/${tournamentId}/next-round`,
        { method: 'POST' },
        token,
      ),

    finalize: (tournamentId: string, token: string) =>
      request<{ message: string; championId: string }>(
        `/tournaments/${tournamentId}/finalize`,
        { method: 'POST' },
        token,
      ),
  },

  // ---------------------------------------------------------------------------
  // News
  // ---------------------------------------------------------------------------

  news: {
    list: (params?: { page?: number; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.page) q.set('page', String(params.page));
      if (params?.limit) q.set('limit', String(params.limit));
      const qs = q.toString();
      return request<NewsPostListDTO>(`/news${qs ? '?' + qs : ''}`);
    },

    get: (id: string) => request<NewsPostDetailDTO>(`/news/${id}`),
    getBySlug: (slug: string) => request<NewsPostDetailDTO>(`/news/slug/${slug}`),

    adminListAll: (adminSecret: string, params?: { page?: number; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.page) q.set('page', String(params.page));
      if (params?.limit) q.set('limit', String(params.limit));
      const qs = q.toString();
      return requestRaw<NewsPostListDTO & { posts: (NewsPostSummaryDTO & { isPublished?: boolean })[] }>(
        `/news/admin/all${qs ? '?' + qs : ''}`,
        { headers: { 'X-Admin-Secret': adminSecret } },
      );
    },

    adminCreate: (adminSecret: string, data: CreateNewsPostRequest) =>
      requestRaw<NewsPostDetailDTO>('/news/admin', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'X-Admin-Secret': adminSecret },
      }),

    adminUpdate: (adminSecret: string, id: string, data: UpdateNewsPostRequest) =>
      requestRaw<NewsPostDetailDTO>(`/news/admin/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        headers: { 'X-Admin-Secret': adminSecret },
      }),

    adminDelete: (adminSecret: string, id: string) =>
      requestRaw<void>(`/news/admin/${id}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Secret': adminSecret },
      }),

    adminUpload: async (adminSecret: string, file: File): Promise<{ url: string }> => {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${BASE}/news/admin/uploads`, {
        method: 'POST',
        headers: { 'X-Admin-Secret': adminSecret },
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<{ url: string }>;
    },
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

    listUsers: (
      adminSecret: string,
      params?: { page?: number; limit?: number; search?: string },
    ) => {
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

    listMatches: (
      adminSecret: string,
      params?: { page?: number; limit?: number; status?: string; mode?: string },
    ) => {
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
  recentMatches: {
    matchId: string;
    status: string;
    mode: string;
    score: string;
    createdAt: string;
  }[];
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
    perRoute: {
      method: string;
      route: string;
      totalRequests: number;
      avgDurationMs: number;
      p95DurationMs: number;
      errorCount: number;
    }[];
  };
  queue: { size: number; singles: number; pairs: number };
  rooms: {
    active: number;
    roomList: {
      roomId: string;
      name: string;
      clients: number;
      maxClients: number;
      createdAt: string;
    }[];
  };
  errors: {
    total: number;
    recent: { message: string; timestamp: string; route?: string }[];
  };
}

// ---------------------------------------------------------------------------
// Internal request helper (no token, uses raw headers)
// ---------------------------------------------------------------------------

async function requestRaw<T>(path: string, options: RequestInit = {}): Promise<T> {
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

export type { NewsPostListDTO, NewsPostDetailDTO, NewsPostSummaryDTO, CreateNewsPostRequest, UpdateNewsPostRequest };

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
