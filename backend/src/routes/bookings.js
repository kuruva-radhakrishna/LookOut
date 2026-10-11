const express = require("express");
const Joi = require("joi");
const Booking = require("../models/Booking");
const Listing = require("../models/Listing");
const AppError = require("../utils/AppError");
const { requireAuth } = require("../middleware/auth");
const validate = require("../middleware/validate");
const service = require("../services/bookingService");
const payments = require("../services/paymentService");
const demo = require("../services/demoPaymentService");

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
    throw new AppError(400, "Use the payment window to pay; demo bookings are confirmed by a successful payment attempt");
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

// ---- demo gateway: only exists when no Razorpay keys are configured ----
const demoOnly = (_req, _res, next) => (payments.mode === "demo" ? next() : next(new AppError(404, "Not found")));
const startSchema = Joi.object({
  method: Joi.string().valid("card", "upi", "netbanking", "wallet").required(),
  card: Joi.object({
    number: Joi.string().pattern(/^[0-9 ]{12,23}$/),
    expiry: Joi.string().pattern(/^\d{2}\/\d{2}$/),
    cvv: Joi.string().pattern(/^\d{3,4}$/),
    name: Joi.string().trim().min(2).max(60),
  }),
  upi: Joi.object({ vpa: Joi.string().trim().pattern(/^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/).message("Enter a valid UPI ID like name@bank") }),
  bank: Joi.string().valid(...demo.BANKS),
  wallet: Joi.string().valid(...demo.WALLETS),
});
const actionSchema = Joi.object({
  action: Joi.string().valid("otp", "resend_otp", "approve", "decline", "bank_success", "bank_failure").required(),
  otp: Joi.string().pattern(/^\d{6}$/).message("Enter the 6-digit OTP"),
});
const cancelSchema = Joi.object({ by: Joi.string().valid("user", "refresh").default("user") });
const pub = (a) => (a.toObject ? a.toObject() : a);

router.post("/:id/payments", demoOnly, validate(startSchema), async (req, res) => {
  res.status(201).json(pub(await demo.start(req.params.id, req.user._id, req.body)));
});
router.post("/:id/payments/:attemptId/action", demoOnly, validate(actionSchema), async (req, res) => {
  res.json(pub(await demo.act(req.params.id, req.user._id, req.params.attemptId, req.body)));
});
router.post("/:id/payments/:attemptId/cancel", demoOnly, validate(cancelSchema), async (req, res) => {
  res.json(pub(await demo.cancel(req.params.id, req.user._id, req.params.attemptId, req.body.by)));
});

router.post("/:id/cancel", async (req, res) => {
  res.json(await service.cancelBooking(req.params.id, req.user._id));
});

module.exports = router;
