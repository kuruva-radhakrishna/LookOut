// Runs the API against a throwaway in-memory MongoDB, seeded with sample listings.
// Handy when you have no MongoDB installed:  npm run dev:memory
const { execFileSync } = require("child_process");
const path = require("path");
const { MongoMemoryServer } = require("mongodb-memory-server");

(async () => {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri("lookout");
  execFileSync(process.execPath, [path.join(__dirname, "seed.js")], { stdio: "inherit", env: process.env });
  require("../src/server");
  const stop = () => mongod.stop().finally(() => process.exit(0));
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
})();
