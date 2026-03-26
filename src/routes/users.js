import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getMe,
  updateMe,
  saveDeviceToken,
  getPersonalizedContent,
  trackEngagement,
  sendPersonalizedNudge,
} from "../controllers/userController.js";

const router = Router();

router.get("/me", requireAuth, getMe);
router.patch("/me", requireAuth, updateMe);
router.post("/save-device-token", requireAuth, saveDeviceToken);
router.get("/personalized-content", requireAuth, getPersonalizedContent);
router.post("/track-engagement", requireAuth, trackEngagement);
router.post("/send-personalized-nudge", requireAuth, sendPersonalizedNudge);

export default router;
