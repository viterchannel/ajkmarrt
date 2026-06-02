import { createLogger } from "@/lib/logger";
import { ShimmerBlock } from "@/components/ui/shimmer";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { Bot, Check, CheckCheck, Clipboard, Flag, MessageSquare, MoreVertical, Paperclip, Phone, Send, Sparkles, Trash2, UserX, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearch } from "wouter";
import { tDual, type TranslationKey } from "@workspace/i18n";
import { api } from "../lib/api";
import {
  loadAdminChatRiderMessages,
  persistAdminChatRiderMessages,
} from "../lib/adminChatStore";
import { playRequestSound, stopSound } from "../lib/notificationSound";
import { setAiTabActive } from "../lib/push";
import { useAuth } from "../lib/rider-auth";
import { useLanguage } from "../lib/useLanguage";
import { useSocket } from "../lib/socket";
import { toast } from "../hooks/use-toast";

const log = createLogger("[Chat]");

const ADMIN_SUPPORT_ID = "__admin_support__";

interface OtherUser {
  id: string;
  name: string | null;
  ajkId: string | null;
}
interface Conversation {
  id: string;
  otherUser: OtherUser;
  lastMessage: { content: string } | null;
  unreadCount: number;
  lastMessageAt: string | null;
}
interface Message {
  id: string;
  content: string;
  senderId: string;
  messageType: string;
  createdAt: string;
  deliveryStatus: string;
  voiceNoteUrl?: string;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
}
interface CommRequest {
  id: string;
  status: string;
  sender?: { name: string; ajkId: string };
}
interface SearchResult {
  id: string;
  name: string;
  ajkId: string;
  role: string;
}
interface IncomingCallData {
  callId: string;
  callerId: string;
  callerName?: string;
  callerAjkId?: string;
}
interface CallSignal {
  callId: string;
  callerId?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}
interface AiMessage {
  role: "user" | "assistant";
  content: string;
}
interface SupportChatMessage {
  id: string;
  userId: string;
  message: string;
  isFromSupport: boolean;
  createdAt: string;
}

function ConversationSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl p-3">
      <ShimmerBlock className="h-12 w-12 flex-shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <ShimmerBlock className="h-3.5 w-32 rounded" />
        <ShimmerBlock className="h-3 w-48 rounded" />
      </div>
    </div>
  );
}

function MessageSkeleton({ align }: { align: "left" | "right" }) {
  return (
    <div className={`flex ${align === "right" ? "justify-end" : "justify-start"}`}>
      <ShimmerBlock
        className={`h-9 rounded-2xl ${align === "right" ? "w-40 rounded-br-md" : "w-52 rounded-bl-md"}`}
      />
    </div>
  );
}

