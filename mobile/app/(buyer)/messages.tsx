import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/colors";
import { Header } from "../../src/components/common/Header";
import { useAuth } from "../../src/hooks/useAuth";
import { marketplaceService } from "../../src/services/marketplace.service";
import { realtimeService } from "../../src/services/realtime.service";
import { Conversation, Message } from "../../src/types";

export default function BuyerMessagesScreen() {
  const { user, activeMembership } = useAuth();
  const { targetSupplierOrgId } = useLocalSearchParams<{ targetSupplierOrgId?: string }>();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const loadConversations = useCallback(async () => {
    try {
      const data = await marketplaceService.listConversations();
      const list = data || [];
      setConversations(list);

      if (targetSupplierOrgId && activeMembership?.organizationId) {
        let existing = list.find((c) => c.supplierOrgId === targetSupplierOrgId);
        if (!existing) {
          try {
            existing = await marketplaceService.createConversation({
              buyerOrgId: activeMembership.organizationId,
              supplierOrgId: targetSupplierOrgId,
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

      if (list.length > 0 && !selectedConv) {
        setSelectedConv(list[0]);
      }
    } catch (e) {
      console.warn("Failed to load conversations:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedConv, targetSupplierOrgId, activeMembership?.organizationId]);

  const loadMessages = useCallback(async (convId: string) => {
    try {
      const msgs = await marketplaceService.getConversationMessages(convId);
      setMessages(msgs || []);
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
    }
  }, [selectedConv, loadMessages]);

  useEffect(() => {
    const unsub = realtimeService.subscribe("message:new", (newMsg: any) => {
      if (newMsg && selectedConv && newMsg.conversationId === selectedConv.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        flatListRef.current?.scrollToEnd({ animated: true });
      }
    });
    return unsub;
  }, [selectedConv]);

  const handleSend = async () => {
    if (!selectedConv || !inputText.trim() || sending) return;
    const body = inputText.trim();
    setInputText("");
    try {
      setSending(true);
      const sent = await marketplaceService.sendMessage(selectedConv.id, body);
      setMessages((prev) => {
        if (prev.some((m) => m.id === sent.id)) return prev;
        return [...prev, sent];
      });
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (e) {
      console.warn("Send message failed:", e);
    } finally {
      setSending(false);
    }
  };

  const otherName =
    selectedConv?.supplier?.name ||
    selectedConv?.otherPartyName ||
    "Factory Partner";

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title={conversations.length > 0 ? otherName : "Messages"}
        subtitle="Direct verified B2B communication"
      />

      {/* Conversation Switcher Tabs */}
      {conversations.length > 1 && (
        <View style={styles.convTabsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.convTabs}
          >
            {conversations.map((c) => {
              const name = c.supplier?.name || c.otherPartyName || "Factory";
              const isSelected = selectedConv?.id === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setSelectedConv(c)}
                  style={[styles.convTab, isSelected && styles.convTabActive]}
                >
                  <Text style={[styles.convTabText, isSelected && styles.convTabTextActive]}>
                    {name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {conversations.length === 0 && !loading ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="chatbubbles-outline" size={32} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No Conversations Yet</Text>
            <Text style={styles.emptyDesc}>
              Messages with garment mills regarding your RFQs, samples, and contracts will appear here in real time.
            </Text>
          </View>
        ) : (
          <>
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id || String(Math.random())}
              contentContainerStyle={styles.messagesList}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
              renderItem={({ item }) => {
                const isMe = item.senderUserId === user?.id || item.sender?.id === user?.id;
                const messageText = item.body || item.content || "";
                return (
                  <View style={[styles.msgRow, isMe ? styles.msgRowRight : styles.msgRowLeft]}>
                    <View style={[styles.msgBubble, isMe ? styles.msgBubbleRight : styles.msgBubbleLeft]}>
                      <Text style={[styles.msgText, isMe ? styles.msgTextRight : styles.msgTextLeft]}>
                        {messageText}
                      </Text>
                      <Text style={[styles.timeText, isMe ? styles.timeTextRight : styles.timeTextLeft]}>
                        {item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Just now"}
                      </Text>
                    </View>
                  </View>
                );
              }}
            />

            {/* Input Bar */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.messageInput}
                placeholder={`Message ${otherName}...`}
                placeholderTextColor={Colors.textMuted}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity
                style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                onPress={handleSend}
                disabled={!inputText.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  convTabsContainer: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 8,
  },
  convTabs: {
    paddingHorizontal: 16,
    gap: 8,
  },
  convTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  convTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  convTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.slate600,
  },
  convTabTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  messagesList: {
    padding: 16,
    paddingBottom: 20,
    gap: 10,
  },
  msgRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  msgRowRight: {
    justifyContent: "flex-end",
  },
  msgRowLeft: {
    justifyContent: "flex-start",
  },
  msgBubble: {
    maxWidth: "80%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  msgBubbleRight: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  msgBubbleLeft: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: 4,
  },
  msgText: {
    fontSize: 14,
    lineHeight: 19,
  },
  msgTextRight: {
    color: "#FFFFFF",
  },
  msgTextLeft: {
    color: Colors.textHeading,
  },
  timeText: {
    fontSize: 10,
    marginTop: 4,
  },
  timeTextRight: {
    color: "rgba(255, 255, 255, 0.7)",
    textAlign: "right",
  },
  timeTextLeft: {
    color: Colors.textMuted,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
  },
  messageInput: {
    flex: 1,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 14,
    color: Colors.textHeading,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: Colors.slate300,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  emptyDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
    maxWidth: 280,
  },
});
