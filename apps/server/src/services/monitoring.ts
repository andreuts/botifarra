/**
 * Server monitoring service — collects runtime metrics similar to Pulse.
 *
 * Tracks:
 *   - Uptime, memory, CPU usage
 *   - HTTP request counts and latencies (per route)
 *   - Active WebSocket / Colyseus room stats
 *   - Matchmaking queue depth
 *   - Error rates
 *
 * Designed for single-process deployments.
 * All data is in-memory — no external dependencies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RequestMetric {
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  timestamp: number;
}

export interface AggregatedRoute {
  method: string;
  route: string;
  totalRequests: number;
  avgDurationMs: number;
  p95DurationMs: number;
  errorCount: number; // 4xx + 5xx
}

export interface ServerSnapshot {
  uptime: number; // seconds
  timestamp: string;
  nodeVersion: string;
  platform: string;
  pid: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  /** Avg CPU usage (0–1) over last sample interval */
  cpuUsage: number;
  requests: {
    total: number;
    last1min: number;
    last5min: number;
    avgDurationMs: number;
    errorRate: number; // 0-1
    perRoute: AggregatedRoute[];
  };
  queue: {
    size: number;
    singles: number;
    pairs: number;
  };
  rooms: {
    active: number;
    roomList: { roomId: string; name: string; clients: number; maxClients: number; createdAt: string }[];
  };
  errors: {
    total: number;
    recent: { message: string; timestamp: string; route?: string | undefined }[];
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/** How many request records to keep in memory */
const MAX_REQUEST_HISTORY = 10_000;
/** How many recent errors to keep */
const MAX_ERROR_HISTORY = 200;

export class MonitoringService {
  private startTime = Date.now();
  private requests: RequestMetric[] = [];
  private errors: { message: string; timestamp: number; route?: string | undefined }[] = [];
  private lastCpuUsage = process.cpuUsage();
  private lastCpuSampleTime = Date.now();
  private cpuPercent = 0;

  constructor() {
    // Sample CPU every 5 seconds
    setInterval(() => this.sampleCpu(), 5000);
  }

  // -----------------------------------------------------------------------
  // Record events
  // -----------------------------------------------------------------------

  recordRequest(metric: RequestMetric): void {
    this.requests.push(metric);
    if (this.requests.length > MAX_REQUEST_HISTORY) {
      this.requests = this.requests.slice(-MAX_REQUEST_HISTORY);
    }
    if (metric.statusCode >= 400) {
      this.recordError(`HTTP ${metric.statusCode}`, metric.route);
    }
  }

  recordError(message: string, route?: string): void {
    this.errors.push({ message, timestamp: Date.now(), route });
    if (this.errors.length > MAX_ERROR_HISTORY) {
      this.errors = this.errors.slice(-MAX_ERROR_HISTORY);
    }
  }

  // -----------------------------------------------------------------------
  // Snapshot
  // -----------------------------------------------------------------------

  getSnapshot(
    queueInfo: { size: number; singles: number; pairs: number },
    roomList: { roomId: string; name: string; clients: number; maxClients: number; createdAt: string }[],
  ): ServerSnapshot {
    const now = Date.now();
    const mem = process.memoryUsage();

    // Request aggregation
    const oneMinAgo = now - 60_000;
    const fiveMinAgo = now - 300_000;
    const last1min = this.requests.filter((r) => r.timestamp >= oneMinAgo);
    const last5min = this.requests.filter((r) => r.timestamp >= fiveMinAgo);

    const totalDuration = this.requests.reduce((sum, r) => sum + r.durationMs, 0);
    const totalErrors = this.requests.filter((r) => r.statusCode >= 400).length;

    return {
      uptime: Math.floor((now - this.startTime) / 1000),
      timestamp: new Date(now).toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid,
      memory: {
        rss: mem.rss,
        heapTotal: mem.heapTotal,
        heapUsed: mem.heapUsed,
        external: mem.external,
      },
      cpuUsage: this.cpuPercent,
      requests: {
        total: this.requests.length,
        last1min: last1min.length,
        last5min: last5min.length,
        avgDurationMs: this.requests.length > 0 ? Math.round(totalDuration / this.requests.length) : 0,
        errorRate: this.requests.length > 0 ? totalErrors / this.requests.length : 0,
        perRoute: this.aggregateRoutes(),
      },
      queue: queueInfo,
      rooms: {
        active: roomList.length,
        roomList,
      },
      errors: {
        total: this.errors.length,
        recent: this.errors.slice(-20).reverse().map((e) => ({
          message: e.message,
          timestamp: new Date(e.timestamp).toISOString(),
          route: e.route,
        })),
      },
    };
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private sampleCpu(): void {
    const now = Date.now();
    const elapsed = (now - this.lastCpuSampleTime) * 1000; // to microseconds
    const usage = process.cpuUsage(this.lastCpuUsage);
    this.cpuPercent = Math.min(1, (usage.user + usage.system) / elapsed);
    this.lastCpuUsage = process.cpuUsage();
    this.lastCpuSampleTime = now;
  }

  private aggregateRoutes(): AggregatedRoute[] {
    const map = new Map<string, RequestMetric[]>();
    for (const r of this.requests) {
      const key = `${r.method} ${r.route}`;
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }

    const result: AggregatedRoute[] = [];
    for (const [, metrics] of map) {
      const sorted = [...metrics].sort((a, b) => a.durationMs - b.durationMs);
      const p95Idx = Math.min(Math.floor(sorted.length * 0.95), sorted.length - 1);
      const totalDuration = metrics.reduce((s, m) => s + m.durationMs, 0);
      result.push({
        method: metrics[0]!.method,
        route: metrics[0]!.route,
        totalRequests: metrics.length,
        avgDurationMs: Math.round(totalDuration / metrics.length),
        p95DurationMs: sorted[p95Idx]!.durationMs,
        errorCount: metrics.filter((m) => m.statusCode >= 400).length,
      });
    }

    return result.sort((a, b) => b.totalRequests - a.totalRequests);
  }
}
