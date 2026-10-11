const Booking = require("../models/Booking");
const AppError = require("../utils/AppError");
const bookingService = require("./bookingService");

/**
 * A fake payment gateway for demo mode (no Razorpay keys). It behaves like a real one: you pick a method,
 * the attempt moves through realistic states (OTP, "approve on your phone", bank page), it can fail in
 * different ways, time out, or be cancelled, and the booking is only confirmed when an attempt succeeds.
 * The state machine lives here on the server so the browser cannot skip it. No money moves.
 *
 * Test inputs (also shown in the UI):
 *   Cards   4111 1111 1111 1111 / 5555 5555 5555 4444  succeed instantly
 *           4000 0000 0000 3220                        needs OTP (123456)
 *           4000 0000 0000 0002 declined | ...9995 insufficient funds | ...0069 expired | ...0127 wrong CVV
 *           any other valid (Luhn) number              needs OTP
 *   UPI     any id approves on the "phone"; an id containing "fail" is declined; containing "timeout" never answers
 *   Banks   approve/cancel on a simulated bank page; Punjab National Bank is "down"
 *   Wallets approve/decline on a simulated app; MobiKwik has no balance
 */
const BANKS = ["HDFC Bank", "State Bank of India", "ICICI Bank", "Axis Bank", "Kotak Mahindra Bank", "Punjab National Bank"];
const WALLETS = ["Paytm", "PhonePe", "Amazon Pay", "MobiKwik"];
const DEMO_OTP = "123456";
const MAX_OTP_TRIES = 3;
const MAX_FAILED_ATTEMPTS = 5;
const ACTIVE = ["awaiting_otp", "awaiting_approval", "awaiting_bank", "processing"];
const TTL = { otp: 5 * 60, upi: 120, upiTimeout: 20, bank: 5 * 60, wallet: 3 * 60 }; // seconds

const CARD_SCENARIOS = {
  4111111111111111: { kind: "success" },
  5555555555554444: { kind: "success" },
  5105105105105100: { kind: "success" },
  4000000000003220: { kind: "otp" },
  4000000000000002: { kind: "fail", reason: "Your card was declined by the bank." },
  4000000000009995: { kind: "fail", reason: "Insufficient funds in the account." },
  4000000000000069: { kind: "fail", reason: "This card has expired or been blocked by the bank." },
  4000000000000127: { kind: "fail", reason: "Incorrect CVV." },
};

const luhn = (n) => {
  let sum = 0;
  for (let i = 0; i < n.length; i++) {
    let d = Number(n[n.length - 1 - i]);
    if (i % 2) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
    sum += d;
  }
  return sum % 10 === 0;
};
const brandOf = (n) => (/^4/.test(n) ? "Visa" : /^(5[1-5]|2[2-7])/.test(n) ? "Mastercard" : /^(60|65|81|82|508)/.test(n) ? "RuPay" : /^3[47]/.test(n) ? "Amex" : "Card");

