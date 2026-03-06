import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth.js";
import { createMedia, uploadMedia, listMedia, deleteMedia } from "../controllers/mediaController.js";

const router = Router();

// memory storage so we can forward bytes to Bunny
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB (adjust as needed)
});

router.post("/", requireAuth, createMedia);
// Accept both main file and an optional pre-generated thumbnail.
router.post(
  "/upload",
  requireAuth,
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  uploadMedia
);
router.get("/", requireAuth, listMedia);
router.delete("/:id", requireAuth, deleteMedia);

export default router;
