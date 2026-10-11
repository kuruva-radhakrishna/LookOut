// Usage: npm run seed            (adds sample listings owned by a demo host)
//        npm run seed -- --reset (wipes listings, reviews and bookings first)
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const env = require("../src/config/env");
const User = require("../src/models/User");
const Listing = require("../src/models/Listing");
const Review = require("../src/models/Review");
const Booking = require("../src/models/Booking");
const BookedNight = require("../src/models/BookedNight");
const { data } = require("./data");

async function main() {
  await mongoose.connect(env.mongoUri);
  await BookedNight.syncIndexes();

  if (process.argv.includes("--reset")) {
    await Promise.all([Listing.deleteMany({}), Review.deleteMany({}), Booking.deleteMany({}), BookedNight.deleteMany({})]);
    console.log("Cleared listings, reviews and bookings");
  }

  const password = process.env.SEED_HOST_PASSWORD || "lookout-demo-1";
  let host = await User.findOne({ username: "demo_host" });
  if (!host) {
    host = await User.create({
      username: "demo_host",
      email: "host@lookout.demo",
      passwordHash: await bcrypt.hash(password, 10),
    });
    console.log(`Created demo host  username: demo_host  password: ${password}`);
  }

  const docs = data.map((l) => ({ ...l, owner: host._id, maxGuests: 2 + (l.cost % 5), description: l.description }));
  await Listing.insertMany(docs);
  console.log(`Seeded ${docs.length} listings`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
