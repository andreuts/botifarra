import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { api } from '../api/client.js';

const OnlinePresenceContext = createContext<number | null>(null);
const HEARTBEAT_INTERVAL_MS = 20_000;
const CLIENT_ID_STORAGE_KEY = 'botifarra-online-client-id';

function getClientId() {
  try {
    const existing = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY);
    if (existing) return existing;
  } catch {
    // Continue with an in-memory id when browser storage is unavailable.
  }

  const clientId = window.crypto?.randomUUID?.()
    ?? `botifarra-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId);
  } catch {
    // The id remains usable for this page session.
  }
  return clientId;
}

export function OnlinePresenceProvider({ children }: PropsWithChildren) {
  const [onlineUsers, setOnlineUsers] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    let heartbeatInFlight = false;
    const clientId = getClientId();

    const sendHeartbeat = async () => {
      if (heartbeatInFlight) return;
      heartbeatInFlight = true;
      try {
        const response = await api.presence.heartbeat(clientId);
        if (active && Number.isSafeInteger(response.onlineUsers)) {
          setOnlineUsers(response.onlineUsers);
        }
      } catch {
        // Keep the last count while the presence endpoint is temporarily unavailable.
      } finally {
        heartbeatInFlight = false;
      }
    };

    void sendHeartbeat();
    const timer = window.setInterval(() => void sendHeartbeat(), HEARTBEAT_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <OnlinePresenceContext.Provider value={onlineUsers}>
      {children}
    </OnlinePresenceContext.Provider>
  );
}

export function useOnlineUserCount() {
  return useContext(OnlinePresenceContext);
}
