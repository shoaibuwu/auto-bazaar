import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import {
  getMyInquiriesWithMeta,
  getInquiryById,
  sendCarInquiry,
  sendInquiryReply,
  markInquiryRead,
  deleteInquiry,
} from "../api/inquiries.api";
import { getCarById } from "../api/cars.api";

const BACKEND_BASE = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

const QUICK_REPLIES_BUYER = [
  { label: "Still available?", text: "Hi, is this vehicle still available?", type: "text" },
  {
    label: "Schedule inspection",
    text: "I would like to schedule a physical inspection and test drive.",
    type: "viewing",
  },
  {
    label: "Final price?",
    text: "What is your best final price for a serious cash buyer?",
    type: "text",
  },
];

const QUICK_REPLIES_SELLER = [
  { label: "Available now", text: "Yes, the vehicle is still available for viewing.", type: "text" },
  {
    label: "Book inspection",
    text: "You can inspect the car today. Let me know what time suits you.",
    type: "viewing",
  },
  {
    label: "Papers verified",
    text: "Original registration book, biometric smart card, and token taxes are complete.",
    type: "text",
  },
];

function dedupeMessages(messages = []) {
  const seen = new Set();
  const unique = [];
  for (const m of messages) {
    const key = m?._id ? String(m._id) : `${m?.sender}-${m?.createdAt}-${m?.text}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(m);
    }
  }
  return unique;
}

function formatTimeShort(dateValue) {
  if (!dateValue) return "";
  const d = new Date(dateValue);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-PK", { month: "short", day: "numeric" });
}

function formatMessageTime(dateValue) {
  if (!dateValue) return "";
  return new Date(dateValue).toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InquiriesPage({ onOpenAuth }) {
  const { user, isAuthenticated } = useAuth();
  const {
    socket,
    isConnected,
    onlineMap,
    refreshUnreadCount,
    checkUsersOnline,
  } = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentUserId = user?._id || user?.id ? String(user._id || user.id) : null;

  // Inbox list & active conversation state
  const [inquiries, setInquiries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState(() => {
    const t = searchParams.get("tab");
    return t === "received" || t === "sent" ? t : "all";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState(
    () => searchParams.get("thread") || null
  );
  const [draftThread, setDraftThread] = useState(null);
  const [mobileShowChat, setMobileShowChat] = useState(
    Boolean(searchParams.get("thread") || searchParams.get("carId"))
  );

  // Active thread composer state
  const [draftText, setDraftText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [showOfferBar, setShowOfferBar] = useState(false);
  const [offerPriceInput, setOfferPriceInput] = useState("");

  // Typing & delete confirmation modal state
  const [typingByThread, setTypingByThread] = useState({});
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);

  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingEmittedRef = useRef(false);
  const selectedIdRef = useRef(selectedId);
  const userRef = useRef(user);
  const setSearchParamsRef = useRef(setSearchParams);
  const initialThreadParamRef = useRef(searchParams.get("thread"));
  const initialCarIdParamRef = useRef(searchParams.get("carId"));
  const handledCarIdRef = useRef(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    setSearchParamsRef.current = setSearchParams;
  }, [setSearchParams]);

  const urlCarIdParam = searchParams.get("carId");

  // Helper: Open an existing thread for a car or prepare an unsent draft chat
  const openCarChatTarget = useCallback(
    async (targetCarId, currentList) => {
      if (!targetCarId || !currentUserId) return;

      const existingCarThread = currentList.find(
        (i) =>
          String(i.car?._id || i.car) === String(targetCarId) &&
          String(i.buyer?._id || i.buyer) === currentUserId
      );

      if (existingCarThread) {
        setDraftThread(null);
        setSelectedId(existingCarThread._id);
        setMobileShowChat(true);
        setSearchParamsRef.current({ thread: existingCarThread._id }, { replace: true });
        return;
      }

      try {
        const carData = await getCarById(targetCarId);
        const sId = String(carData?.seller?._id || carData?.seller || "");
        if (carData && sId && sId !== currentUserId) {
          const currentUser = userRef.current;
          const draftObj = {
            _id: `draft-${carData.id}`,
            isDraft: true,
            car: {
              _id: carData.id,
              title: carData.title,
              price: carData.price,
              images:
                carData.images?.length > 0
                  ? carData.images
                  : carData.image
                    ? [carData.image]
                    : [],
              city: carData.city,
              year: carData.year,
            },
            buyer: {
              _id: currentUserId,
              name: currentUser?.name || "You",
              email: currentUser?.email,
              phoneNumber: currentUser?.phoneNumber,
            },
            seller:
              typeof carData.seller === "object"
                ? carData.seller
                : { _id: sId, name: "Verified Seller" },
            phone: carData.seller?.phoneNumber || "",
            messages: [],
            lastMessage: "Start a live conversation...",
            lastMessageAt: new Date().toISOString(),
            unreadByBuyer: 0,
            unreadBySeller: 0,
          };
          setDraftThread(draftObj);
          setSelectedId(draftObj._id);
          setMobileShowChat(true);
          checkUsersOnline([sId]);
        } else if (currentList.length > 0) {
          setSelectedId(currentList[0]._id);
        }
      } catch {
        if (currentList.length > 0) setSelectedId(currentList[0]._id);
      }
    },
    [currentUserId, checkUsersOnline]
  );

  // Fetch full conversation list from backend
  const fetchInquiries = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setIsLoading(true);
      setError("");
      const { inquiries: list } = await getMyInquiriesWithMeta();
      setInquiries(list);

      // Query online presence for all counterparts
      const counterpartIds = [];
      list.forEach((inq) => {
        const bId = String(inq.buyer?._id || inq.buyer || "");
        const sId = String(inq.seller?._id || inq.seller || "");
        if (bId && bId !== currentUserId) counterpartIds.push(bId);
        if (sId && sId !== currentUserId) counterpartIds.push(sId);
      });

      if (counterpartIds.length > 0) {
        checkUsersOnline([...new Set(counterpartIds)]);
      }

      // Auto-select requested thread, car draft, or first item
      const urlThread = initialThreadParamRef.current;
      const urlCarId = initialCarIdParamRef.current;

      if (urlThread && list.some((i) => String(i._id) === String(urlThread))) {
        setSelectedId(urlThread);
        setMobileShowChat(true);
      } else if (urlCarId) {
        handledCarIdRef.current = urlCarId;
        await openCarChatTarget(urlCarId, list);
      } else if (!selectedIdRef.current && list.length > 0) {
        setSelectedId(list[0]._id);
      }
    } catch (err) {
      console.error("Failed to load inquiries:", err);
      setError(err.message || "Failed to load inquiries.");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, currentUserId, checkUsersOnline, openCarChatTarget]);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  // Also react if user navigates to /inquiries?carId=<id> while page is mounted
  useEffect(() => {
    if (!urlCarIdParam) {
      handledCarIdRef.current = null;
      return;
    }
    if (isLoading || !isAuthenticated || !currentUserId) return;
    if (handledCarIdRef.current === urlCarIdParam) return;
    handledCarIdRef.current = urlCarIdParam;
    openCarChatTarget(urlCarIdParam, inquiries);
  }, [isLoading, isAuthenticated, currentUserId, urlCarIdParam, inquiries, openCarChatTarget]);

  // Open a thread: fetch latest + mark read
  const handleSelectThread = useCallback(
    async (inquiryId) => {
      if (!inquiryId) return;
      if (String(inquiryId) !== String(selectedIdRef.current)) {
        setShowOfferBar(false);
        setOfferPriceInput("");
      }
      setSelectedId(inquiryId);
      setMobileShowChat(true);
      setSendError("");

      if (String(inquiryId).startsWith("draft-")) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete("thread");
        if (draftThread?.car?._id) {
          nextParams.set("carId", draftThread.car._id);
        }
        setSearchParams(nextParams, { replace: true });
        return;
      }

      // Update URL param cleanly without page reload
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("carId");
      nextParams.set("thread", inquiryId);
      setSearchParams(nextParams, { replace: true });

      try {
        const fullInquiry = await getInquiryById(inquiryId);
        if (fullInquiry) {
          setInquiries((prev) =>
            prev.map((item) =>
              String(item._id) === String(inquiryId) ? fullInquiry : item
            )
          );
          refreshUnreadCount();
        }
      } catch (err) {
        console.warn("Could not refresh thread:", err.message);
      }
    },
    [searchParams, setSearchParams, refreshUnreadCount, draftThread]
  );

  // If initial selectedId has unread messages for current user, mark it read once
  useEffect(() => {
    if (!selectedId || !currentUserId || String(selectedId).startsWith("draft-")) return;
    const active = inquiries.find((i) => String(i._id) === String(selectedId));
    if (!active || active.isDraft) return;

    const isSeller = String(active.seller?._id || active.seller) === currentUserId;
    const myUnread = isSeller ? active.unreadBySeller : active.unreadByBuyer;
    if (myUnread > 0) {
      markInquiryRead(selectedId)
        .then(() => {
          setInquiries((prev) =>
            prev.map((item) => {
              if (String(item._id) !== String(selectedId)) return item;
              return {
                ...item,
                unreadBySeller: isSeller ? 0 : item.unreadBySeller,
                unreadByBuyer: !isSeller ? 0 : item.unreadByBuyer,
                status: isSeller ? "read" : item.status,
              };
            })
          );
          refreshUnreadCount();
        })
        .catch(() => { });
    }
  }, [selectedId, currentUserId, inquiries, refreshUnreadCount]);

  // Join active Socket.IO thread room & listen to real-time events
  useEffect(() => {
    if (!socket || !selectedId || String(selectedId).startsWith("draft-")) return;

    socket.emit("thread:join", selectedId);

    return () => {
      socket.emit("thread:leave", selectedId);
    };
  }, [socket, selectedId]);

  useEffect(() => {
    if (!socket || !currentUserId) return;

    const handleIncomingMessage = ({ inquiryId, message, inquiry: updatedInquiry }) => {
      setInquiries((prev) => {
        const idx = prev.findIndex((i) => String(i._id) === String(inquiryId));
        if (idx === -1 && updatedInquiry) {
          return [updatedInquiry, ...prev];
        }
        const next = prev.map((item) => {
          if (String(item._id) !== String(inquiryId)) return item;
          if (updatedInquiry) {
            return {
              ...updatedInquiry,
              messages: dedupeMessages([
                ...(item.messages || []),
                ...(updatedInquiry.messages || []),
              ]),
            };
          }
          return {
            ...item,
            messages: dedupeMessages([...(item.messages || []), message]),
            lastMessage: message?.text || item.lastMessage,
            lastMessageAt: message?.createdAt || new Date().toISOString(),
          };
        });

        // Sort threads newest first by lastMessageAt
        return [...next].sort(
          (a, b) =>
            new Date(b.lastMessageAt || b.createdAt) -
            new Date(a.lastMessageAt || a.createdAt)
        );
      });

      // Clear typing indicator once message arrives
      setTypingByThread((prev) => {
        if (!prev[inquiryId]) return prev;
        const copy = { ...prev };
        delete copy[inquiryId];
        return copy;
      });

      // If this thread is currently open and counterpart sent message, mark read immediately
      const senderId = String(message?.sender?._id || message?.sender || "");
      if (
        String(selectedIdRef.current) === String(inquiryId) &&
        senderId !== currentUserId
      ) {
        markInquiryRead(inquiryId).then(() => refreshUnreadCount()).catch(() => { });
      }
    };

    const handleNewThread = ({ inquiry }) => {
      if (!inquiry) return;
      setInquiries((prev) => {
        if (prev.some((i) => String(i._id) === String(inquiry._id))) return prev;
        return [inquiry, ...prev];
      });
    };

    const handleThreadRead = ({ inquiryId, readBy }) => {
      setInquiries((prev) =>
        prev.map((item) => {
          if (String(item._id) !== String(inquiryId)) return item;
          const sellerId = String(item.seller?._id || item.seller);
          const readByIsSeller = String(readBy) === sellerId;
          return {
            ...item,
            unreadBySeller: readByIsSeller ? 0 : item.unreadBySeller,
            unreadByBuyer: !readByIsSeller ? 0 : item.unreadByBuyer,
            status: readByIsSeller ? "read" : item.status,
            messages: (item.messages || []).map((m) => ({
              ...m,
              readBy: m.readBy?.some((r) => String(r) === String(readBy))
                ? m.readBy
                : [...(m.readBy || []), readBy],
            })),
          };
        })
      );
    };

    const handleThreadDeleted = ({ inquiryId }) => {
      setInquiries((prev) => {
        const remaining = prev.filter((i) => String(i._id) !== String(inquiryId));
        if (String(selectedIdRef.current) === String(inquiryId)) {
          setSelectedId(remaining[0]?._id || null);
          setMobileShowChat(false);
        }
        return remaining;
      });
    };

    const handleTypingStart = ({ inquiryId, userId, name }) => {
      if (String(userId) === currentUserId) return;
      setTypingByThread((prev) => ({
        ...prev,
        [inquiryId]: { userId, name: name || "Participant" },
      }));
    };

    const handleTypingStop = ({ inquiryId }) => {
      setTypingByThread((prev) => {
        if (!prev[inquiryId]) return prev;
        const copy = { ...prev };
        delete copy[inquiryId];
        return copy;
      });
    };

    socket.on("inquiry:message", handleIncomingMessage);
    socket.on("inquiry:updated", handleIncomingMessage);
    socket.on("inquiry:new", handleNewThread);
    socket.on("inquiry:read", handleThreadRead);
    socket.on("inquiry:deleted", handleThreadDeleted);
    socket.on("typing:start", handleTypingStart);
    socket.on("typing:stop", handleTypingStop);

    return () => {
      socket.off("inquiry:message", handleIncomingMessage);
      socket.off("inquiry:updated", handleIncomingMessage);
      socket.off("inquiry:new", handleNewThread);
      socket.off("inquiry:read", handleThreadRead);
      socket.off("inquiry:deleted", handleThreadDeleted);
      socket.off("typing:start", handleTypingStart);
      socket.off("typing:stop", handleTypingStop);
    };
  }, [socket, currentUserId, refreshUnreadCount]);

  // Auto-scroll to latest message whenever active thread or typing state updates
  const selectedThread = useMemo(() => {
    if (draftThread && String(draftThread._id) === String(selectedId)) {
      return draftThread;
    }
    return inquiries.find((i) => String(i._id) === String(selectedId)) || null;
  }, [draftThread, inquiries, selectedId]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [selectedThread?.messages?.length, selectedId, typingByThread[selectedId]]);

  // Emit typing indicators while composing
  const handleDraftChange = (value) => {
    setDraftText(value);
    if (!socket || !selectedId || String(selectedId).startsWith("draft-")) return;

    if (value.trim() && !isTypingEmittedRef.current) {
      socket.emit("typing:start", { inquiryId: selectedId });
      isTypingEmittedRef.current = true;
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingEmittedRef.current) {
        socket.emit("typing:stop", { inquiryId: selectedId });
        isTypingEmittedRef.current = false;
      }
    }, 1800);
  };

  // Step offer price up or down from 0 in clean PKR 5,000 increments
  const handleAdjustOffer = (delta) => {
    const currentVal = Number(offerPriceInput || 0);
    const safeCurrent = Number.isNaN(currentVal) ? 0 : currentVal;
    const next = Math.max(0, safeCurrent + delta);
    setOfferPriceInput(String(next));
  };

  // Send a message (creates thread if draft, or replies to existing thread)
  const handleSendMessage = async (
    e,
    overridePayload = null
  ) => {
    if (e) e.preventDefault();
    if (!selectedId || isSending) return;

    const textToSend = overridePayload?.text ?? draftText.trim();
    const parsedOffer = Number(offerPriceInput);
    const hasValidOffer =
      showOfferBar && Number.isFinite(parsedOffer) && parsedOffer > 0;
    const messageType =
      overridePayload?.messageType ?? (hasValidOffer ? "offer" : "text");
    const offerPrice =
      overridePayload?.offerPrice ?? (hasValidOffer ? parsedOffer : undefined);

    if (!textToSend && messageType !== "offer") return;

    const finalText =
      textToSend ||
      (messageType === "offer" && offerPrice
        ? `I would like to make an offer of PKR ${Number(offerPrice).toLocaleString("en-PK")}.`
        : "");

    if (!finalText) return;

    try {
      setIsSending(true);
      setSendError("");

      // Stop typing indicator right away
      if (socket && isTypingEmittedRef.current && !String(selectedId).startsWith("draft-")) {
        socket.emit("typing:stop", { inquiryId: selectedId });
        isTypingEmittedRef.current = false;
      }

      if (selectedThread?.isDraft) {
        const carIdTarget = selectedThread.car?._id;
        if (!carIdTarget) {
          throw new Error("Vehicle reference is missing.");
        }

        const created = await sendCarInquiry(carIdTarget, {
          message: finalText,
          phoneNumber: user?.phoneNumber || "",
          messageType,
          offerPrice,
        });

        if (created) {
          const normalized = {
            ...created,
            messages: dedupeMessages(created.messages || []),
          };
          setDraftThread(null);
          setInquiries((prev) => {
            const exists = prev.some((i) => String(i._id) === String(created._id));
            const next = exists
              ? prev.map((i) => (String(i._id) === String(created._id) ? normalized : i))
              : [normalized, ...prev];
            return [...next].sort(
              (a, b) =>
                new Date(b.lastMessageAt || b.createdAt) -
                new Date(a.lastMessageAt || a.createdAt)
            );
          });
          setSelectedId(created._id);
          setMobileShowChat(true);
          const nextParams = new URLSearchParams(searchParams);
          nextParams.delete("carId");
          nextParams.set("thread", created._id);
          setSearchParams(nextParams, { replace: true });
        }
      } else {
        const res = await sendInquiryReply(selectedId, {
          text: finalText,
          messageType,
          offerPrice,
        });

        const updatedThread = res?.inquiry;
        if (updatedThread) {
          setInquiries((prev) => {
            const next = prev.map((item) =>
              String(item._id) === String(selectedId)
                ? {
                  ...updatedThread,
                  messages: dedupeMessages(updatedThread.messages || []),
                }
                : item
            );
            return [...next].sort(
              (a, b) =>
                new Date(b.lastMessageAt || b.createdAt) -
                new Date(a.lastMessageAt || a.createdAt)
            );
          });
        }
      }

      if (!overridePayload) {
        setDraftText("");
        setOfferPriceInput("");
        setShowOfferBar(false);
      }
    } catch (err) {
      setSendError(err.message || "Failed to send message.");
    } finally {
      setIsSending(false);
    }
  };

  // Delete confirmed inquiry thread
  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    if (String(confirmDeleteId).startsWith("draft-")) {
      setDraftThread(null);
      setSelectedId(inquiries[0]?._id || null);
      setConfirmDeleteId(null);
      return;
    }
    try {
      setDeletingId(confirmDeleteId);
      const deletedTargetId = confirmDeleteId;
      await deleteInquiry(deletedTargetId);
      setInquiries((prev) =>
        prev.filter((item) => String(item._id) !== String(deletedTargetId))
      );
      if (String(selectedId) === String(deletedTargetId)) {
        const nextThread = inquiries.find(
          (item) => String(item._id) !== String(deletedTargetId)
        );
        setSelectedId(nextThread?._id || null);
        setMobileShowChat(false);
        if (searchParams.get("thread") === String(deletedTargetId)) {
          const nextParams = new URLSearchParams(searchParams);
          if (nextThread?._id) nextParams.set("thread", nextThread._id);
          else nextParams.delete("thread");
          setSearchParams(nextParams, { replace: true });
        }
      }
      refreshUnreadCount();
      setActionNotice({
        type: "success",
        message: "Conversation removed from your inbox.",
      });
      setTimeout(() => setActionNotice(null), 3500);
    } catch (err) {
      setActionNotice({
        type: "error",
        message: err.message || "Failed to delete conversation.",
      });
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  // Hide draft row once its real MongoDB thread exists in inquiries
  const activeDraft = useMemo(() => {
    if (!draftThread) return null;
    const alreadyCreated = inquiries.some(
      (inq) =>
        String(inq.car?._id || inq.car) === String(draftThread.car?._id) &&
        String(inq.buyer?._id || inq.buyer) === currentUserId
    );
    return alreadyCreated ? null : draftThread;
  }, [draftThread, inquiries, currentUserId]);

  // Derived lists & role counters
  const { receivedList, sentList, filteredList } = useMemo(() => {
    const received = inquiries.filter(
      (inq) => String(inq.seller?._id || inq.seller) === currentUserId
    );
    const sentBase = inquiries.filter(
      (inq) => String(inq.buyer?._id || inq.buyer) === currentUserId
    );
    const sent = activeDraft ? [activeDraft, ...sentBase] : sentBase;
    const allCombined = activeDraft ? [activeDraft, ...inquiries] : inquiries;

    let list = allCombined;
    if (activeTab === "received") list = received;
    else if (activeTab === "sent") list = sent;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((inq) => {
        const isSeller = String(inq.seller?._id || inq.seller) === currentUserId;
        const counterpart = isSeller ? inq.buyer : inq.seller;
        return (
          inq.car?.title?.toLowerCase().includes(q) ||
          counterpart?.name?.toLowerCase().includes(q) ||
          inq.lastMessage?.toLowerCase().includes(q)
        );
      });
    }

    return { receivedList: received, sentList: sent, filteredList: list };
  }, [inquiries, activeDraft, currentUserId, activeTab, searchQuery]);

  // Helpers
  const getCarImageUrl = (car) => {
    if (!car || !car.images || car.images.length === 0) {
      return "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=400&q=80";
    }
    const raw = car.images[0];
    return raw.startsWith("http") ? raw : `${BACKEND_BASE}${raw}`;
  };

  const formatWhatsAppUrl = (phone, carTitle) => {
    if (!phone) return null;
    let clean = phone.replace(/[^0-9]/g, "");
    if (clean.startsWith("0")) clean = "92" + clean.slice(1);
    const msg = encodeURIComponent(
      `Assalam o Alaikum, reaching out about ${carTitle || "your vehicle"} on AutoBazaar.`
    );
    return `https://wa.me/${clean}?text=${msg}`;
  };

  // Auth Guard
  if (!isAuthenticated) {
    return (
      <div className="w-full max-w-xl mx-auto px-4 py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-3xl">forum</span>
        </div>
        <h1 className="text-2xl font-bold text-on-surface mb-2">
          Sign In to Access Live Chat
        </h1>
        <p className="text-sm text-on-surface-variant max-w-md mx-auto mb-6">
          Chat in real time with verified buyers and sellers, negotiate offers, and schedule inspections safely.
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-on-primary font-semibold text-sm hover:opacity-95 shadow-md transition-all"
        >
          <span className="material-symbols-outlined text-base">login</span>
          Sign In / Create Account
        </button>
      </div>
    );
  }

  // Active thread counterpart metadata
  const activeIsSeller = selectedThread
    ? String(selectedThread.seller?._id || selectedThread.seller) === currentUserId
    : false;
  const activeCounterpart = selectedThread
    ? activeIsSeller
      ? selectedThread.buyer
      : selectedThread.seller
    : null;
  const activeCounterpartId = activeCounterpart?._id ? String(activeCounterpart._id) : null;
  const isCounterpartOnline = activeCounterpartId ? Boolean(onlineMap[activeCounterpartId]) : false;
  const activePhone = selectedThread?.phone || activeCounterpart?.phoneNumber || "";
  const activeWhatsApp = formatWhatsAppUrl(activePhone, selectedThread?.car?.title);
  const activeTyping = selectedId ? typingByThread[selectedId] : null;
  const quickReplies = activeIsSeller ? QUICK_REPLIES_SELLER : QUICK_REPLIES_BUYER;

  return (
    <div className="w-full max-w-7xl mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin py-6 md:py-8">
      {/* Top Page Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 mb-5 border-b border-outline-variant/30">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="material-symbols-outlined text-primary text-28">
              forum
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
              Messages & Live Chat
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${isConnected
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                  }`}
              />
              {isConnected ? "Live Connected" : "Connecting..."}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
            Real-time buyer & seller messaging desk with instant offer cards and viewing requests.
          </p>
        </div>

        {/* Role Filter Tabs */}
        <div className="inline-flex p-1 rounded-xl bg-surface-container border border-outline-variant/30 self-start md:self-auto">
          {[
            {
              id: "all",
              label: "All Chats",
              count: inquiries.length + (activeDraft ? 1 : 0),
            },
            { id: "received", label: "Selling", count: receivedList.length },
            { id: "sent", label: "Buying", count: sentList.length },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === tab.id
                ? "bg-surface-container-lowest text-on-surface shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
                }`}
            >
              <span>{tab.label}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Notices */}
      {actionNotice && (
        <div
          className={`mb-4 p-3.5 rounded-xl flex items-center justify-between text-xs font-medium border ${actionNotice.type === "success"
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
            : "bg-error/10 border-error/30 text-error"
            }`}
        >
          <span>{actionNotice.message}</span>
          <button type="button" onClick={() => setActionNotice(null)}>
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-error/10 border border-error/20 text-error text-xs flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={fetchInquiries} className="underline font-bold">
            Retry
          </button>
        </div>
      )}

      {/* Split-Pane Chat Desk Container */}
      {isLoading ? (
        <div className="h-[580px] rounded-3xl border border-outline-variant/30 bg-surface-container-lowest grid grid-cols-1 md:grid-cols-12 overflow-hidden animate-pulse">
          <div className="md:col-span-4 border-r border-outline-variant/20 p-4 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-surface-container" />
            ))}
          </div>
          <div className="hidden md:flex md:col-span-8 flex-col justify-between p-6">
            <div className="h-14 rounded-2xl bg-surface-container" />
            <div className="space-y-3">
              <div className="h-12 w-2/3 rounded-2xl bg-surface-container" />
              <div className="h-12 w-1/2 ml-auto rounded-2xl bg-surface-container" />
            </div>
            <div className="h-12 rounded-2xl bg-surface-container" />
          </div>
        </div>
      ) : inquiries.length === 0 && !activeDraft ? (
        <div className="py-20 px-4 bg-surface-container-lowest rounded-3xl border border-outline-variant/30 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl">mark_email_read</span>
          </div>
          <h2 className="text-xl font-bold text-on-surface mb-2">
            No Conversations Yet
          </h2>
          <p className="text-xs text-on-surface-variant max-w-md mx-auto mb-6 leading-relaxed">
            When you message a seller on a vehicle listing—or when buyers inquire about your cars—your real-time chat threads will appear here.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-semibold shadow-md hover:opacity-95 transition-all"
          >
            <span className="material-symbols-outlined text-base">directions_car</span>
            Explore Used Cars
          </Link>
        </div>
      ) : (
        <div className="h-[calc(100vh-225px)] min-h-[480px] max-h-[680px] rounded-3xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-12">
          {/* LEFT PANE: Conversations Sidebar */}
          <aside
            className={`md:col-span-5 lg:col-span-4 border-r border-outline-variant/30 flex flex-col bg-surface-container-low/40 overflow-hidden ${mobileShowChat ? "hidden md:flex" : "flex"
              }`}
          >
            {/* Search Box */}
            <div className="p-3.5 border-b border-outline-variant/30">
              <div className="relative">
                <span className="material-symbols-outlined text-base text-outline absolute left-3 top-1/2 -translate-y-1/2">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search vehicle or person..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            {/* Thread List */}
            <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/20">
              {filteredList.length === 0 ? (
                <div className="p-8 text-center text-xs text-on-surface-variant">
                  No matching conversations found.
                </div>
              ) : (
                filteredList.map((inq) => {
                  const isSeller = String(inq.seller?._id || inq.seller) === currentUserId;
                  const counterpart = isSeller ? inq.buyer : inq.seller;
                  const cId = counterpart?._id ? String(counterpart._id) : "";
                  const isOnline = cId ? Boolean(onlineMap[cId]) : false;
                  const unread = isSeller ? inq.unreadBySeller || 0 : inq.unreadByBuyer || 0;
                  const isSelected = String(inq._id) === String(selectedId);
                  const isTyping = Boolean(typingByThread[inq._id]);

                  return (
                    <button
                      key={inq._id}
                      type="button"
                      onClick={() => handleSelectThread(inq._id)}
                      className={`w-full text-left p-3.5 flex items-start gap-3 transition-colors ${isSelected
                        ? "bg-primary/10 border-l-4 border-l-primary"
                        : "hover:bg-surface-container/60 border-l-4 border-l-transparent"
                        }`}
                    >
                      {/* Thumbnail with Online Dot */}
                      <div className="relative shrink-0">
                        <img
                          src={getCarImageUrl(inq.car)}
                          alt={inq.car?.title || "Vehicle"}
                          className="w-12 h-12 rounded-xl object-cover border border-outline-variant/30 bg-surface-container"
                          onError={(e) => {
                            e.target.src =
                              "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=400&q=80";
                          }}
                        />
                        {isOnline && (
                          <span
                            title="Online now"
                            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-surface-container-lowest"
                          />
                        )}
                      </div>

                      {/* Conversation Meta */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs text-on-surface truncate">
                            {counterpart?.name || "AutoBazaar User"}
                          </span>
                          {inq.isDraft ? (
                            <span className="px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[9px] font-bold uppercase tracking-wider shrink-0">
                              New
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-outline shrink-0">
                              {formatTimeShort(inq.lastMessageAt || inq.createdAt)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${isSeller
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              : "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                              }`}
                          >
                            {isSeller ? "Buyer" : "Seller"}
                          </span>
                          <span className="text-[11px] font-semibold text-primary truncate capitalize">
                            {inq.car?.title || "Vehicle Listing"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-1">
                          <p
                            className={`text-xs truncate ${isTyping
                              ? "text-emerald-600 dark:text-emerald-400 font-semibold italic"
                              : unread > 0
                                ? "text-on-surface font-semibold"
                                : "text-on-surface-variant"
                              }`}
                          >
                            {isTyping
                              ? "typing..."
                              : inq.lastMessage || inq.message}
                          </p>

                          {unread > 0 && (
                            <span className="px-1.5 py-0.5 min-w-[18px] text-center rounded-full bg-primary text-on-primary text-[10px] font-bold leading-none shrink-0">
                              {unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* RIGHT PANE: Active Conversation Thread */}
          <section
            className={`md:col-span-7 lg:col-span-8 flex flex-col bg-surface-container-lowest overflow-hidden ${mobileShowChat ? "flex" : "hidden md:flex"
              }`}
          >
            {!selectedThread ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-5xl text-outline mb-3">
                  chat
                </span>
                <p className="text-sm font-semibold text-on-surface">
                  Select a conversation to start chatting
                </p>
                <p className="text-xs mt-1 max-w-xs">
                  Choose any buyer inquiry or seller thread from the left sidebar.
                </p>
              </div>
            ) : (
              <>
                {/* Thread Header */}
                <div className="px-4 py-3.5 border-b border-outline-variant/30 bg-surface-container-low/50 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Mobile Back Button */}
                    <button
                      type="button"
                      onClick={() => setMobileShowChat(false)}
                      className="md:hidden p-1.5 rounded-lg hover:bg-surface-container text-on-surface"
                      aria-label="Back to conversations"
                    >
                      <span className="material-symbols-outlined text-xl">arrow_back</span>
                    </button>

                    {/* Avatar */}
                    <div className="relative w-10 h-10 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center shrink-0">
                      {activeCounterpart?.name
                        ? activeCounterpart.name.charAt(0).toUpperCase()
                        : "U"}
                      {isCounterpartOnline && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-surface" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="font-bold text-sm text-on-surface truncate">
                          {activeCounterpart?.name || "AutoBazaar User"}
                        </h2>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant border border-outline-variant/30">
                          {activeIsSeller ? "Buyer" : "Seller"}
                        </span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant flex items-center gap-1.5 truncate">
                        {activeTyping ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            typing...
                          </span>
                        ) : isCounterpartOnline ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            Online now
                          </span>
                        ) : (
                          <span>Offline</span>
                        )}
                        {activePhone && (
                          <>
                            <span>•</span>
                            <span className="font-mono">{activePhone}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Direct Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {activePhone && (
                      <a
                        href={`tel:${activePhone}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold border border-outline-variant/40 transition-colors"
                        title="Call"
                      >
                        <span className="material-symbols-outlined text-sm text-emerald-600 dark:text-emerald-400">
                          call
                        </span>
                        <span className="hidden lg:inline">Call</span>
                      </a>
                    )}
                    {activeWhatsApp && (
                      <a
                        href={activeWhatsApp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors"
                        title="Chat on WhatsApp"
                      >
                        <span className="material-symbols-outlined text-sm">chat</span>
                        <span className="hidden lg:inline">WhatsApp</span>
                      </a>
                    )}
                    {!selectedThread.isDraft && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(selectedThread._id)}
                        className="p-1.5 rounded-xl border border-error/30 text-error hover:bg-error/10 transition-colors"
                        title="Delete conversation"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Vehicle Context Bar */}
                {selectedThread.car ? (
                  <Link
                    to={`/cars/${selectedThread.car._id}`}
                    className="px-4 py-2.5 bg-surface-container/50 border-b border-outline-variant/25 flex items-center justify-between gap-3 hover:bg-surface-container transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={getCarImageUrl(selectedThread.car)}
                        alt={selectedThread.car.title}
                        className="w-11 h-8 rounded-lg object-cover border border-outline-variant/30 shrink-0"
                        onError={(e) => {
                          e.target.src =
                            "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=400&q=80";
                        }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-on-surface truncate capitalize">
                          {selectedThread.car.title}
                        </div>
                        <div className="text-[11px] text-on-surface-variant flex items-center gap-2">
                          <span>{selectedThread.car.city || "Pakistan"}</span>
                          {selectedThread.car.year && (
                            <>
                              <span>•</span>
                              <span>{selectedThread.car.year}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {selectedThread.car.price && (
                        <span className="text-xs font-extrabold text-primary font-mono">
                          PKR {Number(selectedThread.car.price).toLocaleString("en-PK")}
                        </span>
                      )}
                      <span className="material-symbols-outlined text-sm text-outline">
                        open_in_new
                      </span>
                    </div>
                  </Link>
                ) : (
                  <div className="px-4 py-2 bg-error/5 border-b border-outline-variant/25 text-xs text-on-surface-variant">
                    This vehicle listing is no longer available.
                  </div>
                )}

                {/* Messages Stream */}
                <div
                  ref={messagesContainerRef}
                  className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-surface-container-low/20"
                >
                  {dedupeMessages(selectedThread.messages || []).length === 0 && !activeTyping && (
                    <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center px-4">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                        <span className="material-symbols-outlined text-2xl">forum</span>
                      </div>
                      <h3 className="text-sm font-bold text-on-surface">
                        Start chatting with {activeCounterpart?.name || "the seller"}
                      </h3>
                      <p className="text-xs text-on-surface-variant max-w-sm mt-1 leading-relaxed">
                        Send a message below, tap a quick question, or click{" "}
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          Make Price Offer
                        </span>{" "}
                        to start negotiating live.
                      </p>
                    </div>
                  )}

                  {dedupeMessages(selectedThread.messages || []).map((msg, idx) => {
                    const senderId = String(msg.sender?._id || msg.sender || "");
                    const isMine = senderId === currentUserId;
                    const isReadByOther =
                      isMine &&
                      activeCounterpartId &&
                      Array.isArray(msg.readBy) &&
                      msg.readBy.some((id) => String(id) === activeCounterpartId);

                    return (
                      <div
                        key={msg._id || idx}
                        className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[82%] sm:max-w-[70%] rounded-2xl px-3.5 py-2.5 shadow-sm ${isMine
                            ? "bg-primary text-on-primary rounded-br-sm"
                            : "bg-surface-container-lowest text-on-surface border border-outline-variant/40 rounded-bl-sm"
                            }`}
                        >
                          {/* Structured Offer Badge */}
                          {msg.messageType === "offer" && msg.offerPrice && (
                            <div
                              className={`mb-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${isMine
                                ? "bg-white/15 text-white"
                                : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                }`}
                            >
                              <span className="material-symbols-outlined text-sm">
                                sell
                              </span>
                              <span>
                                Price Offer: PKR {Number(msg.offerPrice).toLocaleString("en-PK")}
                              </span>
                            </div>
                          )}

                          {/* Structured Viewing Badge */}
                          {msg.messageType === "viewing" && (
                            <div
                              className={`mb-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${isMine
                                ? "bg-white/15 text-white"
                                : "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300"
                                }`}
                            >
                              <span className="material-symbols-outlined text-xs">
                                event_available
                              </span>
                              <span>Inspection / Viewing</span>
                            </div>
                          )}

                          <p className="text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap break-words">
                            {msg.text}
                          </p>

                          <div
                            className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${isMine ? "text-white/75" : "text-outline"
                              }`}
                          >
                            <span>{formatMessageTime(msg.createdAt)}</span>
                            {isMine && (
                              <span
                                className={`material-symbols-outlined text-[13px] ${isReadByOther ? "text-emerald-300" : "text-white/60"
                                  }`}
                                title={isReadByOther ? "Read" : "Sent"}
                              >
                                {isReadByOther ? "done_all" : "done"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Typing Bubble */}
                  {activeTyping && (
                    <div className="flex justify-start">
                      <div className="px-3.5 py-2 rounded-2xl rounded-bl-sm bg-surface-container-lowest border border-outline-variant/40 text-xs text-on-surface-variant flex items-center gap-1.5 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                          style={{ animationDelay: "0.15s" }}
                        />
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                          style={{ animationDelay: "0.3s" }}
                        />
                        <span className="ml-1 text-[11px] italic">
                          {activeTyping.name} is typing...
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Composer Area */}
                <div className="p-3 sm:p-4 border-t border-outline-variant/30 bg-surface-container-lowest space-y-2.5">
                  {sendError && (
                    <div className="text-xs text-error bg-error/10 border border-error/20 px-3 py-1.5 rounded-lg flex items-center justify-between">
                      <span>{sendError}</span>
                      <button type="button" onClick={() => setSendError("")}>
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>
                  )}

                  {/* Quick Replies + Make Offer Toggle */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                    {quickReplies.map((qr) => (
                      <button
                        key={qr.label}
                        type="button"
                        disabled={isSending}
                        onClick={() =>
                          handleSendMessage(null, {
                            text: qr.text,
                            messageType: qr.type,
                          })
                        }
                        className="shrink-0 px-2.5 py-1 rounded-full bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-[11px] font-medium text-on-surface transition-colors"
                      >
                        {qr.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setShowOfferBar((prev) => {
                          const next = !prev;
                          if (next) {
                            setOfferPriceInput((curr) =>
                              curr && Number(curr) > 0 ? curr : "0"
                            );
                          } else {
                            setOfferPriceInput("");
                          }
                          return next;
                        })
                      }
                      className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1 transition-colors ${showOfferBar
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                        }`}
                    >
                      <span className="material-symbols-outlined text-xs">sell</span>
                      <span>Make Price Offer</span>
                    </button>
                  </div>

                  {/* Optional PKR Offer Bar */}
                  {showOfferBar && (
                    <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
                          PKR
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={offerPriceInput}
                          onFocus={(e) => {
                            if (offerPriceInput === "0") e.target.select();
                          }}
                          onChange={(e) => {
                            const cleaned = e.target.value
                              .replace(/[^0-9]/g, "")
                              .replace(/^0+(?=\d)/, "");
                            setOfferPriceInput(cleaned);
                          }}
                          onBlur={() => {
                            if (!offerPriceInput) setOfferPriceInput("0");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "ArrowUp") {
                              e.preventDefault();
                              handleAdjustOffer(5000);
                            } else if (e.key === "ArrowDown") {
                              e.preventDefault();
                              handleAdjustOffer(-5000);
                            }
                          }}
                          placeholder="0"
                          className="no-spinner w-full min-w-0 bg-transparent text-xs sm:text-sm font-mono font-bold text-on-surface placeholder:text-on-surface-variant/60 placeholder:font-sans placeholder:font-normal focus:outline-none"
                        />
                      </div>

                      {/* Custom Themed -5k / +5k Controls */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={Number(offerPriceInput || 0) <= 0}
                          onClick={() => handleAdjustOffer(-5000)}
                          title="Decrease offer by PKR 5,000"
                          aria-label="Decrease offer by PKR 5,000"
                          className="h-7 px-2 rounded-lg bg-surface-container-lowest/90 dark:bg-surface-container hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-0.5 transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <span className="material-symbols-outlined text-sm leading-none">
                            remove
                          </span>
                          <span className="hidden sm:inline">5k</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdjustOffer(5000)}
                          title="Increase offer by PKR 5,000"
                          aria-label="Increase offer by PKR 5,000"
                          className="h-7 px-2 rounded-lg bg-surface-container-lowest/90 dark:bg-surface-container hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-0.5 transition-colors active:scale-95"
                        >
                          <span className="material-symbols-outlined text-sm leading-none">
                            add
                          </span>
                          <span className="hidden sm:inline">5k</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowOfferBar(false);
                            setOfferPriceInput("");
                          }}
                          title="Close offer bar"
                          aria-label="Close offer bar"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors ml-0.5"
                        >
                          <span className="material-symbols-outlined text-base">close</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Message Input Form */}
                  <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                    <textarea
                      rows={1}
                      value={draftText}
                      onChange={(e) => handleDraftChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                      placeholder={
                        showOfferBar
                          ? "Optional note with your PKR offer..."
                          : "Write a message... (Enter to send)"
                      }
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-outline-variant/50 bg-surface-container-low text-on-surface text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-none max-h-28"
                    />
                    <button
                      type="submit"
                      disabled={
                        isSending ||
                        (!draftText.trim() && !(showOfferBar && Number(offerPriceInput) > 0))
                      }
                      className="h-10 px-4 rounded-xl bg-primary text-on-primary font-semibold text-xs flex items-center gap-1.5 shadow-sm hover:opacity-95 disabled:opacity-40 transition-all shrink-0"
                    >
                      {isSending ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-base">send</span>
                          <span className="hidden sm:inline">Send</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-surface-container-lowest border border-outline-variant/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-error/10 text-error flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-xl">delete_forever</span>
              </div>
              <div>
                <h3 className="font-bold text-sm text-on-surface">
                  Delete From Your Inbox?
                </h3>
                <p className="text-xs text-on-surface-variant">
                  This removes the chat history from your inbox only. The other participant keeps their copy.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-error text-white text-xs font-semibold shadow-sm hover:opacity-90 disabled:opacity-50"
              >
                {deletingId ? "Deleting..." : "Delete Chat"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
