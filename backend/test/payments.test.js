process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";
process.env.MAX_PENDING_HOLDS = "100";
delete process.env.RAZORPAY_KEY_ID; // demo gateway

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod, app, User, Listing, Booking, BookedNight, signToken, host, n = 0;
const day = (o) => new Date(Date.now() + o * 86400000).toISOString().slice(0, 10);
const CARD = { number: "4111111111111111", expiry: "12/30", cvv: "123", name: "Test User" };

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  app = require("../src/app");
  User = require("../src/models/User");
  Listing = require("../src/models/Listing");
  Booking = require("../src/models/Booking");
  BookedNight = require("../src/models/BookedNight");
  signToken = require("../src/middleware/auth").signToken;
  await BookedNight.syncIndexes();
  host = await User.create({ username: "pay_host", email: "ph@t.dev", passwordHash: "x" });
});
after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

// every test gets its own guest, listing and held booking
async function setup() {
  n++;
  const guest = await User.create({ username: `payer_${n}`, email: `p${n}@t.dev`, passwordHash: "x" });
  const auth = { Authorization: `Bearer ${signToken(guest)}` };
  const listing = await Listing.create({ title: `L${n}`, cost: 1000, place: "Goa", country: "India", owner: host._id, maxGuests: 4 });
  const res = await request(app).post("/api/bookings").set(auth).send({ listingId: String(listing._id), checkIn: day(10), checkOut: day(12), guests: 2 });
  assert.equal(res.status, 201);
  const id = res.body.booking._id;
  const api = {
    start: (body) => request(app).post(`/api/bookings/${id}/payments`).set(auth).send(body),
    act: (attemptId, body) => request(app).post(`/api/bookings/${id}/payments/${attemptId}/action`).set(auth).send(body),
    cancel: (attemptId, by) => request(app).post(`/api/bookings/${id}/payments/${attemptId}/cancel`).set(auth).send(by ? { by } : {}),
    booking: () => Booking.findById(id),
    nights: () => BookedNight.countDocuments({ booking: id }),
  };
  return { id, auth, api, listing };
}
const card = (number, extra = {}) => ({ method: "card", card: { ...CARD, number, ...extra } });

test("the old one-click confirmation is gone: a booking cannot be paid without a successful attempt", async () => {
  const { id, auth, api } = await setup();
  const r = await request(app).post(`/api/bookings/${id}/verify`).set(auth).send({ demo: true });
  assert.equal(r.status, 400);
  assert.equal((await api.booking()).status, "pending");
});

test("card: instant-success test card confirms the booking and stores no card data", async () => {
  const { api } = await setup();
  const a = await api.start(card("4111 1111 1111 1111"));
  assert.equal(a.status, 201);
  assert.equal(a.body.status, "succeeded");
  assert.equal(a.body.label, "Visa •••• 1111");
  const b = await api.booking();
  assert.equal(b.status, "confirmed");
  assert.ok(b.payment.paidAt);
  const raw = JSON.stringify(b.toObject());
  assert.ok(!/4111\s?1111\s?1111\s?1111/.test(raw), "full card number is not stored");
  assert.ok(!/cvv/i.test(raw), "cvv is not stored");
});

test("card: declines leave the booking pending with the dates still held, and the user can retry", async () => {
  const { api } = await setup();
  const cases = {
    4000000000000002: /declined/i,
    4000000000009995: /insufficient/i,
    4000000000000069: /expired|blocked/i,
    4000000000000127: /cvv/i,
  };
  for (const [number, reason] of Object.entries(cases)) {
    const a = await api.start(card(number));
    assert.equal(a.body.status, "failed", number);
    assert.match(a.body.failureReason, reason);
    const b = await api.booking();
    assert.equal(b.status, "pending");
    assert.equal(await api.nights(), 2, "hold is kept after a failed payment");
  }
  assert.equal((await api.start(card("4111111111111111"))).body.status, "succeeded", "retry with a good card works");
});

