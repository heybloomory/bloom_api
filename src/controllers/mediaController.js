import Media from "../models/Media.js";
import Album from "../models/Album.js";
import { HttpError } from "../utils/httpError.js";
import { createMediaSchema } from "../validators/media.js";
import { uploadToBunny } from "../utils/bunnyStorage.js";

function safeFileName(name) {
  return String(name || "file")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

export async function createMedia(req, res, next) {
  try {
    const data = createMediaSchema.parse(req.body);
    const doc = await Media.create({
      userId: req.user._id,
      albumId: data.albumId,
      memoryId: data.memoryId,
      type: data.type,
      url: data.url,
      key: data.key || "",
      thumbUrl: data.thumbUrl || "",
      width: data.width,
      height: data.height,
      sizeBytes: data.sizeBytes,
      mimeType: data.mimeType || "",
      durationSec: data.durationSec,
    });
    res.status(201).json({ success: true, media: doc });
  } catch (e) {
    next(e);
  }
}

/**
 * POST /api/media/upload (multipart/form-data)
 * fields:
 * - albumId (required)
 * - type: image|video (optional, inferred from mimetype)
 * - file: <binary> (required)
 */
export async function uploadMedia(req, res, next) {
  try {
    const albumId = req.body.albumId;
    if (!albumId) throw new HttpError(400, "albumId is required");

    const album = await Album.findOne({ _id: albumId, userId: req.user._id });
    if (!album) throw new HttpError(404, "Album not found");

    const file = req.files?.file?.[0];
    const thumb = req.files?.thumbnail?.[0];
    if (!file) throw new HttpError(400, "file is required");

    const mime = file.mimetype || "application/octet-stream";
    const isVideo = mime.startsWith("video/");
    const type = (req.body.type || (isVideo ? "video" : "image")).toString();
    if (!["image", "video"].includes(type)) throw new HttpError(400, "type must be image or video");

    const ts = Date.now();
    const original = safeFileName(file.originalname);
    const key = `users/${req.user._id}/albums/${albumId}/${ts}_${original}`;

    const uploaded = await uploadToBunny({
      key,
      buffer: file.buffer,
      contentType: mime,
    });

    // Optional thumbnail upload (preferred over Bunny transform URL query params).
    let thumbUploaded = null;
    if (thumb && thumb.buffer) {
      const thumbMime = thumb.mimetype || "image/jpeg";
      const thumbName = safeFileName(thumb.originalname || `thumb_${original}`);
      const thumbKey = `users/${req.user._id}/albums/${albumId}/thumbs/${ts}_${thumbName}`;
      thumbUploaded = await uploadToBunny({
        key: thumbKey,
        buffer: thumb.buffer,
        contentType: thumbMime,
      });
    }

    const doc = await Media.create({
      userId: req.user._id,
      albumId: albumId,
      type,
      url: uploaded.url,
      key: uploaded.key,
      thumbUrl: thumbUploaded?.url || "",
      sizeBytes: file.size,
      mimeType: mime,
    });

    res.status(201).json({ success: true, media: doc });
  } catch (e) {
    next(e);
  }
}

export async function listMedia(req, res, next) {
  try {
    const filter = { userId: req.user._id };
    if (req.query.albumId) filter.albumId = req.query.albumId;
    if (req.query.memoryId) filter.memoryId = req.query.memoryId;

    const docs = await Media.find(filter).sort({ createdAt: -1 }).limit(500);
    res.json({ success: true, media: docs });
  } catch (e) {
    next(e);
  }
}

export async function deleteMedia(req, res, next) {
  try {
    const doc = await Media.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!doc) throw new HttpError(404, "Media not found");
    // Optional: delete from Bunny storage (not implemented here)
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}
