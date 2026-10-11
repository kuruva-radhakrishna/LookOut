const mongoose = require("mongoose");

// Uploaded image bytes, used when Cloudinary isn't configured (or is unreachable). Served by GET /api/media/:id.
const mediaSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    contentType: { type: String, required: true },
    size: Number,
    data: { type: Buffer, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Media", mediaSchema);
