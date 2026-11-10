import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/colors";
import { Header } from "../../src/components/common/Header";
import { EmptyState } from "../../src/components/common/EmptyState";
import { marketplaceService } from "../../src/services/marketplace.service";
import { realtimeService } from "../../src/services/realtime.service";
import { Notification } from "../../src/types";

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await marketplaceService.listNotifications();
      setNotifications(data || []);
    } catch (e) {
      console.warn("Failed to load notifications:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Real-time socket notification listener
  useEffect(() => {
    const unsub = realtimeService.subscribe("notification:new", (newNotif: any) => {
      if (newNotif) {
        setNotifications((prev) => [newNotif, ...prev]);
      }
    });
    return unsub;
  }, []);

  const handleMarkAsRead = async (item: Notification) => {
    if (item.readAt) return;
    try {
      await marketplaceService.markNotificationRead(item.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n))
      );
    } catch (e) {
      console.warn("Could not mark notification read:", e);
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.readAt);
    for (const n of unread) {
      try {
        await marketplaceService.markNotificationRead(n.id);
      } catch (e) {}
    }
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
    );
  };

  const getNotifIcon = (title: string, content?: string) => {
    const text = `${title} ${content || ""}`.toLowerCase();
    if (text.includes("sample")) return { name: "shirt" as const, color: "#d97706", bg: "#fef3c7" };
    if (text.includes("order") || text.includes("po")) return { name: "cube" as const, color: "#059669", bg: "#d1fae5" };
    if (text.includes("message") || text.includes("chat")) return { name: "chatbubble-ellipses" as const, color: "#2563eb", bg: "#dbeafe" };
    return { name: "notifications" as const, color: Colors.primary, bg: Colors.primaryLight };
  };

  const hasUnread = notifications.some((n) => !n.readAt);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Notifications"
        subtitle="Platform updates & contract alerts"
        showBack
        rightAction={
          hasUnread ? (
            <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadNotifications();
            }}
            colors={[Colors.primary]}
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="notifications-off-outline"
              title="All Caught Up"
              description="You have no unread contract alerts, sample updates or messages right now."
            />
          ) : undefined
        }
        renderItem={({ item }) => {
          const isUnread = !item.readAt;
          const icon = getNotifIcon(item.title, item.content);

          return (
            <TouchableOpacity
              style={[styles.notifCard, isUnread && styles.notifCardUnread]}
              onPress={() => handleMarkAsRead(item)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconWrap, { backgroundColor: icon.bg }]}>
                <Ionicons name={icon.name} size={18} color={icon.color} />
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.topRow}>
                  <Text style={[styles.title, isUnread && styles.titleUnread]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {isUnread && <View style={styles.unreadDot} />}
                </View>

                {item.content ? (
                  <Text style={styles.content} numberOfLines={2}>
                    {item.content}
                  </Text>
                ) : null}

                <Text style={styles.timeText}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Today"}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  markAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
  },
  markAllText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primary,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  notifCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  notifCardUnread: {
    backgroundColor: "#fcfaff",
    borderColor: "#ebdcfc",
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textHeading,
    flex: 1,
  },
  titleUnread: {
    fontWeight: "800",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginLeft: 6,
  },
  content: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },
  timeText: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 6,
  },
});
