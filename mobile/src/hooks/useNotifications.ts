import { useState, useEffect, useCallback, useMemo } from "react";
import { marketplaceService } from "../services/marketplace.service";
import { realtimeService } from "../services/realtime.service";
import { Notification } from "../types";

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const refresh = useCallback(async () => {
    try {
      const data = await marketplaceService.listNotifications();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (error) {
      console.warn("Failed to load notifications:", error);
    }
  }, []);

  useEffect(() => {
    refresh();
    const unsubscribe = realtimeService.subscribe("notification:new", (newNotif: any) => {
      if (newNotif) {
        setNotifications((prev) => [newNotif, ...prev]);
      }
    });
    return () => {
      unsubscribe();
    };
  }, [refresh]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.readAt).length,
    [notifications]
  );

  const markRead = useCallback(async (id: string) => {
    try {
      await marketplaceService.markNotificationRead(id);
      setNotifications((current) =>
        current.map((n) =>
          n.id === id ? { ...n, readAt: new Date().toISOString() } : n
        )
      );
    } catch (e) {
      console.warn("Failed to mark read:", e);
    }
  }, []);

  return {
    notifications,
    unreadCount,
    refresh,
    markRead,
  };
}

