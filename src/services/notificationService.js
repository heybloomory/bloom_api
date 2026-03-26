import { getFirebaseAdmin } from "../config/firebaseAdmin.js";

const MAX_PER_DAY = 2;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function canSendNotification(user = {}) {
  const stats = user.notificationStats || {};
  const day = todayKey();
  const sentToday = stats.lastNotificationDay === day ? Number(stats.notificationsToday || 0) : 0;
  return sentToday < MAX_PER_DAY;
}

export function nextNotificationStats(user = {}) {
  const stats = user.notificationStats || {};
  const day = todayKey();
  const sentToday = stats.lastNotificationDay === day ? Number(stats.notificationsToday || 0) : 0;
  return {
    lastNotificationAt: new Date(),
    notificationsToday: sentToday + 1,
    lastNotificationDay: day,
  };
}

export async function sendPushToTokens(tokens = [], payload = {}) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  try {
    const admin = getFirebaseAdmin();
    const message = {
      tokens,
      notification: {
        title: payload.title || "Bloomory",
        body: payload.body || "",
      },
      data: {
        type: String(payload.type || "general"),
        target: String(payload.target || "home"),
        deepLink: String(payload.deepLink || ""),
      },
    };
    const response = await admin.messaging().sendEachForMulticast(message);
    return {
      successCount: response.successCount || 0,
      failureCount: response.failureCount || 0,
    };
  } catch (error) {
    console.error("[notificationService] FCM send error:", error.message);
    return { successCount: 0, failureCount: tokens.length };
  }
}