test("card: invalid numbers and expired cards are rejected before any attempt is created", async () => {
  const { api } = await setup();
  assert.equal((await api.start(card("4111111111111112"))).status, 400, "fails the Luhn check");
  assert.equal((await api.start(card("4111111111111111", { expiry: "01/20" }))).status, 400, "expired card");
  assert.equal((await api.start(card("4111111111111111", { expiry: "13/30" }))).status, 400, "bad month");
  assert.equal((await api.booking()).payment.attempts.length, 0);
});

test("card OTP: wrong code is rejected, three wrong codes fail the attempt, correct code pays", async () => {
  const { api } = await setup();
  const a = await api.start(card("4000000000003220"));
  assert.equal(a.body.status, "awaiting_otp");
  const w1 = await api.act(a.body._id, { action: "otp", otp: "000000" });
  assert.equal(w1.status, 400);
  assert.match(w1.body.error, /2 attempts left/);
  const ok = await api.act(a.body._id, { action: "otp", otp: "123456" });
  assert.equal(ok.body.status, "succeeded");
  assert.equal((await api.booking()).status, "confirmed");

  const t = await setup();
  const b = await t.api.start(card("4242424242424242")); // any other valid card also needs an OTP
  assert.equal(b.body.status, "awaiting_otp");
  await t.api.act(b.body._id, { action: "otp", otp: "111111" });
  await t.api.act(b.body._id, { action: "otp", otp: "222222" });
  const third = await t.api.act(b.body._id, { action: "otp", otp: "333333" });
  assert.equal(third.body.status, "failed");
  assert.match(third.body.failureReason, /too many/i);
  assert.equal((await t.api.booking()).status, "pending");
  const after = await t.api.act(b.body._id, { action: "otp", otp: "123456" });
  assert.equal(after.status, 409, "a failed attempt cannot be revived");
});

test("UPI: approve pays, decline fails, a 'fail' id is declined, a 'timeout' id expires", async () => {
  const s1 = await setup();
  const a = await s1.api.start({ method: "upi", upi: { vpa: "ravi@okhdfcbank" } });
  assert.equal(a.body.status, "awaiting_approval");
  assert.equal((await s1.api.act(a.body._id, { action: "approve" })).body.status, "succeeded");

  const s2 = await setup();
  const b = await s2.api.start({ method: "upi", upi: { vpa: "ravi@oksbi" } });
  const d = await s2.api.act(b.body._id, { action: "decline" });
  assert.equal(d.body.status, "failed");
  assert.match(d.body.failureReason, /declined/i);

  const s3 = await setup();
  const c = await s3.api.start({ method: "upi", upi: { vpa: "willfail@ybl" } });
  const cr = await s3.api.act(c.body._id, { action: "approve" });
  assert.equal(cr.body.status, "failed");

  const s4 = await setup();
  const e = await s4.api.start({ method: "upi", upi: { vpa: "timeout@paytm" } });
  await Booking.updateOne({ _id: s4.id }, { $set: { "payment.attempts.0.expiresAt": new Date(Date.now() - 1000) } }); // time passes
  const late = await s4.api.act(e.body._id, { action: "approve" });
  assert.equal(late.status, 409, "approving after the request timed out is refused");
  assert.equal((await s4.api.booking()).payment.attempts[0].status, "expired");
  assert.equal((await s4.api.booking()).status, "pending");

  assert.equal((await s1.api.start({ method: "upi", upi: { vpa: "not a vpa" } })).status, 400);
});

test("net banking: bank page success pays, failure does not, a down bank fails immediately", async () => {
  const s1 = await setup();
  const a = await s1.api.start({ method: "netbanking", bank: "HDFC Bank" });
  assert.equal(a.body.status, "awaiting_bank");
  assert.equal((await s1.api.act(a.body._id, { action: "bank_success" })).body.status, "succeeded");

  const s2 = await setup();
  const b = await s2.api.start({ method: "netbanking", bank: "ICICI Bank" });
  assert.equal((await s2.api.act(b.body._id, { action: "bank_failure" })).body.status, "failed");
  assert.equal((await s2.api.booking()).status, "pending");

  const s3 = await setup();
  const c = await s3.api.start({ method: "netbanking", bank: "Punjab National Bank" });
  assert.equal(c.body.status, "failed");
  assert.match(c.body.failureReason, /not responding/i);

  assert.equal((await s3.api.start({ method: "netbanking", bank: "Bank of Nowhere" })).status, 400);
});

