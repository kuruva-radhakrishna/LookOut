process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";
process.env.CLOUDINARY_CLOUD_NAME = ""; // uploads go to MongoDB in tests
delete process.env.RAZORPAY_KEY_ID;

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod, app, User, Listing, Favorite, Media, signToken, n = 0;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const pic = (i) => ({ url: `https://upload.example.org/photo-${i}.jpg` });
const base = { title: "Gallery stay", cost: 2000, place: "Goa", country: "India", category: "beaches", maxGuests: 4 };

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  app = require("../src/app");
  User = require("../src/models/User");
  Listing = require("../src/models/Listing");
  Favorite = require("../src/models/Favorite");
  Media = require("../src/models/Media");
  signToken = require("../src/middleware/auth").signToken;
  await Favorite.syncIndexes();
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
const create = (g, body) => request(app).post("/api/listings").set(g.auth).send({ ...base, ...body });

test("uploads: images are stored and served publicly with cross-origin headers; fakes and strangers are refused", async () => {
  const g = await guest("uploader");
  const up = await request(app).post("/api/media").set(g.auth).attach("images", PNG, { filename: "a.png", contentType: "image/png" }).attach("images", PNG, { filename: "b.png", contentType: "image/png" });
  assert.equal(up.status, 201);
  assert.equal(up.body.length, 2);
  assert.notEqual(up.body[0].url, up.body[1].url);

  const path = new URL(up.body[0].url).pathname;
  const served = await request(app).get(path);
  assert.equal(served.status, 200);
  assert.equal(served.headers["content-type"], "image/png");
  assert.equal(served.headers["cross-origin-resource-policy"], "cross-origin", "the Vercel site must be allowed to show it");
  assert.match(served.headers["cache-control"], /immutable/);
  assert.deepEqual(Buffer.from(served.body), PNG);

  // a text file wearing an image mimetype is rejected by looking at the bytes
  const fake = await request(app).post("/api/media").set(g.auth).attach("images", Buffer.from("<script>alert(1)</script>"), { filename: "x.png", contentType: "image/png" });
  assert.equal(fake.status, 400);
  assert.equal((await request(app).post("/api/media").set(g.auth).attach("images", Buffer.from("hello"), { filename: "x.txt", contentType: "text/plain" })).status, 400);
  assert.equal((await request(app).post("/api/media").attach("images", PNG, { filename: "a.png", contentType: "image/png" })).status, 401);
  assert.equal((await request(app).post("/api/media").set(g.auth)).status, 400, "nothing attached");
  assert.equal((await request(app).get("/api/media/not-an-id")).status, 404);
  assert.equal((await request(app).get(`/api/media/${new mongoose.Types.ObjectId()}`)).status, 404);
  assert.equal(await Media.countDocuments({ owner: g.user._id }), 2);
});

test("behind a TLS-terminating proxy (Render) uploaded image links are https, so browsers on an https site will load them", async () => {
  const g = await guest("proxied");
  const up = await request(app)
    .post("/api/media")
    .set(g.auth)
    .set("X-Forwarded-Proto", "https")
    .set("X-Forwarded-Host", "lookout-api.onrender.com")
    .attach("images", PNG, { filename: "a.png", contentType: "image/png" });
  assert.equal(up.status, 201);
  assert.match(up.body[0].url, /^https:\/\/[^/]+\/api\/media\/[0-9a-f]{24}$/);
});

test("a single photo is automatically the primary one", async () => {
  const g = await guest("solo");
  const r = await create(g, { images: [pic(1)] });
  assert.equal(r.status, 201);
  assert.equal(r.body.images.length, 1);
  assert.equal(r.body.images[0].primary, true);
  assert.equal(r.body.img.url, pic(1).url);
});

test("several photos: the chosen primary becomes the card photo and is listed first", async () => {
  const g = await guest("multi");
  const r = await create(g, { images: [pic(1), pic(2), pic(3)], primary: 2 });
  assert.equal(r.status, 201);
  assert.equal(r.body.img.url, pic(3).url, "listing.img mirrors the primary photo");
  assert.equal(r.body.images[0].url, pic(3).url, "primary first");
  assert.deepEqual(r.body.images.map((i) => i.primary), [true, false, false]);
  assert.deepEqual(r.body.images.slice(1).map((i) => i.url), [pic(1).url, pic(2).url], "the rest keep their order");

  const detail = await request(app).get(`/api/listings/${r.body._id}`);
  assert.equal(detail.body.images.length, 3);
  const search = await request(app).get("/api/listings?q=Gallery");
  const found = search.body.items.find((l) => l._id === r.body._id);
  assert.equal(found.img.url, pic(3).url);
  assert.equal(found.images, undefined, "list results don't carry the whole gallery");
});

test("default primary is the first; a bad primary index falls back to the first; duplicates are dropped", async () => {
  const g = await guest("defaults");
  assert.equal((await create(g, { images: [pic(1), pic(2)] })).body.img.url, pic(1).url);
  const dup = await create(g, { images: [pic(1), pic(1), pic(2)], primary: 2 });
  assert.equal(dup.body.images.length, 2, "same photo twice is kept once");
  assert.equal(dup.body.img.url, pic(2).url, "primary still points at the photo that was chosen");
  assert.equal((await create(g, { images: [pic(1)], primary: 9 })).body.img.url, pic(1).url);
});

