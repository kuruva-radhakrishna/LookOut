process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";
process.env.CLOUDINARY_CLOUD_NAME = ""; // never talk to a real Cloudinary from tests
delete process.env.RAZORPAY_KEY_ID;

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod, app, User, Listing, Review, Booking, signToken, host, hostAuth, n = 0;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  app = require("../src/app");
  User = require("../src/models/User");
  Listing = require("../src/models/Listing");
  Review = require("../src/models/Review");
  Booking = require("../src/models/Booking");
  signToken = require("../src/middleware/auth").signToken;
  await Review.syncIndexes();
  host = await User.create({ username: "rev_host", email: "rh@t.dev", passwordHash: "x" });
  hostAuth = { Authorization: `Bearer ${signToken(host)}` };
});
after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

async function guest(name) {
  n++;
  const user = await User.create({ username: `${name}_${n}`, email: `${name}${n}@t.dev`, passwordHash: "x" });
  return { user, auth: { Authorization: `Bearer ${signToken(user)}` } };
}
const newListing = () => Listing.create({ title: `R${++n}`, cost: 1000, place: "Goa", country: "India", owner: host._id, maxGuests: 4 });
const uploadImage = async (g) => {
  const r = await request(app).post("/api/media").set(g.auth).attach("images", PNG, { filename: "p.png", contentType: "image/png" });
  assert.equal(r.status, 201);
  return r.body[0];
};
const post = (g, listing, body) => request(app).post(`/api/listings/${listing._id}/reviews`).set(g.auth).send(body);
const get = (listing, qs = "", g) => {
  const r = request(app).get(`/api/listings/${listing._id}/reviews${qs}`);
  return g ? r.set(g.auth) : r;
};
const reply = (g, reviewId, body) => request(app).post(`/api/reviews/${reviewId}/replies`).set(g.auth).send(body);

test("a top-level review updates the rating summary; one per guest, never your own listing, input validated", async () => {
  const l = await newListing();
  const a = await guest("a");
  const b = await guest("b");
  assert.equal((await post(a, l, { rating: 5, comment: "Loved it" })).status, 201);
  assert.equal((await post(b, l, { rating: 3, comment: "Okay" })).status, 201);

  const dup = await post(a, l, { rating: 1, comment: "again" });
  assert.equal(dup.status, 409);
  assert.equal((await post({ auth: hostAuth }, l, { rating: 5, comment: "mine" })).status, 400, "host can't review own place");
  assert.equal((await post(a, await newListing(), { rating: 6, comment: "x" })).status, 400, "rating out of range");
  assert.equal((await post(a, await newListing(), { rating: 4, comment: "  " })).status, 400, "empty comment");
  assert.equal((await request(app).post(`/api/listings/${l._id}/reviews`).send({ rating: 5, comment: "x" })).status, 401);

  const r = await get(l);
  assert.equal(r.body.summary.count, 2);
  assert.equal(r.body.summary.avg, 4);
  assert.deepEqual(r.body.summary.distribution, { 1: 0, 2: 0, 3: 1, 4: 0, 5: 1 });
  const stored = await Listing.findById(l._id);
  assert.equal(stored.ratingAvg, 4);
  assert.equal(stored.ratingCount, 2);
});

test("replies nest up to three levels, keep order, carry no rating and don't change the listing rating", async () => {
  const l = await newListing();
  const a = await guest("author");
  const b = await guest("replier");
  const top = (await post(a, l, { rating: 4, comment: "Nice place" })).body._id;

  const r1 = await reply({ auth: hostAuth }, top, { comment: "Thank you!" });
  assert.equal(r1.status, 201);
  const r2 = await reply(a, r1.body._id, { comment: "You're welcome" });
  const r3 = await reply(b, r2.body._id, { comment: "Same here" });
  assert.equal(r3.status, 201);
  const tooDeep = await reply(a, r3.body._id, { comment: "one more" });
  assert.equal(tooDeep.status, 400);
  assert.match(tooDeep.body.error, /three levels/);

  const tree = (await get(l)).body.items[0];
  assert.equal(tree.replies.length, 1);
  const lvl1 = tree.replies[0];
  assert.equal(lvl1.comment, "Thank you!");
  assert.equal(lvl1.isHost, true, "host replies are flagged");
  assert.equal(lvl1.rating, null);
  assert.equal(lvl1.depth, 1);
  assert.equal(lvl1.replies[0].comment, "You're welcome");
  assert.equal(lvl1.replies[0].replies[0].comment, "Same here");
  assert.equal(lvl1.replies[0].replies[0].depth, 3);

  const s = await get(l);
  assert.equal(s.body.summary.count, 1, "replies are not reviews");
  assert.equal((await Listing.findById(l._id)).ratingCount, 1);
  assert.equal((await reply(a, new mongoose.Types.ObjectId(), { comment: "x" })).status, 404);
});

