const ONLINE_TTL_MS = 60_000;
const MAX_TRACKED_USERS = 20_000;

/** Tracks authenticated users while their app heartbeat is fresh. */
export class OnlinePresenceService {
  private readonly lastSeenByUser = new Map<string, number>();

  heartbeat(userId: string, now = Date.now()): number {
    this.pruneExpired(now);

    if (this.lastSeenByUser.has(userId) || this.lastSeenByUser.size < MAX_TRACKED_USERS) {
      this.lastSeenByUser.set(userId, now);
    }

    return this.lastSeenByUser.size;
  }

  private pruneExpired(now: number) {
    for (const [userId, lastSeen] of this.lastSeenByUser) {
      if (now - lastSeen > ONLINE_TTL_MS) this.lastSeenByUser.delete(userId);
    }
  }
}
