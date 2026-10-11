const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const env = require("../config/env");
const AppError = require("./AppError");
const Media = require("../models/Media");

const uploadEnabled = Boolean(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret);
if (uploadEnabled) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
  });
}

// Multer's mimetype comes from the client and can lie, so the real type is read from the file's first bytes.
function sniff(buf) {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) =>
    /^image\/(png|jpe?g|webp)$/.test(file.mimetype) ? cb(null, true) : cb(new AppError(400, "Only png, jpg or webp images")),
});

function cloudinaryUpload(buffer) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder: "lookout" }, (err, result) => (err ? reject(err) : resolve({ url: result.secure_url, filename: result.public_id })))
      .end(buffer);
  });
}

/** Absolute URL of this API as the browser should reach it (set PUBLIC_API_URL behind unusual proxies). */
const baseUrl = (req) => (env.publicApiUrl || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");

/**
 * Stores one uploaded image and returns { url, filename }. Cloudinary is used when configured and reachable;
 * otherwise (or if it fails) the bytes are kept in MongoDB and served by GET /api/media/:id, so uploads always work.
 */
async function storeImage(file, ownerId, req) {
  const contentType = sniff(file.buffer);
  if (!contentType) throw new AppError(400, "That file isn't a valid PNG, JPEG or WebP image");
  if (uploadEnabled) {
    try {
      return await cloudinaryUpload(file.buffer);
    } catch (err) {
      console.warn("Cloudinary upload failed, storing the image in MongoDB instead:", err?.message || err?.error?.message);
    }
  }
  const media = await Media.create({ owner: ownerId, contentType, size: file.size, data: file.buffer });
  return { url: `${baseUrl(req)}/api/media/${media._id}`, filename: `media/${media._id}` };
}

module.exports = { upload, storeImage, uploadEnabled, baseUrl };
