import Media from "../models/Media.js";
import Album from "../models/Album.js";
import { HttpError } from "../utils/httpError.js";
import { createMediaSchema } from "../validators/media.js";
import { uploadToBunny } from "../utils/bunnyStorage.js";
import { uploadVideoToBunnyStream } from "../utils/bunnyStream.js";
import * as albumRepository from "../repositories/albumRepository.js";
import * as mediaRepository from "../repositories/mediaRepository.js";
import { isValidUuid } from "../repositories/helpers.js";
import { addMediaJob } from "../queues/mediaQueue.js";

const usePostgres = () => String(process.env.USE_POSTGRES || "").toLowerCase() === "true";
const userId = (req) => req.user._id ?? req.user.id;

function safeFileName(name) {
  return String(name || "file")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

export async function createMedia(req, res, next) {
  try {
    const data = createMediaSchema.parse(req.body);
    const uid = userId(req);
    if (usePostgres()) {
      const doc = await mediaRepository.createMedia({
        userId: uid,
        albumId: data.albumId,
        memoryId: data.memoryId,
        type: data.type,
        url: data.url || "",
        videoId: data.videoId || "",
        key: data.key || "",
        originalFileName: data.originalFileName || "",
        thumbnailUrl: data.thumbUrl || "",
        width: data.width,
        height: data.height,
        sizeBytes: data.sizeBytes,
        mimeType: data.mimeType || "",
        durationSec: data.durationSec,
      });
      return res.status(201).json({ success: true, media: doc });
    }
    const doc = await Media.create({
      userId: req.user._id,
      albumId: data.albumId,
      memoryId: data.memoryId,
      type: data.type,
      url: data.url || "",
      videoId: data.videoId || "",
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
    const uid = userId(req);

    const album = usePostgres()
      ? await albumRepository.getAlbumById(albumId, uid)
      : await Album.findOne({ _id: albumId, userId: req.user._id });
    if (!album) throw new HttpError(404, "Album not found");

    const file = req.files?.file?.[0];
    const thumb = req.files?.thumbnail?.[0];
    if (!file) throw new HttpError(400, "file is required");

    const mime = file.mimetype || "application/octet-stream";
    const isVideo = mime.startsWith("video/");
    const type = (req.body.type || (isVideo ? "video" : "image")).toString();
    const originalFileName = String(
      req.body.originalFileName || file.originalname || ""
    ).trim();
    if (!["image", "video"].includes(type)) throw new HttpError(400, "type must be image or video");

    const ts = Date.now();
    const original = safeFileName(file.originalname);
    let docPayload = {
      userId: uid,
      albumId,
      type,
      sizeBytes: file.size,
      mimeType: mime,
      originalFileName,
    };

    if (type === "image") {
      // Images → Bunny Storage + BunnyCDN
      const key = `users/${uid}/albums/${albumId}/${ts}_${original}`;
      const uploaded = await uploadToBunny({
        key,
        buffer: file.buffer,
        contentType: mime,
      });
      let thumbUrl = "";
      if (thumb?.buffer) {
        const thumbMime = thumb.mimetype || "image/jpeg";
        const thumbName = safeFileName(thumb.originalname || `thumb_${original}`);
        const thumbKey = `users/${uid}/albums/${albumId}/thumbs/${ts}_${thumbName}`;
        const thumbUploaded = await uploadToBunny({
          key: thumbKey,
          buffer: thumb.buffer,
          contentType: thumbMime,
        });
        thumbUrl = thumbUploaded?.url || "";
      }
      docPayload = {
        ...docPayload,
        url: uploaded.url,
        key: uploaded.key,
        thumbUrl,
      };
    } else {
      // Videos → Bunny Stream
      const { videoId, playbackUrl } = await uploadVideoToBunnyStream({
        title: original,
        buffer: file.buffer,
        contentType: mime,
      });
      let thumbUrl = "";
      if (thumb?.buffer) {
        const thumbKey = `users/${uid}/albums/${albumId}/thumbs/${ts}_thumb_${original}.jpg`;
        const thumbUploaded = await uploadToBunny({
          key: thumbKey,
          buffer: thumb.buffer,
          contentType: thumb.mimetype || "image/jpeg",
        });
        thumbUrl = thumbUploaded?.url || "";
      }
      docPayload = {
        ...docPayload,
        url: playbackUrl,
        videoId,
        thumbUrl,
        key: "",
      };
    }

    const doc = usePostgres()
      ? await mediaRepository.createMedia({
          ...docPayload,
          thumbnailUrl: docPayload.thumbUrl ?? "",
        })
      : await Media.create(docPayload);

    try {
      await addMediaJob({
        mediaId: doc.id ?? doc._id?.toString(),
        type: doc.type,
      });
    } catch (_) {}

    res.status(201).json({ success: true, media: doc });
  } catch (e) {
    next(e);
  }
}

export async function listMedia(req, res, next) {
  try {
    const uid = userId(req);
    if (usePostgres()) {
      const filters = {};
      if (req.query.albumId) filters.albumId = req.query.albumId;
      if (req.query.memoryId) filters.memoryId = req.query.memoryId;
      const docs = await mediaRepository.getMediaByUser(uid, filters);
      return res.json({ success: true, media: docs });
    }
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
    const id = req.params.id;
    const uid = userId(req);
    if (usePostgres()) {
      if (!isValidUuid(id)) throw new HttpError(400, "Invalid media id");
      const deleted = await mediaRepository.deleteMedia(id, uid);
      if (!deleted) throw new HttpError(404, "Media not found");
      return res.json({ success: true });
    }
    const doc = await Media.findOneAndDelete({ _id: id, userId: req.user._id });
    if (!doc) throw new HttpError(404, "Media not found");
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}