/** Validates the submitted details for a method and returns how this attempt will play out. */
function plan(method, input) {
  const after = (s) => new Date(Date.now() + s * 1000);
  if (method === "card") {
    const c = input.card;
    if (!c) throw new AppError(400, "Card details are required");
    const num = (c.number || "").replace(/\s/g, "");
    if (!/^\d{13,19}$/.test(num) || !luhn(num)) throw new AppError(400, "That card number isn't valid");
    const [mm, yy] = (c.expiry || "").split("/").map(Number);
    if (!(mm >= 1 && mm <= 12)) throw new AppError(400, "Enter a valid expiry month");
    const now = new Date();
    if (2000 + yy < now.getFullYear() || (2000 + yy === now.getFullYear() && mm < now.getMonth() + 1)) throw new AppError(400, "This card has expired");
    if (!c.cvv || !c.name) throw new AppError(400, "Enter the CVV and the name on the card");
    const label = `${brandOf(num)} •••• ${num.slice(-4)}`;
    const s = CARD_SCENARIOS[num] || { kind: "otp" };
    if (s.kind === "otp") return { label, scenario: "otp", status: "awaiting_otp", expiresAt: after(TTL.otp) };
    if (s.kind === "fail") return { label, scenario: "declined", status: "failed", failureReason: s.reason };
    return { label, scenario: "instant", status: "processing" };
  }
  if (method === "upi") {
    const vpa = input.upi?.vpa;
    if (!vpa) throw new AppError(400, "Enter a UPI ID");
    const lower = vpa.toLowerCase();
    if (lower.includes("fail")) return { label: `UPI ${vpa}`, scenario: "upi_declined", status: "awaiting_approval", expiresAt: after(TTL.upi) };
    return { label: `UPI ${vpa}`, scenario: lower.includes("timeout") ? "upi_timeout" : "upi", status: "awaiting_approval", expiresAt: after(lower.includes("timeout") ? TTL.upiTimeout : TTL.upi) };
  }
  if (method === "netbanking") {
    if (!BANKS.includes(input.bank)) throw new AppError(400, "Choose a bank");
    if (input.bank === "Punjab National Bank") return { label: input.bank, scenario: "bank_down", status: "failed", failureReason: "The bank's servers are not responding. Try another bank or method." };
    return { label: input.bank, scenario: "bank", status: "awaiting_bank", expiresAt: after(TTL.bank) };
  }
  if (method === "wallet") {
    if (!WALLETS.includes(input.wallet)) throw new AppError(400, "Choose a wallet");
    return { label: input.wallet, scenario: input.wallet === "MobiKwik" ? "wallet_empty" : "wallet", status: "awaiting_approval", expiresAt: after(TTL.wallet) };
  }
  throw new AppError(400, "Unsupported payment method");
}

const publicAttempt = (b, id) => b.payment.attempts.id(id);

/** Atomically moves one attempt between states; resolves false if someone else changed it first. */
async function transition(bookingId, attemptId, from, patch) {
  const set = Object.fromEntries(Object.entries(patch).map(([k, v]) => [`payment.attempts.$[a].${k}`, v]));
  const r = await Booking.updateOne({ _id: bookingId }, { $set: set }, { arrayFilters: [{ "a._id": attemptId, "a.status": { $in: from } }] });
  return r.modifiedCount === 1;
}

async function load(bookingId, guestId, attemptId) {
  const booking = await Booking.findOne({ _id: bookingId, guest: guestId });
  if (!booking) throw new AppError(404, "Booking not found");
  const attempt = attemptId ? booking.payment.attempts.id(attemptId) : null;
  if (attemptId && !attempt) throw new AppError(404, "Payment attempt not found");
  // a request nobody answered in time simply expires
  if (attempt && ACTIVE.includes(attempt.status) && attempt.expiresAt && attempt.expiresAt < new Date()) {
    await transition(booking._id, attempt._id, ACTIVE, { status: "expired", failureReason: "The payment request timed out. Please try again." });
    return load(bookingId, guestId, attemptId);
  }
  return { booking, attempt };
}

/** The attempt reached "paid": confirm the booking (re-claims the dates if the hold just lapsed, refunds if taken). */
async function succeed(booking, attempt) {
  const paymentId = `demo_pay_${attempt._id}`;
  if (!(await transition(booking._id, attempt._id, ACTIVE, { status: "processing" })) && attempt.status !== "processing") return;
  try {
    await bookingService.confirmPayment(booking._id, paymentId);
    await transition(booking._id, attempt._id, ["processing"], { status: "succeeded", paymentId });
  } catch (err) {
    if (!err.status) throw err;
    await transition(booking._id, attempt._id, ["processing"], { status: "failed", failureReason: err.message });
  }
}

const fail = (booking, attempt, reason) => transition(booking._id, attempt._id, ACTIVE, { status: "failed", failureReason: reason });

