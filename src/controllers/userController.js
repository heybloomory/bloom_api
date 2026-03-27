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
  const plain =
    user && typeof user.toObject === "function"
      ? user.toObject()
      : { ...(user || {}) };
  const name = String(plain?.name || "").trim();
  const profileCompleted =
    plain?.profileCompleted === true || plain?.providers?.profileCompleted === true || name.isNotEmpty;
  return {
    ...plain,
    name,
    profileCompleted,
  };
}

export async function updateMe(req, res, next) {
  try {
    console.log("🔥 HIT PROFILE UPDATE API");
    console.log("Headers:", req.headers);
    console.log("Body:", req.body);
    console.log("User from token:", req.user);
    const data = updateMeSchema.parse(req.body);
    if (!req.user || !(req.user.id || req.user._id)) {
      console.log("❌ USER NOT FOUND IN TOKEN");
      return res.status(401).json({ message: "Unauthorized" });
    }
    const uid = req.user._id ?? req.user.id;
    console.log("[profile] updateMe:start", { uid, hasName: Boolean(data.name), profileCompleted: data.profileCompleted });
    if (usePostgres()) {
      const latest = await userRepository.findUserById(uid);
      if (!latest) return res.status(404).json({ success: false, message: "User not found" });
      console.log("Fetched user:", latest);
      console.log("Before update:", latest);
      const providers = {
        ...(latest?.providers || {}),
        profileCompleted: true,
      };
      const user = await userRepository.updateUser(uid, {
        name: data.name ?? latest.name,
        avatarUrl: data.avatarUrl,
        plan: data.plan,
        providers,
      });
      if (!user) throw new Error("User not found");
      const verifyUser = await userRepository.findUserById(uid);
      const normalized = normalizeUser({ ...verifyUser, profileCompleted: true });
      console.log("Saved user:", user);
      console.log("DB AFTER SAVE:", verifyUser);
      console.log("After update:", normalized);
      return res.json({ success: true, user: normalized });
    }

    const user = await User.findById(req.user.id ?? req.user._id).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log("Fetched user:", user);
    console.log("Before update:", user);

    user.name = data.name ?? user.name;
    user.profileCompleted = true;
    if (data.avatarUrl != null) user.avatarUrl = data.avatarUrl;
    if (data.plan != null) user.plan = data.plan;
    const savedUser = await user.save();
    console.log("Saved user:", savedUser);
    const verifyUser = await User.findById(req.user.id ?? req.user._id).select("-passwordHash");
    console.log("DB AFTER SAVE:", verifyUser);

    const normalized = normalizeUser(user);
    console.log("After update:", normalized);

    return res.json({
      success: true,
      user: normalized,
    });
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
