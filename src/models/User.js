import mongoose from "mongoose";
import validator from "validator";

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      sparse: true,
      validate: {
        validator: (v) => !v || validator.isEmail(v),
        message: "Invalid email",
      },
    },
    phone: { type: String, trim: true, unique: true, sparse: true },
    name: { type: String, trim: true, default: "" },
    passwordHash: { type: String, select: false },
    plan: { type: String, enum: ["free", "personal", "partner", "vendor"], default: "free" },
    avatarUrl: { type: String, default: "" },
    lastLoginAt: { type: Date },
    lastLoginIP: { type: String },
    lastLoginDevice: { type: String },
    lastLoginLocation: {
      country: String,
      region: String,
      city: String,
      ll: [Number], // [lat, lon]
    },
    providers: {
      google: {
        googleId: String,
        email: String,
      },
    },

    // Profile completion (DOB is required in Flutter onboarding)
    dateOfBirth: { type: Date },
    // avatarUrl: { type: String },
    isEmailVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// NOTE:
// We already declare `unique: true` on email/phone, so adding explicit indexes
// again causes duplicate-index warnings in Mongoose.

export default mongoose.model("User", UserSchema);
