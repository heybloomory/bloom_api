import mongoose from "mongoose";

const AlbumSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    memoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Memory", index: true },

    // ✅ 3-level hierarchy: Album (1) → Sub-Album (2) → Sub-Album (3). Max depth = 3.
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Album", default: null, index: true },
    level: { type: Number, enum: [1, 2, 3], default: 1 },

    title: { type: String, trim: true, required: true },
    description: { type: String, trim: true, default: "" },
    coverMediaId: { type: mongoose.Schema.Types.ObjectId, ref: "Media" },
  },
  { timestamps: true }
);

AlbumSchema.index({ userId: 1, parentId: 1, createdAt: -1 });

export default mongoose.model("Album", AlbumSchema);
