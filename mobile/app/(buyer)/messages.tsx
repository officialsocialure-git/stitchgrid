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
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  Image,
  Modal as RNModal,
  Alert,
  StatusBar,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Colors } from "../../src/constants/colors";
import { Header } from "../../src/components/common/Header";
import { EmptyState } from "../../src/components/common/EmptyState";
import { useAuth } from "../../src/hooks/useAuth";
import { marketplaceService } from "../../src/services/marketplace.service";
import { realtimeService } from "../../src/services/realtime.service";
import { Conversation, Message } from "../../src/types";
import { NewChatModal } from "../../src/components/messages/NewChatModal";

interface ParsedMessage {
  text: string;
  type: "TEXT" | "IMAGE" | "FILE" | "ORDER";
  imageUrl?: string;
  imageLabel?: string;
  fileName?: string;
  fileSize?: string;
  fileUrl?: string;
  orderPo?: string;
  orderStatus?: string;
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
          fileName: parsed.filename || parsed.fileName || "TechPack_Specification.pdf",
          fileSize: parsed.size || parsed.fileSize || "2.4 MB",
          fileUrl: parsed.url || parsed.fileUrl,
        };
      }
      if (parsed.type === "ORDER" || parsed.orderPo) {
        return {
          type: "ORDER",
          text: parsed.text || "",
          orderPo: parsed.orderPo || parsed.poNumber,
          orderStatus: parsed.orderStatus || parsed.status || "ACTIVE",
        };
      }
    } catch {}
  }
  return { text: body, type: "TEXT" };
}

