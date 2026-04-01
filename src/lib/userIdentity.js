export function getPublicUserId(userLike) {
  return (
    userLike?.profile_id ||
    userLike?.vip_id ||
    userLike?.public_id ||
    userLike?.requester_profile_id ||
    userLike?.requester_vip_id ||
    userLike?.requester_public_id ||
    ""
  );
}

export function getPublicDisplayName(userLike) {
  return (
    userLike?.display_name ||
    userLike?.requester_name ||
    userLike?.name ||
    userLike?.username ||
    "User"
  );
}

export function getPublicAvatar(userLike) {
  return (
    userLike?.requester_avatar ||
    userLike?.avatar_url ||
    userLike?.avatar ||
    "/default-avatar.png"
  );
}