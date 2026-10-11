const multer = require("multer");
const env = require("../config/env");

function notFound(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  let status = err.status || 500;
  let message = err.message || "Something went wrong";

  if (err instanceof multer.MulterError) status = 400;
  if (err.name === "CastError") {
    status = 404;
    message = "Resource not found";
  }
  if (err.code === 11000) {
    status = 409;
    message = "Already exists";
  }
  if (status >= 500) {
    console.error(err);
    if (env.isProd) message = "Something went wrong";
  }
  res.status(status).json({ error: message, ...(err.extra || {}) });
}

module.exports = { notFound, errorHandler };
