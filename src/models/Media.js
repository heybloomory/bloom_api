import mongoose from "mongoose";

const MediaSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    albumId: { type: mongoose.Schema.Types.ObjectId, ref: "Album", index: true },
    memoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Memory", index: true },

    type: { type: String, enum: ["image", "video"], required: true },
    url: { type: String, default: "" },           // required for images (BunnyCDN); empty for video
    videoId: { type: String, default: "" },       // Bunny Stream video ID when type === "video"
    key: { type: String, default: "" },
    originalFileName: { type: String, default: "" },
    thumbUrl: { type: String, default: "" },

    width: { type: Number },
    height: { type: Number },
    sizeBytes: { type: Number },
    mimeType: { type: String, default: "" },
    durationSec: { type: Number },
  },
  { timestamps: true }
);

MediaSchema.index({ userId: 1, albumId: 1, createdAt: -1 });

export default mongoose.model("Media", MediaSchema);
