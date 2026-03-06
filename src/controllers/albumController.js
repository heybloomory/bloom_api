import Album from "../models/Album.js";
import Media from "../models/Media.js";
import { HttpError } from "../utils/httpError.js";
import { createAlbumSchema, updateAlbumSchema } from "../validators/album.js";
import mongoose from "mongoose";

function assertObjectId(id, label = "id") {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new HttpError(400, `Invalid ${label}`);
  }
}

export async function createAlbum(req, res, next) {
  try {
    const data = createAlbumSchema.parse(req.body);

    let parentId = data.parentId ?? null;
    let level = 1;

    if (parentId) {
      assertObjectId(parentId, "parentId");
      const parent = await Album.findOne({ _id: parentId, userId: req.user._id });
      if (!parent) throw new HttpError(404, "Parent album not found");
      if (parent.level >= 2) throw new HttpError(400, "Only 2 levels allowed (parent is already level 2)");
      level = 2;
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
    const filter = { userId: req.user._id };

    // optional filters
    if (req.query.memoryId) filter.memoryId = req.query.memoryId;

    // If parentId is provided, list children of that album.
    // If not provided, default to root albums (parentId=null)
    if ("parentId" in req.query) {
      const pid = req.query.parentId;
      if (pid === "" || pid === "null") {
        filter.parentId = null;
      } else {
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
    assertObjectId(req.params.id, "album id");
    const doc = await Album.findOne({ _id: req.params.id, userId: req.user._id });
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

    assertObjectId(req.params.id, "album id");

    // do not allow changing parent/level via update (keeps tree consistent)
    delete data.parentId;
    delete data.level;

    const doc = await Album.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
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
    assertObjectId(req.params.id, "album id");
    // Prevent deleting an album that still has sub-albums
    const childCount = await Album.countDocuments({ userId: req.user._id, parentId: req.params.id });
    if (childCount > 0) throw new HttpError(400, "Delete sub-albums first");

    const doc = await Album.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!doc) throw new HttpError(404, "Album not found");

    // Optional: also delete media docs (and Bunny files)
    await Media.deleteMany({ userId: req.user._id, albumId: doc._id });

    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}