test("validation: at least one photo, at most ten, http(s) only", async () => {
  const g = await guest("rules");
  assert.equal((await create(g, {})).status, 400, "no photo");
  assert.equal((await create(g, { images: [] })).status, 400);
  assert.equal((await create(g, { images: Array.from({ length: 11 }, (_, i) => pic(i)) })).status, 400, "eleven is too many");
  assert.equal((await create(g, { images: Array.from({ length: 10 }, (_, i) => pic(i)) })).status, 201, "ten is fine");
  assert.equal((await create(g, { images: [{ url: "javascript:alert(1)" }] })).status, 400);
  assert.equal((await create(g, { images: [{ url: "data:image/png;base64,AAAA" }] })).status, 400);
  assert.equal((await create(g, { imageUrl: pic(7).url })).body.img.url, pic(7).url, "the older single-URL form still works");
});

test("editing: change the primary, add and remove photos, keep photographer credit, owner only", async () => {
  const g = await guest("editor");
  const other = await guest("intruder");
  const l = (await create(g, { images: [pic(1), pic(2)] })).body;
  // give the first photo attribution, as the seeded Wikimedia photos have
  await Listing.updateOne({ _id: l._id, "images.url": pic(1).url }, { $set: { "images.$.credit": "Ada Lovelace", "images.$.license": "CC BY 4.0", "images.$.source": "https://commons.example/1" } });

  const put = (user, body) => request(app).put(`/api/listings/${l._id}`).set(user.auth).send(body);
  const r1 = await put(g, { images: [pic(1), pic(2), pic(3)], primary: 1 });
  assert.equal(r1.status, 200);
  assert.equal(r1.body.img.url, pic(2).url);
  assert.equal(r1.body.images.find((i) => i.url === pic(1).url).credit, "Ada Lovelace", "attribution survives an edit");

  const r2 = await put(g, { images: [pic(3), pic(1)], primary: 0 });
  assert.deepEqual(r2.body.images.map((i) => i.url), [pic(3).url, pic(1).url]);
  assert.equal(r2.body.img.url, pic(3).url);

  const r3 = await put(g, { title: "Renamed" });
  assert.equal(r3.body.title, "Renamed");
  assert.equal(r3.body.images.length, 2, "editing other fields leaves the photos alone");

  assert.equal((await put(other, { images: [pic(9)] })).status, 403);
  assert.equal((await put(g, { images: [] })).status, 400, "can't remove every photo");
});

test("listings created before galleries (only `img`) still return a one-photo gallery", async () => {
  const g = await guest("legacy");
  const legacy = await Listing.create({ ...base, owner: g.user._id, img: { url: pic(5).url, filename: "old", credit: "Someone" } });
  const r = await request(app).get(`/api/listings/${legacy._id}`);
  assert.equal(r.body.images.length, 1);
  assert.equal(r.body.images[0].primary, true);
  assert.equal(r.body.images[0].credit, "Someone");
  // editing such a listing keeps the credit and upgrades it to a stored gallery
  const put = await request(app).put(`/api/listings/${legacy._id}`).set(g.auth).send({ images: [pic(5), pic(6)], primary: 0 });
  assert.equal(put.body.images.find((i) => i.url === pic(5).url).credit, "Someone");
});

test("favorites: save, unsave, idempotent, ids and list, per user, cleaned up when a listing is deleted", async () => {
  const owner = await guest("fav_owner");
  const a = await guest("fan_a");
  const b = await guest("fan_b");
  const l1 = (await create(owner, { images: [pic(1)], title: "Fav one" })).body;
  const l2 = (await create(owner, { images: [pic(2)], title: "Fav two" })).body;
  const put = (g, id) => request(app).put(`/api/favorites/${id}`).set(g.auth);

  assert.equal((await put(a, l1._id)).body.saved, true);
  assert.equal((await put(a, l1._id)).status, 200, "saving twice is fine");
  await put(a, l2._id);
  await put(b, l1._id);

  const ids = (await request(app).get("/api/favorites/ids").set(a.auth)).body;
  assert.deepEqual(new Set(ids), new Set([l1._id, l2._id]));
  assert.equal((await request(app).get("/api/favorites/ids").set(b.auth)).body.length, 1, "each user has their own list");

  const list = (await request(app).get("/api/favorites").set(a.auth)).body;
  assert.deepEqual(list.map((l) => l.title), ["Fav two", "Fav one"], "newest saved first");
  assert.equal(list[0].images, undefined);

  assert.equal((await request(app).delete(`/api/favorites/${l1._id}`).set(a.auth)).body.saved, false);
  assert.equal((await request(app).delete(`/api/favorites/${l1._id}`).set(a.auth)).status, 200, "removing twice is fine");
  assert.equal((await request(app).get("/api/favorites/ids").set(a.auth)).body.length, 1);

  assert.equal((await put(a, new mongoose.Types.ObjectId())).status, 404);
  assert.equal((await put(a, "nope")).status, 404);
  assert.equal((await request(app).get("/api/favorites")).status, 401);

  assert.equal((await request(app).delete(`/api/listings/${l1._id}`).set(owner.auth)).status, 200);
  assert.equal(await Favorite.countDocuments({ listing: l1._id }), 0, "deleting a listing removes it from everyone's saved list");
});
