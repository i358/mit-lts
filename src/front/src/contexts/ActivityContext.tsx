import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { mitAPI, apiClient } from '../services/api';

const WS_PATH = '/v1/ws/activity';

function getActivityWsUrl(): string {
  const base = apiClient.defaults.baseURL || import.meta.env?.VITE_API_URL || 'https://api.habbojoh.com.tr/v1';
  const wsBase = String(base).replace(/^https/, 'wss').replace(/^http/, 'ws');
  return wsBase + WS_PATH;
}

interface ActivityContextValue {
  activeCount: number | null;
}

const ActivityContext = createContext<ActivityContextValue>({ activeCount: null });

export function useActivity() {
  return useContext(ActivityContext);
}

export function ActivityProvider({ children }: { children: React.ReactNode }) {
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let ws: WebSocket | null = null;

    const fetchFallback = async () => {
      try {
        const res = await mitAPI.getActiveUserCount();
        if (mountedRef.current && res?.success === 1 && typeof res.activeCount === 'number') {
          setActiveCount(res.activeCount);
        }
      } catch (_) {}
    };

    const connect = async () => {
      try {
        const res = await mitAPI.getActivityToken();
        if (!mountedRef.current || res?.success !== 1 || !res?.token) {
          fetchFallback();
          return;
        }
        const url = getActivityWsUrl();
        ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!mountedRef.current || !ws) return;
          ws.send(JSON.stringify({ type: 'auth', token: res.token }));
        };

        ws.onmessage = (event) => {
          if (!mountedRef.current) return;
          try {
            const msg = JSON.parse(event.data);
            if (msg?.type === 'auth_ok') return;
            if (msg?.type === 'active_count' && typeof msg.count === 'number') {
              setActiveCount(msg.count);
            }
          } catch (_) {}
        };

        ws.onclose = () => {
          wsRef.current = null;
          if (mountedRef.current) fetchFallback();
        };

        ws.onerror = () => {
          wsRef.current = null;
          if (mountedRef.current) fetchFallback();
        };
      } catch (_) {
        if (mountedRef.current) fetchFallback();
      }
    };

    fetchFallback();
    const fallbackInterval = setInterval(fetchFallback, 30000);

    connect();

    return () => {
      mountedRef.current = false;
      clearInterval(fallbackInterval);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return (
    <ActivityContext.Provider value={{ activeCount }}>
      {children}
    </ActivityContext.Provider>
  );
}
