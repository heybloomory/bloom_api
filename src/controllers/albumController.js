import Album from "../models/Album.js";
import Media from "../models/Media.js";
import { HttpError } from "../utils/httpError.js";
import { createAlbumSchema, updateAlbumSchema } from "../validators/album.js";
import mongoose from "mongoose";
import * as albumRepository from "../repositories/albumRepository.js";
import * as mediaRepository from "../repositories/mediaRepository.js";
import { isValidUuid } from "../repositories/helpers.js";

const usePostgres = () => String(process.env.USE_POSTGRES || "").toLowerCase() === "true";
const userId = (req) => req.user._id ?? req.user.id;

function assertObjectId(id, label = "id") {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new HttpError(400, `Invalid ${label}`);
  }
}

function assertId(id, label, usePg) {
  if (usePg && !isValidUuid(id)) throw new HttpError(400, `Invalid ${label}`);
  if (!usePg) assertObjectId(id, label);
}

export async function createAlbum(req, res, next) {
  try {
    const data = createAlbumSchema.parse(req.body);
    const uid = userId(req);

    if (usePostgres()) {
      let parentId = data.parentId ?? null;
      let level = 1;
      if (parentId) {
        if (!isValidUuid(parentId)) throw new HttpError(400, "Invalid parentId");
        const parent = await albumRepository.getAlbumById(parentId, uid);
        if (!parent) throw new HttpError(404, "Parent album not found");
        if (parent.level >= 3) throw new HttpError(400, "Maximum folder depth reached");
        level = parent.level + 1;
      }
      const doc = await albumRepository.createAlbum({
        userId: uid,
        memoryId: data.memoryId,
        parentId,
        level,
        title: data.title,
        description: data.description || "",
        coverMediaId: data.coverMediaId,
      });
      return res.status(201).json({ success: true, album: doc });
    }

    let parentId = data.parentId ?? null;
    let level = 1;
    if (parentId) {
      assertObjectId(parentId, "parentId");
      const parent = await Album.findOne({ _id: parentId, userId: req.user._id });
      if (!parent) throw new HttpError(404, "Parent album not found");
      if (parent.level >= 3) throw new HttpError(400, "Maximum folder depth reached");
      level = parent.level + 1;
    }

    const doc = await Album.create({
      userId: req.user._id,
      memoryId: data.memoryId,
      parentId,
      level,
      title: data.title,
      description: data.description || "",
      coverMediaId: data.coverMediaId,
    });

    res.status(201).json({ success: true, album: doc });
  } catch (e) {
    next(e);
  }
}

export async function listAlbums(req, res, next) {
  try {
    const uid = userId(req);
    if (usePostgres()) {
      const memoryId = req.query.memoryId ?? undefined;
      let parentId = req.query.parentId;
      if (parentId === undefined) parentId = null;
      else if (parentId === "" || parentId === "null") parentId = null;
      const docs = await albumRepository.getAlbumsByUser(uid, { memoryId, parentId });
      return res.json({ success: true, albums: docs });
    }

    const filter = { userId: req.user._id };
    if (req.query.memoryId) filter.memoryId = req.query.memoryId;
    if ("parentId" in req.query) {
      const pid = req.query.parentId;
      if (pid === "" || pid === "null") filter.parentId = null;
      else {
        assertObjectId(pid, "parentId");
        filter.parentId = pid;
      }
    } else {
      filter.parentId = null;
    }
    const docs = await Album.find(filter).sort({ createdAt: -1 }).limit(200);
    res.json({ success: true, albums: docs });
  } catch (e) {
    next(e);
  }
}

export async function getAlbum(req, res, next) {
  try {
    const id = req.params.id;
    const uid = userId(req);
    if (usePostgres()) {
      assertId(id, "album id", true);
      const doc = await albumRepository.getAlbumById(id, uid);
      if (!doc) throw new HttpError(404, "Album not found");
      const [children, media] = await Promise.all([
        albumRepository.getChildAlbums(id, uid),
        mediaRepository.getMediaByAlbum(id, uid),
      ]);
      return res.json({ success: true, album: doc, children, media });
    }

    assertObjectId(id, "album id");
    const doc = await Album.findOne({ _id: id, userId: req.user._id });
    if (!doc) throw new HttpError(404, "Album not found");
    const [children, media] = await Promise.all([
      Album.find({ userId: req.user._id, parentId: doc._id }).sort({ createdAt: -1 }).limit(200),
      Media.find({ userId: req.user._id, albumId: doc._id }).sort({ createdAt: -1 }).limit(500),
    ]);
    res.json({ success: true, album: doc, children, media });
  } catch (e) {
    next(e);
  }
}

export async function updateAlbum(req, res, next) {
  try {
    const data = updateAlbumSchema.parse(req.body);
    const id = req.params.id;
    const uid = userId(req);
    delete data.parentId;
    delete data.level;

    if (usePostgres()) {
      assertId(id, "album id", true);
      const doc = await albumRepository.updateAlbum(id, uid, data);
      if (!doc) throw new HttpError(404, "Album not found");
      return res.json({ success: true, album: doc });
    }

    assertObjectId(id, "album id");
    const doc = await Album.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      data,
      { new: true }
    );
    if (!doc) throw new HttpError(404, "Album not found");
    res.json({ success: true, album: doc });
  } catch (e) {
    next(e);
  }
}

export async function deleteAlbum(req, res, next) {
  try {
    const id = req.params.id;
    const uid = userId(req);

    if (usePostgres()) {
      assertId(id, "album id", true);
      const childCount = await albumRepository.countChildAlbums(id, uid);
      if (childCount > 0) throw new HttpError(400, "Delete sub-albums first");
      const deleted = await albumRepository.deleteAlbum(id, uid);
      if (!deleted) throw new HttpError(404, "Album not found");
      await mediaRepository.deleteMediaByAlbumId(id, uid);
      return res.json({ success: true });
    }

    assertObjectId(id, "album id");
    const childCount = await Album.countDocuments({ userId: req.user._id, parentId: id });
    if (childCount > 0) throw new HttpError(400, "Delete sub-albums first");
    const doc = await Album.findOneAndDelete({ _id: id, userId: req.user._id });
    if (!doc) throw new HttpError(404, "Album not found");
    await Media.deleteMany({ userId: req.user._id, albumId: doc._id });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}
