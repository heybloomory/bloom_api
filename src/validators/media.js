import { z } from "zod";

export const createMediaSchema = z.object({
  type: z.enum(["image", "video"]),
  url: z.string().url().optional(),
  videoId: z.string().optional(),
  key: z.string().optional(),
  thumbUrl: z.union([z.string().url(), z.literal("")]).optional(),
  albumId: z.string().optional(),
  memoryId: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  sizeBytes: z.number().int().positive().optional(),
  mimeType: z.string().optional(),
  durationSec: z.number().positive().optional(),
});
