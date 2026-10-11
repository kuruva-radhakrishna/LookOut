// Usage: npm run seed:reviews
// Creates ~120 demo guest users and reviews on the existing listings (run `npm run seed` first).
// Re-running replaces the previously seeded reviews with a fresh (identical, deterministic) set.
const mongoose = require("mongoose");
const env = require("../src/config/env");
const Listing = require("../src/models/Listing");
const { seedUsersAndReviews } = require("./lib/reviews");

(async () => {
  await mongoose.connect(env.mongoUri);
  if (!(await Listing.countDocuments())) throw new Error("No listings found. Run `npm run seed` first.");
  await seedUsersAndReviews();
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