export default function Chat() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);
  const { socket, adminChatMessages, adminChatUnread, clearAdminChatUnread } = useSocket();
  const search = useSearch();
  const queryClient = useQueryClient();

  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  /* Rider-sent replies in the Admin Support synthetic conversation — persisted
     to localStorage so they survive a full page reload. */
  const [adminSupportRiderMessages, setAdminSupportRiderMessages] = useState<Message[]>(() =>
    loadAdminChatRiderMessages()
  );

  /* Keep rider-sent Admin Support messages persisted whenever they change */
  useEffect(() => {
    persistAdminChatRiderMessages(adminSupportRiderMessages);
  }, [adminSupportRiderMessages]);

  const [input, setInput] = useState("");
  const [searchId, setSearchId] = useState(() => {
    try {
      const params = new URLSearchParams(search);
      return params.get("ajkId") || "";
    } catch {
      return "";
    }
  });
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [sending, setSending] = useState(false);
  const [ajkId, setAjkId] = useState("");

  /* Pre-select the AI tab when the page is opened with ?tab=ai (notification tap),
     or the search tab when opened from an active ride with ?ajkId= (customer chat deep-link) */
  const [tab, setTab] = useState<"chats" | "requests" | "search" | "ai">(() => {
    try {
      const params = new URLSearchParams(search);
      if (params.get("tab") === "ai") return "ai";
      if (params.get("ajkId")) return "search";
    } catch (err) {
      log.error(
        { err: err instanceof Error ? err.message : String(err) },
        "[Chat] URLSearchParams parse failed — defaulting to chats tab"
      );
    }
    return "chats";
  });
  const [typing, setTyping] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);
  const [callTimer, setCallTimer] = useState(0);
  const callTimerRef = useRef(0);
  useEffect(() => {
    callTimerRef.current = callTimer;
  }, [callTimer]);
  const [muted, setMuted] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  /* AI Assistant state */
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiScrollRef = useRef<HTMLDivElement>(null);

  /* When the URL query string changes to ?tab=ai (e.g. rider is already on
     /chat and taps an AI reply notification), switch to the AI Help tab
     immediately without remounting the component. */
  useEffect(() => {
    try {
      const params = new URLSearchParams(search);
      if (params.get("tab") === "ai") setTab("ai");
    } catch (err) {
      log.error(
        { err: err instanceof Error ? err.message : String(err) },
        "[Chat] tab sync URLSearchParams parse failed"
      );
    }
  }, [search]);

  /* Auto-trigger customer search when opened from an active ride with ?ajkId= URL param.
     searchId is already pre-populated from the initializer above; we just need to fire
     the API call once on mount if we detected an ajkId. */
  const didAutoSearchRef = useRef(false);
  useEffect(() => {
    if (!didAutoSearchRef.current && searchId && tab === "search") {
      didAutoSearchRef.current = true;
      void searchUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Notify push.ts whether the AI Help tab is currently the active, visible tab.
     This lets the foreground push handler suppress redundant ai_chat banners
     while the rider is already reading the reply. */
  useEffect(() => {
    const isActive = tab === "ai" && !selectedConv;
    setAiTabActive(isActive);
    return () => {
      setAiTabActive(false);
    };
  }, [tab, selectedConv]);

  /* File upload + overflow menu state */
  const [uploading, setUploading] = useState(false);
  const [showConvMenu, setShowConvMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const trickleIceRef = useRef<boolean | null>(null);

  /* Initialize remote audio element (reused for all tracks) */
  useEffect(() => {
    if (!remoteAudioRef.current) {
      const audio = new Audio();
      audio.autoplay = true;
      audio.setAttribute("playsinline", "true");
      remoteAudioRef.current = audio;
    }
  }, []);

  /* ── React Query: conversations ── */
  const { data: conversationsData, isLoading: convsLoading } = useQuery<Conversation[]>({
    queryKey: ["conversations"],
    queryFn: () => api.apiFetch("/communication/conversations"),
    enabled: !!user?.id,
  });
  const conversations = conversationsData ?? [];

  /* ── React Query: comm requests ── */
  const { data: requestsData, isLoading: requestsLoading } = useQuery<CommRequest[]>({
    queryKey: ["comm-requests"],
    queryFn: () => api.apiFetch("/communication/requests?type=received"),
    enabled: !!user?.id,
  });
  const requests = requestsData ?? [];

  /* ── React Query: support chat history ── */
  const { data: supportChatData, isLoading: supportChatLoading } = useQuery<{
    messages: SupportChatMessage[];
  }>({
    queryKey: ["support-chat-history"],
    queryFn: () => api.getSupportMessages(),
    enabled: !!user?.id,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  /* ── React Query: messages (infinite, pageSize=30) ──
     Page 1 = most recent 30 messages; page 2 = 30 before those, etc.
     Display: reverse page order so oldest appears first at the top. */
  const {
    data: messagesData,
    isLoading: messagesLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<Message[]>({
    queryKey: ["messages", selectedConv?.id],
    queryFn: ({ pageParam }) =>
      api.apiFetch(
        `/communication/conversations/${selectedConv!.id}/messages?limit=30&page=${pageParam as number}`
      ),
    getNextPageParam: (lastPage, allPages) =>
      Array.isArray(lastPage) && lastPage.length >= 30 ? allPages.length + 1 : undefined,
    initialPageParam: 1,
    enabled: !!selectedConv?.id && selectedConv.id !== ADMIN_SUPPORT_ID,
  });

  /* Flatten pages: reverse so older pages come first, newest page at bottom.
     For the synthetic Admin Support conversation combine DB history (both
     directions) with real-time socket-only messages and optimistic pending
     rider messages, deduplicating by id. */
  const messages: Message[] = selectedConv?.id === ADMIN_SUPPORT_ID
    ? (() => {
        const dbMsgs: Message[] = (supportChatData?.messages ?? []).map((m) => ({
          id: m.id,
          content: m.message,
          senderId: m.isFromSupport ? "admin" : (user?.id ?? "rider"),
          messageType: "text" as const,
          createdAt: m.createdAt,
          deliveryStatus: "delivered" as const,
        }));
        const dbIds = new Set(dbMsgs.map((m) => m.id));
        /* Socket-only admin:chat messages not yet persisted via REST */
        const socketOnlyMsgs: Message[] = adminChatMessages
          .filter((m) => !dbIds.has(m.id))
          .map((m) => ({
            id: m.id,
            content: m.message,
            senderId: "admin",
            messageType: "text" as const,
            createdAt: m.sentAt,
            deliveryStatus: "delivered" as const,
          }));
        /* Optimistic rider-sent messages not yet confirmed in DB */
        const pendingMsgs = adminSupportRiderMessages.filter((m) => !dbIds.has(m.id));
        return [...dbMsgs, ...socketOnlyMsgs, ...pendingMsgs].sort(
          (a, b) => (a.createdAt < b.createdAt ? -1 : 1)
        );
      })()
    : (messagesData ? [...messagesData.pages].reverse().flat() : []);

  const endCall = useCallback(() => {
    stopSound();
    /* Idempotent: only call the API if a callId is set — avoids double-end on
       both explicit "End" button press and unmount cleanup. */
    if (callId) {
      api
        .apiFetch(`/communication/calls/${callId}/end`, {
          method: "POST",
          body: JSON.stringify({ duration: callTimerRef.current }),
        })
        .catch((err) => {
          log.error(
            { err: err instanceof Error ? err.message : String(err) },
            "[Chat] endCall API failed"
          );
        });
      const otherId = selectedConv?.otherUser?.id;
      if (otherId && socket) socket.emit("comm:call:end", { callId, targetUserId: otherId });
    }
    /* Clean up peer connection, media streams, and timer.
       Each guard (pcRef.current, localStreamRef.current, timerRef.current) ensures
       double-calls are safe — refs are nulled after the first cleanup. */
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCallActive(false);
    setCallId(null);
    setCallTimer(0);
    setIncomingCall(null);
    trickleIceRef.current = null;
  }, [callId, selectedConv, socket]);

  /* Keep a ref that always points at the latest endCall so socket
     event handlers registered on mount don't capture a stale closure. */
  const endCallRef = useRef(endCall);
  useEffect(() => {
    endCallRef.current = endCall;
  }, [endCall]);

  /* H-02: Release mic on navigation away / component unmount.
     Calls endCallRef.current() which is idempotent — safe even if no call is
     active (callId will be null so the API call is skipped, cleanup is no-op). */
  useEffect(() => {
    return () => {
      endCallRef.current();
      scrollTimersRef.current.forEach((t) => clearTimeout(t));
      scrollTimersRef.current = [];
    };
  }, []);

  /* Stable handler refs — updated every render so closures are always current
     without needing to re-register listeners (which would remove ALL listeners
     for the event, including those registered by other mounted components). */
  const handlersRef = useRef<{
    onMessageNew: (msg: Message) => void;
    onTypingStart: () => void;
    onTypingStop: () => void;
    onMessageRead: () => void;
    onRequestNew: () => void;
    onRequestAccepted: () => void;
    onCallIncoming: (data: IncomingCallData) => Promise<void>;
    onCallEnded: () => void;
    onCallRejected: () => void;
    onCallOffer: (data: CallSignal) => Promise<void>;
    onCallAnswer: (data: CallSignal) => Promise<void>;
    onCallIce: (data: CallSignal) => Promise<void>;
    onCallAnswered: (data: { callId: string }) => void;
    onRequestCancelled: () => void;
    onRequestRejected: () => void;
    onMessageSent: (data: { id: string; conversationId: string }) => void;
    onMessagesReadAll: (data: { conversationId: string }) => void;
  } | null>(null);

  /* Socket event listeners - keyed on user?.id to rebind on user change */
  useEffect(() => {
    if (!socket || !user?.id) return;

    api
      .apiFetch("/communication/me/ajk-id")
      .then((d) => setAjkId(d.ajkId))
      .catch((err) => {
        log.error(
          { err: err instanceof Error ? err.message : String(err) },
          "[Chat] fetchAjkId failed"
        );
      });

    /* Initial data load via React Query — just invalidate to trigger fetches */
    void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    void queryClient.invalidateQueries({ queryKey: ["comm-requests"] });

    const onMessageNew = (msg: Message) => {
      /* Append the new message to the page with the lowest pageParam — that is
         the first fetched (most-recent) page, regardless of how many "load earlier"
         pages have been prepended since. Avoids the fixed-index-0 assumption that
         breaks under pagination reordering. */
      queryClient.setQueryData(
        ["messages", selectedConvRef.current?.id],
        (old: InfiniteData<Message[]> | undefined) => {
          if (!old || !Array.isArray(old.pages)) return old;
          const params = old.pageParams as number[];
          const minParam = params.length > 0 ? Math.min(...params) : 0;
          const pages = old.pages.map((page, i) =>
            params[i] === minParam ? [...page, msg] : page
          );
          return { ...old, pages };
        }
      );
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    };
    const onTypingStart = () => setTyping(true);
    const onTypingStop = () => setTyping(false);
    const onMessageRead = () =>
      queryClient.setQueryData(
        ["messages", selectedConvRef.current?.id],
        (old: InfiniteData<Message[]> | undefined) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) =>
              page.map((m) => ({ ...m, deliveryStatus: "read" }))
            ),
          };
        }
      );
    const onRequestNew = () => {
      void queryClient.invalidateQueries({ queryKey: ["comm-requests"] });
    };
    const onRequestAccepted = () => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["comm-requests"] });
    };
    const onCallIncoming = async (data: IncomingCallData) => {
      setIncomingCall(data);
      playRequestSound();
    };
    const onCallEnded = () => {
      stopSound();
      endCallRef.current();
    };
    const onCallRejected = () => {
      stopSound();
      endCallRef.current();
    };
    const onCallOffer = async (data: CallSignal) => {
      if (!pcRef.current || !data.sdp) return;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(answer);
      if (trickleIceRef.current === false) {
        await new Promise<void>((resolve) => {
          if (!pcRef.current) {
            resolve();
            return;
          }
          pcRef.current.onicegatheringstatechange = () => {
            if (pcRef.current?.iceGatheringState === "complete") resolve();
          };
          setTimeout(resolve, 5000);
        });
      }
      socket.emit("call:signal", {
        type: "answer",
        callId: data.callId,
        targetUserId: data.callerId,
        sdp: pcRef.current?.localDescription,
      });
    };
    const onCallAnswer = async (data: CallSignal) => {
      if (!pcRef.current || !data.sdp) return;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
    };
    const onCallIce = async (data: CallSignal) => {
      if (!pcRef.current || !data.candidate) return;
      await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
    };

    const onCallAnswered = (_data: { callId: string }) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setCallActive(true);
      setCallTimer(0);
      timerRef.current = setInterval(() => setCallTimer((t) => t + 1), 1000);
    };
    const onRequestCancelled = () => {
      void queryClient.invalidateQueries({ queryKey: ["comm-requests"] });
    };
    const onRequestRejected = () => {
      void queryClient.invalidateQueries({ queryKey: ["comm-requests"] });
    };
    const onMessageSent = (data: { id: string; conversationId: string }) => {
      queryClient.setQueryData(
        ["messages", selectedConvRef.current?.id],
        (old: InfiniteData<Message[]> | undefined) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) =>
              page.map((m) => (m.id === data.id ? { ...m, deliveryStatus: "sent" } : m))
            ),
          };
        }
      );
    };
    const onMessagesReadAll = (_data: { conversationId: string }) => {
      queryClient.setQueryData(
        ["messages", selectedConvRef.current?.id],
        (old: InfiniteData<Message[]> | undefined) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) =>
              page.map((m) => ({ ...m, deliveryStatus: "read" }))
            ),
          };
        }
      );
    };

    handlersRef.current = {
      onMessageNew,
      onTypingStart,
      onTypingStop,
      onMessageRead,
      onRequestNew,
      onRequestAccepted,
      onCallIncoming,
      onCallEnded,
      onCallRejected,
      onCallOffer,
      onCallAnswer,
      onCallIce,
      onCallAnswered,
      onRequestCancelled,
      onRequestRejected,
      onMessageSent,
      onMessagesReadAll,
    };

    /* Alias handler: `comm:typing` with { isTyping } dispatches to start/stop */
    const onTyping = (data: { isTyping: boolean; userId: string; conversationId: string }) => {
      if (data.isTyping) onTypingStart();
      else onTypingStop();
    };
    /* Alias handler: `call:signal` dispatches SDP offer/answer and ICE candidates */
    const onCallSignal = (data: {
      type: "offer" | "answer" | "ice-candidate";
      callId: string;
      sdp?: RTCSessionDescriptionInit;
      candidate?: RTCIceCandidateInit;
      callerId?: string;
      targetUserId?: string;
    }) => {
      if (data.type === "offer") void onCallOffer(data as CallSignal);
      else if (data.type === "answer") void onCallAnswer(data as CallSignal);
      else if (data.type === "ice-candidate") void onCallIce(data as CallSignal);
    };

    /* support_message — real-time delivery of support chat messages persisted
       via the REST endpoint (both rider-sent and admin replies).  Appended
       directly into the React Query cache so the UI updates without a refetch. */
    const onSupportMessage = (msg: {
      id: string;
      userId: string;
      message: string;
      isFromSupport: boolean;
      createdAt: string | Date;
    }) => {
      const createdAt =
        typeof msg.createdAt === "string" ? msg.createdAt : new Date(msg.createdAt).toISOString();
      queryClient.setQueryData(
        ["support-chat-history"],
        (old: { messages: SupportChatMessage[] } | undefined) => {
          if (!old) return { messages: [{ ...msg, createdAt }] };
          if (old.messages.some((m) => m.id === msg.id)) return old;
          return { messages: [...old.messages, { id: msg.id, userId: msg.userId, message: msg.message, isFromSupport: msg.isFromSupport, createdAt }] };
        }
      );
      /* Scroll to bottom when a new support message arrives */
      const t = setTimeout(() => {
        const el = scrollRef.current;
        if (el) el.scrollTo(0, el.scrollHeight);
      }, 100);
      scrollTimersRef.current.push(t);
    };

    /* Primary event names (match the server implementation).
       Note: comm:call:offer/answer/ice-candidate listeners are replaced by
       the single call:signal listener below — outgoing signals now emit
       call:signal so the server routes via its canonical call:signal handler. */
    socket.on("comm:message:new", onMessageNew);
    socket.on("comm:typing:start", onTypingStart);
    socket.on("comm:typing:stop", onTypingStop);
    socket.on("comm:message:read", onMessageRead);
    socket.on("comm:request:new", onRequestNew);
    socket.on("comm:request:accepted", onRequestAccepted);
    socket.on("comm:call:incoming", onCallIncoming);
    socket.on("comm:call:ended", onCallEnded);
    socket.on("comm:call:rejected", onCallRejected);
    socket.on("comm:call:answered", onCallAnswered);
    socket.on("comm:request:cancelled", onRequestCancelled);
    socket.on("comm:request:rejected", onRequestRejected);
    socket.on("comm:message:sent", onMessageSent);
    socket.on("comm:messages:read-all", onMessagesReadAll);
    /* Spec-mandated aliases — handled in parallel so either name works */
    socket.on("comm:message", onMessageNew);
    socket.on("comm:typing", onTyping);
    socket.on("call:incoming", onCallIncoming);
    /* call:signal is the canonical SDP/ICE signaling event (offer/answer/ice-candidate) */
    socket.on("call:signal", onCallSignal);
    /* support_message — persisted support chat (both directions) */
    socket.on("support_message", onSupportMessage);

    return () => {
      const h = handlersRef.current;
      if (!h) return;
      socket.off("comm:message:new", h.onMessageNew);
      socket.off("comm:typing:start", h.onTypingStart);
      socket.off("comm:typing:stop", h.onTypingStop);
      socket.off("comm:message:read", h.onMessageRead);
      socket.off("comm:request:new", h.onRequestNew);
      socket.off("comm:request:accepted", h.onRequestAccepted);
      socket.off("comm:call:incoming", h.onCallIncoming);
      socket.off("comm:call:ended", h.onCallEnded);
      socket.off("comm:call:rejected", h.onCallRejected);
      socket.off("comm:call:answered", h.onCallAnswered);
      socket.off("comm:request:cancelled", h.onRequestCancelled);
      socket.off("comm:request:rejected", h.onRequestRejected);
      socket.off("comm:message:sent", h.onMessageSent);
      socket.off("comm:messages:read-all", h.onMessagesReadAll);
      socket.off("comm:message", h.onMessageNew);
      socket.off("comm:typing", onTyping);
      socket.off("call:incoming", h.onCallIncoming);
      socket.off("call:signal", onCallSignal);
      socket.off("support_message", onSupportMessage);
      handlersRef.current = null;
    };
  }, [socket, user?.id, queryClient]); // eslint-disable-line react-hooks/exhaustive-deps

  /* admin:chat — inject new messages from the shared context into the React
     Query conversations cache so the rider sees the "Admin Support" entry on
     the Chats tab without needing to navigate.  The single socket listener
     lives in SocketProvider; this effect only reacts to state changes.
     The unread count comes directly from the context (which is persisted to
     localStorage) rather than being incremented in the cache, so it is
     correct after both hydration and live message delivery. */
  useEffect(() => {
    if (adminChatMessages.length === 0) return;
    const last = adminChatMessages[adminChatMessages.length - 1]!;
    const syntheticConv: Conversation = {
      id: ADMIN_SUPPORT_ID,
      otherUser: { id: "admin", name: "Admin Support", ajkId: "ADMIN" },
      lastMessage: { content: last.message },
      unreadCount: adminChatUnread,
      lastMessageAt: last.sentAt,
    };
    queryClient.setQueryData(["conversations"], (old: Conversation[] | undefined) => {
      if (!old) return [syntheticConv];
      const existing = old.find((c) => c.id === ADMIN_SUPPORT_ID);
      if (existing) {
        return old.map((c) =>
          c.id === ADMIN_SUPPORT_ID
            ? { ...c, lastMessage: { content: last.message }, lastMessageAt: last.sentAt, unreadCount: adminChatUnread }
            : c
        );
      }
      return [syntheticConv, ...old];
    });
  }, [adminChatMessages, adminChatUnread, queryClient]);

  /* Stable ref to selectedConv for use inside socket event handlers that
     were registered once on mount but need the current selected conversation. */
  const selectedConvRef = useRef(selectedConv);
  useEffect(() => {
    selectedConvRef.current = selectedConv;
  }, [selectedConv]);

  const selectConversation = async (conv: Conversation) => {
    setSelectedConv(conv);
    setShowConvMenu(false);
    if (socket && conv.id !== ADMIN_SUPPORT_ID) socket.emit("join", `conversation:${conv.id}`);
    /* Admin Support is a synthetic local conversation — no REST endpoint exists */
    if (conv.id === ADMIN_SUPPORT_ID) {
      /* Clear unread badge — persists to localStorage via the context effect */
      clearAdminChatUnread();
      queryClient.setQueryData(["conversations"], (old: Conversation[] | undefined) => {
        if (!old) return old;
        return old.map((c) => (c.id === ADMIN_SUPPORT_ID ? { ...c, unreadCount: 0 } : c));
      });
      setSendError(null);
      const t = setTimeout(() => {
        const el = scrollRef.current;
        if (el) el.scrollTo(0, el.scrollHeight);
      }, 100);
      scrollTimersRef.current.push(t);
      return;
    }
    try {
      /* Messages are loaded via useInfiniteQuery keyed on conv.id — just
         mark the conversation read and reset any previous send error. */
      await api.apiFetch(`/communication/conversations/${conv.id}/read-all`, { method: "PATCH" });
      setSendError(null);
    } catch (e) {
      setSendError((e as Error)?.message || T("chatFailedOpenConversation"));
    }
    const t = setTimeout(() => {
      const el = scrollRef.current;
      if (el) el.scrollTo(0, el.scrollHeight);
    }, 100);
    scrollTimersRef.current.push(t);
  };

  const sendMessage = async () => {
    if (!input.trim() || !selectedConv || sending) return;
    setSending(true);
    setSendError(null);

    /* Admin Support conversation — persist via REST so the message is stored
       in the DB, then also emit via socket for real-time admin delivery.
       Optimistically appends the message to local state; on success the
       confirmed DB record replaces it; on failure the pending message gains
       deliveryStatus "failed" so the rider can see it did not send. */
    if (selectedConv.id === ADMIN_SUPPORT_ID) {
      const text = input.trim();
      const optimisticId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optimisticMsg: Message = {
        id: optimisticId,
        content: text,
        senderId: user?.id ?? "rider",
        messageType: "text",
        createdAt: new Date().toISOString(),
        deliveryStatus: "sent",
      };
      /* Optimistically add to local pending list */
      setAdminSupportRiderMessages((prev) => [...prev, optimisticMsg]);
      /* Update the last-message preview in the conversation list */
      queryClient.setQueryData(["conversations"], (old: Conversation[] | undefined) => {
        if (!old) return old;
        return old.map((c) =>
          c.id === ADMIN_SUPPORT_ID
            ? { ...c, lastMessage: { content: text }, lastMessageAt: optimisticMsg.createdAt }
            : c
        );
      });
      setInput("");
      setSending(false);
      /* Also emit via socket for real-time admin notification */
      if (socket) socket.emit("rider:chat", { message: text });
      /* Persist to DB — fire-and-forget with retry-on-failure indicator */
      api
        .sendSupportMessage(text)
        .then((res) => {
          /* Replace optimistic entry with confirmed DB record */
          setAdminSupportRiderMessages((prev) => prev.filter((m) => m.id !== optimisticId));
          queryClient.setQueryData(
            ["support-chat-history"],
            (old: { messages: SupportChatMessage[] } | undefined) => {
              const newMsg = res.message;
              if (!old) return { messages: [newMsg] };
              if (old.messages.some((m) => m.id === newMsg.id)) return old;
              return { messages: [...old.messages, newMsg] };
            }
          );
        })
        .catch((err) => {
          log.error(
            { err: err instanceof Error ? err.message : String(err) },
            "[Chat] sendSupportMessage REST failed — marking pending msg as failed"
          );
          /* Mark pending message as failed so the rider sees it did not persist */
          setAdminSupportRiderMessages((prev) =>
            prev.map((m) =>
              m.id === optimisticId ? { ...m, deliveryStatus: "failed" } : m
            )
          );
        });
      return;
    }

    try {
      const msg = await api.apiFetch(`/communication/conversations/${selectedConv.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: input, messageType: "text" }),
      });
      /* Append the sent message optimistically to the messages cache */
      queryClient.setQueryData(
        ["messages", selectedConv.id],
        (old: InfiniteData<Message[]> | undefined) => {
          if (!old) return old;
          const pages = old.pages.map((page, i) =>
            i === 0 ? [...page, msg] : page
          );
          return { ...old, pages };
        }
      );
      setInput("");
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      setSendError((e as Error)?.message || T("chatFailedSendMessage"));
    }
    setSending(false);
  };

  /* ── File / image attachment ── */
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConv) return;
    setUploading(true);
    setSendError(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const uploaded = await api.uploadFile({
        file: base64,
        filename: file.name,
        mimeType: file.type,
      });
      const isImage = file.type.startsWith("image/");
      const msg = await api.apiFetch(`/communication/conversations/${selectedConv.id}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content: isImage ? "[image]" : `[file: ${file.name}]`,
          messageType: isImage ? "image" : "file",
          ...(isImage
            ? { imageUrl: uploaded.url }
            : { fileUrl: uploaded.url, fileName: file.name }),
        }),
      });
      queryClient.setQueryData(
        ["messages", selectedConv.id],
        (old: InfiniteData<Message[]> | undefined) => {
          if (!old) return old;
          const pages = old.pages.map((page, i) =>
            i === 0 ? [...page, msg] : page
          );
          return { ...old, pages };
        }
      );
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      const t = setTimeout(() => {
        const el = scrollRef.current;
        if (el) el.scrollTo(0, el.scrollHeight);
      }, 100);
      scrollTimersRef.current.push(t);
    } catch (e) {
      setSendError((e as Error)?.message || T("chatFailedUploadFile"));
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* ── Block user ── */
  const handleBlock = async () => {
    if (!selectedConv) return;
    setShowConvMenu(false);
    try {
      await api.apiFetch("/communication/block", {
        method: "POST",
        body: JSON.stringify({ blockedUserId: selectedConv.otherUser.id }),
      });
      setSelectedConv(null);
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      setSendError((e as Error)?.message || T("chatFailedBlockUser"));
    }
  };

  /* ── Report user ── */
  const handleReport = async () => {
    if (!selectedConv || !reportReason.trim()) return;
    setShowReportModal(false);
    try {
      await api.apiFetch("/communication/report", {
        method: "POST",
        body: JSON.stringify({ reportedUserId: selectedConv.otherUser.id, reason: reportReason }),
      });
      setReportReason("");
      setSendError(null);
    } catch (e) {
      setSendError((e as Error)?.message || T("chatFailedReportUser"));
    }
  };

  const searchUser = async () => {
    if (!searchId.trim()) return;
    try {
      const result = await api.apiFetch(`/communication/search/${searchId.toUpperCase()}`);
      setSearchResult(result);
    } catch (err) {
      log.error(
        { err: err instanceof Error ? err.message : String(err) },
        "[Chat] searchUser failed"
      );
    }
  };

  const sendRequest = async (receiverId: string) => {
    try {
      await api.apiFetch("/communication/requests", {
        method: "POST",
        body: JSON.stringify({ receiverId }),
      });
      setSearchResult(null);
      setSearchId("");
    } catch (e) {
      setSendError((e as Error)?.message || T("chatFailedSendRequest"));
    }
  };

  const acceptRequest = async (id: string) => {
    try {
      await api.apiFetch(`/communication/requests/${id}/accept`, { method: "PATCH" });
      void queryClient.invalidateQueries({ queryKey: ["comm-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      setSendError((e as Error)?.message || T("chatFailedAcceptRequest"));
    }
  };

  const rejectRequest = async (id: string) => {
    try {
      await api.apiFetch(`/communication/requests/${id}/reject`, { method: "PATCH" });
      void queryClient.invalidateQueries({ queryKey: ["comm-requests"] });
    } catch (e) {
      setSendError((e as Error)?.message || T("chatFailedRejectRequest"));
    }
  };

  const startCall = async (calleeId: string) => {
    try {
      if (pcRef.current) pcRef.current.close();
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop());

      const data = await api.apiFetch("/communication/calls/initiate", {
        method: "POST",
        body: JSON.stringify({ calleeId, conversationId: selectedConv?.id }),
      });

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch (mediaErr) {
        setSendError((mediaErr as Error)?.message || "Microphone access denied");
        return;
      }
      localStreamRef.current = stream;

      setCallId(data.callId);
      setCallActive(true);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setCallTimer((t) => t + 1), 1000);
      const trickleIce = data.trickleIce !== false;
      trickleIceRef.current = trickleIce;

      const pc = new RTCPeerConnection({ iceServers: data.iceServers, iceCandidatePoolSize: 10 });
      pcRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate && trickleIce && socket) {
          socket.emit("call:signal", {
            type: "ice-candidate",
            callId: data.callId,
            targetUserId: calleeId,
            candidate: e.candidate,
          });
        }
      };

      pc.ontrack = (e) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = e.streams[0] ?? null;
          remoteAudioRef.current.play().catch((err) => {
            log.error(
              { err: err instanceof Error ? err.message : String(err) },
              "[Chat] remoteAudio.play (call) failed"
            );
            /* BUG #5: Provide user feedback when audio playback fails */
            if (err instanceof Error && err.name === 'NotAllowedError') {
              toast({
                title: "Audio playback blocked",
                description: "Enable audio playback in your browser settings to hear voice calls",
                variant: "destructive"
              });
            } else {
              toast({
                title: "Voice call audio failed",
                description: "Could not play audio during the call",
                variant: "destructive"
              });
            }
          });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (!trickleIce) {
        await new Promise<void>((resolve) => {
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === "complete") resolve();
          };
          setTimeout(resolve, 5000);
        });
      }
      socket?.emit("call:signal", {
        type: "offer",
        callId: data.callId,
        targetUserId: calleeId,
        sdp: pc.localDescription,
      });
    } catch (e) {
      setSendError((e as Error)?.message || T("chatFailedStartCall"));
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !t.enabled;
      });
      setMuted(!muted);
    }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const handleAcceptCall = async () => {
    try {
      if (!incomingCall) return;
      if (pcRef.current) pcRef.current.close();
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop());

      const ad = await api.apiFetch(`/communication/calls/${incomingCall.callId}/answer`, {
        method: "POST",
      });
      if (timerRef.current) clearInterval(timerRef.current);
      setCallActive(true);
      setCallId(incomingCall.callId);
      timerRef.current = setInterval(() => setCallTimer((t) => t + 1), 1000);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      localStreamRef.current = stream;
      const trickleIce = ad.trickleIce !== false;
      trickleIceRef.current = trickleIce;

      const pc = new RTCPeerConnection({
        iceServers: ad.iceServers || [{ urls: "stun:stun.l.google.com:19302" }],
        iceCandidatePoolSize: 10,
      });
      pcRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate && trickleIce && socket) {
          socket.emit("call:signal", {
            type: "ice-candidate",
            callId: incomingCall.callId,
            targetUserId: incomingCall.callerId,
            candidate: e.candidate,
          });
        }
      };

      pc.ontrack = (e) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = e.streams[0] ?? null;
          remoteAudioRef.current.play().catch((err) => {
            log.error(
              { err: err instanceof Error ? err.message : String(err) },
              "[Chat] remoteAudio.play (answer) failed"
            );
            /* BUG #5: Provide user feedback when audio playback fails */
            if (err instanceof Error && err.name === 'NotAllowedError') {
              toast({
                title: "Audio playback blocked",
                description: "Enable audio playback in your browser settings to hear voice calls",
                variant: "destructive"
              });
            } else {
              toast({
                title: "Voice call audio failed",
                description: "Could not play audio during the call",
                variant: "destructive"
              });
            }
          });
        }
      };

      setIncomingCall(null);
    } catch (e) {
      setSendError((e as Error)?.message || T("chatFailedAnswerCall"));
    }
  };

  /* ── AI Assistant ── */
  const sendAiMessage = async () => {
    const text = aiInput.trim();
    if (!text || aiLoading) return;

    const userMsg: AiMessage = { role: "user", content: text };
    const newHistory = [...aiMessages, userMsg];
    setAiMessages(newHistory);
    setAiInput("");
    setAiLoading(true);

    try {
      const result = await api.aiChat(text, newHistory.slice(-10));
      setAiMessages((prev) => [...prev, { role: "assistant", content: result.reply }]);
    } catch (err) {
      log.error(
        { err: err instanceof Error ? err.message : String(err) },
        "[Chat] aiChat API failed"
      );
    } finally {
      setAiLoading(false);
      const t = setTimeout(() => aiScrollRef.current?.scrollTo(0, aiScrollRef.current.scrollHeight), 100);
      scrollTimersRef.current.push(t);
    }
  };

  const SUGGESTED_QUESTIONS = [
    T("chatAiQ1"),
    T("chatAiQ2"),
    T("chatAiQ3"),
    T("chatAiQ4"),
  ];

  return (
    <div className="flex h-full flex-col bg-surface">
      {incomingCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="mx-4 w-full max-w-sm rounded-3xl bg-card p-8 text-center">
            <div className="mb-4 flex items-center justify-center text-6xl text-muted-foreground"><Phone size={48} /></div>
            <h2 className="mb-2 text-xl font-bold">{T("chatIncomingCall")}</h2>
            <p className="mb-6 text-muted-foreground">
              {incomingCall.callerName} ({incomingCall.callerAjkId})
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={async () => {
                  const captured = incomingCall;
                  setIncomingCall(null);
                  stopSound();
                  if (captured) {
                    try {
                      await api.apiFetch(`/communication/calls/${captured.callId}/reject`, {
                        method: "POST",
                      });
                    } catch (e) {
                      setSendError((e as Error)?.message || T("chatFailedRejectCall"));
                    }
                  }
                }}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-error text-2xl text-white"
              >
                ✕
              </button>
              <button
                onClick={handleAcceptCall}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-success text-2xl text-white"
              >
                <Phone size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {callActive && (
        <div className="flex items-center justify-between bg-success px-4 py-3 text-white">
          <span className="font-bold">🔊 {T("chatCallActive")} — {fmt(callTimer)}</span>
          <div className="flex gap-2">
            <button
              onClick={toggleMute}
              className={`rounded-lg px-3 py-1 text-sm font-bold ${muted ? "bg-error" : "bg-white/20"}`}
            >
              {muted ? T("chatUnmute") : T("chatMute")}
            </button>
            <button onClick={endCall} className="rounded-lg bg-error px-3 py-1 text-sm font-bold">
              {T("chatEnd")}
            </button>
          </div>
        </div>
      )}

      <div className="px-4 pt-4 pb-2">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-white"><MessageSquare size={24} /> {T("chatMessages")}</h1>
          {ajkId && (
            <button
              onClick={() => navigator.clipboard.writeText(ajkId)}
              className="rounded-full bg-success/15 px-3 py-1.5 text-xs font-bold text-success"
            >
              {ajkId} <Clipboard size={12} className="inline" />
            </button>
          )}
        </div>
        {!selectedConv && (
          <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
            {(["chats", "requests", "search", "ai"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex flex-shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition ${tab === t ? "bg-brand text-surface" : "bg-muted text-muted-foreground"}`}
              >
                {t === "ai" && <Sparkles size={13} />}
                {t === "chats"
                  ? T("chatChats")
                  : t === "requests"
                    ? `${T("chatRequests")}${requests.length ? ` (${requests.length})` : ""}`
                    : t === "search"
                      ? T("chatSearchTab")
                      : T("chatAiHelp")}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className={`flex-1 overflow-y-auto px-4 ${tab === "ai" && !selectedConv ? "flex flex-col" : ""}`}
        ref={tab === "ai" ? undefined : scrollRef}
      >
        {selectedConv ? (
          <div className="flex h-full flex-col">
            {/* Conversation header */}
            <div className="mb-3 flex items-center gap-3 border-b py-3">
              <button
                onClick={() => {
                  setSelectedConv(null);
                  setShowConvMenu(false);
                }}
                className="font-bold text-success"
              >
                ← {T("back")}
              </button>
              <div className="flex-1">
                <p className="font-bold text-white">{selectedConv.otherUser?.name || T("chatUserFallback")}</p>
                <p className="text-xs text-muted-foreground">{selectedConv.otherUser?.ajkId}</p>
              </div>
              {selectedConv.id !== ADMIN_SUPPORT_ID && (
                <>
                  <button
                    onClick={() => startCall(selectedConv.otherUser?.id)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-success text-lg text-white"
                  >
                    <Phone size={20} />
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setShowConvMenu((v) => !v)}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-muted transition-colors active:bg-muted/80"
                    >
                      <MoreVertical size={18} className="text-muted-foreground" />
                    </button>
                    {showConvMenu && (
                      <>
                        {/* Click-outside overlay — closes the menu when the user taps anywhere else */}
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowConvMenu(false)}
                        />
                        <div className="absolute top-12 right-0 z-50 min-w-[160px] overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
                          <button
                            onClick={() => {
                              setShowConvMenu(false);
                              setShowReportModal(true);
                            }}
                            className="flex w-full items-center gap-3 px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted active:bg-muted"
                          >
                            <Flag size={15} className="text-warning" /> {T("chatReportUser")}
                          </button>
                          <button
                            onClick={handleBlock}
                            className="flex w-full items-center gap-3 border-t border-border px-4 py-3 text-sm text-error transition-colors hover:bg-error/10 active:bg-error/15"
                          >
                            <UserX size={15} /> {T("chatBlockUser")}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Message list */}
            <div className="flex-1 space-y-2 overflow-y-auto pb-2">
              {/* Load earlier messages button */}
              {hasNextPage && (
                <div className="flex justify-center py-2">
                  <button
                    onClick={() => void fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="rounded-full bg-muted px-4 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/80 disabled:opacity-50"
                  >
                    {isFetchingNextPage ? (
                      <span className="flex items-center gap-1.5">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-border border-t-foreground/30" />
                        {T("loading")}
                      </span>
                    ) : (
                      T("chatLoadEarlierMessages")
                    )}
                  </button>
                </div>
              )}
              {/* Message loading skeletons */}
              {(messagesLoading || (selectedConv?.id === ADMIN_SUPPORT_ID && supportChatLoading)) && (
                <div className="space-y-3 py-2">
                  <MessageSkeleton align="left" />
                  <MessageSkeleton align="right" />
                  <MessageSkeleton align="left" />
                  <MessageSkeleton align="right" />
                </div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderId === user?.id ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${msg.senderId === user?.id ? "rounded-br-md bg-brand text-surface" : "rounded-bl-md bg-muted text-white"}`}
                  >
                    {msg.messageType === "image" && msg.imageUrl ? (
                      <img
                        src={msg.imageUrl}
                        alt={T("chatSharedImage")}
                        className="mb-1 max-h-48 max-w-full rounded-lg object-cover"
                      />
                    ) : msg.messageType === "file" && msg.fileUrl ? (
                      <a
                        href={msg.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-2 text-sm underline ${msg.senderId === user?.id ? "text-success/70" : "text-blue-400"}`}
                      >
                        <Paperclip size={13} /> {msg.fileName || T("chatFileFallback")}
                      </a>
                    ) : (
                      <p className="text-sm">{msg.content}</p>
                    )}
                    <span
                      className={`text-[10px] ${msg.senderId === user?.id ? "text-brand/70" : "text-muted-foreground"}`}
                    >
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {msg.senderId === user?.id && (
                        <span className={`ml-1 inline ${msg.deliveryStatus === "failed" ? "text-error" : "text-brand/70"}`}>
                          {msg.deliveryStatus === "failed" ? "✕" : msg.deliveryStatus === "read" ? <CheckCheck size={10} /> : <Check size={10} />}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              ))}
              {typing && <div className="text-xs text-muted-foreground italic">{T("chatTyping")}</div>}
            </div>
          </div>
        ) : tab === "chats" ? (
          <div className="space-y-2">
            {convsLoading ? (
              <>
                <ConversationSkeleton />
                <ConversationSkeleton />
                <ConversationSkeleton />
                <ConversationSkeleton />
              </>
            ) : conversations.length === 0 ? (
              <div className="py-12 text-center">
                <p className="mb-4 flex items-center justify-center text-5xl text-muted-foreground"><MessageSquare size={48} /></p>
                <p className="font-bold text-muted-foreground">{T("chatNoConversations")}</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-muted"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-lg font-bold text-white">
                    {(conv.otherUser?.name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between">
                      <p className="truncate font-bold">{conv.otherUser?.name || T("chatUserFallback")}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="truncate text-sm text-muted-foreground">
                        {conv.lastMessage?.content || T("chatNoMessages")}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success text-[10px] font-bold text-white">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        ) : tab === "requests" ? (
          <div className="space-y-2">
            {requestsLoading ? (
              <>
                {[28, 24].map((w, i) => (
                  <div key={i} className="flex items-center justify-between rounded-2xl bg-muted p-4">
                    <div className="space-y-2">
                      <ShimmerBlock className={`h-3.5 w-${w} rounded`} />
                      <ShimmerBlock className={`h-3 w-${i === 0 ? 20 : 16} rounded`} />
                    </div>
                    <div className="flex gap-2">
                      <ShimmerBlock className="h-9 w-16 rounded-xl" />
                      <ShimmerBlock className="h-9 w-16 rounded-xl" />
                    </div>
                  </div>
                ))}
              </>
            ) : requests.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground">{T("chatNoPendingRequests")}</p>
            ) : (
              requests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between rounded-2xl bg-muted p-4"
                >
                  <div>
                    <p className="font-bold">{req.sender?.name || T("chatUnknownFallback")}</p>
                    <p className="text-xs text-muted-foreground">{req.sender?.ajkId}</p>
                  </div>
                  {req.status === "pending" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => acceptRequest(req.id)}
                        className="rounded-xl bg-success px-4 py-2 text-sm font-bold text-white"
                      >
                        {T("accept")}
                      </button>
                      <button
                        onClick={() => rejectRequest(req.id)}
                        className="rounded-xl bg-error/15 px-4 py-2 text-sm font-bold text-error"
                      >
                        {T("reject")}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : tab === "search" ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder={T("chatEnterAjkId")}
                className="h-12 flex-1 rounded-xl border px-4 outline-none"
              />
              <button
                onClick={searchUser}
                className="h-12 rounded-xl bg-success px-6 text-sm font-bold text-white"
              >
                {T("chatSearchTab")}
              </button>
            </div>
            {searchResult && (
              <div className="flex items-center justify-between rounded-2xl bg-muted p-4">
                <div>
                  <p className="font-bold">{searchResult.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {searchResult.ajkId} · {searchResult.role}
                  </p>
                </div>
                <button
                  onClick={() => sendRequest(searchResult.id)}
                  className="rounded-xl bg-success px-4 py-2 text-sm font-bold text-white"
                >
                  {T("chatSendRequest")}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ── AI Assistant Tab ── */
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Header card */}
            <div className="mb-4 flex flex-shrink-0 items-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 p-4 text-white">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                <Bot size={22} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-extrabold">{T("chatAiAssistantTitle")}</p>
                <p className="text-xs text-success/70">
                  {T("chatAiSubtitle")}
                </p>
              </div>
              {aiMessages.length > 0 && (
                <button
                  onClick={() => setAiMessages([])}
                  className="rounded-lg bg-white/20 p-1.5"
                  title={T("chatClearChat")}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {/* Messages area */}
            <div className="flex-1 space-y-3 overflow-y-auto pb-3" ref={aiScrollRef}>
              {aiMessages.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-center text-xs font-semibold text-muted-foreground">
                    {T("chatSuggestedQuestions")}
                  </p>
                  {SUGGESTED_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setAiInput(q);
                      }}
                      className="w-full rounded-xl border border-border bg-muted p-3.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:border-brand/40 hover:bg-brand/10"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              ) : (
                aiMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex items-end gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="mt-0.5 mr-2 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-success/15">
                        <Bot size={14} className="text-success" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === "user" ? "rounded-br-md bg-brand text-surface" : "rounded-bl-md bg-muted text-white"}`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
              {aiLoading && (
                <div className="flex justify-start">
                  <div className="mr-2 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-success/15">
                    <Bot size={14} className="text-success" />
                  </div>
                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-muted px-4 py-3">
                    <span
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/20"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/20"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/20"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="flex flex-shrink-0 gap-2 border-t pt-3">
              <input
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendAiMessage()}
                placeholder={T("chatAskPlaceholder")}
                className="h-11 flex-1 rounded-xl border px-4 text-sm outline-none focus:border-success focus:ring-1 focus:ring-success/30"
                disabled={aiLoading}
              />
              <button
                onClick={sendAiMessage}
                disabled={aiLoading || !aiInput.trim()}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-surface transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedConv && (
        <div className="border-t border-border bg-surface p-4">
          {sendError && (
            <div className="mb-3 flex items-center justify-between rounded-lg bg-error/10 p-3 text-sm text-error">
              <span>{sendError}</span>
              <button onClick={() => setSendError(null)} className="ml-2 font-bold text-error">
                <X size={14} />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            {/* File attachment — hidden for Admin Support (text-only channel) */}
            {selectedConv.id !== ADMIN_SUPPORT_ID && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,application/pdf,.doc,.docx,.txt"
                  onChange={handleFileSelect}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors active:bg-muted/80 disabled:opacity-50"
                  title={T("chatAttachFile")}
                >
                  {uploading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-success border-t-transparent" />
                  ) : (
                    <Paperclip size={18} />
                  )}
                </button>
              </>
            )}
            <input
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (selectedConv.id !== ADMIN_SUPPORT_ID) {
                  socket?.emit("comm:typing:start", {
                    conversationId: selectedConv.id,
                    userId: user?.id,
                  });
                  socket?.emit("rider:typing", {
                    isTyping: true,
                    conversationId: selectedConv.id,
                    userId: user?.id,
                  });
                }
              }}
              onBlur={() => {
                if (selectedConv.id !== ADMIN_SUPPORT_ID) {
                  socket?.emit("comm:typing:stop", {
                    conversationId: selectedConv.id,
                    userId: user?.id,
                  });
                  socket?.emit("rider:typing", {
                    isTyping: false,
                    conversationId: selectedConv.id,
                    userId: user?.id,
                  });
                }
              }}
              placeholder={selectedConv.id === ADMIN_SUPPORT_ID ? T("chatReplyAdmin") : T("chatTypeMessage")}
              className="h-12 flex-1 rounded-xl border px-4 outline-none"
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <button
              onClick={sendMessage}
              disabled={sending}
              className="h-12 rounded-xl bg-success px-6 font-bold text-white disabled:opacity-50"
            >
              {T("send")}
            </button>
          </div>
        </div>
      )}

      {/* Report modal */}
      {showReportModal && selectedConv && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-t-3xl bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-extrabold text-white">
                <Flag size={16} className="text-warning" /> {T("chatReport")}{" "}
                {selectedConv.otherUser?.name || T("chatUserFallback")}
              </h3>
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportReason("");
                }}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted"
              >
                <X size={14} className="text-muted-foreground" />
              </button>
            </div>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder={T("chatReportDesc")}
              className="mb-4 min-h-[100px] w-full resize-none rounded-2xl border-2 border-border p-3 text-sm outline-none focus:border-amber-400"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportReason("");
                }}
                className="flex-1 rounded-2xl border-2 border-border py-3 text-sm font-bold text-muted-foreground"
              >
                {T("cancel")}
              </button>
              <button
                onClick={handleReport}
                disabled={!reportReason.trim()}
                className="flex-1 rounded-2xl bg-warning py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {T("chatSubmitReport")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
