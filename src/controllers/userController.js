import User from "../models/User.js";
import { z } from "zod";

const updateMeSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  avatarUrl: z.string().url().optional(),
  plan: z.enum(["free", "personal", "partner", "vendor"]).optional(),
});

export async function updateMe(req, res, next) {
  try {
    const data = updateMeSchema.parse(req.body);
    const user = await User.findByIdAndUpdate(req.user._id, data, { new: true }).select("-passwordHash");
    res.json({ success: true, user });
  } catch (e) {
    next(e);
  }
}
