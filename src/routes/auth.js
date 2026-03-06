import { Router } from "express";
import { register, login, loginEmail, sendOtp, checkCountry, me, googleAuth } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// ✅ Google: register if new, else login
router.post("/google", googleAuth);

// ✅ Keep old route for compatibility (your app may call this)
router.post("/login-google", googleAuth);

router.post("/register", register);
router.post("/login", login);

// Bloom App (Flutter) compatibility routes
router.get("/check-country", checkCountry);
router.post("/send-otp", sendOtp);
router.post("/login-email", loginEmail);

router.get("/me", requireAuth, me);

export default router;
