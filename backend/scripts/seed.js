// Usage: npm run seed              (adds ~500 sample listings across India, owned by demo hosts)
//        npm run seed -- --reset   (wipes listings, reviews and bookings first)
// Listings come from scripts/lib (places, prices, text) and scripts/seed-images.json (unique photos).
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const env = require("../src/config/env");
const User = require("../src/models/User");
const Listing = require("../src/models/Listing");
const Review = require("../src/models/Review");
const Booking = require("../src/models/Booking");
const BookedNight = require("../src/models/BookedNight");
const { buildPlan } = require("./lib/plan");
const { describe } = require("./lib/text");
const { seedUsersAndReviews } = require("./lib/reviews");

const HOSTS = ["demo_host", "aarav_stays", "meera_homes", "kabir_retreats", "isha_villas", "rohan_getaways", "tara_heritage", "vikram_lodges"];

function loadImages() {
  const file = path.join(__dirname, "seed-images.json");
  if (!fs.existsSync(file)) throw new Error("scripts/seed-images.json is missing. Run: node scripts/build-images.js");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

async function main() {
  const images = loadImages();
  const plan = buildPlan();
  const missing = plan.filter((s) => !images[s.id]);
  if (missing.length) throw new Error(`${missing.length} listings have no image (e.g. ${missing[0].id}). Re-run build-images.js`);

  await mongoose.connect(env.mongoUri);
  await BookedNight.syncIndexes();

  if (process.argv.includes("--reset")) {
    await Promise.all([Listing.deleteMany({}), Review.deleteMany({}), Booking.deleteMany({}), BookedNight.deleteMany({})]);
    console.log("Cleared listings, reviews and bookings");
  }

  const password = process.env.SEED_HOST_PASSWORD || "lookout-demo-1";
  const passwordHash = await bcrypt.hash(password, 10);
  const hosts = [];
  for (const username of HOSTS) {
    let host = await User.findOne({ username });
    if (!host) host = await User.create({ username, email: `${username}@lookout.demo`, passwordHash });
    hosts.push(host);
  }
  console.log(`Demo hosts: ${HOSTS.join(", ")}  (password: ${password})`);

  const owned = await Listing.countDocuments({ owner: { $in: hosts.map((h) => h._id) } });
  if (owned) throw new Error(`${owned} demo listings already exist. Re-run with --reset to replace them.`);

  const used = new Set();
  const docs = plan.map((slot, i) => ({ ...describe(slot, used), img: images[slot.id], owner: hosts[i % hosts.length]._id }));
  await Listing.insertMany(docs);
  console.log(`Seeded ${docs.length} listings in ${new Set(docs.map((d) => d.place)).size} places`);
  await seedUsersAndReviews({ password });
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
