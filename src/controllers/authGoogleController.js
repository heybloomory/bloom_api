import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { getFirebaseAdmin } from "../config/firebaseAdmin.js";

function signJwt(user) {
  return jwt.sign(
    { sub: user._id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

export async function loginWithGoogle(req, res) {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ success: false, message: "idToken is required" });
    }

    const admin = getFirebaseAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);

    const email = decoded.email?.toLowerCase();
    const name =
      decoded.name ||
      decoded.firebase?.sign_in_provider ||
      "Google User";

    if (!email) {
      return res.status(400).json({ success: false, message: "Google account email not found" });
    }

    // ✅ register if not exists, else login
    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name,
        email,
        authProvider: "google",
        // password not needed for google users
      });
    } else {
      // Optional: update provider/name if missing
      const updates = {};
      if (!user.authProvider) updates.authProvider = "google";
      if (!user.name && name) updates.name = name;
      if (Object.keys(updates).length) {
        user = await User.findByIdAndUpdate(user._id, updates, { new: true });
      }
    }

    const token = signJwt(user);

    return res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        plan: user.plan || "free",
      },
    });
  } catch (e) {
    return res.status(401).json({
      success: false,
      message: "Google token verification failed",
      error: e?.message,
    });
  }
}
