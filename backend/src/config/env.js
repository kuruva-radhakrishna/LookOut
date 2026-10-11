require("dotenv").config();

// Some local resolvers (VPNs, routers, DNS proxies on 127.0.0.1) refuse the SRV lookups that
// mongodb+srv:// URIs need. In development, append public resolvers as a fallback; the system ones still go first.
if (process.env.NODE_ENV !== "production" && !process.env.NO_DNS_FALLBACK) {
  const dns = require("dns");
  dns.setServers([...new Set([...dns.getServers(), "8.8.8.8", "1.1.1.1"])]);
}

const num = (v, d) => (v === undefined || v === "" ? d : Number(v));

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: num(process.env.PORT, 5000),
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/lookout",
  jwtSecret: process.env.JWT_SECRET || "dev-only-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  // Comma separated list of allowed browser origins, e.g. https://lookout.vercel.app
  clientUrls: (process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean),
  holdMinutes: num(process.env.BOOKING_HOLD_MINUTES, 10),
  maxPendingHolds: num(process.env.MAX_PENDING_HOLDS, 3),
  taxRate: 0.18, // GST, mirrored in the frontend for the price preview
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || "",
    keySecret: process.env.RAZORPAY_KEY_SECRET || "",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
  },
  mapboxToken: process.env.MAPBOX_TOKEN || "",
};

env.isProd = env.nodeEnv === "production";
env.paymentMode = env.razorpay.keyId && env.razorpay.keySecret ? "razorpay" : "demo";

if (env.isProd && env.jwtSecret === "dev-only-secret-change-me") {
  throw new Error("JWT_SECRET must be set in production");
}

module.exports = env;
