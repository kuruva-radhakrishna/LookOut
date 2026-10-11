const crypto = require("crypto");
const Razorpay = require("razorpay");
const env = require("../config/env");
const AppError = require("../utils/AppError");

/**
 * Payment gateway wrapper. With RAZORPAY_KEY_ID/SECRET set it talks to Razorpay (use rzp_test_ keys
 * for test mode). Without keys it runs in "demo" mode: no money moves and the client may confirm a
 * payment directly, so the whole booking flow can be exercised locally or in a portfolio deployment.
 */
const mode = env.paymentMode;
const client =
  mode === "razorpay" ? new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret }) : null;

const safeEqual = (a, b) => {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};
const hmac = (secret, data) => crypto.createHmac("sha256", secret).update(data).digest("hex");

async function createOrder(booking) {
  if (mode === "demo") {
    return { provider: "demo", orderId: `demo_order_${booking._id}`, keyId: null };
  }
  try {
    const order = await client.orders.create({
      amount: booking.pricing.total,
      currency: booking.pricing.currency,
      receipt: String(booking._id),
      notes: { bookingId: String(booking._id) },
    });
    return { provider: "razorpay", orderId: order.id, keyId: env.razorpay.keyId };
  } catch (err) {
    console.error("Razorpay order creation failed", err?.error || err);
    throw new AppError(502, "Payment provider is unavailable, please try again");
  }
}

// Checks the signature Razorpay Checkout hands to the browser after a successful payment.
function verifyCheckoutSignature({ orderId, paymentId, signature }) {
  if (!orderId || !paymentId || !signature) return false;
  return safeEqual(hmac(env.razorpay.keySecret, `${orderId}|${paymentId}`), signature);
}

function verifyWebhookSignature(rawBody, signature) {
  if (!env.razorpay.webhookSecret || !signature) return false;
  return safeEqual(hmac(env.razorpay.webhookSecret, rawBody), signature);
}

async function refund(paymentId, amount) {
  if (mode === "demo" || String(paymentId).startsWith("demo_")) {
    return { id: `demo_refund_${Date.now()}`, amount };
  }
  return client.payments.refund(paymentId, { amount, speed: "normal" });
}

module.exports = { mode, createOrder, verifyCheckoutSignature, verifyWebhookSignature, refund };
