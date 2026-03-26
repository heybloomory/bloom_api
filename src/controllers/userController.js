import User from "../models/User.js";
import { z } from "zod";
import * as userRepository from "../repositories/userRepository.js";
import { buildPersonalizedContent } from "../services/recommendationEngine.js";
import {
  canSendNotification,
  nextNotificationStats,
  sendPushToTokens,
} from "../services/notificationService.js";

const updateMeSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  avatarUrl: z.string().url().optional(),
  plan: z.enum(["free", "personal", "partner", "vendor"]).optional(),
  profileCompleted: z.boolean().optional(),
});

const saveDeviceTokenSchema = z.object({
  token: z.string().min(20),
  platform: z.enum(["android", "ios", "web"]).optional(),
});

const trackEngagementSchema = z.object({
  action: z.enum(["timeline_view", "upload_success"]),
});

const usePostgres = () => String(process.env.USE_POSTGRES || "").toLowerCase() === "true";

function normalizeUser(user = {}) {
  const name = String(user?.name || "").trim();
  const profileCompleted =
    user?.profileCompleted === true || user?.providers?.profileCompleted === true || name.isNotEmpty;
  return {
    ...(user || {}),
    name,
    profileCompleted,
  };
}

export async function updateMe(req, res, next) {
  try {
    const data = updateMeSchema.parse(req.body);
    const uid = req.user._id ?? req.user.id;
    console.log("[profile] updateMe:start", { uid, hasName: Boolean(data.name), profileCompleted: data.profileCompleted });
    if (usePostgres()) {
      const latest = await userRepository.findUserById(uid);
      const providers = {
        ...(latest?.providers || {}),
        ...(data.profileCompleted != null ? { profileCompleted: data.profileCompleted } : {}),
      };
      const user = await userRepository.updateUser(uid, {
        ...data,
        providers,
      });
      if (!user) throw new Error("User not found");
      const normalized = normalizeUser(user);
      console.log("[profile] updateMe:done", { uid, name: normalized.name, profileCompleted: normalized.profileCompleted });
      return res.json({ success: true, user: normalized });
    }
    const user = await User.findByIdAndUpdate(req.user._id, data, { new: true }).select("-passwordHash");
    const normalized = normalizeUser(user);
    console.log("[profile] updateMe:done", { uid, name: normalized.name, profileCompleted: normalized.profileCompleted });
    res.json({ success: true, user: normalized });
  } catch (e) {
    next(e);
  }
}

export async function getMe(req, res, next) {
  try {
    const uid = req.user._id ?? req.user.id;
    const user = usePostgres() ? await userRepository.findUserById(uid) : await User.findById(uid).select("-passwordHash");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const normalized = normalizeUser(user);
    res.json({ success: true, user: normalized });
  } catch (e) {
    next(e);
  }
}

export async function saveDeviceToken(req, res, next) {
  try {
    const { token, platform } = saveDeviceTokenSchema.parse(req.body);
    const uid = req.user._id ?? req.user.id;

    if (usePostgres()) {
      const latest = await userRepository.findUserById(uid);
      const providers = { ...(latest?.providers || {}) };
      const existing = Array.isArray(providers.deviceTokens) ? providers.deviceTokens : [];
      const merged = [token, ...existing.filter((t) => t !== token)].slice(0, 5);
      providers.deviceTokens = merged;
      providers.lastDevicePlatform = platform || providers.lastDevicePlatform || null;
      const user = await userRepository.updateUser(uid, { providers });
      return res.json({ success: true, tokensCount: providers.deviceTokens.length, user });
    }

    const user = await User.findById(uid).select("-passwordHash");
    const list = Array.isArray(user.deviceTokens) ? user.deviceTokens : [];
    user.deviceTokens = [token, ...list.filter((t) => t !== token)].slice(0, 5);
    await user.save();
    return res.json({ success: true, tokensCount: user.deviceTokens.length });
  } catch (e) {
    next(e);
  }
}

export async function getPersonalizedContent(req, res, next) {
  try {
    const uid = req.user._id ?? req.user.id;
    const user = usePostgres() ? await userRepository.findUserById(uid) : await User.findById(uid);
    const content = buildPersonalizedContent(user || {});
    res.json({ success: true, ...content });
  } catch (e) {
    next(e);
  }
}

export async function trackEngagement(req, res, next) {
  try {
    const { action } = trackEngagementSchema.parse(req.body);
    const uid = req.user._id ?? req.user.id;

    if (usePostgres()) {
      const latest = await userRepository.findUserById(uid);
      const providers = { ...(latest?.providers || {}) };
      const stats = { ...(providers.engagementStats || {}) };
      if (action === "timeline_view") {
        stats.timelineViews = Number(stats.timelineViews || 0) + 1;
        stats.lastTimelineViewAt = new Date().toISOString();
      } else {
        stats.uploads = Number(stats.uploads || 0) + 1;
        stats.lastUploadAt = new Date().toISOString();
      }
      providers.engagementStats = stats;
      await userRepository.updateUser(uid, { providers });
      return res.json({ success: true });
    }

    const user = await User.findById(uid);
    user.engagementStats = user.engagementStats || {};
    if (action === "timeline_view") {
      user.engagementStats.timelineViews = Number(user.engagementStats.timelineViews || 0) + 1;
      user.engagementStats.lastTimelineViewAt = new Date();
    } else {
      user.engagementStats.uploads = Number(user.engagementStats.uploads || 0) + 1;
      user.engagementStats.lastUploadAt = new Date();
    }
    await user.save();
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

export async function sendPersonalizedNudge(req, res, next) {
  try {
    const uid = req.user._id ?? req.user.id;
    const user = usePostgres() ? await userRepository.findUserById(uid) : await User.findById(uid);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (!canSendNotification(user)) {
      return res.json({ success: true, skipped: true, reason: "daily_limit" });
    }

    const content = buildPersonalizedContent(user);
    const topBanner = content.banners[0];
    const topOffer = content.offers[0];
    const payload = topBanner
      ? { title: topBanner.title, body: topBanner.subtitle, target: topBanner.target, type: "reminder" }
      : topOffer
        ? { title: topOffer.title, body: topOffer.description, target: topOffer.target, type: "offer" }
        : { title: "Bloomory", body: "Check new updates in your timeline.", target: "home", type: "activity" };

    const tokens = usePostgres()
      ? (user?.providers?.deviceTokens || [])
      : (user?.deviceTokens || []);

    const result = await sendPushToTokens(tokens, payload);

    if (!usePostgres()) {
      user.notificationStats = { ...(user.notificationStats || {}), ...nextNotificationStats(user) };
      await user.save();
    } else {
      const providers = { ...(user.providers || {}) };
      providers.notificationStats = nextNotificationStats(user);
      await userRepository.updateUser(uid, { providers });
    }

    res.json({ success: true, result, payload, trackedEvent: "notification_sent" });
  } catch (e) {
    next(e);
  }
}
