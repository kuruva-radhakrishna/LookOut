const mongoose = require("mongoose");
const env = require("./config/env");
const app = require("./app");
const BookedNight = require("./models/BookedNight");

async function main() {
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 30000 });
  // The unique {listing,date} index is what prevents double bookings; make sure it exists before serving.
  await BookedNight.syncIndexes();
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
