import Memory from "../models/Memory.js";
import { HttpError } from "../utils/httpError.js";
import { createMemorySchema, updateMemorySchema } from "../validators/memory.js";
import * as memoryRepository from "../repositories/memoryRepository.js";
import { isValidUuid } from "../repositories/helpers.js";

const usePostgres = () => String(process.env.USE_POSTGRES || "").toLowerCase() === "true";
const userId = (req) => req.user._id ?? req.user.id;

export async function createMemory(req, res, next) {
  try {
    const data = createMemorySchema.parse(req.body);
    if (usePostgres()) {
      const doc = await memoryRepository.createMemory({
        userId: userId(req),
        title: data.title,
        description: data.description || "",
        tags: data.tags || [],
        visibility: data.visibility || "private",
      });
      return res.status(201).json({ success: true, memory: doc });
    }
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
    if (usePostgres()) {
      const docs = await memoryRepository.getUserMemories(userId(req));
      return res.json({ success: true, memories: docs });
    }
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
    const id = req.params.id;
    if (usePostgres()) {
      if (!isValidUuid(id)) throw new HttpError(400, "Invalid memory id");
      const doc = await memoryRepository.getMemoryById(id, userId(req));
      if (!doc) throw new HttpError(404, "Memory not found");
      return res.json({ success: true, memory: doc });
    }
    const doc = await Memory.findOne({ _id: id, userId: req.user._id });
    if (!doc) throw new HttpError(404, "Memory not found");
    res.json({ success: true, memory: doc });
  } catch (e) {
    next(e);
  }
}

export async function updateMemory(req, res, next) {
  try {
    const data = updateMemorySchema.parse(req.body);
    const id = req.params.id;
    if (usePostgres()) {
      if (!isValidUuid(id)) throw new HttpError(400, "Invalid memory id");
      const doc = await memoryRepository.updateMemory(id, userId(req), data);
      if (!doc) throw new HttpError(404, "Memory not found");
      return res.json({ success: true, memory: doc });
    }
    const doc = await Memory.findOneAndUpdate(
      { _id: id, userId: req.user._id },
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
    const id = req.params.id;
    if (usePostgres()) {
      if (!isValidUuid(id)) throw new HttpError(400, "Invalid memory id");
      const deleted = await memoryRepository.deleteMemory(id, userId(req));
      if (!deleted) throw new HttpError(404, "Memory not found");
      return res.json({ success: true });
    }
    const doc = await Memory.findOneAndDelete({ _id: id, userId: req.user._id });
    if (!doc) throw new HttpError(404, "Memory not found");
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}
