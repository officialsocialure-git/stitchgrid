import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { isRealtimeConnected, subscribeRealtime } from '@/services/realtime';

/**
 * Refreshes only the mounted screen when a relevant backend event arrives.
 * A low-frequency fallback is retained only while the socket is disconnected.
 */
export function useRealtimeRefresh(
  refresh: (quiet?: boolean) => void | Promise<void>,
  topics: string[],
  fallbackMs = 60000,
) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const topicsKey = topics.join('|');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastRefreshAt = 0;
    const allowedTopics = new Set(topicsKey.split('|'));

    const runRefresh = () => {
      const now = Date.now();
      if (now - lastRefreshAt < 1200) return;
      lastRefreshAt = now;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void refreshRef.current(true); }, 250);
    };

    const unsubscribe = subscribeRealtime(payload => {
      if (payload.topic === 'connection:restored' || allowedTopics.has('*') || allowedTopics.has(payload.topic)) {
        runRefresh();
      }
    });

    const fallback = setInterval(() => {
      if (AppState.currentState === 'active' && !isRealtimeConnected()) runRefresh();
    }, fallbackMs);

    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') runRefresh();
    });

    return () => {
      unsubscribe();
      clearInterval(fallback);
      appState.remove();
      if (timer) clearTimeout(timer);
    };
  }, [topicsKey, fallbackMs]);
}
