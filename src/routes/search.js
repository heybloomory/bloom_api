import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { search } from "../controllers/searchController.js";

const router = Router();

router.get("/", requireAuth, search);

export default router;
