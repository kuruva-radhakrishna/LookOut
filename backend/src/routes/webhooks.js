const express = require("express");
const Booking = require("../models/Booking");
const payments = require("../services/paymentService");
const service = require("../services/bookingService");

const router = express.Router();

/**
 * Razorpay -> server safety net. If the guest closes the tab after paying, the browser callback never
 * fires; this webhook still confirms the booking. Mounted with a raw body parser (needed for the
 * signature check). Configure it in the Razorpay dashboard for the `payment.captured` event.
 */
router.post("/razorpay", async (req, res) => {
  const raw = req.body.toString("utf8");
  if (!payments.verifyWebhookSignature(raw, req.headers["x-razorpay-signature"])) {
    return res.status(400).json({ error: "Invalid signature" });
  }
  const event = JSON.parse(raw);
  if (event.event === "payment.captured") {
    const payment = event.payload.payment.entity;
    const booking = await Booking.findOne({ "payment.orderId": payment.order_id });
    if (booking) {
      try {
        await service.confirmPayment(booking._id, payment.id);
      } catch (err) {
        if (!err.status) throw err; // business outcomes (e.g. refunded) are fine; ack so Razorpay stops retrying
      }
    }
  }
  res.json({ ok: true });
});

module.exports = router;
