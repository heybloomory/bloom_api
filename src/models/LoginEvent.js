import mongoose from "mongoose";

const LoginEventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    method: { type: String, enum: ["password", "google"], required: true },
    at: { type: Date, default: Date.now },
    ip: String,
    userAgent: String,
    device: String,
    location: {
      country: String,
      region: String,
      city: String,
      ll: [Number],
    },
  },
  { timestamps: true }
);

export default mongoose.model("LoginEvent", LoginEventSchema);
