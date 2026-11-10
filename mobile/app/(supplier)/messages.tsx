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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/colors";
import { Header } from "../../src/components/common/Header";
import { useAuth } from "../../src/hooks/useAuth";
import { marketplaceService } from "../../src/services/marketplace.service";
import { realtimeService } from "../../src/services/realtime.service";
import { Conversation, Message } from "../../src/types";

export default function SupplierMessagesScreen() {
  const { user } = useAuth();
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
      setConversations(data || []);
      if (data && data.length > 0 && !selectedConv) {
        setSelectedConv(data[0]);
      }
    } catch (e) {
      console.warn("Failed to load conversations:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedConv]);

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
        setMessages((prev) => [...prev, newMsg]);
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
      setMessages((prev) => [...prev, sent]);
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (e) {
      console.warn("Send message failed:", e);
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title={selectedConv ? (selectedConv.otherPartyName || "Buyer Chat") : "Client Chats"}
        subtitle={selectedConv ? "Direct factory communication" : "Active buyer inquiries"}
        showBack={!!selectedConv && conversations.length > 1}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {conversations.length === 0 && !loading ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No Messages</Text>
            <Text style={styles.emptyDesc}>
              Messages from buyers inquiring about RFQs, fabric samples, and deliveries will show here.
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
                return (
                  <View style={[styles.msgRow, isMe ? styles.msgRowRight : styles.msgRowLeft]}>
                    <View style={[styles.bubble, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
                      {!isMe && (
                        <Text style={styles.senderLabel}>
                          {item.sender?.fullName || "Buyer"}
                        </Text>
                      )}
                      <Text style={[styles.msgText, isMe ? styles.msgTextRight : styles.msgTextLeft]}>
                        {item.content}
                      </Text>
                      <Text style={[styles.timeText, isMe ? styles.timeRight : styles.timeLeft]}>
                        {item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                      </Text>
                    </View>
                  </View>
                );
              }}
            />

            <View style={styles.inputBar}>
              <TextInput
                style={styles.chatInput}
                placeholder="Reply to buyer..."
                placeholderTextColor={Colors.textMuted}
                value={inputText}
                onChangeText={setInputText}
                multiline
              />
              <TouchableOpacity
                onPress={handleSend}
                disabled={!inputText.trim() || sending}
                style={[styles.sendButton, !inputText.trim() && { opacity: 0.5 }]}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="send" size={18} color="#FFFFFF" />
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
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 20,
  },
  msgRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  msgRowLeft: {
    justifyContent: "flex-start",
  },
  msgRowRight: {
    justifyContent: "flex-end",
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleLeft: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleRight: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  senderLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primary,
    marginBottom: 2,
  },
  msgText: {
    fontSize: 14,
    lineHeight: 20,
  },
  msgTextLeft: {
    color: Colors.text,
  },
  msgTextRight: {
    color: "#FFFFFF",
  },
  timeText: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  timeLeft: {
    color: Colors.textMuted,
  },
  timeRight: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
  },
  chatInput: {
    flex: 1,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    color: Colors.text,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});

