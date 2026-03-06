import { z } from "zod";

export const createMemorySchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string().min(1).max(30)).optional(),
  visibility: z.enum(["private", "shared", "public"]).optional(),
});

export const updateMemorySchema = createMemorySchema.partial().extend({
  isFavorite: z.boolean().optional(),
  coverMediaId: z.string().optional(),
});
