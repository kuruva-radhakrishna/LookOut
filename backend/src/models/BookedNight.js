const mongoose = require("mongoose");

/**
 * One document per (listing, night). The unique index on {listing, date} is the concurrency guard:
 * MongoDB guarantees that of N simultaneous inserts for the same night exactly one succeeds, so two
 * guests can never hold the same night, with no application-level locking and no replica set needed.
 *
 * `expiresAt` is set while a night is only *held* (payment pending) and removed once paid. The TTL
 * index sweeps abandoned holds; the booking service also reclaims stale holds on demand because the
 * TTL monitor only runs about once a minute.
 */
const bookedNightSchema = new mongoose.Schema({
  listing: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },
  date: { type: Date, required: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, index: true },
  expiresAt: { type: Date },
});

bookedNightSchema.index({ listing: 1, date: 1 }, { unique: true });
bookedNightSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("BookedNight", bookedNightSchema);
