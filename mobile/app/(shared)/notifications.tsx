import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/colors";
import { Header } from "../../src/components/common/Header";
import { Card } from "../../src/components/common/Card";
import { EmptyState } from "../../src/components/common/EmptyState";
import { realtimeService } from "../../src/services/realtime.service";
import { Notification } from "../../src/types";

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: "n1",
      userId: "u1",
      title: "PP Sample Approved",
      content: "Buyer approved the pre-production sample for Order #SG-PO-4807. Bulk cutting is active.",
      isRead: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: "n2",
      userId: "u1",
      title: "New Quotation Received",
      content: "Tirupur Knits submitted a bid of ₹175/pc for your 5,000 pcs Polo T-Shirts RFQ.",
      isRead: true,
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: "n3",
      userId: "u1",
      title: "Escrow Payment Deposited",
      content: "30% milestone deposit confirmed for Purchase Order #SG-PO-4329.",
      isRead: true,
      createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    },
  ]);

  useEffect(() => {
    const unsub = realtimeService.subscribe("notification:new", (newNotif: any) => {
      if (newNotif) {
        setNotifications((prev) => [newNotif, ...prev]);
      }
    });
    return unsub;
  }, []);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Notifications"
        subtitle="Live production & milestone alerts"
        showBack
        rightAction={
          <TouchableOpacity onPress={markAllRead} style={styles.markReadBtn}>
            <Text style={styles.markReadText}>Mark read</Text>
          </TouchableOpacity>
        }
      />

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="notifications-outline"
            title="All Caught Up"
            description="You have no unread notifications or alerts."
          />
        }
        renderItem={({ item }) => (
          <Card style={[styles.notifCard, !item.isRead && styles.unreadCard]}>
            <View style={styles.topRow}>
              <View style={[styles.iconWrap, !item.isRead && { backgroundColor: Colors.primary }]}>
                <Ionicons
                  name="notifications"
                  size={16}
                  color={!item.isRead ? "#FFFFFF" : Colors.primary}
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
            </View>
            <Text style={styles.content}>{item.content}</Text>
          </Card>
        )}
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
    fontSize: 13,
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

