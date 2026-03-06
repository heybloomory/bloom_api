import { z } from "zod";

export const createAlbumSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  memoryId: z.string().optional(),
  parentId: z.string().nullable().optional(), // ✅ root = null, sub-album = parent album id
  coverMediaId: z.string().optional(),
});

export const updateAlbumSchema = createAlbumSchema.partial();
