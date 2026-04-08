import { DEFAULT_AVATAR_URL } from "../constants/avatar";

const USER_AVATAR_KEYS = [
  "avatar",
  "profilePicture",
  "profile_picture",
  "avatarUrl",
  "avatar_url",
  "photoURL",
  "photoUrl",
  "image",
  "picture"
];

const resolveAvatar = (entity) => {
  if (!entity || typeof entity !== "object") return "";

  for (const key of USER_AVATAR_KEYS) {
    const value = entity[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
};

export const normalizeUserEntity = (user) => {
  if (!user || typeof user !== "object") return user;

  const resolvedName =
    user.name ||
    user.username ||
    user.fullName ||
    user.full_name ||
    user.displayName ||
    user.display_name ||
    user.nickname ||
    "";

  return {
    ...user,
    id: user.user_id || user.id || user._id,
    name: resolvedName,
    email: user.email || "",
    avatar: resolveAvatar(user)
  };
};

export const getAvatarUrl = (userEntity, fallback = DEFAULT_AVATAR_URL) => {
  const normalized = normalizeUserEntity(userEntity);
  if (!normalized || typeof normalized !== "object") return fallback;
  return normalized.avatar || fallback;
};

export const getStoredAuthUser = () => {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return normalizeUserEntity(parsed);
  } catch {
    return null;
  }
};

export const saveAuthUserToStorage = (user) => {
  const normalized = normalizeUserEntity(user);
  if (!normalized) return;
  localStorage.setItem("user", JSON.stringify(normalized));
};