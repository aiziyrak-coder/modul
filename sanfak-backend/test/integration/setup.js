process.env.JWT_SECRET = process.env.JWT_SECRET || "integration_test_secret_key";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";
process.env.FILEPATH = process.env.FILEPATH || "./";

const os = require("os");
const path = require("path");

process.env.RESIDENCY_NOTICE_FILES_DIR =
  process.env.RESIDENCY_NOTICE_FILES_DIR || path.join(os.tmpdir(), "sanfak-it-residency-notices");

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}, 60000);

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({})),
  );
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongod) {
    await mongod.stop();
  }
}, 60000);
