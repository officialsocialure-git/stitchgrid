import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Linking,
  SafeAreaView,
  ActivityIndicator,
  Image,
  Modal as RNModal,
  Alert,
  StatusBar,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../../src/constants/colors";
import { Header } from "../../src/components/common/Header";
import { EmptyState } from "../../src/components/common/EmptyState";
import { useAuth } from "../../src/hooks/useAuth";
import { marketplaceService } from "../../src/services/marketplace.service";
import { realtimeService } from "../../src/services/realtime.service";
import { Conversation, Message } from "../../src/types";
import { SupplierNewChatModal } from "../../src/components/messages/SupplierNewChatModal";

interface ParsedMessage {
  text: string;
  type: "TEXT" | "IMAGE" | "FILE" | "ORDER" | "SAMPLE";
  imageUrl?: string;
  imageLabel?: string;
  fileName?: string;
  fileSize?: string;
  fileUrl?: string;
  orderPo?: string;
  orderStatus?: string;
  sampleType?: string;
}

function parseMessageBody(body?: string): ParsedMessage {
  if (!body) return { text: "", type: "TEXT" };
  const trimmed = body.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.type === "IMAGE" || parsed.imageUrl) {
        return {
          type: "IMAGE",
          text: parsed.text || parsed.caption || "",
          imageUrl: parsed.url || parsed.imageUrl,
          imageLabel: parsed.label || "Sample Proof Photo",
        };
      }
      if (parsed.type === "FILE" || parsed.fileUrl) {
        return {
          type: "FILE",
          text: parsed.text || "",
          fileName: parsed.filename || parsed.fileName || "File",
          fileSize: parsed.size || parsed.fileSize || "Size not available",
          fileUrl: parsed.url || parsed.fileUrl,
        };
      }
      if (parsed.type === "ORDER" || parsed.orderPo || parsed.poNumber) {
        return {
          type: "ORDER",
          text: parsed.text || "",
          orderPo: parsed.orderPo || parsed.poNumber,
          orderStatus: parsed.orderStatus || parsed.status || "Not available",
        };
      }
      if (parsed.type === "SAMPLE") {
        return {
          type: "SAMPLE",
          text: parsed.text || "Sample update",
          sampleType: parsed.sampleType || "Sample",
        };
      }
    } catch {}
  }
  return { text: body, type: "TEXT" };
}

function formatChatTime(dateString?: string): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 3600 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  } else {
    return date.toLocaleDateString([], { day: "numeric", month: "short" });
  }
}

// Fallback curated B2B garment conversations for supplier testing & seamless offline demo
const INITIAL_SUPPLIER_CONVERSATIONS: (Conversation & { unreadCount?: number })[] = [
  {
    id: "conv-buyer-qspider",
    buyerOrgId: "org-buyer-qspider",
    supplierOrgId: "org-supplier-current",
    buyer: {
      id: "org-buyer-qspider",
      name: "Qspider",
      city: "Bihar",
    },
    linkedOrder: {
      id: "po-2589",
      poNumber: "SG-PO-2026-2589",
      status: "COMPLETED",
      item: "1,000 pcs cargo black pants",
    },
    unreadCount: 2,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    messages: [
      {
        id: "msg-qspider-1",
        conversationId: "conv-buyer-qspider",
        senderUserId: "user-buyer-qspider",
        body: "Please share the final dispatch slip and courier tracking for the cargo pants.",
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        sender: { id: "user-buyer-qspider", fullName: "Qspider Merchandiser" },
      },
    ],
  },
  {
    id: "conv-buyer-trendsetter",
    buyerOrgId: "org-buyer-trendsetter",
    supplierOrgId: "org-supplier-current",
    buyer: {
      id: "org-buyer-trendsetter",
      name: "TrendSetter Apparel Co.",
      city: "Birgunj, UP",
    },
    linkedOrder: {
      id: "po-1197",
      poNumber: "RFQ-2026-1197",
      status: "QUOTE_SENT",
      item: "5,000 tees - 240 GSM Cotton",
    },
    unreadCount: 1,
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    messages: [
      {
        id: "msg-trend-1",
        conversationId: "conv-buyer-trendsetter",
        senderUserId: "user-buyer-trend",
        body: "We reviewed your quote of ₹399/pc with 21 days lead time. Ready to proceed with sampling!",
        createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
        sender: { id: "user-buyer-trend", fullName: "Amit Sharma (Sourcing Lead)" },
      },
    ],
  },
  {
    id: "conv-buyer-dominos",
    buyerOrgId: "org-buyer-dominos",
    supplierOrgId: "org-supplier-current",
    buyer: {
      id: "org-buyer-dominos",
      name: "Dominos Retail & Uniforms",
      city: "Noida, UP",
    },
    linkedOrder: {
      id: "po-0891",
      poNumber: "SG-PO-2026-0891",
      status: "IN_PRODUCTION",
      item: "Corporate Polo Shirts & Aprons",
    },
    unreadCount: 0,
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    messages: [
      {
        id: "msg-dominos-1",
        conversationId: "conv-buyer-dominos",
        senderUserId: "me",
        body: "Fabric batch lab-dips have been approved by the inspection team.",
        createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
        sender: { id: "me", fullName: "You" },
      },
    ],
  },
];

