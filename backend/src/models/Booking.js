const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    listing: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true, index: true },
    guest: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    nights: { type: Number, required: true },
    guests: { type: Number, required: true, min: 1 },
    pricing: {
      subtotal: Number, // paise
      tax: Number,
      total: Number,
      currency: { type: String, default: "INR" },
    },
    // pending = dates held, awaiting payment; expired = hold ran out; confirmed = paid
    status: { type: String, enum: ["pending", "confirmed", "cancelled", "expired"], default: "pending", index: true },
    holdExpiresAt: Date,
    payment: {
      provider: { type: String, enum: ["razorpay", "demo"] },
      orderId: { type: String, index: true, sparse: true },
      paymentId: String,
      refundId: String,
      refundedAmount: Number,
      refundError: String,
      paidAt: Date,
    },
    cancelledAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);