test("reactions: like, switch to dislike, clear; never your own; counts only, no voter ids; personalised per viewer", async () => {
  const l = await newListing();
  const author = await guest("writer");
  const fan = await guest("fan");
  const other = await guest("other");
  const id = (await post(author, l, { rating: 5, comment: "Great" })).body._id;
  const react = (g, value) => request(app).post(`/api/reviews/${id}/reaction`).set(g.auth).send({ value });

  assert.deepEqual((await react(fan, "like")).body, { likes: 1, dislikes: 0, myReaction: "like" });
  assert.deepEqual((await react(fan, "like")).body, { likes: 1, dislikes: 0, myReaction: "like" }, "liking twice doesn't double count");
  assert.deepEqual((await react(other, "like")).body, { likes: 2, dislikes: 0, myReaction: "like" });
  assert.deepEqual((await react(fan, "dislike")).body, { likes: 1, dislikes: 1, myReaction: "dislike" }, "switching moves the vote");
  assert.deepEqual((await react(fan, "none")).body, { likes: 1, dislikes: 0, myReaction: null });
  assert.equal((await react(author, "like")).status, 400, "can't react to your own review");
  assert.equal((await react(fan, "love")).status, 400);
  assert.equal((await request(app).post(`/api/reviews/${id}/reaction`).send({ value: "like" })).status, 401);

  const asOther = (await get(l, "", other)).body.items[0];
  assert.equal(asOther.myReaction, "like");
  assert.equal(typeof asOther.likes, "number");
  const anon = (await get(l)).body.items[0];
  assert.equal(anon.myReaction, null);
  assert.ok(!JSON.stringify(anon).includes(String(other.user._id)), "voter ids are not exposed");
});

test("review photos must be ones we host, max four", async () => {
  const l = await newListing();
  const g = await guest("photographer");
  const pic = await uploadImage(g);
  const ok = await post(g, l, { rating: 5, comment: "Look!", images: [pic] });
  assert.equal(ok.status, 201);
  const got = (await get(l)).body.items[0];
  assert.equal(got.images.length, 1);
  assert.equal(new URL(got.images[0].url).pathname, new URL(pic.url).pathname);

  const g2 = await guest("sneaky");
  assert.equal((await post(g2, l, { rating: 5, comment: "x", images: [{ url: "https://evil.example.com/a.png" }] })).status, 400, "hot-linking elsewhere is refused");
  const g3 = await guest("many");
  const five = Array.from({ length: 5 }, () => pic);
  assert.equal((await post(g3, l, { rating: 5, comment: "x", images: five })).status, 400, "at most four photos");
  // replies may carry photos too
  assert.equal((await reply(g3, ok.body._id, { comment: "me too", images: [pic] })).status, 201);
});

test("deleting: only the author; a review takes its thread with it; a reply takes only its own subtree", async () => {
  const l = await newListing();
  const a = await guest("del_a");
  const b = await guest("del_b");
  const top = (await post(a, l, { rating: 2, comment: "meh" })).body._id;
  const r1 = (await reply(b, top, { comment: "level 1" })).body._id;
  const r2 = (await reply(a, r1, { comment: "level 2" })).body._id;
  await reply(b, top, { comment: "sibling" });

  assert.equal((await request(app).delete(`/api/reviews/${top}`).set(b.auth)).status, 403);
  assert.equal((await request(app).delete(`/api/reviews/${r1}`).set(a.auth)).status, 403, "author of the reply only");

  assert.equal((await request(app).delete(`/api/reviews/${r1}`).set(b.auth)).status, 200);
  assert.equal(await Review.countDocuments({ _id: { $in: [r1, r2] } }), 0, "reply and its child are gone");
  const tree = (await get(l)).body.items[0];
  assert.equal(tree.replies.length, 1);
  assert.equal(tree.replies[0].comment, "sibling");
  assert.equal((await Listing.findById(l._id)).ratingCount, 1, "deleting a reply leaves the rating alone");

  assert.equal((await request(app).delete(`/api/reviews/${top}`).set(a.auth)).status, 200);
  assert.equal(await Review.countDocuments({ listing: l._id }), 0, "the whole thread is removed");
  const stored = await Listing.findById(l._id);
  assert.equal(stored.ratingCount, 0);
  assert.equal(stored.ratingAvg, 0);
  assert.equal((await request(app).delete(`/api/reviews/${top}`).set(a.auth)).status, 404);
});

