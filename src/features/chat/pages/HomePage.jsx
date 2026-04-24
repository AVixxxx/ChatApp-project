import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./HomePage.css";
import socket, { connectSocketWithToken } from "@/socket";
import {
  getConversations,
  getConversationMembers,
  createGroupConversation,
  createPrivateConversation,
  addMemberToGroup,
  removeMemberFromGroup,
  leaveGroupConversation,
  setGroupAdmin,
  deleteGroupConversation,
  updateGroupInfo
} from "@/features/chat/services/conversationService";
import {
  getMessagesPage,
  sendMessage,
  recallMessage as recallMessageApi,
  deleteMessage as deleteMessageApi,
  normalizeMessage
} from "@/features/chat/services/messageService";
import { findAccount } from "@/features/auth/services/authService";
import { sendFriendRequest } from "@/features/contacts/services/friendService";
import { getMe, getFriends } from "@/features/profile/services/userService";
import {
  getAvatarUrl,
  getStoredAuthUser,
  normalizeUserEntity,
  saveAuthUserToStorage
} from "@/utils/userNormalizer";
import {
  GROUP_AVATAR_URL,
  GROUP_INFO_MEMBER_AVATAR_URL,
  GROUP_PICKER_MEMBER_AVATAR_URL,
  MESSAGE_SENDER_AVATAR_URL
} from "@/constants/avatar";
import Sidebar from "@/features/chat/components/Sidebar";
import ConversationList from "@/features/chat/components/ConversationList";
import ChatWindow from "@/features/chat/components/ChatWindow";
import RightPanel from "@/features/chat/components/RightPanel";
import GroupModal from "@/features/chat/components/GroupModal";
import GroupInfoModal from "@/features/chat/components/GroupInfoModal";
import AddFriendModal from "@/features/chat/components/AddFriendModal";
import FriendProfileModal from "@/features/contacts/components/FriendProfileModal";
import CallOverlay from "@/features/chat/components/CallOverlay";
import { useGroupCall } from "@/features/chat/hooks/useGroupCall";
import CallParticipantModal from "@/features/chat/components/CallParticipantModal";

const getEntityId = (entity) => {
  if (!entity || typeof entity !== "object") return null;
  return entity.id || entity.message_id || entity.conversation_id || entity._id;
};

const getUserId = (userEntity) => {
  if (!userEntity) return null;
  if (typeof userEntity === "string") return userEntity;
  return userEntity.id || userEntity.user_id || userEntity._id;
};

const getUserDisplayName = (userEntity) => {
  if (!userEntity) return "Unknown User";

  if (typeof userEntity === "string") {
    return `User ${userEntity.slice(0, 6)}`;
  }

  const normalized = normalizeUserEntity(userEntity);
  if (normalized?.name && normalized.name.trim()) {
    return normalized.name.trim();
  }

  const fallbackId = getUserId(userEntity);
  if (fallbackId) {
    return `User ${String(fallbackId).slice(0, 6)}`;
  }

  return "Unknown User";
};

const getVirtualConversationId = (friendId) => `friend-${friendId}`;
const isVirtualConversationId = (conversationId) =>
  typeof conversationId === "string" && conversationId.startsWith("friend-");

const getSafeId = (value) => {
  if (!value) return "";
  return String(value);
};

const parseOnlineValue = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return (
      normalized === "true" ||
      normalized === "1" ||
      normalized === "t" ||
      normalized === "online"
    );
  }
  return false;
};

const HOME_CONVERSATIONS_CACHE_KEY = "homeConversationsCacheV1";
const HOME_CONVERSATIONS_CACHE_TTL_MS = 5 * 60 * 1000;
const MESSAGE_PAGE_SIZE = 30;

