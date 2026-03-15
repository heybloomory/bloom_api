import jwt from "jsonwebtoken";
import { HttpError } from "../utils/httpError.js";
import User from "../models/User.js";
import * as userRepository from "../repositories/userRepository.js";

const usePostgres = () => String(process.env.USE_POSTGRES || "").toLowerCase() === "true";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new HttpError(401, "Missing Authorization token");

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = usePostgres()
      ? await userRepository.findUserById(payload.sub)
      : await User.findById(payload.sub).select("-passwordHash");
    if (!user) throw new HttpError(401, "Invalid token user");

    req.user = user;
    next();
  } catch (e) {
    if (e.name === "JsonWebTokenError" || e.name === "TokenExpiredError") {
      return next(new HttpError(401, "Invalid or expired token"));
    }
    next(e);
  }
}

/** Sets req.user when token is valid; does not 401 when missing (for optional auth). */
export async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return next();

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = usePostgres()
      ? await userRepository.findUserById(payload.sub)
      : await User.findById(payload.sub).select("-passwordHash");
    if (user) req.user = user;
    next();
  } catch {
    next();
  }
}
