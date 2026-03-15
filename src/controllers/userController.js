import User from "../models/User.js";
import { z } from "zod";
import * as userRepository from "../repositories/userRepository.js";

const updateMeSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  avatarUrl: z.string().url().optional(),
  plan: z.enum(["free", "personal", "partner", "vendor"]).optional(),
});

const usePostgres = () => String(process.env.USE_POSTGRES || "").toLowerCase() === "true";

export async function updateMe(req, res, next) {
  try {
    const data = updateMeSchema.parse(req.body);
    const uid = req.user._id ?? req.user.id;
    if (usePostgres()) {
      const user = await userRepository.updateUser(uid, data);
      if (!user) throw new Error("User not found");
      return res.json({ success: true, user });
    }
    const user = await User.findByIdAndUpdate(req.user._id, data, { new: true }).select("-passwordHash");
    res.json({ success: true, user });
  } catch (e) {
    next(e);
  }
}
