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
import { Card } from "../../src/components/common/Card";
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
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Notifications"
        subtitle="Live production & milestone alerts"
        showBack
        rightAction={
          notifications.some((n) => !n.readAt) ? (
            <TouchableOpacity onPress={handleMarkAllRead} style={styles.markReadBtn}>
              <Text style={styles.markReadText}>Mark all read</Text>
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
              icon="notifications-outline"
              title="All Caught Up"
              description="You have no notifications at this time."
            />
          ) : null
        }
        renderItem={({ item }) => {
          const isUnread = !item.readAt;
          return (
            <Card
              style={[styles.notifCard, isUnread && styles.unreadCard]}
              onPress={() => handleMarkAsRead(item)}
            >
              <View style={styles.topRow}>
                <View style={[styles.iconWrap, isUnread && { backgroundColor: Colors.primary }]}>
                  <Ionicons
                    name="notifications"
                    size={16}
                    color={isUnread ? "#FFFFFF" : Colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.time}>
                    {new Date(item.createdAt).toLocaleDateString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
                {isUnread && <View style={styles.unreadDot} />}
              </View>
              <Text style={styles.content}>{item.body || item.content || ""}</Text>
            </Card>
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
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  markReadBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  markReadText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
  },
  notifCard: {
    marginBottom: 10,
    padding: 14,
  },
  unreadCard: {
    borderColor: Colors.borderPrimary,
    backgroundColor: "#FDFBFF",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 6,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.text,
  },
  time: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  content: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    paddingLeft: 44,
  },
});
