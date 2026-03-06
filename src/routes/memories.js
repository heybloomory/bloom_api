import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createMemory, listMemories, getMemory, updateMemory, deleteMemory } from "../controllers/memoryController.js";

const router = Router();

router.post("/", requireAuth, createMemory);
router.get("/", requireAuth, listMemories);
router.get("/:id", requireAuth, getMemory);
router.patch("/:id", requireAuth, updateMemory);
router.delete("/:id", requireAuth, deleteMemory);

export default router;