async function start(bookingId, guestId, input) {
  const booking = await Booking.findOne({ _id: bookingId, guest: guestId });
  if (!booking) throw new AppError(404, "Booking not found");
  if (booking.status === "confirmed") throw new AppError(409, "This booking is already paid");
  if (booking.status !== "pending" || booking.holdExpiresAt < new Date()) throw new AppError(410, "Your hold on these dates has expired. Please start again.");
  const failed = (booking.payment.attempts || []).filter((a) => ["failed", "expired"].includes(a.status)).length;
  if (failed >= MAX_FAILED_ATTEMPTS) throw new AppError(429, "Too many failed payment attempts. Cancel this reservation and try again.");

  const p = plan(input.method, input); // throws 400 on bad details, before anything is changed

  // only one live attempt at a time: starting a new one cancels the old
  if (booking.payment.attempts?.some((a) => ACTIVE.includes(a.status))) {
    await Booking.updateOne(
      { _id: booking._id },
      { $set: { "payment.attempts.$[a].status": "cancelled", "payment.attempts.$[a].cancelledBy": "user" } },
      { arrayFilters: [{ "a.status": { $in: ACTIVE } }] }
    );
  }
  await Booking.updateOne({ _id: booking._id }, { $push: { "payment.attempts": { method: input.method, ...p } } });

  const fresh = await Booking.findById(booking._id);
  const attempt = fresh.payment.attempts[fresh.payment.attempts.length - 1];
  if (attempt.scenario === "instant") await succeed(fresh, attempt);
  return (await Booking.findById(booking._id)).payment.attempts.id(attempt._id);
}

async function act(bookingId, guestId, attemptId, { action, otp }) {
  const { booking, attempt } = await load(bookingId, guestId, attemptId);
  const done = () => Booking.findById(booking._id).then((b) => b.payment.attempts.id(attemptId));
  const need = (...statuses) => {
    if (!statuses.includes(attempt.status)) throw new AppError(409, `This payment is no longer waiting (${attempt.status}).`);
  };

  if (action === "otp") {
    need("awaiting_otp");
    if (otp === DEMO_OTP) await succeed(booking, attempt);
    else {
      const tries = attempt.otpTries + 1;
      if (tries >= MAX_OTP_TRIES) await transition(booking._id, attempt._id, ["awaiting_otp"], { status: "failed", otpTries: tries, failureReason: "Too many incorrect OTP attempts." });
      else {
        await transition(booking._id, attempt._id, ["awaiting_otp"], { otpTries: tries });
        throw new AppError(400, `Incorrect OTP. ${MAX_OTP_TRIES - tries} attempt${MAX_OTP_TRIES - tries === 1 ? "" : "s"} left.`);
      }
    }
  } else if (action === "resend_otp") {
    need("awaiting_otp");
    await transition(booking._id, attempt._id, ["awaiting_otp"], { expiresAt: new Date(Date.now() + TTL.otp * 1000), otpTries: 0 });
  } else if (action === "approve") {
    need("awaiting_approval");
    if (attempt.scenario === "upi_declined") await fail(booking, attempt, "The UPI request was declined in your app.");
    else if (attempt.scenario === "wallet_empty") await fail(booking, attempt, "Insufficient balance in your wallet.");
    else await succeed(booking, attempt);
  } else if (action === "decline") {
    need("awaiting_approval");
    await fail(booking, attempt, "You declined the payment request.");
  } else if (action === "bank_success") {
    need("awaiting_bank");
    await succeed(booking, attempt);
  } else if (action === "bank_failure") {
    need("awaiting_bank");
    await fail(booking, attempt, "The transaction was not authorised by your bank.");
  } else {
    throw new AppError(400, "Unknown action");
  }
  return done();
}

/** The guest closed the payment window, or refreshed the page mid-payment. The reservation (and its hold) stays. */
async function cancel(bookingId, guestId, attemptId, by = "user") {
  const { booking, attempt } = await load(bookingId, guestId, attemptId);
  if (!ACTIVE.includes(attempt.status)) return attempt;
  await transition(booking._id, attempt._id, ACTIVE, {
    status: by === "refresh" ? "abandoned" : "cancelled",
    cancelledBy: by,
    failureReason: by === "refresh" ? "The payment was interrupted because the page was refreshed or closed." : "You cancelled the payment.",
  });
  return publicAttempt(await Booking.findById(booking._id), attemptId);
}

module.exports = { start, act, cancel, BANKS, WALLETS, DEMO_OTP, ACTIVE };
