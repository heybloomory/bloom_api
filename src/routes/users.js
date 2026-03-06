import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { updateMe } from "../controllers/userController.js";

const router = Router();

router.patch("/me", requireAuth, updateMe);

export default router;
