import { requireAuth } from "../middleware/auth.js";
import * as memoryRepository from "../repositories/memoryRepository.js";
import * as albumRepository from "../repositories/albumRepository.js";

const usePostgres = () => String(process.env.USE_POSTGRES || "").toLowerCase() === "true";
const userId = (req) => req.user._id ?? req.user.id;

/**
 * GET /api/search?q=...
 * Returns { memories: [...], albums: [...] }.
 * Full-text search only when USE_POSTGRES=true; otherwise returns empty arrays.
 */
export async function search(req, res, next) {
  try {
    const q = (req.query.q || "").toString().trim();
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

    if (!usePostgres()) {
      return res.json({ memories: [], albums: [] });
    }

    const uid = userId(req);
    const [memories, albums] = await Promise.all([
      memoryRepository.searchMemories(uid, q, limit),
      albumRepository.searchAlbums(uid, q, limit),
    ]);

    res.json({ memories, albums });
  } catch (e) {
    next(e);
  }
}
