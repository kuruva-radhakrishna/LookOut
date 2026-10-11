process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";
process.env.BOOKING_HOLD_MINUTES = "10";
process.env.MAX_PENDING_HOLDS = "100";
delete process.env.RAZORPAY_KEY_ID; // force demo payment mode

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod, app, User, Listing, Booking, BookedNight, signToken;

const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

async function makeUser(name) {
  const user = await User.create({ username: name, email: `${name}@t.dev`, passwordHash: "x" });
  return { user, auth: { Authorization: `Bearer ${signToken(user)}` } };
}
async function makeListing(owner, extra = {}) {
  return Listing.create({ title: "Test stay", cost: 1000, place: "Goa", country: "India", owner: owner._id, maxGuests: 4, ...extra });
}
const book = (auth, listing, from, to, guests = 2) =>
  request(app).post("/api/bookings").set(auth).send({ listingId: String(listing._id), checkIn: day(from), checkOut: day(to), guests });
const pay = (auth, id) => request(app).post(`/api/bookings/${id}/verify`).set(auth).send({ demo: true });

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
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

test("25 guests racing for the same dates: exactly one wins", async () => {
  const { user: host } = await makeUser("host1");
  const listing = await makeListing(host);
  const guests = await Promise.all(Array.from({ length: 25 }, (_, i) => makeUser(`racer${i}`)));

  const results = await Promise.all(guests.map((g) => book(g.auth, listing, 10, 14)));
  const wins = results.filter((r) => r.status === 201);
  const losses = results.filter((r) => r.status === 409);

  assert.equal(wins.length, 1, `expected one winner, got ${wins.length}`);
  assert.equal(losses.length, 24);
  assert.equal(await BookedNight.countDocuments({ listing: listing._id }), 4, "exactly 4 nights held, no leftovers from losers");
  assert.equal(await Booking.countDocuments({ listing: listing._id }), 1, "losing attempts leave no booking rows behind");
});

test("overlapping ranges: one of two overlapping stays wins, an adjacent stay is unaffected", async () => {
  const { user: host } = await makeUser("host2");
  const listing = await makeListing(host);
  const [a, b, c] = await Promise.all(["guest_a", "guest_b", "guest_c"].map(makeUser));

  const [ra, rb, rc] = await Promise.all([
    book(a.auth, listing, 20, 24), // nights 20..23
    book(b.auth, listing, 22, 26), // nights 22..25 (overlaps a on 22,23)
    book(c.auth, listing, 24, 27), // nights 24..26 (overlaps b only)
  ]);
  const statuses = [ra.status, rb.status, rc.status];
  // a vs b conflict, b vs c conflict, a vs c are compatible. Valid outcomes: {a,c} or {b} (a and c never both lose).
  const okSet = statuses.map((s, i) => (s === 201 ? "abc"[i] : "")).join("");
  assert.ok(okSet === "ac" || okSet === "b", `unexpected winners: ${okSet} (${statuses})`);
  const held = await BookedNight.countDocuments({ listing: listing._id });
  assert.equal(held, okSet === "b" ? 4 : 7);
});

test("checkout day is free for the next guest (back-to-back stays)", async () => {
  const { user: host } = await makeUser("host3");
  const listing = await makeListing(host);
  const a = await makeUser("back1");
  const b = await makeUser("back2");
  assert.equal((await book(a.auth, listing, 30, 33)).status, 201);
  assert.equal((await book(b.auth, listing, 33, 35)).status, 201);
});

test("paying confirms the booking, blocks the dates in availability, and is idempotent", async () => {
  const { user: host } = await makeUser("host4");
  const listing = await makeListing(host);
  const guest = await makeUser("payer");
  const created = await book(guest.auth, listing, 40, 42);
  assert.equal(created.status, 201);
  assert.equal(created.body.booking.pricing.total, 2 * 1000 * 100 * 1.18);

  const id = created.body.booking._id;
  const first = await pay(guest.auth, id);
  const second = await pay(guest.auth, id);
  assert.equal(first.body.status, "confirmed");
  assert.equal(second.body.status, "confirmed");

  const avail = await request(app).get(`/api/listings/${listing._id}/availability`);
  assert.deepEqual(avail.body.booked, [day(40), day(41)]);

  // the nights no longer carry an expiry, so the TTL sweeper can never delete a paid booking
  assert.equal(await BookedNight.countDocuments({ booking: id, expiresAt: { $ne: null } }), 0);
});

