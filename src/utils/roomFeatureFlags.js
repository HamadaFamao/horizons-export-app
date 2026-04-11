export const ROOM_FEATURES = {
  backgroundGallery: {
    id: "backgroundGallery",
    label: "Background gallery",
    isPremium: true,
    isFreeForNow: true,
  },
  animatedBackgrounds: {
    id: "animatedBackgrounds",
    label: "Animated backgrounds",
    isPremium: true,
    isFreeForNow: false,
  },
  vipThemes: {
    id: "vipThemes",
    label: "VIP themes",
    isPremium: true,
    isFreeForNow: false,
  },
};

export function canUseFeature(feature, user) {
  return !feature.isPremium || feature.isFreeForNow || user.isSubscribed;
}

export function normalizeFeatureUser(user) {
  return {
    ...(user || {}),
    isSubscribed: Boolean(
      user?.isSubscribed ||
      user?.is_subscribed ||
      user?.subscriptionActive ||
      user?.plan === "premium" ||
      user?.plan === "vip" ||
      user?.is_vip
    ),
  };
}
