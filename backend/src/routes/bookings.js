const express = require("express");
const Joi = require("joi");
const Booking = require("../models/Booking");
const Listing = require("../models/Listing");
const AppError = require("../utils/AppError");
const { requireAuth } = require("../middleware/auth");
const validate = require("../middleware/validate");
const service = require("../services/bookingService");
const payments = require("../services/paymentService");

const router = express.Router();
router.use(requireAuth);

const createSchema = Joi.object({
  listingId: Joi.string().hex().length(24).required(),
  checkIn: Joi.string().required(),
  checkOut: Joi.string().required(),
  guests: Joi.number().integer().min(1).max(20).default(1),
});
const verifySchema = Joi.object({
  razorpay_order_id: Joi.string(),
  razorpay_payment_id: Joi.string(),
  razorpay_signature: Joi.string(),
  demo: Joi.boolean(),
});

const populate = (q) => q.populate("listing", "title img place country owner").populate("guest", "username");

// Step 1: hold the dates and open a payment order.
router.post("/", validate(createSchema), async (req, res) => {
  const { booking, checkout } = await service.createHold({ ...req.body, guestId: req.user._id });
  res.status(201).json({ booking, checkout, paymentMode: payments.mode });
});

router.get("/mine", async (req, res) => {
  res.json(await populate(Booking.find({ guest: req.user._id }).sort({ createdAt: -1 })).lean());
});

// Bookings other people made on listings I own.
router.get("/hosting", async (req, res) => {
  const mine = await Listing.find({ owner: req.user._id }).distinct("_id");
  res.json(await populate(Booking.find({ listing: { $in: mine }, status: "confirmed" }).sort({ checkIn: 1 })).lean());
});

router.get("/:id", async (req, res) => {
  const booking = await populate(Booking.findOne({ _id: req.params.id, guest: req.user._id })).lean();
  if (!booking) throw new AppError(404, "Booking not found");
  res.json(booking);
});

// Step 2: the browser reports a successful payment; we verify the gateway signature before confirming.
router.post("/:id/verify", validate(verifySchema), async (req, res) => {
  const booking = await Booking.findOne({ _id: req.params.id, guest: req.user._id });
  if (!booking) throw new AppError(404, "Booking not found");

  let paymentId;
  if (payments.mode === "demo") {
    if (!req.body.demo) throw new AppError(400, "Demo payment confirmation required");
    paymentId = `demo_pay_${booking._id}`;
  } else {
    const ok = payments.verifyCheckoutSignature({
      orderId: booking.payment?.orderId,
      paymentId: req.body.razorpay_payment_id,
      signature: req.body.razorpay_signature,
    });
    if (!ok || req.body.razorpay_order_id !== booking.payment?.orderId) {
      throw new AppError(400, "Payment verification failed");
    }
    paymentId = req.body.razorpay_payment_id;
  }
  res.json(await service.confirmPayment(booking._id, paymentId));
});

router.post("/:id/cancel", async (req, res) => {
  res.json(await service.cancelBooking(req.params.id, req.user._id));
});

module.exports = router;
