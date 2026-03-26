function isProfileComplete(user) {
  return Boolean(user?.name && (user?.dateOfBirth || user?.providers?.dob));
}

function daysSince(dateValue) {
  if (!dateValue) return null;
  const time = new Date(dateValue).getTime();
  if (Number.isNaN(time)) return null;
  return Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000));
}

export function buildPersonalizedContent(user = {}) {
  const country =
    user?.lastLoginLocation?.country ||
    user?.providers?.country ||
    "GLOBAL";
  const isIndia = String(country).toUpperCase() === "IN";
  const uploads = Number(user?.engagementStats?.uploads || 0);
  const timelineViews = Number(user?.engagementStats?.timelineViews || 0);
  const inactiveDays = daysSince(user?.lastLoginAt);
  const profileCompleted = isProfileComplete(user);

  const banners = [];
  const offers = [];
  const recommendations = [];

  if (!profileCompleted) {
    banners.push({
      id: "complete-profile",
      title: "Complete your profile",
      subtitle: "Finish onboarding to unlock personalized storage insights.",
      target: "profile",
      priority: 100,
    });
    recommendations.push({
      id: "onboarding-tip",
      title: "Add your profile details",
      description: "This helps us tailor reminders and seasonal offers.",
      type: "onboarding",
    });
  }

  if (isIndia) {
    offers.push({
      id: "india-festival-offer",
      title: "Festival Offer",
      description: "Get extra Bloomory storage at a special India price.",
      cta: "View offer",
      target: "offers",
      amount: 300,
    });
  }

  if (uploads >= 20) {
    offers.push({
      id: "upgrade-storage",
      title: "Running out of storage?",
      description: "Upgrade your plan to keep all your memories in one place.",
      cta: "Upgrade",
      target: "offers",
    });
    recommendations.push({
      id: "storage-tip",
      title: "Archive by albums",
      description: "Group media into albums to keep your timeline organized.",
      type: "usage",
    });
  }

  if ((inactiveDays ?? 0) >= 3) {
    banners.push({
      id: "come-back",
      title: "We miss you at Bloomory",
      subtitle: "You have saved memories waiting to be revisited.",
      target: "home",
      priority: 80,
    });
  }

  if (timelineViews > 10) {
    recommendations.push({
      id: "power-user",
      title: "You are a power user",
      description: "Try premium features to auto-organize uploads faster.",
      type: "upsell",
    });
  }

  return {
    country,
    segments: {
      indiaUser: isIndia,
      newUser: !profileCompleted,
      activeUser: timelineViews > 10 || uploads > 10,
    },
    banners: banners.sort((a, b) => b.priority - a.priority),
    offers,
    recommendations,
  };
}
