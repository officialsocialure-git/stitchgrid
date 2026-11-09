"use client";

import { useEffect, useRef, useCallback } from "react";
import { realtime } from "@/services/realtime.service";

interface UseRealtimeSyncOptions {
  topics?: string[];
  onSync: () => void | Promise<void>;
  pollIntervalMs?: number;
  enabled?: boolean;
}

export function useRealtimeSync({
  topics = [],
  onSync,
  pollIntervalMs = 30000,
  enabled = true,
}: UseRealtimeSyncOptions) {
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerSync = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      onSyncRef.current();
    }, 250);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // 1. Subscribe to Socket.IO realtime topics
    const unsubscribe = realtime.subscribe(topics, () => {
      triggerSync();
    });

    // 2. Window focus & tab visibility change listener
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        triggerSync();
      }
    };

    const handleOnline = () => {
      triggerSync();
    };

    const handleCustomSync = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (
        !topics.length ||
        (customEvent.detail?.topic && topics.includes(customEvent.detail.topic))
      ) {
        triggerSync();
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("stitchgrid:sync", handleCustomSync);

    // 3. Fallback polling (automatically paused when tab is hidden to save battery & data)
    let pollInterval: NodeJS.Timeout | null = null;
    if (pollIntervalMs > 0) {
      pollInterval = setInterval(() => {
        if (!document.hidden) {
          triggerSync();
        }
      }, pollIntervalMs);
    }

    return () => {
      unsubscribe();
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("stitchgrid:sync", handleCustomSync);
      if (pollInterval) clearInterval(pollInterval);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [enabled, topics, pollIntervalMs, triggerSync]);
}