test("listing reviews: sorting, paging, helpful order, and reviews that predate threading still show up", async () => {
  const l = await newListing();
  const people = [];
  for (let i = 0; i < 7; i++) people.push(await guest("p"));
  const ratings = [5, 1, 4, 2, 5, 3, 4];
  for (const [i, g] of people.entries()) {
    await post(g, l, { rating: ratings[i], comment: `review ${i}` });
    await new Promise((r) => setTimeout(r, 5)); // distinct timestamps
  }
  // an old-style review: no depth/parent/likes fields at all (as written by the earlier seed)
  const legacyAuthor = await guest("legacy");
  await Review.collection.insertOne({ listing: l._id, author: legacyAuthor.user._id, rating: 3, comment: "legacy review", createdAt: new Date(Date.now() - 86400000), updatedAt: new Date() });

  const all = await get(l, "?limit=24");
  assert.equal(all.body.items.length, 8);
  assert.equal(all.body.total, 8);
  assert.ok(all.body.items.some((r) => r.comment === "legacy review" && r.likes === 0 && Array.isArray(r.replies)));

  const recent = (await get(l, "?sort=recent&limit=24")).body.items.map((r) => r.comment);
  assert.equal(recent[0], "review 6");
  assert.equal(recent.at(-1), "legacy review");
  const high = (await get(l, "?sort=high&limit=24")).body.items.map((r) => r.rating);
  assert.deepEqual(high, [...high].sort((x, y) => y - x));
  const low = (await get(l, "?sort=low&limit=24")).body.items.map((r) => r.rating);
  assert.deepEqual(low, [...low].sort((x, y) => x - y));

  // helpful: most liked first
  const target = (await get(l, "?limit=24")).body.items.find((r) => r.comment === "review 1");
  for (const g of people.slice(2, 5)) await request(app).post(`/api/reviews/${target._id}/reaction`).set(g.auth).send({ value: "like" });
  assert.equal((await get(l, "?sort=helpful&limit=24")).body.items[0].comment, "review 1");

  // paging
  const p1 = (await get(l, "?limit=3&offset=0&sort=recent")).body;
  const p2 = (await get(l, "?limit=3&offset=3&sort=recent")).body;
  assert.equal(p1.items.length, 3);
  assert.equal(p2.items.length, 3);
  assert.equal(p1.total, 8);
  assert.equal(new Set([...p1.items, ...p2.items].map((r) => r._id)).size, 6, "no overlap between pages");
  assert.equal((await get(l, "?limit=3&offset=6")).body.items.length, 2);
});

test("verified stay: only guests with a completed paid stay are flagged", async () => {
  const l = await newListing();
  const stayed = await guest("stayed");
  const never = await guest("never");
  await Booking.create({
    listing: l._id,
    guest: stayed.user._id,
    checkIn: new Date(Date.now() - 6 * 86400000),
    checkOut: new Date(Date.now() - 3 * 86400000),
    nights: 3,
    guests: 1,
    pricing: { subtotal: 300000, tax: 54000, total: 354000 },
    status: "confirmed",
  });
  await post(stayed, l, { rating: 5, comment: "stayed here" });
  await post(never, l, { rating: 5, comment: "just looking" });
  const items = (await get(l, "?limit=24")).body.items;
  assert.equal(items.find((r) => r.comment === "stayed here").verifiedStay, true);
  assert.equal(items.find((r) => r.comment === "just looking").verifiedStay, false);
});
