import mongoose from "mongoose";

const MemorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, trim: true, required: true },
    description: { type: String, trim: true, default: "" },
    coverMediaId: { type: mongoose.Schema.Types.ObjectId, ref: "Media" },
    tags: [{ type: String, trim: true }],
    isFavorite: { type: Boolean, default: false },
    visibility: { type: String, enum: ["private", "shared", "public"], default: "private" },
  },
  { timestamps: true }
);

MemorySchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("Memory", MemorySchema);