test("an abandoned hold is reclaimed, and a late payment on it is refunded", async () => {
  const { user: host } = await makeUser("host5");
  const listing = await makeListing(host);
  const slow = await makeUser("slow");
  const quick = await makeUser("quick");

  const held = await book(slow.auth, listing, 50, 52);
  assert.equal(held.status, 201);
  assert.equal((await book(quick.auth, listing, 50, 52)).status, 409, "hold blocks others while valid");

  // simulate the 10 minute window passing (the TTL sweeper hasn't run yet)
  await BookedNight.updateMany({ listing: listing._id }, { expiresAt: new Date(Date.now() - 1000) });
  const taken = await book(quick.auth, listing, 50, 52);
  assert.equal(taken.status, 201, "expired hold must not block");
  assert.equal((await Booking.findById(held.body.booking._id)).status, "expired");

  await pay(quick.auth, taken.body.booking._id);
  const late = await pay(slow.auth, held.body.booking._id);
  assert.equal(late.status, 409);
  assert.match(late.body.error, /refunded/);
  const after = await Booking.findById(held.body.booking._id);
  assert.ok(after.payment.refundId, "late payer was refunded");
  assert.equal(await BookedNight.countDocuments({ listing: listing._id }), 2, "winner's nights untouched");
});

test("a late payment whose dates are still free re-claims them", async () => {
  const { user: host } = await makeUser("host6");
  const listing = await makeListing(host);
  const guest = await makeUser("late");
  const held = await book(guest.auth, listing, 60, 62);
  await BookedNight.deleteMany({ booking: held.body.booking._id }); // TTL sweeper already ran
  await Booking.findByIdAndUpdate(held.body.booking._id, { status: "expired" });
  const res = await pay(guest.auth, held.body.booking._id);
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "confirmed");
  assert.equal(await BookedNight.countDocuments({ listing: listing._id }), 2);
});

test("cancelling releases the dates and refunds a paid stay; double cancel is safe", async () => {
  const { user: host } = await makeUser("host7");
  const listing = await makeListing(host);
  const guest = await makeUser("canceller");
  const other = await makeUser("other");
  const created = await book(guest.auth, listing, 70, 73);
  const id = created.body.booking._id;
  await pay(guest.auth, id);

  const [c1, c2] = await Promise.all([
    request(app).post(`/api/bookings/${id}/cancel`).set(guest.auth),
    request(app).post(`/api/bookings/${id}/cancel`).set(guest.auth),
  ]);
  assert.equal(c1.status, 200);
  assert.equal(c2.status, 200);
  const doc = await Booking.findById(id);
  assert.equal(doc.status, "cancelled");
  assert.ok(doc.payment.refundId);
  assert.equal(await BookedNight.countDocuments({ listing: listing._id }), 0);
  assert.equal((await book(other.auth, listing, 70, 73)).status, 201, "dates are bookable again");
});

test("input validation and ownership rules", async () => {
  const { user: host, auth: hostAuth } = await makeUser("host8");
  const listing = await makeListing(host);
  const guest = await makeUser("val");
  assert.equal((await book(hostAuth, listing, 5, 7)).status, 400, "can't book own listing");
  assert.equal((await book(guest.auth, listing, -3, 2)).status, 400, "past check-in rejected");
  assert.equal((await book(guest.auth, listing, 8, 8)).status, 400, "zero nights rejected");
  assert.equal((await book(guest.auth, listing, 8, 60)).status, 400, "over 30 nights rejected");
  assert.equal((await book(guest.auth, listing, 8, 10, 9)).status, 400, "over capacity rejected");
  assert.equal((await request(app).post("/api/bookings").send({})).status, 401, "auth required");
  const stranger = await makeUser("stranger");
  const mine = await book(guest.auth, listing, 8, 10);
  assert.equal((await request(app).post(`/api/bookings/${mine.body.booking._id}/cancel`).set(stranger.auth)).status, 404);
});
