import User from "../../models/User.js";
import { buildPersonalizedContent } from "../../services/recommendationEngine.js";
import {
  canSendNotification,
  nextNotificationStats,
  sendPushToTokens,
} from "../../services/notificationService.js";

export async function runPersonalizedNudgesJob() {
  const users = await User.find({}).limit(200).lean(false);

  for (const user of users) {
    if (!canSendNotification(user)) continue;
    const tokens = Array.isArray(user.deviceTokens) ? user.deviceTokens : [];
    if (tokens.length === 0) continue;

    const content = buildPersonalizedContent(user);
    const banner = content.banners[0];
    const payload = banner
      ? { title: banner.title, body: banner.subtitle, target: banner.target, type: "reminder" }
      : { title: "Bloomory", body: "Come back and check your timeline updates.", target: "home", type: "activity" };

    await sendPushToTokens(tokens, payload);
    user.notificationStats = { ...(user.notificationStats || {}), ...nextNotificationStats(user) };
    await user.save();
  }
}
