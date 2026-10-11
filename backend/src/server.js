const mongoose = require("mongoose");
const env = require("./config/env");
const app = require("./app");
const BookedNight = require("./models/BookedNight");
const Review = require("./models/Review");
const Favorite = require("./models/Favorite");

async function main() {
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 30000 });
  // The unique {listing,date} index is what prevents double bookings; make sure it exists before serving.
  await BookedNight.syncIndexes();
  // Reviews written before threading existed have no `depth`; mark them top-level (idempotent) before the
  // unique "one review per guest per listing" index is built.
  await Review.updateMany({ depth: { $exists: false } }, { $set: { depth: 0 } });
  await Promise.all([Review.syncIndexes(), Favorite.syncIndexes()]);
  const server = app.listen(env.port, () => {
    console.log(`LookOut API listening on :${env.port} (payments: ${require("./services/paymentService").mode})`);
  });
  const stop = () => server.close(() => mongoose.disconnect().then(() => process.exit(0)));
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

main().catch((err) => {
  console.error("Failed to start", err);
  process.exit(1);
});
