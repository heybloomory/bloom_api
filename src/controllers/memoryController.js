import Memory from "../models/Memory.js";
import { HttpError } from "../utils/httpError.js";
import { createMemorySchema, updateMemorySchema } from "../validators/memory.js";

export async function createMemory(req, res, next) {
  try {
    const data = createMemorySchema.parse(req.body);
    const doc = await Memory.create({
      userId: req.user._id,
      title: data.title,
      description: data.description || "",
      tags: data.tags || [],
      visibility: data.visibility || "private",
    });
    res.status(201).json({ success: true, memory: doc });
  } catch (e) {
    next(e);
  }
}

export async function listMemories(req, res, next) {
  try {
    const docs = await Memory.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ success: true, memories: docs });
  } catch (e) {
    next(e);
  }
}

export async function getMemory(req, res, next) {
  try {
    const doc = await Memory.findOne({ _id: req.params.id, userId: req.user._id });
    if (!doc) throw new HttpError(404, "Memory not found");
    res.json({ success: true, memory: doc });
  } catch (e) {
    next(e);
  }
}

export async function updateMemory(req, res, next) {
  try {
    const data = updateMemorySchema.parse(req.body);
    const doc = await Memory.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      data,
      { new: true }
    );
    if (!doc) throw new HttpError(404, "Memory not found");
    res.json({ success: true, memory: doc });
  } catch (e) {
    next(e);
  }
}

export async function deleteMemory(req, res, next) {
  try {
    const doc = await Memory.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!doc) throw new HttpError(404, "Memory not found");
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}
