import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getTimeline } from "../controllers/timelineController.js";

const router = Router();

router.get("/", requireAuth, getTimeline);

export default router;
