import { useEffect } from "react";
import { AppState, AppStateStatus } from "react-native";
import { realtimeService } from "../services/realtime.service";

interface UseRealtimeSyncOptions {
  topics?: string[];
  onSync: () => void | Promise<void>;
  pollIntervalMs?: number;
}

export function useRealtimeSync({ topics = ["sync"], onSync, pollIntervalMs }: UseRealtimeSyncOptions) {
  useEffect(() => {
    // 1. Subscribe to Socket events
    const unsubscribes = topics.map((topic) => {
      return realtimeService.subscribe(topic, () => {
        onSync();
      });
    });

    // 2. Refresh on app foreground
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        onSync();
      }
    };
    const appStateSub = AppState.addEventListener("change", handleAppStateChange);

    // 3. Fallback background polling if interval provided
    let timer: any = null;
    if (pollIntervalMs && pollIntervalMs > 0) {
      timer = setInterval(() => {
        if (AppState.currentState === "active") {
          onSync();
        }
      }, pollIntervalMs);
    }

    return () => {
      unsubscribes.forEach((unsub) => unsub());
      appStateSub.remove();
      if (timer) clearInterval(timer);
    };
  }, [topics, onSync, pollIntervalMs]);
}

