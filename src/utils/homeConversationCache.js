import { getConversations } from "@/features/chat/services/conversationService";
import { getFriends } from "@/features/profile/services/userService";
import { getStoredAuthUser, normalizeUserEntity } from "./userNormalizer";

const HOME_CONVERSATIONS_CACHE_KEY = "homeConversationsCacheV1";

const getUserId = (userEntity) => {
  if (!userEntity) return null;
  if (typeof userEntity === "string") return userEntity;
  return userEntity.id || userEntity.user_id || userEntity._id;
};

const getSafeId = (value) => {
  if (!value) return "";
  return String(value);
};

const getVirtualConversationId = (friendId) => `friend-${friendId}`;

const readCachedSelectionId = () => {
  try {
    const raw = sessionStorage.getItem(HOME_CONVERSATIONS_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return parsed?.selectedConversationId || null;
  } catch {
    return null;
  }
};

const buildMergedConversations = (conversationList, friendList, currentUserId) => {
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
        (member) => getUserId(member) && getSafeId(getUserId(member)) !== getSafeId(currentUserId)
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
      (member) => getUserId(member) && getSafeId(getUserId(member)) !== getSafeId(currentUserId)
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

export const prefetchHomeConversationsCache = async (currentUserId) => {
  const authUser = getStoredAuthUser();
  const userId = getSafeId(currentUserId || authUser?.id);

  try {
    const [conversationData, friendData] = await Promise.all([
      getConversations(),
      getFriends()
    ]);

    const mergedConversations = buildMergedConversations(
      conversationData,
      friendData,
      userId
    );

    const cachedSelectionId = readCachedSelectionId();
    const selectedConversationId =
      cachedSelectionId &&
      mergedConversations.some((conversation) => conversation.id === cachedSelectionId)
        ? cachedSelectionId
        : mergedConversations[0]?.id || null;

    sessionStorage.setItem(
      HOME_CONVERSATIONS_CACHE_KEY,
      JSON.stringify({
        conversations: mergedConversations,
        selectedConversationId,
        timestamp: Date.now()
      })
    );
  } catch (error) {
    console.error("Failed to prefetch Home conversations cache:", error);
  }
};