function formatChatTime(dateString?: string): string {
  if (!dateString) return "Live";
  const date = new Date(dateString);
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

export default function BuyerMessagesScreen() {
  const router = useRouter();
  const { user, activeMembership } = useAuth();
  const { targetSupplierOrgId, supplierId, orgId, orgName } = useLocalSearchParams<{
    targetSupplierOrgId?: string;
    supplierId?: string;
    orgId?: string;
    orgName?: string;
  }>();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
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
  const targetId = targetSupplierOrgId || supplierId || orgId;

  // 1. Load All Supplier Conversations
  const loadConversations = useCallback(async () => {
    try {
      const data = await marketplaceService.listConversations();
      const list = Array.isArray(data) ? data : [];
      setConversations(list);

      // Handle deep-link to a specific supplier
      if (targetId && activeMembership?.organizationId) {
        let existing = list.find(
          (c) => c.supplierOrgId === targetId || c.supplier?.id === targetId
        );
        if (!existing) {
          try {
            existing = await marketplaceService.createConversation({
              buyerOrgId: activeMembership.organizationId,
              supplierOrgId: targetId,
            });
            list.unshift(existing);
            setConversations([...list]);
          } catch (e) {}
        }
        if (existing) {
          setSelectedConv(existing);
          return;
        }
      }
    } catch (e) {
      console.warn("Failed to load conversations:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [targetId, activeMembership?.organizationId]);

  // 2. Load Messages for Active Conversation
  const loadMessages = useCallback(async (convId: string) => {
    try {
      const msgs = await marketplaceService.getConversationMessages(convId);
      setMessages(Array.isArray(msgs) ? msgs : []);
    } catch (e) {
      console.warn("Failed to load messages:", e);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (selectedConv) {
      loadMessages(selectedConv.id);
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

    try {
      setSending(true);
      const sent = await marketplaceService.sendMessage(selectedConv.id, body);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? sent : m)));
      loadConversations();
    } catch (e) {
      console.warn("Send message failed:", e);
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
        Alert.alert("Permission Required", "Please grant access to your photo library to share images.");
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

        const base64Uri = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;

        const uploaded = await marketplaceService.uploadFile({
          filename: `sample_${Date.now()}.jpg`,
          data: base64Uri,
          label: "Sample Proof Photo",
        });

        const imagePayload = JSON.stringify({
          type: "IMAGE",
          url: uploaded.url,
          label: "Sample Proof Photo",
          text: "Here is the sample photo for your inspection.",
        });

        const sent = await marketplaceService.sendMessage(selectedConv.id, imagePayload);
        setMessages((prev) => [...prev, sent]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
        loadConversations();
      }
    } catch (err: any) {
      Alert.alert("Upload Failed", err.message || "Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
  };

  // 6. Send Tech Pack / PDF Attachment
  const handleSendTechpack = async () => {
    if (!selectedConv) return;
    setIsAttachmentSheetOpen(false);

    const techPackPayload = JSON.stringify({
      type: "FILE",
      filename: "TechPack_Specification_v2.pdf",
      size: "2.4 MB",
      url: "https://example.com/techpack.pdf",
      text: "Attached is the official garment Tech Pack and measurement tolerance sheet.",
    });

    try {
      setSending(true);
      const sent = await marketplaceService.sendMessage(selectedConv.id, techPackPayload);
      setMessages((prev) => [...prev, sent]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
      loadConversations();
    } catch (err) {
      console.warn("Failed to send Techpack:", err);
    } finally {
      setSending(false);
    }
  };

  // 7. Send Purchase Order Milestone Reference
  const handleSendOrderReference = async () => {
    if (!selectedConv) return;
    setIsAttachmentSheetOpen(false);

    const poNumber = selectedConv.linkedOrder?.poNumber || "SG-PO-2026-4807";
    const status = selectedConv.linkedOrder?.status || "IN_PRODUCTION";

    const orderPayload = JSON.stringify({
      type: "ORDER",
      poNumber,
      status,
      text: `Contract Reference: Purchase Order #${poNumber} (${status.replace(/_/g, " ")})`,
    });

    try {
      setSending(true);
      const sent = await marketplaceService.sendMessage(selectedConv.id, orderPayload);
      setMessages((prev) => [...prev, sent]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
      loadConversations();
    } catch (err) {
      console.warn("Failed to send Order Reference:", err);
    } finally {
      setSending(false);
    }
  };

  // Filtered Conversations List
  const filteredConversations = useMemo(() => {
    let result = [...conversations];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((c) => {
        const name = (c.supplier?.name || c.buyer?.name || "").toLowerCase();
        const city = (c.supplier?.city || c.buyer?.city || "").toLowerCase();
        const lastMsg = (c.messages?.[0]?.body || "").toLowerCase();
        const po = (c.linkedOrder?.poNumber || "").toLowerCase();
        return name.includes(q) || city.includes(q) || lastMsg.includes(q) || po.includes(q);
      });
    }

    if (activeFilterTab === "ORDERS") {
      result = result.filter((c) => Boolean(c.linkedOrder));
    }

    return result;
  }, [conversations, searchQuery, activeFilterTab]);

  const activeSupplierName =
    selectedConv?.supplier?.name ||
    selectedConv?.otherPartyName ||
    orgName ||
    "Verified Manufacturer";

  const activeSupplierCity = selectedConv?.supplier?.city || "India";

  // VIEW 1: WhatsApp Chat List Screen
  if (!selectedConv) {
    return (
      <SafeAreaView
        style={[
          styles.safeArea,
          Platform.OS === "android" ? { paddingTop: StatusBar.currentHeight || 0 } : null,
        ]}
      >
        <Header
          title="Messages"
          subtitle="Multi-supplier B2B messaging network"
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
              placeholder="Search chats, suppliers, or POs..."
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

        {/* Conversations List */}
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
                    ? "No chats found matching your search. Try searching another supplier name."
                    : "Connect with verified mills directly. Chat about RFQs, fabric specs, prototype samples, and purchase orders."
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
            const supplierName = item.supplier?.name || "Verified Factory Partner";
            const initial = supplierName[0]?.toUpperCase() || "M";
            const lastMsg = item.messages?.[0];
            const parsed = parseMessageBody(lastMsg?.body);
            const timeStr = formatChatTime(lastMsg?.createdAt || item.updatedAt || item.createdAt);
            const isMe = lastMsg?.senderUserId === user?.id;

            return (
              <TouchableOpacity
                style={styles.chatItemRow}
                activeOpacity={0.7}
                onPress={() => setSelectedConv(item)}
              >
                {/* Avatar with Online Indicator */}
                <View style={styles.chatAvatar}>
                  <Text style={styles.chatAvatarText}>{initial}</Text>
                  <View style={styles.chatOnlineDot} />
                </View>

                {/* Conversation Details */}
                <View style={styles.chatItemContent}>
                  <View style={styles.chatItemTop}>
                    <Text style={styles.chatItemName} numberOfLines={1}>
                      {supplierName}
                    </Text>
                    <Text style={styles.chatItemTime}>{timeStr}</Text>
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
                          {item.supplier?.city ? `${item.supplier.city}, India` : "Verified Mill"}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Message Preview */}
                  <View style={styles.lastMsgRow}>
                    {isMe && (
                      <Ionicons
                        name="checkmark-done"
                        size={15}
                        color="#2563EB"
                        style={{ marginRight: 4 }}
                      />
                    )}
                    {parsed.type === "IMAGE" ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                        <Ionicons name="camera-outline" size={13} color={Colors.textSecondary} />
                        <Text style={styles.lastMsgMediaText}>Photo</Text>
                      </View>
                    ) : parsed.type === "FILE" ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                        <Ionicons name="document-text-outline" size={13} color={Colors.textSecondary} />
                        <Text style={styles.lastMsgMediaText}>Tech Pack Document</Text>
                      </View>
                    ) : (
                      <Text style={styles.lastMsgText} numberOfLines={1}>
                        {parsed.text || "Tap to start conversation"}
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />

        {/* WhatsApp-Style Floating Action Button */}
        <TouchableOpacity
          style={styles.floatingActionBtn}
          activeOpacity={0.85}
          onPress={() => setIsNewChatOpen(true)}
        >
          <Ionicons name="chatbubble-ellipses" size={24} color="#FFF" />
        </TouchableOpacity>

        {/* New Chat Selection Modal */}
        <NewChatModal
          visible={isNewChatOpen}
          onClose={() => setIsNewChatOpen(false)}
          onSelectSupplier={async (supp) => {
            if (!activeMembership?.organizationId) return;
            try {
              const conv = await marketplaceService.createConversation({
                buyerOrgId: activeMembership.organizationId,
                supplierOrgId: supp.id,
              });
              setSelectedConv(conv);
              loadConversations();
            } catch (err) {
              console.warn("Failed to create conversation:", err);
            }
          }}
        />
      </SafeAreaView>
    );
  }

  // VIEW 2: WhatsApp Individual Conversation Screen
  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        Platform.OS === "android" ? { paddingTop: StatusBar.currentHeight || 0 } : null,
      ]}
    >
      {/* WhatsApp Chat Navigation Bar */}
      <View style={styles.chatNavBar}>
        <TouchableOpacity
          onPress={() => setSelectedConv(null)}
          style={styles.navBackBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.textHeading} />
        </TouchableOpacity>

        {/* Avatar */}
        <View style={styles.navAvatar}>
          <Text style={styles.navAvatarText}>{activeSupplierName[0]?.toUpperCase() || "M"}</Text>
          <View style={styles.navOnlineDot} />
        </View>

        {/* Supplier Title & Status */}
        <View style={styles.navTitleWrap}>
          <Text style={styles.navSupplierName} numberOfLines={1}>
            {activeSupplierName}
          </Text>
          <Text style={styles.navSupplierStatus}>
            ● Active Now • {activeSupplierCity}, India
          </Text>
        </View>

        {/* Linked Contract Action */}
        {selectedConv.linkedOrder && (
          <TouchableOpacity
            style={styles.contractShortcutBtn}
            activeOpacity={0.8}
            onPress={() => router.push("/(buyer)/orders")}
          >
            <Ionicons name="receipt-outline" size={14} color="#5B13EC" />
            <Text style={styles.contractShortcutText}>
              {selectedConv.linkedOrder.poNumber}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Linked Contract Ribbon (if available) */}
      {selectedConv.linkedOrder && (
        <View style={styles.linkedContractRibbon}>
          <Ionicons name="information-circle" size={14} color="#5B13EC" />
          <Text style={styles.linkedContractRibbonText} numberOfLines={1}>
            Linked Contract: {selectedConv.linkedOrder.poNumber} ({selectedConv.linkedOrder.item})
          </Text>
          <TouchableOpacity onPress={() => router.push("/(buyer)/orders")}>
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
          keyExtractor={(item) => item.id || String(Math.random())}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={
            <View style={styles.dateSeparatorContainer}>
              <View style={styles.dateSeparatorPill}>
                <Ionicons name="shield-checkmark" size={12} color="#15803D" />
                <Text style={styles.dateSeparatorText}>
                  Messages are end-to-end encrypted with Milestone Escrow Protection.
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
                      {item.sender?.fullName || activeSupplierName}
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
                        onPress={() => Alert.alert("Download", `Downloading ${parsed.fileName}...`)}
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
                        onPress={() => router.push("/(buyer)/orders")}
                      >
                        <Text style={styles.orderRefBtnText}>View Production Progress →</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={[styles.msgBodyText, isMe && styles.msgBodyTextRight]}>
                      {parsed.text}
                    </Text>
                  )}

                  {/* Message Meta: Timestamp + Delivery Checkmarks */}
                  <View style={styles.msgMetaRow}>
                    <Text style={[styles.timeText, isMe && styles.timeTextRight]}>
                      {timeFormatted}
                    </Text>
                    {isMe && (
                      <Ionicons
                        name="checkmark-done"
                        size={15}
                        color="#38BDF8"
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
        <View style={styles.bottomBarContainer}>
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

          {/* Send Button */}
          <TouchableOpacity
            style={[
              styles.sendCircleBtn,
              (!inputText.trim() && !uploadingImage) && styles.sendBtnDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            activeOpacity={0.85}
          >
            {sending || uploadingImage ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="send" size={17} color="#FFF" style={{ marginLeft: 2 }} />
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
          <View style={styles.attachmentSheet}>
            <View style={styles.sheetDrag} />
            <Text style={styles.attachmentTitle}>Share with Manufacturer</Text>

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
                <Text style={styles.attachOptionLabel}>Photo / Proof</Text>
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
    </SafeAreaView>
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
    paddingBottom: 90,
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
    marginTop: 3,
  },
  lastMsgText: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
  },
  lastMsgMediaText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textHeading,
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
  navSupplierName: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  navSupplierStatus: {
    fontSize: 10,
    color: "#15803D",
    fontWeight: "600",
    marginTop: 1,
  },
  contractShortcutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 8,
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
    maxWidth: "90%",
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
    maxWidth: "80%",
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
    backgroundColor: "#5B13EC",
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
    color: "#FFFFFF",
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
    color: "#E0E7FF",
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
  sendBtnDisabled: {
    opacity: 0.5,
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
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },
  attachOptionLabel: {
    fontSize: 12,
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
