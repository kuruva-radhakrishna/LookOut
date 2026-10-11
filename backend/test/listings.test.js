process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";
delete process.env.RAZORPAY_KEY_ID;

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod, app, User, Listing, Booking, BookedNight, signToken, host;
const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const get = (qs = "") => request(app).get(`/api/listings${qs}`);

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

  host = await User.create({ username: "host_search", email: "h@t.dev", passwordHash: "x" });
  const places = ["Goa", "Jaipur", "Manali", "Kochi"];
  const cats = ["beaches", "castles", "mountains", "rooms"];
  // 40 listings: cost 1000..40000 in steps of 1000, 10 per place, rating rises with index
  await Listing.insertMany(
    Array.from({ length: 40 }, (_, i) => ({
      title: `Stay ${i + 1} ${cats[i % 4]}`,
      description: i % 5 === 0 ? "has a lovely pool" : "simple stay",
      cost: (i + 1) * 1000,
      place: `${places[i % 4]}, India`,
      country: "India",
      category: cats[i % 4],
      maxGuests: 2 + (i % 6),
      owner: host._id,
      ratingAvg: i % 7 === 0 ? 0 : 3 + (i % 3) * 0.7,
      ratingCount: i % 7 === 0 ? 0 : i + 1,
      createdAt: new Date(Date.now() - (40 - i) * 86400000),
    }))
  );
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

test("paging: limit is a multiple of three, offset walks the whole set without gaps or repeats", async () => {
  const first = await get("?limit=12&offset=0&sort=price_asc");
  assert.equal(first.body.limit, 12);
  assert.equal(first.body.items.length, 12);
  assert.equal(first.body.total, 40);
  assert.equal(first.body.hasMore, true);

  const seen = [];
  for (let offset = 0; offset < 40; offset += 12) {
    const r = await get(`?limit=12&offset=${offset}&sort=price_asc`);
    seen.push(...r.body.items.map((l) => l.cost));
  }
  assert.equal(seen.length, 40);
  assert.deepEqual(seen, [...seen].sort((a, b) => a - b), "ordered across pages");
  assert.equal(new Set(seen).size, 40, "no duplicates across pages");

  const last = await get("?limit=12&offset=36&sort=price_asc");
  assert.equal(last.body.items.length, 4);
  assert.equal(last.body.hasMore, false);
  assert.equal(last.body.page, 4);
  assert.equal(last.body.pages, 4);
});

test("limit is snapped to a multiple of three and clamped", async () => {
  const cases = { 10: 9, 12: 12, 13: 12, 2: 3, 0: 12, 100: 48, abc: 12, "-6": 3 };
  for (const [sent, expected] of Object.entries(cases)) {
    const r = await get(`?limit=${sent}`);
    assert.equal(r.body.limit, expected, `limit=${sent} -> ${r.body.limit}, expected ${expected}`);
    assert.equal(r.body.limit % 3, 0);
  }
  assert.equal((await get("")).body.limit, 12, "default");
});

test("filters: category, price range, guests, rating combine", async () => {
  assert.ok((await get("?category=castles")).body.items.every((l) => l.category === "castles"));
  const priced = await get("?minPrice=5000&maxPrice=9000&limit=48");
  assert.ok(priced.body.items.length > 0 && priced.body.items.every((l) => l.cost >= 5000 && l.cost <= 9000));
  assert.equal(priced.body.total, 5);
  assert.ok((await get("?guests=6&limit=48")).body.items.every((l) => l.maxGuests >= 6));
  assert.ok((await get("?minRating=4&limit=48")).body.items.every((l) => l.ratingAvg >= 4));
  const combo = await get("?category=beaches&minPrice=10000&limit=48");
  assert.ok(combo.body.items.every((l) => l.category === "beaches" && l.cost >= 10000));
  assert.equal(combo.body.total, (await get("?category=beaches&limit=48")).body.items.filter((l) => l.cost >= 10000).length);
});

test("text search matches place and description, every word must match, regex input is safe", async () => {
  assert.ok((await get("?q=goa&limit=48")).body.items.every((l) => /goa/i.test(l.place)));
  const both = await get("?q=goa pool&limit=48");
  assert.ok(both.body.total > 0 && both.body.items.every((l) => /goa/i.test(l.place) && /pool/i.test(l.description)));
  const evil = await get("?q=.*(");
  assert.equal(evil.status, 200);
  assert.equal(evil.body.total, 0);
});

