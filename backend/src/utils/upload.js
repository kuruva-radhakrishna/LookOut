const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const env = require("../config/env");
const AppError = require("./AppError");

const uploadEnabled = Boolean(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret);
if (uploadEnabled) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
  });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    /^image\/(png|jpe?g|webp)$/.test(file.mimetype) ? cb(null, true) : cb(new AppError(400, "Only png, jpg or webp images")),
});

function uploadBuffer(buffer) {
  if (!uploadEnabled) {
    throw new AppError(400, "Image upload is not configured on the server; provide an image URL instead");
  }
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder: "lookout" }, (err, result) =>
        err ? reject(err) : resolve({ url: result.secure_url, filename: result.public_id })
      )
      .end(buffer);
  });
}

module.exports = { upload, uploadBuffer, uploadEnabled };
