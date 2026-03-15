import { OAuth2Client } from "google-auth-library";
import { recordLogin, getLoginMeta } from "../utils/loginAudit.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { HttpError } from "../utils/httpError.js";
import { registerSchema, loginSchema, loginEmailSchema, sendOtpSchema } from "../validators/auth.js";
import * as userRepository from "../repositories/userRepository.js";
import * as loginEventRepository from "../repositories/loginEventRepository.js";

const usePostgres = () => String(process.env.USE_POSTGRES || "").toLowerCase() === "true";

function signToken(userId) {
  return jwt.sign(
    { sub: String(userId) },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function toUserResponse(user) {
  const id = user._id ?? user.id;
  return { id, email: user.email, phone: user.phone, name: user.name, plan: user.plan };
}

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function googleAuth(req, res, next) {
  try {
    const { idToken } = req.body;
    if (!idToken) throw new HttpError(400, "idToken required");

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload?.email?.toLowerCase();
    const googleId = payload?.sub;
    const name = payload?.name || "";
    const picture = payload?.picture || "";

    if (!email || !googleId) throw new HttpError(401, "Invalid Google token");

    let user;
    let isNew = false;

    if (usePostgres()) {
      user = await userRepository.findUserByGoogleId(googleId);
      if (!user) user = await userRepository.findUserByEmail(email);
      if (!user) {
        isNew = true;
        user = await userRepository.createUser({
          email,
          name,
          providers: { google: { googleId, email } },
          avatarUrl: picture,
          isEmailVerified: true,
        });
      } else {
        const providers = { ...(user.providers || {}), google: { googleId, email } };
        user = await userRepository.updateUser(user.id, {
          providers,
          name: user.name || name,
          avatarUrl: user.avatarUrl || picture,
          isEmailVerified: true,
        });
      }
      const meta = getLoginMeta(req);
      await userRepository.updateLastLogin(user.id, {
        lastLoginAt: new Date(),
        lastLoginIP: meta.ip,
        lastLoginDevice: meta.device,
        lastLoginLocation: meta.location,
      });
      await loginEventRepository.createLoginEvent({
        userId: user.id,
        method: "google",
        at: new Date(),
        ip: meta.ip,
        userAgent: meta.userAgent,
        device: meta.device,
        location: meta.location,
      });
    } else {
      user = await User.findOne({ "providers.google.googleId": googleId });
      if (!user) user = await User.findOne({ email });
      if (!user) {
        isNew = true;
        user = await User.create({
          email,
          name,
          providers: { google: { googleId, email } },
          avatarUrl: picture,
          isEmailVerified: true,
        });
      } else {
        user.providers = user.providers || {};
        user.providers.google = user.providers.google || {};
        user.providers.google.googleId = googleId;
        user.providers.google.email = email;
        if (!user.name && name) user.name = name;
        if (!user.avatarUrl && picture) user.avatarUrl = picture;
        if (!user.isEmailVerified) user.isEmailVerified = true;
        await user.save();
      }
      await recordLogin({ req, user, method: "google" });
    }

    const token = signToken(user._id ?? user.id);

    res.json({
      success: true,
      message: isNew ? "Registered & logged in" : "Logged in",
      token,
      isNew,
      user: toUserResponse(user),
    });
  } catch (e) {
    next(e);
  }
}


export async function register(req, res, next) {
  try {
    const data = registerSchema.parse(req.body);

    if (usePostgres()) {
      const exists = await userRepository.findUserByEmailOrPhone(data.email, data.phone);
      if (exists) throw new HttpError(409, "User already exists");
      const passwordHash = await bcrypt.hash(data.password, 12);
      const user = await userRepository.createUser({
        email: data.email?.toLowerCase(),
        phone: data.phone,
        name: data.name || "",
        passwordHash,
      });
      const token = signToken(user.id);
      return res.status(201).json({ success: true, token, user: toUserResponse(user) });
    }

    const exists = await User.findOne({
      $or: [
        data.email ? { email: data.email.toLowerCase() } : null,
        data.phone ? { phone: data.phone } : null
      ].filter(Boolean)
    });
    if (exists) throw new HttpError(409, "User already exists");

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await User.create({
      email: data.email?.toLowerCase(),
      phone: data.phone,
      name: data.name || "",
      passwordHash,
    });

    const token = signToken(user._id.toString());
    res.status(201).json({
      success: true,
      token,
      user: toUserResponse(user),
    });
  } catch (e) {
    next(e);
  }
}

export async function login(req, res, next) {
  try {
    const data = loginSchema.parse(req.body);

    if (usePostgres()) {
      const user = data.email
        ? await userRepository.findUserByEmailWithPassword(data.email.toLowerCase())
        : await userRepository.findUserByPhoneWithPassword(data.phone);
      if (!user) throw new HttpError(401, "Invalid credentials");
      const ok = await bcrypt.compare(data.password, user.passwordHash || "");
      if (!ok) throw new HttpError(401, "Invalid credentials");
      const meta = getLoginMeta(req);
      await userRepository.updateLastLogin(user.id, {
        lastLoginAt: new Date(),
        lastLoginIP: meta.ip,
        lastLoginDevice: meta.device,
        lastLoginLocation: meta.location,
      });
      await loginEventRepository.createLoginEvent({
        userId: user.id,
        method: "password",
        at: new Date(),
        ip: meta.ip,
        userAgent: meta.userAgent,
        device: meta.device,
        location: meta.location,
      });
      const token = signToken(user.id);
      return res.json({ success: true, token, user: toUserResponse(user) });
    }

    const query = data.email ? { email: data.email.toLowerCase() } : { phone: data.phone };
    const user = await User.findOne(query).select("+passwordHash");
    if (!user) throw new HttpError(401, "Invalid credentials");
    const ok = await bcrypt.compare(data.password, user.passwordHash || "");
    if (!ok) throw new HttpError(401, "Invalid credentials");
    await recordLogin({ req, user, method: "password" });

    const token = signToken(user._id.toString());
    res.json({
      success: true,
      token,
      user: toUserResponse(user),
    });
  } catch (e) {
    next(e);
  }
}

// ---------------------------------------------------------------------------
// Bloom App compatibility endpoints
// Flutter app currently calls:
//   GET  /api/auth/check-country
//   POST /api/auth/send-otp       { mobile }
//   POST /api/auth/login-email    { email, password }
// ---------------------------------------------------------------------------

export async function checkCountry(req, res) {
  // Simple, dependency-free implementation:
  // - If a reverse proxy sets `x-country` (e.g., Cloudflare), use it.
  // - Otherwise default to "IN" in development.
  const hdr = String(req.headers["x-country"] || req.headers["cf-ipcountry"] || "").toUpperCase();
  const country = hdr || (process.env.NODE_ENV === "production" ? "" : "IN");
  const isIndia = country === "IN" || country === "IND";
  res.json({ success: true, country: country || null, isIndia });
}

export async function sendOtp(req, res, next) {
  try {
    const { mobile } = sendOtpSchema.parse(req.body);
    // OTP is a placeholder until you integrate an SMS provider (Twilio, MSG91, etc.).
    // For dev, return success and include OTP ONLY outside production.
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const payload = { success: true, message: "OTP sent (demo). Integrate SMS provider for production." };
    if (process.env.NODE_ENV !== "production") payload.otp = otp;
    res.json(payload);
  } catch (e) {
    next(e);
  }
}

export async function loginEmail(req, res, next) {
  try {
    const data = loginEmailSchema.parse(req.body);

    if (usePostgres()) {
      const user = await userRepository.findUserByEmailWithPassword(data.email.toLowerCase());
      if (!user) throw new HttpError(401, "Invalid credentials");
      const ok = await bcrypt.compare(data.password, user.passwordHash || "");
      if (!ok) throw new HttpError(401, "Invalid credentials");
      const meta = getLoginMeta(req);
      await userRepository.updateLastLogin(user.id, {
        lastLoginAt: new Date(),
        lastLoginIP: meta.ip,
        lastLoginDevice: meta.device,
        lastLoginLocation: meta.location,
      });
      await loginEventRepository.createLoginEvent({
        userId: user.id,
        method: "password",
        at: new Date(),
        ip: meta.ip,
        userAgent: meta.userAgent,
        device: meta.device,
        location: meta.location,
      });
      const token = signToken(user.id);
      return res.json({ success: true, token, user: toUserResponse(user) });
    }

    const user = await User.findOne({ email: data.email.toLowerCase() }).select("+passwordHash");
    if (!user) throw new HttpError(401, "Invalid credentials");
    const ok = await bcrypt.compare(data.password, user.passwordHash || "");
    if (!ok) throw new HttpError(401, "Invalid credentials");
    await recordLogin({ req, user, method: "password" });

    const token = signToken(user._id.toString());
    res.json({
      success: true,
      token,
      user: toUserResponse(user),
    });
  } catch (e) {
    next(e);
  }
}

export async function me(req, res) {
  res.json({ success: true, user: req.user });
}
