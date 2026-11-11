import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { api } from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';

const OnlinePresenceContext = createContext<number | null>(null);
const HEARTBEAT_INTERVAL_MS = 20_000;

export function OnlinePresenceProvider({ children }: PropsWithChildren) {
  const token = useAuthStore((state) => state.user?.accessToken ?? '');
  const [onlineUsers, setOnlineUsers] = useState<number | null>(null);

  useEffect(() => {
    if (!token) {
      setOnlineUsers(null);
      return;
    }

    let active = true;
    let heartbeatInFlight = false;

    const sendHeartbeat = async () => {
      if (heartbeatInFlight) return;
      heartbeatInFlight = true;
      try {
        const response = await api.presence.heartbeat(token);
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
  }, [token]);

  return (
    <OnlinePresenceContext.Provider value={onlineUsers}>
      {children}
    </OnlinePresenceContext.Provider>
  );
}

export function useOnlineUserCount() {
  return useContext(OnlinePresenceContext);
}
