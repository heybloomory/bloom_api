import Memory from "../models/Memory.js";
import * as memoryRepository from "../repositories/memoryRepository.js";
import { getTimelineCache, setTimelineCache } from "../utils/timelineCache.js";

const usePostgres = () => String(process.env.USE_POSTGRES || "").toLowerCase() === "true";
const userId = (req) => req.user._id ?? req.user.id;

/**
 * GET /api/timeline?limit=20&offset=0
 * Returns { memories: [...] }. Uses Redis cache when USE_POSTGRES and Redis are available.
 */
export async function getTimeline(req, res, next) {
  try {
    const uid = userId(req);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

    if (!usePostgres()) {
      const docs = await Memory.find({ userId: uid })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset)
        .lean();
      return res.json({ memories: docs });
    }

    const cached = await getTimelineCache(uid, limit, offset);
    if (cached !== null) {
      return res.json({ memories: cached });
    }

    const memories = await memoryRepository.getTimeline(uid, limit, offset);
    await setTimelineCache(uid, limit, offset, memories);
    res.json({ memories });
  } catch (e) {
    next(e);
  }
}