test("sorting", async () => {
  const asc = (await get("?sort=price_asc&limit=48")).body.items.map((l) => l.cost);
  const desc = (await get("?sort=price_desc&limit=48")).body.items.map((l) => l.cost);
  assert.deepEqual(asc, [...asc].sort((a, b) => a - b));
  assert.deepEqual(desc, [...desc].sort((a, b) => b - a));
  const rated = (await get("?sort=rating&limit=48")).body.items.map((l) => l.ratingAvg);
  assert.deepEqual(rated, [...rated].sort((a, b) => b - a));
  const newest = (await get("?sort=newest&limit=3")).body.items;
  assert.equal(newest[0].title, "Stay 40 rooms");
});

test("date filter hides listings with a booked or held night in the range, but not back-to-back stays", async () => {
  const all = (await get("?limit=48")).body.total;
  const target = await Listing.findOne({ title: "Stay 1 beaches" });
  const guest = await User.create({ username: "guest_search", email: "g@t.dev", passwordHash: "x" });
  const auth = { Authorization: `Bearer ${signToken(guest)}` };
  const hold = await request(app).post("/api/bookings").set(auth).send({ listingId: String(target._id), checkIn: day(20), checkOut: day(23), guests: 2 });
  assert.equal(hold.status, 201);

  const overlapping = await get(`?limit=48&checkIn=${day(22)}&checkOut=${day(25)}`);
  assert.equal(overlapping.body.total, all - 1, "held nights remove the listing");
  assert.ok(!overlapping.body.items.some((l) => String(l._id) === String(target._id)));

  const adjacent = await get(`?limit=48&checkIn=${day(23)}&checkOut=${day(25)}`);
  assert.equal(adjacent.body.total, all, "check-out day is free");

  // an expired hold no longer blocks
  await BookedNight.updateMany({ listing: target._id }, { expiresAt: new Date(Date.now() - 1000) });
  assert.equal((await get(`?limit=48&checkIn=${day(22)}&checkOut=${day(25)}`)).body.total, all);

  assert.equal((await get(`?checkIn=${day(5)}`)).status, 400, "needs both dates");
  assert.equal((await get(`?checkIn=${day(5)}&checkOut=${day(5)}`)).status, 400, "zero nights");
  assert.equal((await get(`?checkIn=${day(-3)}&checkOut=${day(2)}`)).status, 400, "past check-in");
  await Booking.deleteMany({});
});

test("place suggestions and facets", async () => {
  const all = await request(app).get("/api/listings/places");
  assert.equal(all.status, 200);
  assert.equal(all.body.length, 4);
  assert.ok(all.body.every((p) => p.count === 10));
  const some = await request(app).get("/api/listings/places?q=jai");
  assert.deepEqual(some.body.map((p) => p.place), ["Jaipur, India"]);

  const f = await request(app).get("/api/listings/facets");
  assert.deepEqual(f.body.price, { min: 1000, max: 40000 });
  assert.equal(f.body.categories.length, 4);
});

test("similar listings: excludes itself, ranks same place and category first, respects the limit", async () => {
  const goaBeach = await Listing.findOne({ title: "Stay 1 beaches" }); // Goa, beaches, ₹1,000
  const r = await request(app).get(`/api/listings/${goaBeach._id}/similar`);
  assert.equal(r.status, 200);
  assert.ok(r.body.length > 0 && r.body.length <= 12);
  assert.ok(!r.body.some((l) => String(l._id) === String(goaBeach._id)), "never includes the listing itself");
  assert.equal(new Set(r.body.map((l) => l._id)).size, r.body.length, "no duplicates");

  // seed data: Goa listings are every 4th (same place and category as this one), so they must come first
  const firstFive = r.body.slice(0, 5);
  assert.ok(firstFive.every((l) => l.place === goaBeach.place && l.category === goaBeach.category), "same place + same category first");

  const three = await request(app).get(`/api/listings/${goaBeach._id}/similar?limit=3`);
  assert.equal(three.body.length, 3);
  assert.equal((await request(app).get(`/api/listings/${goaBeach._id}/similar?limit=999`)).body.length <= 24, true);

  // a place with nothing else nearby still gets same-category suggestions
  const lonely = await Listing.create({ title: "Lone island hut", cost: 2000, place: "Nowhere, Atlantis", country: "India", category: "beaches", owner: host._id, maxGuests: 2 });
  const l = await request(app).get(`/api/listings/${lonely._id}/similar`);
  assert.ok(l.body.length > 0 && l.body.every((x) => x.category === "beaches"));

  assert.equal((await request(app).get("/api/listings/000000000000000000000000/similar")).status, 404);
  assert.equal((await request(app).get("/api/listings/not-an-id/similar")).status, 404);
});
