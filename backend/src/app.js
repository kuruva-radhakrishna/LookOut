const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const env = require("./config/env");
const payments = require("./services/paymentService");
const { uploadEnabled } = require("./utils/upload");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();
app.set("trust proxy", 1); // Render sits behind a proxy; needed for correct client IPs in rate limiting

app.use(helmet());
app.use(
  cors({
    origin(origin, cb) {
      // allow same-origin/tools (no Origin header) and the configured frontends
      if (!origin || env.clientUrls.includes(origin)) return cb(null, true);
      cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);
if (env.nodeEnv !== "test") app.use(morgan(env.isProd ? "combined" : "dev"));

// Webhooks need the untouched request body for signature verification, so they go before express.json().
app.use("/api/webhooks", express.raw({ type: "application/json" }), require("./routes/webhooks"));
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (_req, res) =>
  res.json({
    ok: true,
    paymentMode: payments.mode,
    razorpayKeyId: payments.mode === "razorpay" ? env.razorpay.keyId : null, // public key, safe to expose
    uploads: uploadEnabled,
    holdMinutes: env.holdMinutes,
  })
);
app.use("/api/auth", require("./routes/auth"));
app.use("/api/listings/:id/reviews", require("./routes/reviews").listingRouter);
app.use("/api/listings", require("./routes/listings"));
app.use("/api/reviews", require("./routes/reviews"));
app.use("/api/media", require("./routes/media"));
app.use("/api/favorites", require("./routes/favorites"));
app.use("/api/bookings", require("./routes/bookings"));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
