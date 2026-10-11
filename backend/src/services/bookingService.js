const Booking = require("../models/Booking");
const BookedNight = require("../models/BookedNight");
const Listing = require("../models/Listing");
const env = require("../config/env");
const AppError = require("../utils/AppError");
const { parseDay, today, nightsBetween, MAX_NIGHTS, DAY } = require("../utils/dates");
const { priceStay } = require("../utils/pricing");
const payments = require("./paymentService");

const isDuplicateKey = (err) => err?.code === 11000 || err?.writeErrors?.some?.((w) => w.code === 11000);
const FULL_REFUND_NOTICE_MS = 2 * DAY; // free cancellation until 48h before check-in

/** Drop holds whose payment window has passed so their nights become bookable again. */
async function releaseExpiredHolds(listingId, dates) {
  const now = new Date();
  const stale = await BookedNight.find({ listing: listingId, date: { $in: dates }, expiresAt: { $lte: now } })
    .select("booking")
    .lean();
  if (!stale.length) return;
  const ids = [...new Set(stale.map((n) => String(n.booking)))];
  await Booking.updateMany({ _id: { $in: ids }, status: "pending" }, { status: "expired" });
  // Filtering on expiresAt again makes this a no-op for any hold that was paid in the meantime.
  await BookedNight.deleteMany({ booking: { $in: ids }, expiresAt: { $lte: now } });
}

/**
 * Step 1 of a booking: atomically hold every night of the stay, then create the payment order.
 *
 * Nights are inserted in ascending date order. Two overlapping requests therefore collide on the
 * same (earliest shared) night: exactly one wins and the other gets a clean 409, instead of both
 * grabbing part of the range and both failing.
 */
async function createHold({ listingId, guestId, checkIn, checkOut, guests }) {
  const listing = await Listing.findById(listingId);
  if (!listing) throw new AppError(404, "Listing not found");
  if (String(listing.owner) === String(guestId)) throw new AppError(400, "You can't book your own listing");

  const start = parseDay(checkIn, "checkIn");
  const end = parseDay(checkOut, "checkOut");
  if (start < today()) throw new AppError(400, "Check-in can't be in the past");
  const dates = nightsBetween(start, end);
  if (dates.length < 1) throw new AppError(400, "Check-out must be after check-in");
  if (dates.length > MAX_NIGHTS) throw new AppError(400, `Stays are limited to ${MAX_NIGHTS} nights`);
  if (guests > listing.maxGuests) throw new AppError(400, `This place sleeps at most ${listing.maxGuests} guests`);

  const now = new Date();
  const openHolds = await Booking.countDocuments({ guest: guestId, status: "pending", holdExpiresAt: { $gt: now } });
  if (openHolds >= env.maxPendingHolds) {
    throw new AppError(429, "You have several unpaid reservations. Finish or cancel one first.");
  }

  await releaseExpiredHolds(listing._id, dates);

  const holdExpiresAt = new Date(Date.now() + env.holdMinutes * 60 * 1000);
  const booking = await Booking.create({
    listing: listing._id,
    guest: guestId,
    checkIn: start,
    checkOut: end,
    nights: dates.length,
    guests,
    pricing: priceStay(listing.cost, dates.length),
    status: "pending",
    holdExpiresAt,
  });

  try {
    await BookedNight.insertMany(
      dates.map((date) => ({ listing: listing._id, date, booking: booking._id, expiresAt: holdExpiresAt })),
      { ordered: true }
    );
  } catch (err) {
    await discard(booking);
    if (isDuplicateKey(err)) {
      throw new AppError(409, "Sorry, some of those dates were just booked by someone else. Please pick different dates.");
    }
    throw err;
  }

  try {
    const order = await payments.createOrder(booking);
    booking.payment = { provider: order.provider, orderId: order.orderId };
    await booking.save();
    return { booking, checkout: { provider: order.provider, orderId: order.orderId, keyId: order.keyId } };
  } catch (err) {
    await discard(booking);
    throw err;
  }
}

async function discard(booking) {
  await BookedNight.deleteMany({ booking: booking._id });
  await Booking.deleteOne({ _id: booking._id });
}

/**
 * Make sure every night of the booking is held by it with no expiry. Normally the hold is still
 * intact. If the payment window lapsed (or the TTL sweeper already removed the rows) before a
 * successful payment reached us, we re-claim the nights; this only fails if someone else took them.
 */
