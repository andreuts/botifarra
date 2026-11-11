const ONLINE_TTL_MS = 60_000;
const MAX_TRACKED_CLIENTS = 20_000;

/** Tracks anonymous browser connections while their app heartbeat is fresh. */
export class OnlinePresenceService {
  private readonly lastSeenByClient = new Map<string, number>();

  heartbeat(clientId: string, now = Date.now()): number {
    this.pruneExpired(now);

    if (this.lastSeenByClient.has(clientId) || this.lastSeenByClient.size < MAX_TRACKED_CLIENTS) {
      this.lastSeenByClient.set(clientId, now);
    }

    return this.lastSeenByClient.size;
  }

  private pruneExpired(now: number) {
    for (const [clientId, lastSeen] of this.lastSeenByClient) {
      if (now - lastSeen > ONLINE_TTL_MS) this.lastSeenByClient.delete(clientId);
    }
  }
}