const readHomeConversationsCache = () => {
  try {
    const raw = sessionStorage.getItem(HOME_CONVERSATIONS_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const timestamp = Number(parsed.timestamp || 0);
    if (!timestamp || Date.now() - timestamp > HOME_CONVERSATIONS_CACHE_TTL_MS) {
      return null;
    }

    return {
      conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
      selectedConversationId: parsed.selectedConversationId || null
    };
  } catch {
    return null;
  }
};

const writeHomeConversationsCache = ({ conversations, selectedConversationId }) => {
  try {
    sessionStorage.setItem(
      HOME_CONVERSATIONS_CACHE_KEY,
      JSON.stringify({
        conversations,
        selectedConversationId,
        timestamp: Date.now()
      })
    );
  } catch {
    // Ignore cache write failures (private mode/quota issues)
  }
};

const getConversationFingerprint = (conversation) => {
  if (!conversation || typeof conversation !== "object") return "";

  const lastUpdated =
    conversation.updatedAt ||
    conversation.lastMessageTime ||
    conversation.last_message_time ||
    conversation.lastMessage?.createdAt ||
    conversation.lastMessage?.created_at ||
    "";

  return `${conversation.id}|${lastUpdated}`;
};

const isConversationListEquivalent = (currentList, incomingList) => {
  if (!Array.isArray(currentList) || !Array.isArray(incomingList)) return false;
  if (currentList.length !== incomingList.length) return false;

  for (let index = 0; index < currentList.length; index += 1) {
    if (
      getConversationFingerprint(currentList[index]) !==
      getConversationFingerprint(incomingList[index])
    ) {
      return false;
    }
  }

  return true;
};

function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [socketClient] = useState(socket);
  const [user, setUser] = useState(() => getStoredAuthUser());
  const [conversations, setConversations] = useState(() => {
    const cached = readHomeConversationsCache();
    const initialConversations = cached?.conversations || [];
    const routedConversation = location.state?.conversation
      ? [location.state.conversation]
      : [];

    return [...routedConversation, ...initialConversations];
  });
  const [selectedConversationId, setSelectedConversationId] = useState(() => {
    const cached = readHomeConversationsCache();
    return location.state?.conversationId || cached?.selectedConversationId || null;
  });
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);
  const [addFriendKeyword, setAddFriendKeyword] = useState("");
  const [addFriendResults, setAddFriendResults] = useState([]);
  const [addFriendError, setAddFriendError] = useState("");
  const [isSearchingAddFriend, setIsSearchingAddFriend] = useState(false);
  const [sendingAddFriendId, setSendingAddFriendId] = useState("");
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [groupModalError, setGroupModalError] = useState("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);
  const [isUpdatingGroup, setIsUpdatingGroup] = useState(false);
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);
  const [isTransferringAdmin, setIsTransferringAdmin] = useState(false);
  const [isDissolvingGroup, setIsDissolvingGroup] = useState(false);
  const [showFriendProfileModal, setShowFriendProfileModal] = useState(false);
  const [selectedFriendProfile, setSelectedFriendProfile] = useState(null);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [unreadCountByConversationId, setUnreadCountByConversationId] = useState({});
  const [isCallParticipantModalOpen, setIsCallParticipantModalOpen] = useState(false);
  const [selectedCallParticipantIds, setSelectedCallParticipantIds] = useState([]);
  const [pendingCallMode, setPendingCallMode] = useState("video");
  const [callParticipantError, setCallParticipantError] = useState("");
  const [isStartingSelectedCall, setIsStartingSelectedCall] = useState(false);
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const shouldScrollToBottomRef = useRef(false);
  const systemMessageSequenceRef = useRef(0);
  const pendingPrependScrollRef = useRef(null);
  const isLoadingOlderMessagesRef = useRef(false);
  const failedOlderMessagesCursorRef = useRef(null);
  const [messagePageCursor, setMessagePageCursor] = useState(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isInitialMessagesLoading, setIsInitialMessagesLoading] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);

  const formatTime = (dateString) => {
    if (!dateString) return "";

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const formatConversationTime = (dateString) => {
    if (!dateString) return "";

    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });
    }

    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric"
    });
  };

  const getConversationSortTime = (conversation) => {
    const rawValue =
      conversation?.updatedAt ||
      conversation?.lastMessageTime ||
      conversation?.last_message_time ||
      conversation?.lastMessage?.createdAt ||
      conversation?.lastMessage?.created_at ||
      conversation?.last_time ||
      conversation?.lastTime ||
      conversation?.last_message_at ||
      conversation?.createdAt ||
      conversation?.created_at ||
      conversation?.create_at ||
      0;

    const parsed = new Date(rawValue).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const getConversationPreview = (conversation) => {
    const lastMessage = conversation?.lastMessage || conversation?.last_message;

    if (!lastMessage) {
      return conversation?.isGroup ? "Group created" : "Start chatting...";
    }

    const messageType =
      lastMessage.messageType || lastMessage.message_type || lastMessage.type;

    if (messageType === "image") {
      return "Image";
    }

    if (messageType === "file") {
      return "File";
    }

    const textPreview =
      lastMessage.text ||
      lastMessage.content ||
      lastMessage.message ||
      conversation?.lastMessageText ||
      conversation?.last_message ||
      conversation?.last_message_text;

    if (typeof textPreview === "string" && textPreview.trim()) {
      return textPreview;
    }

    return "New message";
  };

  const getConversationDisplayName = (conversation) => {
    if (!conversation) return "Unknown";

    if (conversation.isGroup) {
      return conversation.groupName || "Unnamed Group";
    }

    const otherMember =
      conversation.members?.find(
        (member) => getUserId(member) && getUserId(member) !== user?.id
      ) || conversation.members?.[0];

    return getUserDisplayName(otherMember);
  };

  const getConversationAvatar = (conversation) => {
    if (!conversation) return getAvatarUrl(null);

    if (conversation.isGroup) {
      return getAvatarUrl(conversation, GROUP_AVATAR_URL);
    }

    const otherMember =
      conversation.members?.find(
        (member) => getUserId(member) && getUserId(member) !== user?.id
      ) || conversation.members?.[0];

    return getAvatarUrl(otherMember, getAvatarUrl(user));
  };

  const hydrateGroupConversationMembers = async (conversationId) => {
    if (!conversationId) return;

    try {
      const members = await getConversationMembers(conversationId);

      setConversations((prev) =>
        prev.map((conversation) => {
          if (conversation.id !== conversationId || !conversation.isGroup) {
            return conversation;
          }

          const groupAdmin =
            members.find((member) => String(member.role || "").toLowerCase() === "admin") || null;

          return {
            ...conversation,
            members,
            groupAdmin
          };
        })
      );
    } catch (error) {
      console.error("Failed to load group members:", error);
    }
  };

  const mergeConversationsWithFriends = (conversationList, friendList) => {
    const safeConversations = Array.isArray(conversationList) ? conversationList : [];
    const safeFriends = Array.isArray(friendList)
      ? friendList.map((friend) => normalizeUserEntity(friend))
      : [];

    const friendDirectory = new Map(
      safeFriends
        .map((friend) => [getSafeId(getUserId(friend)), friend])
        .filter(([friendId]) => Boolean(friendId))
    );

    const allowedFriendIds = new Set(friendDirectory.keys());

    const sanitizedConversations = safeConversations
      .map((conversation) => {
        if (conversation?.isGroup) return conversation;

        const otherMember = conversation.members?.find(
          (member) => getUserId(member) && getUserId(member) !== user?.id
        );

        const otherMemberId = getSafeId(getUserId(otherMember));
        if (!otherMemberId || !allowedFriendIds.has(otherMemberId)) {
          return null;
        }

        const friendProfile = friendDirectory.get(otherMemberId);
        const hydratedMembers = Array.isArray(conversation.members)
          ? conversation.members.map((member) => {
              const memberId = getSafeId(getUserId(member));
              if (memberId === otherMemberId) {
                return {
                  ...member,
                  ...friendProfile
                };
              }
              return member;
            })
          : [friendProfile];

        return {
          ...conversation,
          members: hydratedMembers
        };
      })
      .filter(Boolean);

    const existingFriendIds = new Set();

    sanitizedConversations.forEach((conversation) => {
      if (conversation?.isGroup) return;

      const otherMember = conversation.members?.find(
        (member) => getUserId(member) && getUserId(member) !== user?.id
      );

      const otherMemberId = getSafeId(getUserId(otherMember));
      if (otherMemberId) {
        existingFriendIds.add(otherMemberId);
      }
    });

    const virtualConversations = safeFriends
      .filter((friend) => {
        const friendId = getSafeId(getUserId(friend));
        return friendId && !existingFriendIds.has(friendId);
      })
      .map((friend) => ({
        id: getVirtualConversationId(getSafeId(getUserId(friend))),
        isGroup: false,
        isVirtual: true,
        friendId: getSafeId(getUserId(friend)),
        members: [friend],
        lastMessage: null,
        lastMessageTime: null,
        updatedAt: null
      }));

    return [...sanitizedConversations, ...virtualConversations];
  };

  const mergeOnlineStateIntoConversation = (incomingConversation, currentConversationItem) => {
    if (!incomingConversation) return incomingConversation;

    if (incomingConversation.isGroup) {
      return incomingConversation;
    }

    const currentMembers = Array.isArray(currentConversationItem?.members)
      ? currentConversationItem.members
      : [];

    const mergedMembers = Array.isArray(incomingConversation.members)
      ? incomingConversation.members.map((member) => {
          const memberId = getUserId(member);
          const existingMember = currentMembers.find(
            (currentMember) => getUserId(currentMember) === memberId
          );

          if (!existingMember) return member;

          return {
            ...member,
            isOnline:
              existingMember.isOnline ?? member.isOnline ?? existingMember.online ?? member.online,
            is_online:
              existingMember.is_online ?? member.is_online ?? existingMember.isOnline ?? member.isOnline,
            online: existingMember.online ?? member.online ?? existingMember.isOnline ?? member.isOnline
          };
        })
      : incomingConversation.members;

    return {
      ...incomingConversation,
      members: mergedMembers
    };
  };

  const mergeConversationListPresence = (nextConversations, previousConversations) => {
    return nextConversations.map((incomingConversation) => {
      const currentConversationItem = previousConversations.find(
        (conversation) => conversation.id === incomingConversation.id
      );

      return mergeOnlineStateIntoConversation(incomingConversation, currentConversationItem);
    });
  };

  const updateConversationWithNewMessage = (message) => {
    const targetConversationId = message.conversationId || message.conversation_id;
    if (!targetConversationId) return;

    setConversations((prev) => {
      const updated = prev.map((conversation) =>
        conversation.id === targetConversationId
          ? {
              ...conversation,
              lastMessage: message,
              lastMessageTime: message.createdAt || message.created_at,
              updatedAt: message.createdAt || message.created_at
            }
          : conversation
      );

      updated.sort(
        (a, b) =>
          new Date(b.updatedAt || b.lastMessageTime || 0) -
          new Date(a.updatedAt || a.lastMessageTime || 0)
      );

      return [...updated];
    });
  };

  const resolveConversationTarget = async () => {
    let targetConversationId = selectedConversationId;

    if (!isVirtualConversationId(targetConversationId)) {
      return targetConversationId;
    }

    const selectedVirtualConversation = conversations.find(
      (conversation) => conversation.id === selectedConversationId
    );
    const friendId = selectedVirtualConversation?.friendId;

    if (!friendId) {
      console.error("Missing friend id for virtual conversation");
      return null;
    }

    const createdConversation = await createPrivateConversation([friendId]);

    setConversations((prev) => {
      const filtered = prev.filter((conversation) => conversation.id !== selectedConversationId);
      return [createdConversation, ...filtered];
    });

    setSelectedConversationId(createdConversation.id);
    return createdConversation.id;
  };

  const appendMessageWithoutDuplicate = (message) => {
    const normalizedCreatedAt =
      message?.createdAt || message?.created_at || message?.create_at;

    const toTimestamp = (messageItem) => {
      const value =
        messageItem?.createdAt || messageItem?.created_at || messageItem?.create_at;
      const parsed = new Date(value).getTime();
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    setMessages((prev) => {
      const exists = prev.some((existingMessage) => {
        if (existingMessage.id && message.id) {
          return existingMessage.id === message.id;
        }

        const sameConversation =
          (existingMessage.conversationId || existingMessage.conversation_id) ===
          (message.conversationId || message.conversation_id);
        const sameSender =
          (existingMessage.sender_id || getUserId(existingMessage.sender)) ===
          (message.sender_id || getUserId(message.sender));
        const sameText = (existingMessage.text || "") === (message.text || "");
        const existingCreatedAt =
          existingMessage.createdAt ||
          existingMessage.created_at ||
          existingMessage.create_at;
        const sameCreatedAt = existingCreatedAt === normalizedCreatedAt;

        return sameConversation && sameSender && sameText && sameCreatedAt;
      });

      if (exists) return prev;
      return [...prev, message].sort(
        (firstMessage, secondMessage) =>
          toTimestamp(firstMessage) - toTimestamp(secondMessage)
      );
    });
  };

  const removeMessagesByIds = (messageIds) => {
    const idSet = new Set(
      (Array.isArray(messageIds) ? messageIds : [messageIds])
        .map((value) => getSafeId(value))
        .filter(Boolean)
    );

    if (idSet.size === 0) return;

    setMessages((prev) =>
      prev.filter((message) => !idSet.has(getSafeId(getEntityId(message))))
    );
  };

  const markMessagesAsRecalled = (messageIds) => {
    const idSet = new Set(
      (Array.isArray(messageIds) ? messageIds : [messageIds])
        .map((value) => getSafeId(value))
        .filter(Boolean)
    );

    if (idSet.size === 0) return;

    setMessages((prev) =>
      prev.map((message) => {
        const messageId = getSafeId(getEntityId(message));
        if (!idSet.has(messageId)) {
          return message;
        }

        return normalizeMessage({
          ...message,
          text: "[Tin nhắn đã được thu hồi]",
          content: "[Tin nhắn đã được thu hồi]",
          is_recalled: true,
          file_url: "",
          fileUrl: "",
          imageUrl: ""
        });
      })
    );

    setConversations((prev) =>
      prev.map((conversation) => {
        const lastMessage = conversation?.lastMessage;
        const lastMessageId = getSafeId(getEntityId(lastMessage || {}));

        if (!idSet.has(lastMessageId)) {
          return conversation;
        }

        return {
          ...conversation,
          lastMessage: normalizeMessage({
            ...(lastMessage || {}),
            id: lastMessageId,
            text: "[Tin nhắn đã được thu hồi]",
            content: "[Tin nhắn đã được thu hồi]",
            is_recalled: true,
            file_url: "",
            fileUrl: "",
            imageUrl: ""
          })
        };
      })
    );
  };

  const getApiErrorMessage = (error, fallbackMessage) => {
    const responseData = error?.response?.data;

    if (typeof responseData === "string" && responseData.trim()) {
      return responseData;
    }

    if (responseData && typeof responseData === "object") {
      const candidate = responseData.error || responseData.message;
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate;
      }
    }

    if (typeof error?.message === "string" && error.message.trim()) {
      return error.message;
    }

    return fallbackMessage;
  };

  const getGroupParticipantDisplayName = (targetUserId, conversationId) => {
    const normalizedTargetId = getSafeId(targetUserId);
    if (!normalizedTargetId) return "Một thành viên";

    if (normalizedTargetId === getSafeId(user?.id)) {
      return "Bạn";
    }

    const targetConversation = conversations.find(
      (conversation) => String(conversation.id) === String(conversationId)
    );

    const matchedConversationMember = (targetConversation?.members || []).find(
      (member) => getSafeId(getUserId(member)) === normalizedTargetId
    );

    if (matchedConversationMember) {
      return getUserDisplayName(matchedConversationMember);
    }

    const matchedFriend = (allUsers || []).find(
      (friend) => getSafeId(getUserId(friend)) === normalizedTargetId
    );

    if (matchedFriend) {
      return getUserDisplayName(matchedFriend);
    }

    return getUserDisplayName(targetUserId);
  };

  const appendGroupSystemMessage = ({ conversationId, text, eventType, targetUserId }) => {
    const normalizedConversationId = getSafeId(conversationId);
    const messageText = String(text || "").trim();

    if (!normalizedConversationId || !messageText) {
      return;
    }

    systemMessageSequenceRef.current += 1;
    const createdAt = new Date().toISOString();
    const systemMessage = normalizeMessage({
      id: `system-${eventType || "event"}-${normalizedConversationId}-${getSafeId(targetUserId) || "na"}-${systemMessageSequenceRef.current}`,
      conversationId: normalizedConversationId,
      text: messageText,
      type: "system",
      messageType: "system",
      createdAt,
      sender_id: null,
      sender: null,
      isSystemMessage: true
    });

    updateConversationWithNewMessage(systemMessage);

    const isActiveConversation =
      String(selectedConversationId || "") === normalizedConversationId;

    if (isActiveConversation) {
      shouldScrollToBottomRef.current = isNearBottom();
      appendMessageWithoutDuplicate(systemMessage);
    }
  };

  const isNearBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;

    return (
      container.scrollHeight - container.scrollTop - container.clientHeight < 140
    );
  };

  const loadInitialMessages = async (conversationId) => {
    if (!conversationId || isVirtualConversationId(conversationId)) {
      setMessages([]);
      setMessagePageCursor(null);
      setHasMoreMessages(false);
      isLoadingOlderMessagesRef.current = false;
      return;
    }

    setIsInitialMessagesLoading(true);

    try {
      const page = await getMessagesPage(conversationId, { limit: MESSAGE_PAGE_SIZE });
      shouldScrollToBottomRef.current = true;
      setMessages(page.messages);
      setMessagePageCursor(page.nextCursor || null);
      setHasMoreMessages(Boolean(page.nextCursor));
      failedOlderMessagesCursorRef.current = null;
    } catch (error) {
      console.error("Failed to load messages:", error);
      setMessages([]);
      setMessagePageCursor(null);
      setHasMoreMessages(false);
      failedOlderMessagesCursorRef.current = null;
    } finally {
      setIsInitialMessagesLoading(false);
    }
  };

  const loadOlderMessages = async () => {
    if (
      !selectedConversationId ||
      isVirtualConversationId(selectedConversationId) ||
      !hasMoreMessages ||
      isLoadingOlderMessagesRef.current ||
      !messagePageCursor ||
      failedOlderMessagesCursorRef.current === messagePageCursor
    ) {
      return;
    }

    const container = messagesContainerRef.current;
    if (!container) return;

    pendingPrependScrollRef.current = {
      scrollHeight: container.scrollHeight,
      scrollTop: container.scrollTop
    };

    isLoadingOlderMessagesRef.current = true;
    setIsLoadingOlderMessages(true);
    shouldScrollToBottomRef.current = false;

    try {
      const previousCursor = messagePageCursor;
      const page = await getMessagesPage(selectedConversationId, {
        cursor: messagePageCursor,
        limit: MESSAGE_PAGE_SIZE
      });

      setMessages((prev) => {
        const existingIds = new Set(prev.map((message) => message.id));
        const olderMessages = page.messages.filter((message) => !existingIds.has(message.id));
        return [...olderMessages, ...prev].sort(
          (firstMessage, secondMessage) =>
            new Date(firstMessage.createdAt || firstMessage.created_at || firstMessage.create_at || 0) -
            new Date(secondMessage.createdAt || secondMessage.created_at || secondMessage.create_at || 0)
        );
      });

      setMessagePageCursor(page.nextCursor || null);

      const hasOlderBatch = Array.isArray(page.messages) && page.messages.length > 0;
      const cursorMoved = page.nextCursor && page.nextCursor !== previousCursor;
      setHasMoreMessages(Boolean(page.nextCursor) && hasOlderBatch && cursorMoved);
      failedOlderMessagesCursorRef.current = null;
    } catch (error) {
      console.error("Failed to load older messages:", error);
      failedOlderMessagesCursorRef.current = messagePageCursor;
      setHasMoreMessages(false);
      pendingPrependScrollRef.current = null;
    } finally {
      isLoadingOlderMessagesRef.current = false;
      setIsLoadingOlderMessages(false);
    }
  };

  const handleMessageScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (container.scrollTop <= 40) {
      loadOlderMessages();
    }
  };

  const handleSelectConversation = async (conversationId) => {
    if (!conversationId) return;

    if (!isVirtualConversationId(conversationId)) {
      setSelectedConversationId(conversationId);
      setUnreadCountByConversationId((prev) => {
        if (!prev[conversationId]) return prev;
        const next = { ...prev };
        delete next[conversationId];
        return next;
      });
      return;
    }

    const selectedVirtualConversation = conversations.find(
      (conversation) => conversation.id === conversationId
    );
    const friendId = selectedVirtualConversation?.friendId;

    if (!friendId) {
      console.error("Missing friend id for virtual conversation");
      return;
    }

    try {
      const createdConversation = await createPrivateConversation([friendId]);

      setConversations((prev) => {
        const filtered = prev.filter(
          (conversation) => conversation.id !== conversationId
        );
        return [createdConversation, ...filtered];
      });

      setSelectedConversationId(createdConversation.id);
      setUnreadCountByConversationId((prev) => {
        const next = { ...prev };
        delete next[conversationId];
        delete next[createdConversation.id];
        return next;
      });
    } catch (error) {
      console.error("Failed to create private conversation:", error);
    }
  };

  const openGroupModal = async () => {
    try {
      const friends = await getFriends();
      setAllUsers(friends);
      setGroupModalError("");
      setIsGroupModalOpen(true);
    } catch (error) {
      console.error("Failed to load friends:", error);
      setGroupModalError("Failed to load friends list.");
      setAllUsers([]);
      setIsGroupModalOpen(true);
    }
  };

  const closeGroupModal = () => {
    setIsGroupModalOpen(false);
    setSelectedGroupMembers([]);
    setGroupName("");
    setGroupModalError("");
  };

  const toggleGroupMember = (userId) => {
    setGroupModalError("");
    setSelectedGroupMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleUpdateGroupInfo = async (name, avatarFile) => {
    if (!currentConversation?.id) return;
    setIsUpdatingGroup(true);
    try {
      const updated = await updateGroupInfo(currentConversation.id, { name, avatarFile });
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id !== currentConversation.id) return conv;
          return {
            ...conv,
            groupName: updated?.name ?? name ?? conv.groupName,
            groupAvatar: updated?.avatar_url ?? updated?.avatar ?? conv.groupAvatar
          };
        })
      );
    } catch (error) {
      console.error("Failed to update group info:", error);
    } finally {
      setIsUpdatingGroup(false);
    }
  };

  const handleAddMembersToGroup = async (userIds) => {
    if (!currentConversation?.id || !Array.isArray(userIds) || userIds.length === 0) return;
    setIsAddingMembers(true);
    try {
      for (const uid of userIds) {
        await addMemberToGroup(currentConversation.id, uid);
      }
      await hydrateGroupConversationMembers(currentConversation.id);
    } catch (error) {
      console.error("Failed to add members:", error);
    } finally {
      setIsAddingMembers(false);
    }
  };

  const handleRemoveMemberFromGroup = async (targetUserId) => {
    if (!currentConversation?.id || !targetUserId) return;
    try {
      await removeMemberFromGroup(currentConversation.id, targetUserId);
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id !== currentConversation.id) return conv;
          return {
            ...conv,
            members: (conv.members || []).filter(
              (m) => String(m.id || m.user_id) !== String(targetUserId)
            )
          };
        })
      );
    } catch (error) {
      console.error("Failed to remove member:", error);
    }
  };

  const handleTransferGroupAdmin = async (targetUserId) => {
    const conversationId = currentConversation?.id;
    const normalizedTargetUserId = String(targetUserId || "");

    if (!conversationId || !normalizedTargetUserId) return;

    const targetMember = (currentConversation?.members || []).find(
      (member) => String(getUserId(member) || "") === normalizedTargetUserId
    );
    const targetDisplayName = getUserDisplayName(targetMember);

    const isConfirmed = window.confirm(
      `Bạn có chắc muốn trao quyền admin cho ${targetDisplayName}?`
    );

    if (!isConfirmed) return;

    setIsTransferringAdmin(true);

    try {
      await setGroupAdmin(conversationId, normalizedTargetUserId);
      setConversations((prev) =>
        prev.map((conversation) => {
          if (String(conversation.id) !== String(conversationId)) {
            return conversation;
          }

          const nextMembers = Array.isArray(conversation.members)
            ? conversation.members.map((member) => {
                const memberId = String(getUserId(member) || "");
                if (!memberId) return member;

                return {
                  ...member,
                  role: memberId === normalizedTargetUserId ? "admin" : "member"
                };
              })
            : conversation.members;

          const nextGroupAdmin =
            nextMembers?.find(
              (member) => String(getUserId(member) || "") === normalizedTargetUserId
            ) || targetMember || null;

          return {
            ...conversation,
            members: nextMembers,
            groupAdmin: nextGroupAdmin
          };
        })
      );
    } catch (error) {
      alert(getApiErrorMessage(error, "Không thể chuyển quyền admin lúc này."));
    } finally {
      setIsTransferringAdmin(false);
    }
  };

  const handleLeaveGroup = async () => {
    const conversationId = currentConversation?.id;
    const currentUserId = user?.id;

    if (!conversationId || !currentUserId) return;

    const adminId = getUserId(currentConversation?.groupAdmin);
    const hasConversationAdmin = Boolean(adminId);
    const isCurrentUserAdminByConversation =
      hasConversationAdmin && String(adminId) === String(currentUserId);
    const currentMember = (currentConversation?.members || []).find(
      (member) => String(getUserId(member)) === String(currentUserId)
    );
    const isCurrentUserAdminByRole =
      String(currentMember?.role || "").toLowerCase() === "admin";

    if (
      isCurrentUserAdminByConversation ||
      (!hasConversationAdmin && isCurrentUserAdminByRole)
    ) {
      alert("Bạn đang là admin. Hãy chuyển quyền admin trước khi rời nhóm.");
      return;
    }

    const isConfirmed = window.confirm("Bạn có chắc muốn rời nhóm này?");
    if (!isConfirmed) return;

    setIsLeavingGroup(true);

    try {
      await leaveGroupConversation(conversationId, currentUserId);
      setShowGroupInfoModal(false);
      setConversations((prev) =>
        prev.filter((conv) => String(conv.id) !== String(conversationId))
      );
      setSelectedConversationId((prev) =>
        String(prev) === String(conversationId) ? null : prev
      );
      setUnreadCountByConversationId((prev) => {
        const next = { ...prev };
        delete next[conversationId];
        return next;
      });
    } catch (error) {
      alert(getApiErrorMessage(error, "Không thể rời nhóm lúc này."));
    } finally {
      setIsLeavingGroup(false);
    }
  };

  const handleDissolveGroup = async () => {
    const conversationId = currentConversation?.id;
    const currentUserId = user?.id;

    if (!conversationId || !currentUserId) return;

    const adminId = getUserId(currentConversation?.groupAdmin);
    const hasConversationAdmin = Boolean(adminId);
    const isCurrentUserAdminByConversation =
      hasConversationAdmin && String(adminId) === String(currentUserId);
    const currentMember = (currentConversation?.members || []).find(
      (member) => String(getUserId(member)) === String(currentUserId)
    );
    const isCurrentUserAdminByRole =
      String(currentMember?.role || "").toLowerCase() === "admin";

    const isCurrentUserAdmin =
      isCurrentUserAdminByConversation ||
      (!hasConversationAdmin && isCurrentUserAdminByRole);

    if (!isCurrentUserAdmin) {
      alert("Chỉ admin mới có quyền giải tán nhóm.");
      return;
    }

    const isConfirmed = window.confirm(
      "Bạn có chắc muốn giải tán nhóm này? Hành động này không thể hoàn tác."
    );

    if (!isConfirmed) return;

    setIsDissolvingGroup(true);

    try {
      await deleteGroupConversation(conversationId);
      setShowGroupInfoModal(false);
      setConversations((prev) =>
        prev.filter((conv) => String(conv.id) !== String(conversationId))
      );
      setSelectedConversationId((prev) =>
        String(prev) === String(conversationId) ? null : prev
      );
      setUnreadCountByConversationId((prev) => {
        const next = { ...prev };
        delete next[conversationId];
        return next;
      });
    } catch (error) {
      alert(getApiErrorMessage(error, "Không thể giải tán nhóm lúc này."));
    } finally {
      setIsDissolvingGroup(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      setGroupModalError("Please enter a group name.");
      return;
    }

    if (selectedGroupMembers.length < 2) {
      setGroupModalError("Please select at least 2 friends to create a group.");
      return;
    }

    try {
      setIsCreatingGroup(true);
      setGroupModalError("");

      const newGroup = await createGroupConversation({
        groupName: groupName.trim(),
        members: selectedGroupMembers
      });

      setConversations((prev) => [newGroup, ...prev]);
      setSelectedConversationId(newGroup.id);
      setMessages([]);
      closeGroupModal();
    } catch (error) {
      console.error("Failed to create group:", error);
      setGroupModalError(
        getApiErrorMessage(error, "Failed to create group conversation.")
      );
    } finally {
      setIsCreatingGroup(false);
    }
  };

  useEffect(() => {
    connectSocketWithToken();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    socketClient.emit("user_online", user.id);
  }, [socketClient, user?.id]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const me = await getMe();
        const normalizedMe = normalizeUserEntity(me);
        setUser(normalizedMe);
        saveAuthUserToStorage(normalizedMe);
      } catch (error) {
        console.error("Failed to fetch user:", error);
      }
    };

    fetchUser();
  }, []);

  useEffect(() => {
    const handleNewConversation = (conversation) => {
      const normalizedId = getEntityId(conversation);
      if (!normalizedId) return;

      const normalizedConversation = {
        ...conversation,
        id: normalizedId
      };

      setConversations((prev) => {
        const exists = prev.some((c) => c.id === normalizedId);
        if (exists) return prev;
        return [normalizedConversation, ...prev];
      });
    };

    socketClient.on("new_conversation", handleNewConversation);

    return () => {
      socketClient.off("new_conversation", handleNewConversation);
    };
  }, [socketClient]);

  useEffect(() => {
    writeHomeConversationsCache({ conversations, selectedConversationId });
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const [conversationData, friendData] = await Promise.all([
          getConversations(),
          getFriends()
        ]);

        setAllUsers(Array.isArray(friendData) ? friendData : []);

        const mergedConversations = mergeConversationsWithFriends(
          conversationData,
          friendData
        );

        const mergedWithLiveStatus = mergeConversationListPresence(
          mergedConversations,
          conversations
        );

        setConversations((prev) =>
          isConversationListEquivalent(prev, mergedWithLiveStatus)
            ? prev
            : mergedWithLiveStatus
        );

        setSelectedConversationId((prev) => {
          if (prev && mergedWithLiveStatus.some((conversation) => conversation.id === prev)) {
            return prev;
          }

          return mergedWithLiveStatus[0]?.id || null;
        });
      } catch (error) {
        console.error("Failed to load conversations:", error);
      }
    };

    fetchConversations();
  }, []);

  useEffect(() => {
    if (!showGroupInfoModal || !currentConversation?.isGroup) return;

    const refreshGroupInfoContext = async () => {
      try {
        const [friends] = await Promise.all([
          getFriends(),
          currentConversation?.id
            ? hydrateGroupConversationMembers(currentConversation.id)
            : Promise.resolve()
        ]);
        setAllUsers(Array.isArray(friends) ? friends : []);
      } catch (error) {
        console.error("Failed to refresh friends for add-members:", error);
      }
    };

    refreshGroupInfoContext();
  }, [showGroupInfoModal, currentConversation?.id, currentConversation?.isGroup]);

  useEffect(() => {
    if (!selectedConversationId || isVirtualConversationId(selectedConversationId)) {
      return;
    }
    socketClient.emit("join_conversation", selectedConversationId);

    return () => {
      socketClient.emit("leave_conversation", selectedConversationId);
    };
  }, [selectedConversationId, socketClient]);

  useEffect(() => {
    const selected = conversations.find(
      (conversation) => conversation.id === selectedConversationId
    );
    setCurrentConversation(selected || null);
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    const selected = conversations.find(
      (conversation) => conversation.id === selectedConversationId
    );

    if (!selected?.isGroup || !selected?.id || (selected.members?.length ?? 0) > 0) {
      return;
    }

    hydrateGroupConversationMembers(selected.id);
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    setMessages([]);
    setMessagePageCursor(null);
    setHasMoreMessages(true);
    failedOlderMessagesCursorRef.current = null;
    setIsLoadingOlderMessages(false);
    isLoadingOlderMessagesRef.current = false;
    loadInitialMessages(selectedConversationId);
  }, [selectedConversationId]);

  useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (pendingPrependScrollRef.current) {
      const { scrollHeight, scrollTop } = pendingPrependScrollRef.current;
      const nextScrollHeight = container.scrollHeight;
      container.scrollTop = scrollTop + (nextScrollHeight - scrollHeight);
      pendingPrependScrollRef.current = null;
      return;
    }

    if (shouldScrollToBottomRef.current) {
      container.scrollTop = container.scrollHeight;
      shouldScrollToBottomRef.current = false;
    }
  }, [messages]);

  useEffect(() => {
    const handleReceiveMessage = (message) => {
      const normalizedMessage = normalizeMessage({
        ...message,
        id: getEntityId(message)
      });

      const isActiveConversationScrollTarget = isNearBottom();

      updateConversationWithNewMessage(normalizedMessage);

      const normalizedConversationId = String(
        normalizedMessage.conversationId || ""
      );
      const activeConversationId = String(
        currentConversation?.id || selectedConversationId || ""
      );
      const activeFriendId = String(currentConversation?.friendId || "");
      const messageSenderId = String(
        normalizedMessage.sender_id || getUserId(normalizedMessage.sender) || ""
      );

      const isActiveConversationMatch =
        activeConversationId && !isVirtualConversationId(activeConversationId)
          ? normalizedConversationId
            ? normalizedConversationId === activeConversationId
            : activeConversationId === String(selectedConversationId || "")
          : normalizedConversationId && activeConversationId
            ? normalizedConversationId === activeConversationId
          : false;

      const isActiveVirtualDirectMatch =
        isVirtualConversationId(selectedConversationId) &&
        !currentConversation?.isGroup &&
        activeFriendId &&
        messageSenderId &&
        activeFriendId === messageSenderId;

      if (isActiveConversationMatch || isActiveVirtualDirectMatch) {
        shouldScrollToBottomRef.current = isActiveConversationScrollTarget;
        appendMessageWithoutDuplicate(normalizedMessage);
        return;
      }

      const normalizedUserId = getSafeId(user?.id);
      if (
        normalizedConversationId &&
        messageSenderId &&
        normalizedUserId &&
        messageSenderId !== normalizedUserId
      ) {
        setUnreadCountByConversationId((prev) => ({
          ...prev,
          [normalizedConversationId]: (prev[normalizedConversationId] || 0) + 1
        }));
      }
    };

    const handleReceiveMessageBatch = (messagesBatch) => {
      if (!Array.isArray(messagesBatch) || messagesBatch.length === 0) return;

      messagesBatch.forEach((message) => {
        handleReceiveMessage(message);
      });
    };

    const handleDeleteMessage = (payload) => {
      const deletedMessageId =
        payload?.messageId || payload?.message_id || payload?.id;

      if (!deletedMessageId) return;

      removeMessagesByIds([deletedMessageId]);
    };

    const handleMessageRecalled = (payload) => {
      const recalledMessageId =
        payload?.messageId || payload?.message_id || payload?.id;

      if (!recalledMessageId) return;

      markMessagesAsRecalled([recalledMessageId]);
    };

    socketClient.on("receive_message", handleReceiveMessage);
    socketClient.on("new_message", handleReceiveMessage);
    socketClient.on("new_messages_batch", handleReceiveMessageBatch);
    socketClient.on("delete message", handleDeleteMessage);
    socketClient.on("message_recalled", handleMessageRecalled);

    return () => {
      socketClient.off("receive_message", handleReceiveMessage);
      socketClient.off("new_message", handleReceiveMessage);
      socketClient.off("new_messages_batch", handleReceiveMessageBatch);
      socketClient.off("delete message", handleDeleteMessage);
      socketClient.off("message_recalled", handleMessageRecalled);
    };
  }, [currentConversation, selectedConversationId, socketClient, user?.id]);

  useEffect(() => {
    const handleUserStatus = ({ userId, status }) => {
      const targetUserId = getSafeId(userId);
      if (!targetUserId) return;

      const isOnline =
        parseOnlineValue(status) ||
        String(status || "").trim().toLowerCase() === "online";

      setConversations((prev) =>
        prev.map((conversation) => {
          if (!Array.isArray(conversation?.members)) return conversation;

          let changed = false;
          const updatedMembers = conversation.members.map((member) => {
            const memberId = getSafeId(getUserId(member));
            if (!memberId || memberId !== targetUserId) {
              return member;
            }

            changed = true;
            return {
              ...member,
              is_online: isOnline,
              isOnline,
              online: isOnline
            };
          });

          if (!changed) return conversation;
          return {
            ...conversation,
            members: updatedMembers
          };
        })
      );
    };

    socketClient.on("user_status", handleUserStatus);

    return () => {
      socketClient.off("user_status", handleUserStatus);
    };
  }, [socketClient]);

  // Group event listeners
  useEffect(() => {
    if (!socketClient) return;

    const handleGroupUpdated = (updatedGroup) => {
      if (!updatedGroup?.conversation_id && !updatedGroup?.id) return;
      const convId = updatedGroup.conversation_id || updatedGroup.id;
      setConversations((prev) =>
        prev.map((conv) => {
          if (String(conv.id) !== String(convId)) return conv;
          return {
            ...conv,
            groupName: updatedGroup.name ?? conv.groupName,
            groupAvatar: updatedGroup.avatar_url ?? updatedGroup.avatar ?? conv.groupAvatar
          };
        })
      );
    };

    const handleNewMemberJoined = ({ conversation_id, userId: joinedUserId }) => {
      if (!conversation_id) return;
      hydrateGroupConversationMembers(conversation_id);

      const memberName = getGroupParticipantDisplayName(
        joinedUserId,
        conversation_id
      );

      appendGroupSystemMessage({
        conversationId: conversation_id,
        targetUserId: joinedUserId,
        eventType: "member-joined",
        text: `${memberName} da duoc them vao nhom`
      });
    };

    const handleMemberLeft = ({
      conversation_id,
      userId: leftUserId,
      isKicked
    }) => {
      if (!conversation_id) return;

      const memberName = getGroupParticipantDisplayName(
        leftUserId,
        conversation_id
      );

      setConversations((prev) =>
        prev.map((conv) => {
          if (String(conv.id) !== String(conversation_id)) return conv;
          return {
            ...conv,
            members: (conv.members || []).filter(
              (m) => String(m.id || m.user_id) !== String(leftUserId)
            )
          };
        })
      );

      appendGroupSystemMessage({
        conversationId: conversation_id,
        targetUserId: leftUserId,
        eventType: isKicked ? "member-kicked" : "member-left",
        text: isKicked
          ? `${memberName} da bi moi khoi nhom`
          : `${memberName} da roi nhom`
      });
    };

    const handleYouAreKicked = ({ conversation_id }) => {
      setShowGroupInfoModal(false);
      setConversations((prev) => prev.filter((conv) => String(conv.id) !== String(conversation_id)));
      if (String(selectedConversationId) === String(conversation_id)) {
        setSelectedConversationId(null);
      }
    };

    const handleAddedToGroup = (payload) => {
      const convId = payload?.conversation_id || payload?.id;
      if (!convId) return;
      hydrateGroupConversationMembers(convId);
    };

    const handleGroupDissolved = ({ conversation_id }) => {
      if (!conversation_id) return;

      setShowGroupInfoModal(false);
      setConversations((prev) =>
        prev.filter((conv) => String(conv.id) !== String(conversation_id))
      );
      setUnreadCountByConversationId((prev) => {
        const next = { ...prev };
        delete next[conversation_id];
        return next;
      });

      setSelectedConversationId((prev) =>
        String(prev) === String(conversation_id) ? null : prev
      );
    };

    const handleNewAdminAssigned = ({ conversation_id, newAdminId }) => {
      if (!conversation_id || !newAdminId) return;

      setConversations((prev) =>
        prev.map((conv) => {
          if (String(conv.id) !== String(conversation_id)) return conv;

          const nextMembers = Array.isArray(conv.members)
            ? conv.members.map((member) => {
                const memberId = String(getUserId(member) || "");
                if (!memberId) return member;

                return {
                  ...member,
                  role: memberId === String(newAdminId) ? "admin" : "member"
                };
              })
            : conv.members;

          const nextGroupAdmin =
            nextMembers?.find(
              (member) => String(getUserId(member) || "") === String(newAdminId)
            ) || conv.groupAdmin;

          return {
            ...conv,
            members: nextMembers,
            groupAdmin: nextGroupAdmin
          };
        })
      );
    };

    socketClient.on("group_updated", handleGroupUpdated);
    socketClient.on("new_member_joined", handleNewMemberJoined);
    socketClient.on("member_left", handleMemberLeft);
    socketClient.on("you_are_kicked", handleYouAreKicked);
    socketClient.on("added_to_group", handleAddedToGroup);
    socketClient.on("group_dissolved", handleGroupDissolved);
    socketClient.on("new_admin_assigned", handleNewAdminAssigned);

    return () => {
      socketClient.off("group_updated", handleGroupUpdated);
      socketClient.off("new_member_joined", handleNewMemberJoined);
      socketClient.off("member_left", handleMemberLeft);
      socketClient.off("you_are_kicked", handleYouAreKicked);
      socketClient.off("added_to_group", handleAddedToGroup);
      socketClient.off("group_dissolved", handleGroupDissolved);
      socketClient.off("new_admin_assigned", handleNewAdminAssigned);
    };
  }, [
    allUsers,
    conversations,
    selectedConversationId,
    socketClient,
    user?.id
  ]);

  useEffect(() => {
    setShowGroupInfoModal(false);
  }, [selectedConversationId]);

  const handleSendMessage = async (payload = {}) => {
    const messageText = String(payload?.text ?? newMessage ?? "").trim();
    const attachments = Array.isArray(payload?.attachments) ? payload.attachments : [];

    if (!messageText && attachments.length === 0) return;

    const targetConversationId = await resolveConversationTarget();
    if (!targetConversationId) return;

    shouldScrollToBottomRef.current = true;

    try {
      const files = attachments
        .map((attachment) => attachment?.file)
        .filter(Boolean);

      const hasFiles = files.length > 0;
      const messageType = hasFiles
        ? attachments.every((attachment) => attachment?.kind === "image")
          ? "image"
          : "file"
        : "text";

      const sentPayload = await sendMessage({
        conversationId: targetConversationId,
        text: messageText,
        files: hasFiles ? files : undefined,
        messageType
      });

      const sentMessages = Array.isArray(sentPayload) ? sentPayload : [sentPayload];

      sentMessages.filter(Boolean).forEach((message) => {
        appendMessageWithoutDuplicate(message);
      });

      const latestMessage = sentMessages[sentMessages.length - 1];
      if (latestMessage) {
        updateConversationWithNewMessage(latestMessage);
      }

      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
      throw error;
    }
  };

  const handleRecallMessage = async (message) => {
    const messageId = getEntityId(message);
    if (!messageId) return;

    const isConfirmed = window.confirm("Thu hồi tin nhắn này?");
    if (!isConfirmed) return;

    try {
      await recallMessageApi(messageId);
      markMessagesAsRecalled([messageId]);
    } catch (error) {
      console.error("Failed to recall message:", error);
      alert(getApiErrorMessage(error, "Không thể thu hồi tin nhắn lúc này."));
    }
  };

  const handleRecallMessageGroup = async (message) => {
    const groupedItems = Array.isArray(message?.groupedItems)
      ? message.groupedItems
      : [];
    const targets = groupedItems.length > 0 ? groupedItems : [message];
    const targetIds = targets
      .map((item) => getEntityId(item))
      .filter(Boolean);

    if (targetIds.length === 0) return;

    const isConfirmed = window.confirm(
      `Thu hồi ${targetIds.length} tin nhắn này?`
    );
    if (!isConfirmed) return;

    try {
      const results = await Promise.allSettled(
        targetIds.map((id) => recallMessageApi(id))
      );

      const succeededIds = targetIds.filter(
        (_, index) => results[index]?.status === "fulfilled"
      );

      if (succeededIds.length > 0) {
        markMessagesAsRecalled(succeededIds);
      }

      if (succeededIds.length !== targetIds.length) {
        alert("Một số tin nhắn chưa thu hồi được.");
      }
    } catch (error) {
      console.error("Failed to recall grouped messages:", error);
      alert(getApiErrorMessage(error, "Không thể thu hồi các tin nhắn này."));
    }
  };

  const handleDeleteMessage = async (message) => {
    const messageId = getEntityId(message);
    if (!messageId) return;

    const isConfirmed = window.confirm("Xóa tin nhắn này khỏi phía bạn?");
    if (!isConfirmed) return;

    try {
      await deleteMessageApi(messageId);
      removeMessagesByIds([messageId]);
    } catch (error) {
      console.error("Failed to delete message:", error);
      alert(getApiErrorMessage(error, "Không thể xóa tin nhắn này lúc này."));
    }
  };

  const handleDeleteMessageGroup = async (message) => {
    const groupedItems = Array.isArray(message?.groupedItems)
      ? message.groupedItems
      : [];
    const targets = groupedItems.length > 0 ? groupedItems : [message];
    const targetIds = targets
      .map((item) => getEntityId(item))
      .filter(Boolean);

    if (targetIds.length === 0) return;

    const isConfirmed = window.confirm(
      `Xóa ${targetIds.length} tin nhắn này khỏi phía bạn?`
    );
    if (!isConfirmed) return;

    try {
      const results = await Promise.allSettled(
        targetIds.map((id) => deleteMessageApi(id))
      );

      const succeededIds = targetIds.filter(
        (_, index) => results[index]?.status === "fulfilled"
      );

      if (succeededIds.length > 0) {
        removeMessagesByIds(succeededIds);
      }

      if (succeededIds.length !== targetIds.length) {
        alert("Một số tin nhắn chưa xóa được.");
      }
    } catch (error) {
      console.error("Failed to delete grouped messages:", error);
      alert(getApiErrorMessage(error, "Không thể xóa các tin nhắn này lúc này."));
    }
  };

  const selectedOtherMember =
    currentConversation?.members?.find(
      (member) => getUserId(member) && getUserId(member) !== user?.id
    ) || currentConversation?.members?.[0];

  const selectedConversationDisplayName = currentConversation
    ? currentConversation.isGroup
      ? currentConversation.groupName || "Unnamed Group"
      : getUserDisplayName(selectedOtherMember)
    : "No conversation selected";

  const selectedGroupMembersList = currentConversation?.isGroup
    ? currentConversation.members || []
    : [];

  const selectedGroupMemberCount = selectedGroupMembersList.length;

  const availableFriendsToAdd = currentConversation?.isGroup
    ? (allUsers || []).filter((friend) => {
        const friendId = String(getUserId(friend) || "");
        return (
          friendId &&
          !selectedGroupMembersList.some(
            (m) => String(getUserId(m) || "") === friendId
          )
        );
      })
    : [];

  const filteredConversations = [...conversations]
    .sort((firstConversation, secondConversation) => {
      return (
        getConversationSortTime(secondConversation) -
        getConversationSortTime(firstConversation)
      );
    })
    .filter((conversation) =>
      getConversationDisplayName(conversation)
        .toLowerCase()
        .includes(searchTerm.toLowerCase().trim())
    );

  const sidebarAvatar = getAvatarUrl(user);
  const headerAvatar = currentConversation
    ? getConversationAvatar(currentConversation)
    : getAvatarUrl(user);

  const getMessageSenderAvatar = (message) => {
    const directSender = message?.sender;
    if (directSender && typeof directSender === "object") {
      return getAvatarUrl(directSender, MESSAGE_SENDER_AVATAR_URL);
    }

    const senderId = getSafeId(message?.sender_id || getUserId(directSender));
    if (!senderId) {
      return MESSAGE_SENDER_AVATAR_URL;
    }

    const members = Array.isArray(currentConversation?.members)
      ? currentConversation.members
      : [];

    const matchedMember = members.find(
      (member) => getSafeId(getUserId(member)) === senderId
    );

    if (matchedMember) {
      return getAvatarUrl(matchedMember, MESSAGE_SENDER_AVATAR_URL);
    }

    if (getSafeId(user?.id) === senderId) {
      return getAvatarUrl(user, MESSAGE_SENDER_AVATAR_URL);
    }

    return MESSAGE_SENDER_AVATAR_URL;
  };

  const getMessageSenderName = (message) => {
    const directSender = message?.sender;
    if (directSender && typeof directSender === "object") {
      return getUserDisplayName(directSender);
    }

    const senderId = getSafeId(message?.sender_id || getUserId(directSender));
    if (!senderId) {
      return "Unknown";
    }

    if (getSafeId(user?.id) === senderId) {
      return user?.name || "You";
    }

    const members = Array.isArray(currentConversation?.members)
      ? currentConversation.members
      : [];

    const matchedMember = members.find(
      (member) => getSafeId(getUserId(member)) === senderId
    );

    return matchedMember ? getUserDisplayName(matchedMember) : "Unknown";
  };

  const getGroupInfoMemberAvatar = (member) =>
    getAvatarUrl(member, GROUP_INFO_MEMBER_AVATAR_URL);

  const getGroupPickerMemberAvatar = (member) =>
    getAvatarUrl(member, GROUP_PICKER_MEMBER_AVATAR_URL);

  const toggleCallParticipant = (memberId) => {
    setCallParticipantError("");
    setSelectedCallParticipantIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const closeCallParticipantModal = () => {
    if (isStartingSelectedCall) return;
    setIsCallParticipantModalOpen(false);
    setSelectedCallParticipantIds([]);
    setPendingCallMode("video");
    setCallParticipantError("");
  };

  const handleRequestStartCall = (mode = "video") => {
    if (!currentConversation?.id) return;

    if (!currentConversation?.isGroup) {
      startCall({ mode });
      return;
    }

    const availableParticipants = Array.isArray(currentConversation.members)
      ? currentConversation.members.filter(
          (member) => getSafeId(getUserId(member)) && getSafeId(getUserId(member)) !== getSafeId(user?.id)
        )
      : [];

    if (availableParticipants.length === 0) {
      clearCallError();
      return;
    }

    setPendingCallMode(mode);
    setSelectedCallParticipantIds(
      availableParticipants.map((member) => getSafeId(getUserId(member)))
    );
    setCallParticipantError("");
    setIsCallParticipantModalOpen(true);
  };

  const handleConfirmStartSelectedCall = async () => {
    if (selectedCallParticipantIds.length === 0) {
      setCallParticipantError("Hãy chọn ít nhất 1 thành viên.");
      return;
    }

    try {
      setIsStartingSelectedCall(true);
      const didStart = await startCall({
        mode: pendingCallMode,
        selectedParticipantIds: selectedCallParticipantIds
      });

      if (didStart) {
        setIsCallParticipantModalOpen(false);
        setSelectedCallParticipantIds([]);
        setCallParticipantError("");
      }
    } finally {
      setIsStartingSelectedCall(false);
    }
  };

  const openAddFriendModal = () => {
    setIsAddFriendModalOpen(true);
    setAddFriendKeyword("");
    setAddFriendResults([]);
    setAddFriendError("");
  };

  const closeAddFriendModal = () => {
    if (isSearchingAddFriend || sendingAddFriendId) return;
    setIsAddFriendModalOpen(false);
    setAddFriendKeyword("");
    setAddFriendResults([]);
    setAddFriendError("");
  };

  const getSearchMode = (rawValue) => {
    const value = String(rawValue || "").trim();
    if (!value) return "none";
    if (value.includes("@")) return "email";

    const digitsOnly = value.replace(/[^0-9]/g, "");
    if (digitsOnly && digitsOnly.length >= 6) return "phone";
    return "invalid";
  };

  const buildSearchResult = (candidate) => {
    const normalized = normalizeUserEntity(candidate);
    const candidateId = getSafeId(getUserId(normalized || candidate));
    if (!candidateId || candidateId === getSafeId(user?.id)) return null;

    return {
      ...normalized,
      id: candidateId,
      avatar: getAvatarUrl(normalized),
      email: normalized?.email || candidate?.email || "",
      phone:
        normalized?.phone ||
        normalized?.phone_number ||
        candidate?.phone ||
        candidate?.phone_number ||
        ""
    };
  };

  const searchUsersWithApi = async (input, mode) => {
    const normalizedValue = String(input || "").trim();
    const rawCandidates = [];

    if (mode === "phone") {
      const digits = normalizedValue.replace(/[^0-9]/g, "");
      const variants = Array.from(
        new Set([digits, `+${digits}`, `+84${digits.replace(/^0/, "")}`])
      ).filter(Boolean);

      for (const value of variants) {
        try {
          const result = await findAccount(value);
          rawCandidates.push(result);
        } catch {
          // Try next phone format
        }
      }
    } else {
      const result = await findAccount(normalizedValue);
      rawCandidates.push(result);
    }

    const flattened = rawCandidates.flatMap((item) =>
      Array.isArray(item) ? item : item ? [item] : []
    );

    return flattened
      .map(buildSearchResult)
      .filter(Boolean)
      .filter(
        (item, index, self) =>
          index === self.findIndex((entry) => getSafeId(entry.id) === getSafeId(item.id))
      );
  };

  const handleSearchAddFriend = async () => {
    const rawKeyword = String(addFriendKeyword || "").trim();
    const mode = getSearchMode(rawKeyword);

    if (!rawKeyword) {
      setAddFriendResults([]);
      setAddFriendError("Vui lòng nhập số điện thoại hoặc email");
      return;
    }

    if (mode === "invalid") {
      setAddFriendResults([]);
      setAddFriendError("Vui lòng nhập số điện thoại hoặc email hợp lệ");
      return;
    }

    const keywordForSearch =
      mode === "phone" ? rawKeyword.replace(/[^0-9]/g, "") : rawKeyword;

    try {
      setIsSearchingAddFriend(true);
      setAddFriendError("");

      const results = await searchUsersWithApi(keywordForSearch, mode);
      setAddFriendResults(results);

      if (results.length === 0) {
        setAddFriendError("Không tìm thấy người dùng");
      }
    } catch {
      setAddFriendResults([]);
      setAddFriendError("Không thể tìm kiếm lúc này");
    } finally {
      setIsSearchingAddFriend(false);
    }
  };

  const handleAddFriendFromSearch = async (receiverId) => {
    if (!receiverId) return;

    try {
      setSendingAddFriendId(String(receiverId));
      setAddFriendError("");
      await sendFriendRequest(receiverId);
      setAddFriendResults((prev) =>
        prev.filter((item) => getSafeId(item.id) !== getSafeId(receiverId))
      );
    } catch (requestError) {
      setAddFriendError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          "Could not send friend request"
      );
    } finally {
      setSendingAddFriendId("");
    }
  };

  const getDirectChatStatusInfo = (conversation) => {
    if (!conversation || conversation.isGroup) {
      return {
        text: "",
        className: "offline"
      };
    }

    const otherMember =
      conversation.members?.find(
        (member) => getUserId(member) && getUserId(member) !== user?.id
      ) || conversation.members?.[0];

    const isOnline =
      parseOnlineValue(
        otherMember?.is_online ??
          otherMember?.isOnline ??
          otherMember?.online ??
          false
      );

    return {
      text: isOnline ? "Online" : "Offline",
      className: isOnline ? "online" : "offline"
    };
  };

  const selectedStatusInfo = getDirectChatStatusInfo(currentConversation);
  const {
    activeCall,
    callPhase,
    localStream,
    remoteParticipants,
    errorMessage: callErrorMessage,
    isLocalAudioEnabled,
    isLocalVideoEnabled,
    canStartCall,
    startCall,
    acceptIncomingCall,
    declineIncomingCall,
    endCall,
    toggleMicrophone,
    toggleCamera,
    clearCallError
  } = useGroupCall({
    socket: socketClient,
    currentConversation,
    currentUser: user,
    getUserId
  });

  const handleOpenFriendProfileFromConversation = (conversation) => {
    if (!conversation || conversation.isGroup) return;

    const otherMember =
      conversation.members?.find(
        (member) => getUserId(member) && getUserId(member) !== user?.id
      ) || conversation.members?.[0];

    if (!otherMember) return;

    const normalizedMember = normalizeUserEntity(otherMember);
    const isOnline = parseOnlineValue(
      otherMember?.is_online ?? otherMember?.isOnline ?? otherMember?.online ?? false
    );

    setSelectedFriendProfile({
      ...normalizedMember,
      raw: otherMember,
      isOnline
    });
    setShowFriendProfileModal(true);
  };

  return (
    <div className="chat-layout">
      <Sidebar
        avatarUrl={sidebarAvatar}
        userName={user?.name}
        activeMenu="messages"
        onOpenMessages={() => navigate("/home")}
        onOpenContacts={() => navigate("/contacts")}
        onOpenProfile={() => navigate("/profile")}
      />

      <ConversationList
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onOpenAddFriend={openAddFriendModal}
        onOpenCreateGroup={openGroupModal}
        conversations={conversations}
        filteredConversations={filteredConversations}
        selectedConversationId={selectedConversationId}
        onSelectConversation={handleSelectConversation}
        getConversationAvatar={getConversationAvatar}
        getConversationDisplayName={getConversationDisplayName}
        getConversationStatusText={(conversation) =>
          getDirectChatStatusInfo(conversation)?.text || "Offline"
        }
        getUnreadCount={(conversation) => unreadCountByConversationId[conversation?.id] || 0}
        formatConversationTime={formatConversationTime}
        getConversationPreview={getConversationPreview}
        onAvatarClick={handleOpenFriendProfileFromConversation}
      />

      <ChatWindow
        selectedConversation={currentConversation}
        selectedConversationDisplayName={selectedConversationDisplayName}
        selectedGroupMemberCount={selectedGroupMemberCount}
        headerStatusText={selectedStatusInfo?.text || "Offline"}
        headerStatusClass={selectedStatusInfo?.className || "offline"}
        headerAvatar={headerAvatar}
        setShowGroupInfoModal={setShowGroupInfoModal}
        selectedConversationId={selectedConversationId}
        messages={messages}
        user={user}
        getUserId={getUserId}
        getMessageSenderAvatar={getMessageSenderAvatar}
        getMessageSenderName={getMessageSenderName}
        formatTime={formatTime}
        messagesEndRef={messagesEndRef}
        messagesContainerRef={messagesContainerRef}
        onMessageScroll={handleMessageScroll}
        isLoadingOlderMessages={isLoadingOlderMessages}
        hasMoreMessages={hasMoreMessages}
        isInitialMessagesLoading={isInitialMessagesLoading}
        newMessage={newMessage}
        setNewMessage={setNewMessage}
        handleSendMessage={handleSendMessage}
        handleRecallMessage={handleRecallMessage}
        handleRecallMessageGroup={handleRecallMessageGroup}
        handleDeleteMessage={handleDeleteMessage}
        handleDeleteMessageGroup={handleDeleteMessageGroup}
        onStartAudioCall={() => handleRequestStartCall("audio")}
        onStartVideoCall={() => handleRequestStartCall("video")}
        isCallActionDisabled={!canStartCall}
      />

      <RightPanel openGroupModal={openGroupModal} />

      <GroupInfoModal
        show={showGroupInfoModal}
        selectedConversation={currentConversation}
        selectedGroupMemberCount={selectedGroupMemberCount}
        selectedGroupMembersList={selectedGroupMembersList}
        close={() => setShowGroupInfoModal(false)}
        getUserId={getUserId}
        getGroupInfoMemberAvatar={getGroupInfoMemberAvatar}
        currentUserId={user?.id}
        availableFriendsToAdd={availableFriendsToAdd}
        onUpdateGroupInfo={handleUpdateGroupInfo}
        onAddMembers={handleAddMembersToGroup}
        onRemoveMember={handleRemoveMemberFromGroup}
        onTransferAdmin={handleTransferGroupAdmin}
        onLeaveGroup={handleLeaveGroup}
        onDissolveGroup={handleDissolveGroup}
        isUpdatingGroup={isUpdatingGroup}
        isAddingMembers={isAddingMembers}
        isLeavingGroup={isLeavingGroup}
        isTransferringAdmin={isTransferringAdmin}
        isDissolvingGroup={isDissolvingGroup}
      />

      <GroupModal
        isOpen={isGroupModalOpen}
        closeGroupModal={closeGroupModal}
        groupName={groupName}
        setGroupName={setGroupName}
        allUsers={allUsers}
        selectedGroupMembers={selectedGroupMembers}
        toggleGroupMember={toggleGroupMember}
        getGroupMemberAvatar={getGroupPickerMemberAvatar}
        handleCreateGroup={handleCreateGroup}
        isCreatingGroup={isCreatingGroup}
        errorMessage={groupModalError}
      />

      <AddFriendModal
        isOpen={isAddFriendModalOpen}
        keyword={addFriendKeyword}
        onKeywordChange={setAddFriendKeyword}
        results={addFriendResults}
        error={addFriendError}
        isSearching={isSearchingAddFriend}
        sendingId={sendingAddFriendId}
        onClose={closeAddFriendModal}
        onSearch={handleSearchAddFriend}
        onAddFriend={handleAddFriendFromSearch}
      />

      <FriendProfileModal
        isOpen={showFriendProfileModal}
        contact={selectedFriendProfile}
        onClose={() => {
          setShowFriendProfileModal(false);
          setSelectedFriendProfile(null);
        }}
      />

      <CallParticipantModal
        isOpen={isCallParticipantModalOpen}
        title={pendingCallMode === "audio" ? "Chọn thành viên cho cuộc gọi thoại" : "Chọn thành viên cho cuộc gọi video"}
        members={
          Array.isArray(currentConversation?.members)
            ? currentConversation.members
                .filter(
                  (member) =>
                    getSafeId(getUserId(member)) &&
                    getSafeId(getUserId(member)) !== getSafeId(user?.id)
                )
                .map((member) => ({
                  ...member,
                  id: getSafeId(getUserId(member))
                }))
            : []
        }
        selectedMemberIds={selectedCallParticipantIds}
        toggleMember={toggleCallParticipant}
        getMemberAvatar={getGroupPickerMemberAvatar}
        onClose={closeCallParticipantModal}
        onConfirm={handleConfirmStartSelectedCall}
        isSubmitting={isStartingSelectedCall}
        errorMessage={callParticipantError}
      />

      <CallOverlay
        activeCall={activeCall}
        callPhase={callPhase}
        localStream={localStream}
        remoteParticipants={remoteParticipants}
        errorMessage={callErrorMessage}
        isLocalAudioEnabled={isLocalAudioEnabled}
        isLocalVideoEnabled={isLocalVideoEnabled}
        onAccept={acceptIncomingCall}
        onDecline={declineIncomingCall}
        onEnd={() => endCall({ notifyPeers: true })}
        onToggleMicrophone={toggleMicrophone}
        onToggleCamera={toggleCamera}
        onDismissError={clearCallError}
      />
    </div>
  );
}

export default HomePage;