export default function SupplierMessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 0);
  const bottomInset = Math.max(insets.bottom, Platform.OS === "ios" ? 24 : 10);
  const { user, activeMembership } = useAuth();
  const {
    targetBuyerOrgId,
    buyerId,
    orgId,
    orgName,
    poNumber,
  } = useLocalSearchParams<{
    targetBuyerOrgId?: string;
    buyerId?: string;
    orgId?: string;
    orgName?: string;
    poNumber?: string;
  }>();

  const [conversations, setConversations] = useState<(Conversation & { unreadCount?: number })[]>([]);
  const [selectedConv, setSelectedConv] = useState<(Conversation & { unreadCount?: number }) | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilterTab, setActiveFilterTab] = useState<"ALL" | "ORDERS" | "UNREAD">("ALL");

  // Modals state
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isAttachmentSheetOpen, setIsAttachmentSheetOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const targetId = targetBuyerOrgId || buyerId || orgId;

  // 1. Load All Buyer Conversations
  const loadConversations = useCallback(async () => {
    try {
      const data = await marketplaceService.listConversations();
      const list = (Array.isArray(data) ? data : []).filter(
        (conversation) => conversation.supplierOrgId === activeMembership?.organizationId
      );
      setConversations(list as any);

      // Handle deep-link to a specific buyer or order
      if (targetId && activeMembership?.organizationId) {
        let existing = list.find(
          (c) => c.buyerOrgId === targetId || c.buyer?.id === targetId || (poNumber && c.linkedOrder?.poNumber === poNumber)
        );
        if (!existing) {
          try {
            existing = await marketplaceService.createConversation({
              buyerOrgId: targetId,
              supplierOrgId: activeMembership.organizationId,
            });
            list.unshift(existing);
            setConversations([...list] as any);
          } catch (e) {}
        }
        if (existing) {
          setSelectedConv(existing as any);
          return;
        }
      }
    } catch (e) {
      console.warn("Failed to load conversations:", e);
      setConversations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [targetId, poNumber, activeMembership?.organizationId]);

  // 2. Load Messages for Active Conversation
  const loadMessages = useCallback(async (convId: string) => {
    try {
      const msgs = await marketplaceService.getConversationMessages(convId);
      setMessages(Array.isArray(msgs) ? msgs : []);
    } catch (e) {
      console.warn("Failed to load messages:", e);
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (selectedConv) {
      loadMessages(selectedConv.id);
      // Mark as read in local conversation state
      setConversations((prev) =>
        prev.map((c) => (c.id === selectedConv.id ? { ...c, unreadCount: 0 } : c))
      );
    } else {
      setMessages([]);
    }
  }, [selectedConv, loadMessages]);

  // 3. Real-Time Socket Subscription
  useEffect(() => {
    const unsub = realtimeService.subscribe("message:new", (newMsg: any) => {
      if (newMsg && selectedConv && newMsg.conversationId === selectedConv.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
      loadConversations();
    });
    return unsub;
  }, [selectedConv, loadConversations]);

  // 4. Send Text Message
  const handleSend = async () => {
    if (!selectedConv || !inputText.trim() || sending) return;
    const body = inputText.trim();
    setInputText("");

    // Optimistic UI update
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      conversationId: selectedConv.id,
      senderUserId: user?.id || "me",
      body,
      createdAt: new Date().toISOString(),
      sender: { id: user?.id || "me", fullName: user?.fullName || "You" },
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

    // Update conversation last message in list
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConv.id
          ? { ...c, messages: [optimisticMsg], updatedAt: new Date().toISOString() }
          : c
      )
    );

    try {
      setSending(true);
      const sent = await marketplaceService.sendMessage(selectedConv.id, body);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? sent : m)));
      loadConversations();
    } catch (e: any) {
      setMessages((prev) => prev.filter((message) => message.id !== tempId));
      setInputText(body);
      loadConversations();
      Alert.alert(
        "Message Not Sent",
        e?.response?.data?.message || e?.message || "Your message could not be sent. Please try again."
      );
    } finally {
      setSending(false);
    }
  };

  // 5. Send Image Attachment (Expo Image Picker + Upload)
  const handlePickAndSendImage = async () => {
    if (!selectedConv) return;
    setIsAttachmentSheetOpen(false);

    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission Required",
          "Please grant access to your photo library to share sample and production proofs."
        );
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        base64: true,
        quality: 0.8,
      });

      if (!res.canceled && res.assets && res.assets[0]) {
        const asset = res.assets[0];
        setUploadingImage(true);

        if (!asset.base64) {
          throw new Error("The selected image could not be prepared for upload. Please select it again.");
        }
        const mimeType = asset.mimeType || "image/jpeg";
        const extension = mimeType.split("/")[1] || "jpg";
        const base64Uri = `data:${mimeType};base64,${asset.base64}`;
        const uploaded = await marketplaceService.uploadFile({
          filename: asset.fileName || `sample_proof_${Date.now()}.${extension}`,
          data: base64Uri,
          label: "Production Proof Photo",
        });
        const uploadedUrl = uploaded.url;

        const imagePayload = JSON.stringify({
          type: "IMAGE",
          url: uploadedUrl,
          label: "Garment Sample & Production Proof",
          text: "Here is the production proof photo for your review.",
        });

        const tempId = `temp_img_${Date.now()}`;
        const optimisticMsg: Message = {
          id: tempId,
          conversationId: selectedConv.id,
          senderUserId: user?.id || "me",
          body: imagePayload,
          createdAt: new Date().toISOString(),
          sender: { id: user?.id || "me", fullName: user?.fullName || "You" },
        };
        setMessages((prev) => [...prev, optimisticMsg]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

        try {
          const sent = await marketplaceService.sendMessage(selectedConv.id, imagePayload);
          setMessages((prev) => prev.map((m) => (m.id === tempId ? sent : m)));
          loadConversations();
        } catch (sendError: any) {
          setMessages((prev) => prev.filter((message) => message.id !== tempId));
          Alert.alert(
            "Message Not Sent",
            sendError?.response?.data?.message || sendError?.message || "The image could not be sent. Please try again."
          );
        }
      }
    } catch (err: any) {
      Alert.alert("Upload Failed", err.message || "Failed to pick image.");
    } finally {
      setUploadingImage(false);
    }
  };

  // The Web App currently exposes a Tech Pack action without a connected file-upload flow.
  const handleSendTechpack = () => {
    setIsAttachmentSheetOpen(false);
    Alert.alert("Document Sharing", "Document upload is not connected to the Web App messaging workflow yet.");
  };

  // 7. Send Purchase Order Milestone Reference
  const handleSendOrderReference = async () => {
    if (!selectedConv) return;
    setIsAttachmentSheetOpen(false);

    const linkedOrder = selectedConv.linkedOrder;
    if (!linkedOrder?.poNumber) {
      Alert.alert("No Linked Order", "This conversation does not have a purchase order to share.");
      return;
    }
    const poNumberStr = linkedOrder.poNumber;
    const status = linkedOrder.status || "Not available";

    const orderPayload = JSON.stringify({
      type: "ORDER",
      poNumber: poNumberStr,
      orderStatus: status,
      text: `Production Milestone Update: Order #${poNumberStr} is currently ${status.replace(/_/g, " ")}.`,
    });

    const tempId = `temp_order_${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      conversationId: selectedConv.id,
      senderUserId: user?.id || "me",
      body: orderPayload,
      createdAt: new Date().toISOString(),
      sender: { id: user?.id || "me", fullName: user?.fullName || "You" },
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      setSending(true);
      const sent = await marketplaceService.sendMessage(selectedConv.id, orderPayload);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? sent : m)));
      loadConversations();
    } catch (err: any) {
      setMessages((prev) => prev.filter((message) => message.id !== tempId));
      Alert.alert(
        "Message Not Sent",
        err?.response?.data?.message || err?.message || "The order reference could not be sent. Please try again."
      );
    } finally {
      setSending(false);
    }
  };

  // Sample photos and approval status must be submitted from the Samples workflow.
  const handleSendSampleProof = () => {
    setIsAttachmentSheetOpen(false);
    router.push("/(supplier)/samples");
  };

  // Calling is not part of the current Web App messaging workflow.

  // Filtered Conversations List
  const filteredConversations = useMemo(() => {
    let result = [...conversations];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((c) => {
        const name = (c.buyer?.name || c.otherPartyName || "").toLowerCase();
        const city = (c.buyer?.city || "").toLowerCase();
        const lastMsg = (c.messages?.[0]?.body || "").toLowerCase();
        const po = (c.linkedOrder?.poNumber || "").toLowerCase();
        const item = (c.linkedOrder?.item || "").toLowerCase();
        return (
          name.includes(q) ||
          city.includes(q) ||
          lastMsg.includes(q) ||
          po.includes(q) ||
          item.includes(q)
        );
      });
    }

    if (activeFilterTab === "ORDERS") {
      result = result.filter((c) => Boolean(c.linkedOrder));
    } else if (activeFilterTab === "UNREAD") {
      result = result.filter((c) => Boolean(c.unreadCount && c.unreadCount > 0));
    }

    return result;
  }, [conversations, searchQuery, activeFilterTab]);

  const activeBuyerName =
    selectedConv?.buyer?.name ||
    selectedConv?.otherPartyName ||
    orgName ||
    "Buyer not available";

  const activeBuyerCity = selectedConv?.buyer?.city || "India";

  // ==========================================
  // VIEW 1: WhatsApp Chat List Screen
  // ==========================================
  if (!selectedConv) {
    return (
      <View style={styles.safeArea}>
        <Header
          title="Messages"
          subtitle="Multi-buyer B2B messaging network"
          showMenuButton={true}
          rightAction={
            <TouchableOpacity
              onPress={() => setIsNewChatOpen(true)}
              style={styles.newChatHeaderBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={20} color="#5B13EC" />
            </TouchableOpacity>
          }
        />

        {/* WhatsApp-Style Search Bar */}
        <View style={styles.searchBarContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search chats, buyers, or POs..."
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* WhatsApp Filter Chips */}
        <View style={styles.filterChipsRow}>
          {[
            { key: "ALL", label: "All Chats" },
            { key: "ORDERS", label: "Active Orders" },
            { key: "UNREAD", label: "Unread" },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveFilterTab(tab.key as any)}
              style={[
                styles.filterChip,
                activeFilterTab === tab.key && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilterTab === tab.key && styles.filterChipTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Conversations FlatList */}
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadConversations();
              }}
              colors={[Colors.primary]}
            />
          }
          contentContainerStyle={styles.chatListContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            !loading ? (
              <EmptyState
                icon="chatbubbles-outline"
                title="No Conversations Yet"
                description={
                  searchQuery
                    ? "No chats found matching your search. Try searching another buyer or brand name."
                    : "Connect with garment buyers directly. Discuss RFQ pricing, sample revisions, and purchase order milestones."
                }
                actionTitle="Start New Chat"
                onAction={() => setIsNewChatOpen(true)}
              />
            ) : (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#5B13EC" />
                <Text style={styles.loadingText}>Loading conversations...</Text>
              </View>
            )
          }
          renderItem={({ item }) => {
            const buyerName = item.buyer?.name || item.otherPartyName || "Buyer not available";
            const initial = buyerName[0]?.toUpperCase() || "B";
            const lastMsg = item.messages?.[0];
            const parsed = parseMessageBody(lastMsg?.body);
            const timeStr = formatChatTime(lastMsg?.createdAt || item.updatedAt || item.createdAt);
            const isMe = lastMsg?.senderUserId === user?.id || lastMsg?.senderUserId === "me";
            const unread = item.unreadCount || 0;

            return (
              <TouchableOpacity
                style={styles.chatItemRow}
                activeOpacity={0.7}
                onPress={() => setSelectedConv(item)}
              >
                {/* Circular Avatar with Online Indicator */}
                <View style={styles.chatAvatar}>
                  <Text style={styles.chatAvatarText}>{initial}</Text>
                  <View style={styles.chatOnlineDot} />
                </View>

                {/* Conversation Details */}
                <View style={styles.chatItemContent}>
                  <View style={styles.chatItemTop}>
                    <Text style={styles.chatItemName} numberOfLines={1}>
                      {buyerName}
                    </Text>
                    <Text style={[styles.chatItemTime, unread > 0 && styles.chatItemTimeUnread]}>
                      {timeStr}
                    </Text>
                  </View>

                  {/* Context Pill (Linked PO or City) */}
                  <View style={styles.chatItemContextRow}>
                    {item.linkedOrder ? (
                      <View style={styles.poTag}>
                        <Ionicons name="cube-outline" size={10} color="#5B13EC" />
                        <Text style={styles.poTagText}>
                          {item.linkedOrder.poNumber} • {item.linkedOrder.status.replace(/_/g, " ")}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.locationTag}>
                        <Ionicons name="location-outline" size={10} color={Colors.textSecondary} />
                        <Text style={styles.locationTagText}>
                          {item.buyer?.city ? `${item.buyer.city}, India` : "Verified Garment Buyer"}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Message Preview Row */}
                  <View style={styles.lastMsgRow}>
                    <View style={styles.lastMsgLeft}>
                      {isMe && (
                        <Ionicons
                          name="checkmark-done"
                          size={15}
                          color="#2563EB"
                          style={{ marginRight: 4 }}
                        />
                      )}
                      {parsed.type === "IMAGE" ? (
                        <View style={styles.mediaPreviewTag}>
                          <Ionicons name="camera" size={13} color="#15803D" />
                          <Text style={styles.lastMsgMediaText}>Photo Proof</Text>
                        </View>
                      ) : parsed.type === "FILE" ? (
                        <View style={styles.mediaPreviewTag}>
                          <Ionicons name="document-text" size={13} color="#5B13EC" />
                          <Text style={styles.lastMsgMediaText}>Tech Pack Document</Text>
                        </View>
                      ) : parsed.type === "ORDER" ? (
                        <View style={styles.mediaPreviewTag}>
                          <Ionicons name="cube" size={13} color="#1D4ED8" />
                          <Text style={styles.lastMsgMediaText}>PO Reference</Text>
                        </View>
                      ) : parsed.type === "SAMPLE" ? (
                        <View style={styles.mediaPreviewTag}>
                          <Ionicons name="shirt" size={13} color="#7C3AED" />
                          <Text style={styles.lastMsgMediaText}>Sample Submission</Text>
                        </View>
                      ) : (
                        <Text
                          style={[styles.lastMsgText, unread > 0 && styles.lastMsgTextUnread]}
                          numberOfLines={1}
                        >
                          {parsed.text || "Tap to open chat"}
                        </Text>
                      )}
                    </View>

                    {/* Unread Message Count Badge */}
                    {unread > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>{unread}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />

        {/* WhatsApp Floating Action Button */}
        <TouchableOpacity
          style={styles.floatingActionBtn}
          activeOpacity={0.85}
          onPress={() => setIsNewChatOpen(true)}
        >
          <Ionicons name="chatbubble-ellipses" size={24} color="#FFF" />
        </TouchableOpacity>

        {/* New Chat Selection Modal */}
        <SupplierNewChatModal
          visible={isNewChatOpen}
          onClose={() => setIsNewChatOpen(false)}
          onSelectBuyer={async (buyer) => {
            if (!activeMembership?.organizationId) return;
            try {
              const conv = await marketplaceService.createConversation({
                buyerOrgId: buyer.id,
                supplierOrgId: activeMembership.organizationId,
              });
              const enriched: Conversation & { unreadCount?: number } = {
                ...conv,
                buyer: { id: buyer.id, name: buyer.name, city: buyer.city },
                messages: [],
                unreadCount: 0,
              };
              setConversations((prev) => [enriched, ...prev]);
              setSelectedConv(enriched);
            } catch (err: any) {
              console.warn("Failed to create conversation:", err);
              Alert.alert(
                "Unable to Start Conversation",
                err?.response?.data?.message || err?.message || "The conversation could not be created. Please try again."
              );
            }
          }}
        />
      </View>
    );
  }

  // ==========================================
  // VIEW 2: WhatsApp Individual Conversation Screen
  // ==========================================
  return (
    <View style={styles.safeArea}>
      {/* WhatsApp Chat Navigation Bar */}
      <View style={[styles.chatNavBar, { paddingTop: topInset + 6 }]}>
        <TouchableOpacity
          onPress={() => setSelectedConv(null)}
          style={styles.navBackBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.textHeading} />
        </TouchableOpacity>

        {/* Avatar */}
        <View style={styles.navAvatar}>
          <Text style={styles.navAvatarText}>{activeBuyerName[0]?.toUpperCase() || "B"}</Text>

        </View>

        {/* Buyer Title & Online Status */}
        <View style={styles.navTitleWrap}>
          <View style={styles.navNameRow}>
            <Text style={styles.navBuyerName} numberOfLines={1}>
              {activeBuyerName}
            </Text>
            <Ionicons name="shield-checkmark" size={13} color="#15803D" />
          </View>
          <Text style={styles.navBuyerStatus}>STITCHGRID Conversation</Text>
        </View>

        {/* Linked PO Pill Shortcut */}
        {selectedConv.linkedOrder && (
          <TouchableOpacity
            style={styles.contractShortcutBtn}
            activeOpacity={0.8}
            onPress={() => router.push("/(supplier)/orders")}
          >
            <Ionicons name="cube-outline" size={13} color="#5B13EC" />
            <Text style={styles.contractShortcutText}>
              {selectedConv.linkedOrder.poNumber.split("-").pop() || "PO"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Linked Contract Ribbon (if available) */}
      {selectedConv.linkedOrder && (
        <View style={styles.linkedContractRibbon}>
          <Ionicons name="information-circle" size={14} color="#5B13EC" />
          <Text style={styles.linkedContractRibbonText} numberOfLines={1}>
            Contract: {selectedConv.linkedOrder.poNumber} ({selectedConv.linkedOrder.item})
          </Text>
          <TouchableOpacity onPress={() => router.push("/(supplier)/orders")}>
            <Text style={styles.linkedContractViewText}>View Order →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* WhatsApp Message Thread */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
        style={{ flex: 1, backgroundColor: "#F8FAFC" }}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id || `${item.conversationId || "message"}-${item.createdAt || "unknown"}`}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={
            <View style={styles.dateSeparatorContainer}>
              <View style={styles.dateSeparatorPill}>
                <Ionicons name="shield-checkmark" size={12} color="#15803D" />
                <Text style={styles.dateSeparatorText}>
                  Keep RFQ, sample and order updates together in one conversation.
                </Text>
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const isMe =
              item.senderUserId === user?.id ||
              item.sender?.id === user?.id ||
              item.senderUserId === "me";

            const parsed = parseMessageBody(item.body || item.content);
            const timeFormatted = item.createdAt
              ? new Date(item.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Just now";

            return (
              <View style={[styles.msgRow, isMe ? styles.msgRowRight : styles.msgRowLeft]}>
                <View
                  style={[
                    styles.msgBubble,
                    isMe ? styles.msgBubbleRight : styles.msgBubbleLeft,
                  ]}
                >
                  {/* Sender Name for Received Messages */}
                  {!isMe && (
                    <Text style={styles.senderNameLabel}>
                      {item.sender?.fullName || activeBuyerName}
                    </Text>
                  )}

                  {/* Render based on parsed type */}
                  {parsed.type === "IMAGE" && parsed.imageUrl ? (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => setPreviewImageUrl(parsed.imageUrl || null)}
                      style={styles.msgImageContainer}
                    >
                      <Image
                        source={{ uri: parsed.imageUrl }}
                        style={styles.msgImage}
                        resizeMode="cover"
                      />
                      {parsed.text ? (
                        <Text style={[styles.msgBodyText, isMe && styles.msgBodyTextRight]}>
                          {parsed.text}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  ) : parsed.type === "FILE" ? (
                    <View style={styles.msgFileCard}>
                      <View style={styles.fileIconCircle}>
                        <Ionicons name="document-text" size={20} color="#5B13EC" />
                      </View>
                      <View style={{ flex: 1, marginHorizontal: 8 }}>
                        <Text style={styles.fileNameText} numberOfLines={1}>
                          {parsed.fileName}
                        </Text>
                        <Text style={styles.fileSizeText}>{parsed.fileSize}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          if (!parsed.fileUrl) {
                            Alert.alert("File Unavailable", "This message does not contain a valid file link.");
                            return;
                          }
                          Linking.openURL(parsed.fileUrl).catch(() =>
                            Alert.alert("Unable to Open File", "The file link could not be opened. Please try again later.")
                          );
                        }}
                        style={styles.fileDownloadBtn}
                      >
                        <Ionicons name="download-outline" size={16} color="#5B13EC" />
                      </TouchableOpacity>
                    </View>
                  ) : parsed.type === "ORDER" ? (
                    <View style={styles.orderRefCard}>
                      <View style={styles.orderRefTop}>
                        <Ionicons name="cube" size={16} color="#5B13EC" />
                        <Text style={styles.orderRefPoText}>PO #{parsed.orderPo}</Text>
                      </View>
                      <Text style={styles.orderRefStatus}>
                        Status: {parsed.orderStatus?.replace(/_/g, " ")}
                      </Text>
                      <TouchableOpacity
                        style={styles.orderRefBtn}
                        onPress={() => router.push("/(supplier)/orders")}
                      >
                        <Text style={styles.orderRefBtnText}>View Order Milestones →</Text>
                      </TouchableOpacity>
                    </View>
                  ) : parsed.type === "SAMPLE" ? (
                    <View style={styles.sampleRefCard}>
                      <View style={styles.sampleRefTop}>
                        <Ionicons name="shirt-outline" size={16} color="#7C3AED" />
                        <Text style={styles.sampleRefTitle}>{parsed.sampleType}</Text>
                      </View>
                      <Text style={styles.sampleRefText}>{parsed.text}</Text>
                      <TouchableOpacity
                        style={styles.sampleRefBtn}
                        onPress={() => router.push("/(supplier)/samples")}
                      >
                        <Text style={styles.sampleRefBtnText}>Inspect Sample Details →</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={[styles.msgBodyText, isMe && styles.msgBodyTextRight]}>
                      {parsed.text}
                    </Text>
                  )}

                  {/* Message Meta: Timestamp + WhatsApp Delivery Checkmarks */}
                  <View style={styles.msgMetaRow}>
                    <Text style={[styles.timeText, isMe && styles.timeTextRight]}>
                      {timeFormatted}
                    </Text>
                    {isMe && (
                      <Ionicons
                        name="checkmark-done"
                        size={15}
                        color="#2563EB"
                        style={{ marginLeft: 3 }}
                      />
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />

        {/* WhatsApp-Style Bottom Input Bar */}
        <View style={[styles.bottomBarContainer, { paddingBottom: bottomInset }]}>
          {/* Attachment Paperclip Button */}
          <TouchableOpacity
            style={styles.attachBtn}
            onPress={() => setIsAttachmentSheetOpen(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={24} color="#5B13EC" />
          </TouchableOpacity>

          {/* Text Input */}
          <TextInput
            style={styles.chatTextInput}
            placeholder="Type a message or milestone update..."
            placeholderTextColor={Colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={2000}
          />

          {/* Send / Mic Button */}
          <TouchableOpacity
            style={[
              styles.sendCircleBtn,
              !inputText.trim() && !uploadingImage && styles.micCircleBtn,
            ]}
            onPress={
              inputText.trim()
                ? handleSend
                : () =>
                    Alert.alert(
                      "Voice Note",
                      "Hold to record an encrypted audio message for this buyer."
                    )
            }
            disabled={uploadingImage}
            activeOpacity={0.85}
          >
            {sending || uploadingImage ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : inputText.trim() ? (
              <Ionicons name="send" size={17} color="#FFF" style={{ marginLeft: 2 }} />
            ) : (
              <Ionicons name="mic" size={18} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* WhatsApp-Style Attachment Action Sheet Modal */}
      <RNModal
        visible={isAttachmentSheetOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsAttachmentSheetOpen(false)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setIsAttachmentSheetOpen(false)}
          />
          <View style={[styles.attachmentSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.sheetDrag} />
            <Text style={styles.attachmentTitle}>Share with Buyer</Text>

            <View style={styles.attachmentOptionsRow}>
              {/* Photo / Sample Proof */}
              <TouchableOpacity
                style={styles.attachOption}
                activeOpacity={0.8}
                onPress={handlePickAndSendImage}
              >
                <View style={[styles.attachIconCircle, { backgroundColor: "#DCFCE7" }]}>
                  <Ionicons name="camera" size={24} color="#15803D" />
                </View>
                <Text style={styles.attachOptionLabel}>Photo Proof</Text>
              </TouchableOpacity>

              {/* Tech Pack PDF */}
              <TouchableOpacity
                style={styles.attachOption}
                activeOpacity={0.8}
                onPress={handleSendTechpack}
              >
                <View style={[styles.attachIconCircle, { backgroundColor: "#F3E8FF" }]}>
                  <Ionicons name="document-text" size={24} color="#5B13EC" />
                </View>
                <Text style={styles.attachOptionLabel}>Tech Pack</Text>
              </TouchableOpacity>

              {/* Purchase Order Reference */}
              <TouchableOpacity
                style={styles.attachOption}
                activeOpacity={0.8}
                onPress={handleSendOrderReference}
              >
                <View style={[styles.attachIconCircle, { backgroundColor: "#DBEAFE" }]}>
                  <Ionicons name="receipt" size={24} color="#1D4ED8" />
                </View>
                <Text style={styles.attachOptionLabel}>PO Reference</Text>
              </TouchableOpacity>

              {/* Sample Submission Proof */}
              <TouchableOpacity
                style={styles.attachOption}
                activeOpacity={0.8}
                onPress={handleSendSampleProof}
              >
                <View style={[styles.attachIconCircle, { backgroundColor: "#EDE9FE" }]}>
                  <Ionicons name="shirt" size={24} color="#7C3AED" />
                </View>
                <Text style={styles.attachOptionLabel}>Sample Proof</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </RNModal>

      {/* Full-Screen Image Viewer Modal */}
      <RNModal
        visible={Boolean(previewImageUrl)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPreviewImageUrl(null)}
      >
        <View style={styles.imageViewerOverlay}>
          <TouchableOpacity
            style={styles.imageViewerCloseBtn}
            onPress={() => setPreviewImageUrl(null)}
          >
            <Ionicons name="close" size={26} color="#FFF" />
          </TouchableOpacity>

          {previewImageUrl && (
            <Image
              source={{ uri: previewImageUrl }}
              style={styles.imageViewerFull}
              resizeMode="contain"
            />
          )}
        </View>
      </RNModal>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  newChatHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.textHeading,
    padding: 0,
  },
  filterChipsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  filterChipActive: {
    backgroundColor: "#F3E8FF",
    borderColor: "#E9D5FF",
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: "#5B13EC",
  },
  chatListContent: {
    paddingBottom: 110,
  },
  chatItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  chatAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  chatAvatarText: {
    fontSize: 19,
    fontWeight: "900",
    color: "#5B13EC",
  },
  chatOnlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  chatItemContent: {
    flex: 1,
    marginLeft: 12,
  },
  chatItemTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chatItemName: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.textHeading,
    flex: 1,
    marginRight: 8,
  },
  chatItemTime: {
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  chatItemTimeUnread: {
    color: "#5B13EC",
    fontWeight: "700",
  },
  chatItemContextRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  poTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  poTagText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#5B13EC",
    textTransform: "uppercase",
  },
  locationTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  locationTagText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  lastMsgRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  lastMsgLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  lastMsgText: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
  },
  lastMsgTextUnread: {
    color: Colors.textHeading,
    fontWeight: "600",
  },
  mediaPreviewTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  lastMsgMediaText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textHeading,
  },
  unreadBadge: {
    backgroundColor: "#5B13EC",
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  floatingActionBtn: {
    position: "absolute",
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#5B13EC",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#5B13EC",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 10,
  },
  chatNavBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: 8,
  },
  navBackBtn: {
    padding: 4,
  },
  navAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  navAvatarText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#5B13EC",
  },
  navOnlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "#22C55E",
    borderWidth: 1.5,
    borderColor: "#FFF",
  },
  navTitleWrap: {
    flex: 1,
  },
  navNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  navBuyerName: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.textHeading,
    flexShrink: 1,
  },
  navBuyerStatus: {
    fontSize: 10,
    color: "#15803D",
    fontWeight: "600",
    marginTop: 1,
  },
  navActionIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
  contractShortcutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
  },
  contractShortcutText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#5B13EC",
  },
  linkedContractRibbon: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F7F2FF",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#E9D5FF",
    gap: 6,
  },
  linkedContractRibbonText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textHeading,
  },
  linkedContractViewText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#5B13EC",
  },
  messagesContainer: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  dateSeparatorContainer: {
    alignItems: "center",
    marginVertical: 10,
  },
  dateSeparatorPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    maxWidth: "92%",
  },
  dateSeparatorText: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: "600",
    textAlign: "center",
  },
  msgRow: {
    flexDirection: "row",
    marginVertical: 2,
  },
  msgRowRight: {
    justifyContent: "flex-end",
  },
  msgRowLeft: {
    justifyContent: "flex-start",
  },
  msgBubble: {
    maxWidth: "82%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  msgBubbleRight: {
    backgroundColor: "#EDE9FE",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    borderBottomRightRadius: 4,
  },
  msgBubbleLeft: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  senderNameLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#5B13EC",
    marginBottom: 4,
  },
  msgBodyText: {
    fontSize: 14,
    color: Colors.textHeading,
    lineHeight: 20,
  },
  msgBodyTextRight: {
    color: "#1E1B4B",
  },
  msgMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  timeText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  timeTextRight: {
    color: "#6D28D9",
  },
  msgImageContainer: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 4,
  },
  msgImage: {
    width: 220,
    height: 160,
    borderRadius: 12,
    backgroundColor: "#0F172A",
  },
  msgFileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 4,
  },
  fileIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
  },
  fileNameText: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  fileSizeText: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  fileDownloadBtn: {
    padding: 6,
  },
  orderRefCard: {
    backgroundColor: "#F3E8FF",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E9D5FF",
    marginBottom: 4,
  },
  orderRefTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  orderRefPoText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#5B13EC",
  },
  orderRefStatus: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginTop: 3,
  },
  orderRefBtn: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#E9D5FF",
  },
  orderRefBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#5B13EC",
  },
  sampleRefCard: {
    backgroundColor: "#F5F3FF",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#DDD6FE",
    marginBottom: 4,
  },
  sampleRefTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sampleRefTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#7C3AED",
  },
  sampleRefText: {
    fontSize: 12,
    color: Colors.textHeading,
    marginTop: 4,
    lineHeight: 17,
  },
  sampleRefBtn: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#DDD6FE",
  },
  sampleRefBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#7C3AED",
  },
  bottomBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    gap: 8,
  },
  attachBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
  },
  chatTextInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 20,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    color: Colors.textHeading,
  },
  sendCircleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#5B13EC",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#5B13EC",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  micCircleBtn: {
    backgroundColor: "#7C3AED",
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  attachmentSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  sheetDrag: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 12,
  },
  attachmentTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.textHeading,
    marginBottom: 16,
    textAlign: "center",
  },
  attachmentOptionsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  attachOption: {
    alignItems: "center",
    gap: 8,
  },
  attachIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  attachOptionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textHeading,
  },
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  imageViewerCloseBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  imageViewerFull: {
    width: "100%",
    height: "80%",
  },
});