async function reclaimNights(booking) {
  await BookedNight.updateMany({ booking: booking._id }, { $unset: { expiresAt: 1 } });
  const held = new Set((await BookedNight.find({ booking: booking._id }).lean()).map((n) => n.date.getTime()));
  for (const date of nightsBetween(booking.checkIn, booking.checkOut)) {
    if (held.has(date.getTime())) continue;
    try {
      await BookedNight.create({ listing: booking.listing, date, booking: booking._id });
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
      const owner = await BookedNight.findOne({ listing: booking.listing, date }).lean();
      if (!owner || String(owner.booking) !== String(booking._id)) {
        await BookedNight.deleteMany({ booking: booking._id });
        return false;
      }
    }
  }
  return true;
}

/**
 * Step 2: the payment succeeded (browser callback or webhook). Idempotent, so being called twice for
 * the same payment is harmless. If the dates can no longer be honoured the guest is refunded.
 */
async function confirmPayment(bookingId, paymentId) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new AppError(404, "Booking not found");
  if (booking.status === "confirmed") return booking;

  if (booking.status === "cancelled" || !(await reclaimNights(booking))) {
    const reason = booking.status === "cancelled" ? "was cancelled" : "could not be held";
    await refundBooking(booking, paymentId);
    throw new AppError(409, `Your reservation ${reason}, so the payment has been refunded.`);
  }

  const confirmed = await Booking.findOneAndUpdate(
    { _id: booking._id, status: { $in: ["pending", "expired"] } },
    {
      $set: { status: "confirmed", "payment.paymentId": paymentId, "payment.paidAt": new Date() },
      $unset: { holdExpiresAt: 1 },
    },
    { new: true }
  );
  return confirmed || Booking.findById(booking._id); // lost a race to a concurrent confirmation
}

async function refundBooking(booking, paymentId, amount = booking.pricing.total) {
  const update = { "payment.paymentId": paymentId };
  try {
    const refund = await payments.refund(paymentId, amount);
    update["payment.refundId"] = refund.id;
    update["payment.refundedAmount"] = amount;
  } catch (err) {
    console.error(`Refund failed for booking ${booking._id}`, err?.error || err);
    update["payment.refundError"] = String(err?.error?.description || err.message);
  }
  if (booking.status !== "cancelled") update.status = "expired";
  return Booking.findByIdAndUpdate(booking._id, { $set: update, $unset: { holdExpiresAt: 1 } }, { new: true });
}

/** Guests can cancel unpaid holds any time, and paid stays with a full refund up to 48h before check-in. */
async function cancelBooking(bookingId, guestId) {
  const booking = await Booking.findOne({ _id: bookingId, guest: guestId });
  if (!booking) throw new AppError(404, "Booking not found");
  if (booking.status === "cancelled") return booking;
  if (booking.checkIn <= today() && booking.status === "confirmed") {
    throw new AppError(400, "Stays that have started can't be cancelled online");
  }
  const wasPaid = booking.status === "confirmed";

  // The status flip is the lock: only one of several concurrent cancels gets past it, so we refund once.
  const cancelled = await Booking.findOneAndUpdate(
    { _id: booking._id, status: { $in: ["pending", "expired", "confirmed"] } },
    { $set: { status: "cancelled", cancelledAt: new Date() }, $unset: { holdExpiresAt: 1 } },
    { new: true }
  );
  if (!cancelled) return Booking.findById(booking._id);
  await BookedNight.deleteMany({ booking: booking._id });

  if (wasPaid && booking.checkIn.getTime() - Date.now() >= FULL_REFUND_NOTICE_MS) {
    return refundBooking(cancelled, cancelled.payment.paymentId);
  }
  return cancelled;
}

/** Nights (as YYYY-MM-DD) that can't be booked in [from, to): paid stays plus unexpired holds. */
async function bookedDays(listingId, from, to) {
  const rows = await BookedNight.find({
    listing: listingId,
    date: { $gte: from, $lt: to },
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  })
    .select("date")
    .lean();
  return rows.map((r) => r.date.toISOString().slice(0, 10)).sort();
}

module.exports = { createHold, confirmPayment, cancelBooking, bookedDays };