test("wallet: approve pays, an empty wallet fails, wrong action for the state is refused", async () => {
  const s1 = await setup();
  const a = await s1.api.start({ method: "wallet", wallet: "Paytm" });
  assert.equal((await s1.api.act(a.body._id, { action: "bank_success" })).status, 409, "a wallet isn't waiting on a bank page");
  assert.equal((await s1.api.act(a.body._id, { action: "approve" })).body.status, "succeeded");

  const s2 = await setup();
  const b = await s2.api.start({ method: "wallet", wallet: "MobiKwik" });
  const r = await s2.api.act(b.body._id, { action: "approve" });
  assert.equal(r.body.status, "failed");
  assert.match(r.body.failureReason, /balance/i);
});

test("cancelling: the user can cancel a payment and the hold stays; a page refresh abandons it", async () => {
  const { api, id } = await setup();
  const a = await api.start({ method: "upi", upi: { vpa: "ravi@oksbi" } });
  const c = await api.cancel(a.body._id);
  assert.equal(c.body.status, "cancelled");
  assert.equal((await api.booking()).status, "pending");
  assert.equal(await api.nights(), 2, "cancelling a payment keeps the reservation held");

  const b = await api.start({ method: "wallet", wallet: "PhonePe" });
  const r = await api.cancel(b.body._id, "refresh");
  assert.equal(r.body.status, "abandoned");
  assert.match(r.body.failureReason, /refreshed or closed/);

  // you cannot approve something that was cancelled
  assert.equal((await api.act(b.body._id, { action: "approve" })).status, 409);
  // and a finished attempt is unaffected by a late cancel
  const ok = await api.start(card("4111111111111111"));
  assert.equal((await api.cancel(ok.body._id, "refresh")).body.status, "succeeded");
  assert.equal((await Booking.findById(id)).status, "confirmed");
});

test("only one live attempt at a time, and a confirmed booking can't be paid again", async () => {
  const { api } = await setup();
  const first = await api.start({ method: "upi", upi: { vpa: "ravi@oksbi" } });
  const second = await api.start({ method: "netbanking", bank: "Axis Bank" });
  const attempts = (await api.booking()).payment.attempts;
  assert.equal(attempts[0].status, "cancelled", "starting a new method cancels the previous live attempt");
  assert.equal(attempts[1].status, "awaiting_bank");
  assert.equal((await api.act(first.body._id, { action: "approve" })).status, 409);
  await api.act(second.body._id, { action: "bank_success" });
  assert.equal((await api.start(card("4111111111111111"))).status, 409, "already paid");
});

test("too many failed attempts are blocked; an expired hold can't start a payment", async () => {
  const s = await setup();
  for (let i = 0; i < 5; i++) assert.equal((await s.api.start(card("4000000000000002"))).body.status, "failed");
  assert.equal((await s.api.start(card("4111111111111111"))).status, 429);

  const e = await setup();
  await Booking.updateOne({ _id: e.id }, { holdExpiresAt: new Date(Date.now() - 1000) });
  assert.equal((await e.api.start(card("4111111111111111"))).status, 410);
});

test("a guest cannot touch another guest's payment", async () => {
  const a = await setup();
  const attempt = await a.api.start({ method: "upi", upi: { vpa: "ravi@oksbi" } });
  const other = await User.create({ username: "intruder_1", email: "i@t.dev", passwordHash: "x" });
  const auth = { Authorization: `Bearer ${signToken(other)}` };
  const r = await request(app).post(`/api/bookings/${a.id}/payments/${attempt.body._id}/action`).set(auth).send({ action: "approve" });
  assert.equal(r.status, 404);
  assert.equal((await a.api.booking()).status, "pending");
});
