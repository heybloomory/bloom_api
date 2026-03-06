import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createAlbum, listAlbums, getAlbum, updateAlbum, deleteAlbum } from "../controllers/albumController.js";

const router = Router();

router.post("/", requireAuth, createAlbum);
router.get("/", requireAuth, listAlbums);
router.get("/:id", requireAuth, getAlbum);
router.patch("/:id", requireAuth, updateAlbum);
router.delete("/:id", requireAuth, deleteAlbum);

export default router;
