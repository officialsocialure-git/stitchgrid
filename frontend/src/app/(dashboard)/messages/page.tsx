"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/common/Button";
import { marketplaceService } from "@/services/marketplace.service";

interface ConvItem {
  id: string;
  name: string;
  lastMsg: string;
  time: string;
  unread: number;
}

interface MessageItem {
  id: string;
  senderUserId: string;
  senderName: string;
  body: string;
  time: string;
  isMe: boolean;
}

export default function MessagesPage() {
  const { user, membership } = useAuth();
  const isSupplier = membership?.role === "SUPPLIER";
  const isBuyer = membership?.role === "BUYER";
  const [conversations, setConversations] = useState<ConvItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>("");
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loadingConv, setLoadingConv] = useState(true);
  const [sending, setSending] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      setLoadingConv(true);
      const data = await marketplaceService.listConversations();
      if (data && data.length > 0) {
        const mapped: ConvItem[] = data.map((c: any) => ({
          id: c.id,
          name: isSupplier
            ? (c.buyer?.name || c.supplier?.name || "Buyer Partner")
            : (c.supplier?.name || c.buyer?.name || "Manufacturing Partner"),
          lastMsg: c.messages?.[0]?.body || "Factory communication channel.",
          time: c.messages?.[0]?.createdAt ? new Date(c.messages[0].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Live",
          unread: 0,
        }));
        setConversations(mapped);
        setActiveChatId(mapped[0].id);
      } else {
        setConversations([]);
        setActiveChatId("");
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
      setConversations([]);
      setActiveChatId("");
    } finally {
      setLoadingConv(false);
    }
  }, []);

  const loadMessages = useCallback(async (convId: string) => {
    if (!convId) {
      setMessages([]);
      return;
    }
    try {
      const data = await marketplaceService.getConversationMessages(convId);
      if (data && data.length > 0) {
        const mapped: MessageItem[] = data.map((m: any) => {
          const isMe = m.senderUserId === user?.id;
          return {
            id: m.id,
            senderUserId: m.senderUserId,
            senderName: isMe ? "You" : "Partner",
            body: m.body,
            time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isMe,
          };
        });
        setMessages(mapped);
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
      setMessages([]);
    }
  }, [user?.id]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (activeChatId) {
      loadMessages(activeChatId);
      const pollTimer = setInterval(() => {
        loadMessages(activeChatId);
      }, 4000);
      return () => clearInterval(pollTimer);
    } else {
      setMessages([]);
    }
  }, [activeChatId, loadMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !activeChatId) return;

    const text = messageText.trim();
    setMessageText("");

    const newMsg: MessageItem = {
      id: `temp_${Date.now()}`,
      senderUserId: user?.id || "me",
      senderName: "You",
      body: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMe: true,
    };
    setMessages((prev) => [...prev, newMsg]);

    try {
      setSending(true);
      await marketplaceService.sendMessage(activeChatId, text);
      await loadMessages(activeChatId);
      await loadConversations();
    } catch (err) {
      console.error("Message send error:", err);
    } finally {
      setSending(false);
    }
  };

  const activeChat = conversations.find((c) => c.id === activeChatId);

  return (
    <div className="h-[calc(100dvh-8rem)] min-h-0 max-w-7xl mx-auto flex rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm overflow-hidden">
      {/* Conversation list: mobile buyer sees this until a conversation is opened. */}
      <div className={`w-full md:w-80 border-r border-surface-container-high flex flex-col shrink-0 ${isBuyer && isMobileChatOpen ? "hidden md:flex" : "flex"}`}>
        <div className="p-4 border-b border-surface-container-high">
          <h2 className="font-sans font-bold text-base text-on-surface">
            {isSupplier ? "Factory Communications" : "Chat"}
          </h2>
          <p className="text-xs text-secondary mt-0.5">Live Direct Messages</p>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-surface-container-high">
          {loadingConv ? (
            <div className="p-6 text-center text-xs font-mono text-secondary">Loading channels...</div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-secondary">
              <span className="material-symbols-outlined text-[28px] text-secondary mb-1">chat</span>
              <p>No active chats</p>
            </div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setActiveChatId(c.id);
                  if (isBuyer) setIsMobileChatOpen(true);
                }}
                className={`w-full p-4 text-left flex items-start gap-3 transition-colors ${
                  activeChatId === c.id ? "bg-surface-container-low" : "hover:bg-surface-container-lowest"
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-primary-fixed text-primary font-bold flex items-center justify-center shrink-0">
                  {c.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-sans font-bold text-xs text-on-surface truncate">{c.name}</span>
                    <span className="text-[10px] text-secondary font-mono">{c.time}</span>
                  </div>
                  <p className="text-xs text-secondary truncate mt-1">{c.lastMsg}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat View: buyer mobile opens this only after selecting a conversation. */}
      <div className={`min-w-0 flex-1 flex flex-col ${isBuyer && !isMobileChatOpen ? "hidden md:flex" : "flex"}`}>
        {activeChat ? (
          <>
            {/* Header */}
            <div className="p-3 sm:p-4 border-b border-surface-container-high flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                {isBuyer && (
                  <button
                    type="button"
                    aria-label="Back to conversations"
                    onClick={() => setIsMobileChatOpen(false)}
                    className="md:hidden h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-primary hover:bg-primary-fixed"
                  >
                    <span className="material-symbols-outlined">arrow_back</span>
                  </button>
                )}
                <div className="w-9 h-9 rounded-xl bg-primary-fixed text-primary font-bold flex items-center justify-center shrink-0">
                  {activeChat.name[0]}
                </div>
                <div>
                  <h3 className="font-sans font-bold text-sm text-on-surface">{activeChat.name}</h3>
                  <span className="text-[11px] text-emerald-600 font-medium">● Active Channel</span>
                </div>
              </div>
              <div className="hidden sm:block shrink-0">
                <Button variant="outline" size="sm" icon="attach_file">
                  Share Techpack
                </Button>
              </div>
            </div>

            {/* Message Thread */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-surface-container-low/30">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-secondary text-xs">
                  <span className="material-symbols-outlined text-[32px] mb-2">forum</span>
                  <p>Send a message to start communicating.</p>
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`flex ${m.isMe ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-md p-3.5 rounded-2xl text-xs shadow-sm ${
                        m.isMe
                          ? "bg-primary text-white"
                          : "bg-surface-container-lowest border border-outline-variant/30 text-on-surface"
                      }`}
                    >
                      {!m.isMe && <p className="font-semibold text-primary mb-1">{m.senderName}</p>}
                      <p>{m.body}</p>
                      <span
                        className={`block mt-1 text-[10px] font-mono text-right ${
                          m.isMe ? "text-purple-200" : "text-secondary"
                        }`}
                      >
                        {m.time}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-surface-container-high flex items-center gap-3 bg-surface-container-lowest">
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type a message or milestone update..."
                className="flex-1 h-11 px-4 rounded-xl border border-outline-variant/40 text-sm focus:outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={sending || !messageText.trim()}
                aria-label="Send message"
                title="Send message"
                className="h-11 w-11 shrink-0 rounded-full bg-[#5B13EC] text-white flex items-center justify-center shadow-sm hover:bg-[#4d0ecf] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[21px]">send</span>
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-secondary">
            <div className="w-16 h-16 rounded-2xl bg-surface-container-low flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[32px] text-secondary">chat</span>
            </div>
            <h3 className="font-bold text-sm text-on-surface">No Conversation Selected</h3>
            <p className="text-xs text-secondary mt-1 max-w-xs">
              When an RFQ or purchase order is initiated, a dedicated direct messaging channel will be created here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
