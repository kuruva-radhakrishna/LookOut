const express = require("express");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const Media = require("../models/Media");
const AppError = require("../utils/AppError");
const env = require("../config/env");
const { requireAuth } = require("../middleware/auth");
const { upload, storeImage } = require("../utils/upload");

const router = express.Router();

const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.nodeEnv === "test",
  message: { error: "Too many uploads, please try again later" },
});

// Upload up to 10 images; returns [{ url, filename }] to reference from a listing or review.
router.post("/", requireAuth, uploadLimiter, upload.array("images", 10), async (req, res) => {
  if (!req.files?.length) throw new AppError(400, "Choose at least one image");
  const stored = [];
  for (const file of req.files) stored.push(await storeImage(file, req.user._id, req)); // one at a time: keeps memory and DB load modest
  res.status(201).json(stored);
});

// Public, immutable image bytes. The default helmet policy would stop another origin (the Vercel site) from showing them.
router.get("/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError(404, "Image not found");
  const media = await Media.findById(req.params.id).select("contentType data");
  if (!media) throw new AppError(404, "Image not found");
  res.set({
    "Content-Type": media.contentType,
    "Cache-Control": "public, max-age=31536000, immutable",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Content-Security-Policy": "default-src 'none'",
  });
  res.send(media.data);
});

module.exports = router;
